import * as T from "three";
import { mergeStaticMeshes } from "./batching.js";
// Building-specific details are placed on the same OSM faces as their parent towers.
export function addLandmarkDetails(scene, data) {
  const steel = new T.MeshStandardMaterial({
      color: 0xbcc5c8,
      roughness: 0.34,
      metalness: 0.65,
      envMapIntensity: 5,
    }),
    parts = [];
  function beam(a, b, r = 0.28) {
    const d = new T.Vector3().subVectors(b, a),
      mesh = new T.Mesh(new T.CylinderGeometry(r, r, d.length(), 6), steel);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    mesh.updateMatrixWorld();
    parts.push(mesh);
  }
  function sign(index, text, colour) {
    const [h, raw] = data.buildings[index],
      p = raw.slice(0, -1);
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = colour;
    ctx.font = text === "HSBC" ? "bold 176px Georgia" : "bold 190px Arial";
    ctx.textAlign = "center";
    ctx.fillText(text, text === "HSBC" ? 395 : 512, 195);
    if (text === "HSBC") {
      ctx.fillStyle = "#d61730";
      for (const tri of [
        [
          [760, 40],
          [820, 110],
          [760, 180],
        ],
        [
          [880, 40],
          [820, 110],
          [880, 180],
        ],
        [
          [760, 40],
          [880, 40],
          [820, 110],
        ],
        [
          [760, 180],
          [880, 180],
          [820, 110],
        ],
      ]) {
        ctx.beginPath();
        tri.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.fill();
      }
    }
    if (text === "citi") {
      ctx.strokeStyle = "#df1734";
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(520, 86, 94, Math.PI, 0);
      ctx.stroke();
    }
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = 8;
    const material = new T.MeshStandardMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      roughness: 0.6,
      side: T.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const cx = p.reduce((s, v) => s + v[0], 0) / p.length,
      cz = p.reduce((s, v) => s + v[1], 0) / p.length;
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz);
      if (len < 35) continue;
      const mx = (a[0] + b[0]) / 2,
        mz = (a[1] + b[1]) / 2;
      let nx = dz / len,
        nz = -dx / len;
      if (nx * (mx - cx) + nz * (mz - cz) < 0) {
        nx = -nx;
        nz = -nz;
      }
      const label = new T.Mesh(
        new T.PlaneGeometry(Math.min(len * 0.65, 36), 9),
        material,
      );
      label.position.set(mx + nx * 0.35, h - 9, mz + nz * 0.35);
      label.rotation.y = Math.atan2(nx, nz);
      scene.add(label);
    }
  }
  sign(11, "HSBC", "#152b3e");
  sign(797, "citi", "#d7e1e5");
  // Newfoundland's structural diamond lattice, a distinctive west-approach landmark.
  const [h, raw] = data.buildings[4525],
    p = raw.slice(0, -1);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 10) continue;
    const bays = Math.max(1, Math.round(len / 15));
    for (let bay = 0; bay < bays; bay++)
      for (let y = 5; y < h - 5; y += 26) {
        const u = bay / bays,
          v = (bay + 1) / bays,
          top = Math.min(h, y + 26);
        const point = (u, y) =>
          new T.Vector3(a[0] + (b[0] - a[0]) * u, y, a[1] + (b[1] - a[1]) * u);
        beam(point(u, y), point(v, top));
        beam(point(v, y), point(u, top));
      }
  }
  scene.add(mergeStaticMeshes(parts));
}
