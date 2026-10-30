const ANGLE = (2.8 * Math.PI) / 180,
  CS = Math.cos(ANGLE),
  SN = Math.sin(ANGLE);
const en = (x, z) => [z * CS + x * SN, x * CS - z * SN];
const world = (e, n) => ({ x: n * CS + e * SN, z: e * CS - n * SN });
export function initCustomStart({
  buildings,
  roads,
  water,
  parks,
  getRunway,
  onStart,
  validate,
}) {
  const dialog = document.getElementById("custom-start"),
    canvas = document.getElementById("start-map"),
    ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);
  let paths = null,
    zoom = 1,
    centre = [-3500, 0],
    pin = en(-650, -6500),
    bearing = 93,
    scheduled = false,
    drag = null;
  const threshold = () => en(0, $("start-runway").value === "09" ? -1508 : 0);
  function makePath(rings) {
    const path = new Path2D();
    for (const ring of rings) {
      ring.forEach(([x, z], i) => {
        const [e, n] = en(x, z);
        if (i) path.lineTo(e, n);
        else path.moveTo(e, n);
      });
      path.closePath();
    }
    return path;
  }
  function prepare() {
    if (paths) return;
    paths = {
      water: makePath(water.flatMap((p) => [p.outer, ...p.holes])),
      parks: makePath(parks.map((p) => p.outer)),
      buildings: [0, 1, 2].map(() => new Path2D()),
      roads: new Path2D(),
    };
    for (const [h, p] of buildings) {
      const path = paths.buildings[h > 60 ? 2 : h > 15 ? 1 : 0];
      p.forEach(([x, z], i) => {
        const [e, n] = en(x, z);
        if (i) path.lineTo(e, n);
        else path.moveTo(e, n);
      });
      path.closePath();
    }
    for (const [, p] of roads)
      p.forEach(([x, z], i) => {
        const [e, n] = en(x, z);
        if (i) paths.roads.lineTo(e, n);
        else paths.roads.moveTo(e, n);
      });
  }
  function metrics() {
    const rect = canvas.getBoundingClientRect();
    return { w: rect.width, h: rect.height, s: (rect.width / 21000) * zoom };
  }
  function screen(p) {
    const { w, h, s } = metrics();
    return [w / 2 + (p[0] - centre[0]) * s, h / 2 - (p[1] - centre[1]) * s];
  }
  function local(event) {
    const r = canvas.getBoundingClientRect();
    return [event.clientX - r.left, event.clientY - r.top];
  }
  function mapPoint(p) {
    const { w, h, s } = metrics();
    return [centre[0] + (p[0] - w / 2) / s, centre[1] - (p[1] - h / 2) / s];
  }
  function config() {
    return {
      ...world(...pin),
      bearing,
      altitudeFt: Number($("start-altitude").value),
      runway: $("start-runway").value,
    };
  }
  function update() {
    const c = config(),
      p = { x: c.x, y: c.altitudeFt * 0.3048, z: c.z },
      hit = validate(p);
    $("start-bearing-value").textContent =
      String(Math.round(bearing)).padStart(3, "0") + "°";
    $("start-bearing").value = Math.round(bearing);
    const t = threshold();
    $("start-distance").textContent =
      (Math.hypot(pin[0] - t[0], pin[1] - t[1]) / 1852).toFixed(1) +
      " NM to runway " +
      c.runway;
    $("start-coordinates").textContent =
      (51.50494 + pin[1] / 111320).toFixed(4) +
      "° N · " +
      (
        0.06602 +
        pin[0] / (111320 * Math.cos((51.505 * Math.PI) / 180))
      ).toFixed(4) +
      "° E";
    const invalid =
      !Number.isFinite(c.altitudeFt) ||
      c.altitudeFt < 300 ||
      c.altitudeFt > 6000;
    $("start-warning").textContent = hit
      ? hit.reason || "Above buildings here: choose at least " +
        Math.ceil((hit.h + 30) / 0.3048 / 100) * 100 +
        " ft."
      : invalid
        ? "Choose an altitude between 300 and 6,000 feet."
        : "";
    $("launch-custom").disabled = !!hit || invalid;
    drawSoon();
  }
  function aim() {
    const t = threshold();
    bearing =
      ((Math.atan2(t[0] - pin[0], t[1] - pin[1]) * 180) / Math.PI + 360) % 360;
    update();
  }
  function label(text, x, z) {
    const p = screen(en(x, z));
    ctx.font = "600 10px Arial";
    ctx.textAlign = "center";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#11212b";
    ctx.strokeText(text, p[0], p[1]);
    ctx.fillStyle = "#b8c7cf";
    ctx.fillText(text, p[0], p[1]);
  }
  function drawSoon() {
    if (scheduled || !dialog.open) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      draw();
    });
  }
  function draw() {
    if (!paths || !dialog.open) return;
    const { w, h, s } = metrics(),
      dpr = Math.min(devicePixelRatio, 2);
    if (
      canvas.width !== Math.round(w * dpr) ||
      canvas.height !== Math.round(h * dpr)
    ) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#13242d";
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2 - centre[0] * s, h / 2 + centre[1] * s);
    ctx.scale(s, -s);
    ctx.fillStyle = "#203b35";
    ctx.fill(paths.parks);
    ctx.fillStyle = "#244755";
    ctx.fill(paths.water, "evenodd");
    ctx.strokeStyle = "#47606a";
    ctx.lineWidth = 8;
    ctx.stroke(paths.roads);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = ["#2c3c45", "#3a4d58", "#687b85"][i];
      ctx.fill(paths.buildings[i]);
    }
    const a = en(0, 0),
      b = en(0, -1508);
    ctx.strokeStyle = "#efe1c4";
    ctx.lineWidth = 38;
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.stroke();
    ctx.restore();
    if (w > 500 || zoom > 1.5) label("CANARY WHARF", -290, -5920);
    label("THE O2", -428, -4337);
    label("LONDON CITY", 220, -754);
    if (w > 500 || zoom > 1.5) label("ROYAL DOCKS", 650, -1700);
    const p = screen(pin),
      t = screen(threshold());
    ctx.strokeStyle = "#efc39366";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(...p);
    ctx.lineTo(...t);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#efc393";
    ctx.beginPath();
    ctx.arc(...t, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(...p);
    ctx.rotate((bearing * Math.PI) / 180);
    ctx.fillStyle = "#efc393";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (const [i, [x, y]] of [
      [0, -17],
      [3, -4],
      [16, 4],
      [16, 7],
      [3, 3],
      [2, 12],
      [7, 16],
      [7, 18],
      [0, 15],
      [-7, 18],
      [-7, 16],
      [-2, 12],
      [-3, 3],
      [-16, 7],
      [-16, 4],
      [-3, -4],
    ].entries()) {
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.font = "600 11px Arial";
    ctx.fillStyle = "#c7d3da";
    ctx.textAlign = "left";
    ctx.fillText("N ↑", 18, 26);
    const kmPixels = 1000 * s;
    ctx.strokeStyle = "#8dabb9";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, h - 20);
    ctx.lineTo(20 + kmPixels, h - 20);
    ctx.stroke();
    ctx.font = "10px Arial";
    ctx.fillText("1 km", 20, h - 28);
  }
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    drag = { start: local(e), centre: [...centre], moved: false };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = local(e),
      dx = p[0] - drag.start[0],
      dy = p[1] - drag.start[1];
    if (Math.hypot(dx, dy) > 5) drag.moved = true;
    if (drag.moved) {
      const { s } = metrics();
      centre = [drag.centre[0] - dx / s, drag.centre[1] + dy / s];
      drawSoon();
    }
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!drag) return;
    if (!drag.moved) {
      pin = mapPoint(local(e));
      aim();
    }
    drag = null;
  });
  canvas.addEventListener("pointercancel", () => (drag = null));
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoom = Math.max(0.65, Math.min(8, zoom * Math.exp(-e.deltaY * 0.001)));
      drawSoon();
    },
    { passive: false },
  );
  canvas.addEventListener("keydown", (e) => {
    const movement = {
      ArrowUp: [0, 250],
      ArrowDown: [0, -250],
      ArrowLeft: [-250, 0],
      ArrowRight: [250, 0],
    }[e.key];
    if (movement) {
      e.preventDefault();
      pin = [pin[0] + movement[0], pin[1] + movement[1]];
      aim();
    }
  });
  dialog.addEventListener("keydown", (e) => e.stopPropagation());
  $("start-bearing").oninput = (e) => {
    bearing = Number(e.target.value);
    update();
  };
  $("start-altitude").oninput = update;
  $("start-runway").onchange = aim;
  $("aim-runway").onclick = aim;
  $("map-zoom-in").onclick = () => {
    zoom = Math.min(8, zoom * 1.5);
    drawSoon();
  };
  $("map-zoom-out").onclick = () => {
    zoom = Math.max(0.65, zoom / 1.5);
    drawSoon();
  };
  $("map-reset").onclick = () => {
    centre = [-3500, 0];
    zoom = 1;
    drawSoon();
  };
  $("close-custom").onclick = () => dialog.close();
  $("launch-custom").onclick = () => {
    update();
    if ($("launch-custom").disabled) return;
    const c = config();
    dialog.close();
    onStart(c);
  };
  new ResizeObserver(drawSoon).observe(canvas);
  return {
    open() {
      prepare();
      $("start-runway").value = getRunway();
      dialog.showModal();
      aim();
      canvas.focus();
    },
  };
}
