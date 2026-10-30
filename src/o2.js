import * as T from "three";
import { mergeStaticMeshes } from "./batching.js";

// Millennium Dome: 365 m canopy, 52 m apex and twelve 100 m lattice masts.
// Dimensions: RSHP project description. Details studied from Wikimedia aerial photographs.
// This is an architectural approximation, not a survey or an engineering model.
export function buildO2(scene, origin, services) {
  const pieces = [];
  const metal = new T.MeshStandardMaterial({
    color: 0xd49d28,
    roughness: 0.46,
    metalness: 0.45,
  });
  const cable = new T.MeshStandardMaterial({
    color: 0x889396,
    roughness: 0.55,
    metalness: 0.65,
  });
  const silver = new T.MeshStandardMaterial({
    color: 0x9da8ac,
    roughness: 0.4,
    metalness: 0.65,
  });
  const dark = new T.MeshStandardMaterial({
    color: 0x26333a,
    roughness: 0.65,
    metalness: 0.25,
  });
  const glass = new T.MeshStandardMaterial({
    color: 0x32515a,
    roughness: 0.26,
    metalness: 0.5,
    envMapIntensity: 6,
  });
  const stone = new T.MeshStandardMaterial({
    color: 0x8f8a7d,
    roughness: 0.95,
  });
  const roof = new T.MeshStandardMaterial({
    color: 0xf1f0e8,
    roughness: 0.79,
    side: T.DoubleSide,
  });
  roof.onBeforeCompile = (s) => {
    s.vertexShader = "varying vec3 vCanopy;\n" + s.vertexShader;
    s.vertexShader = s.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvCanopy=position;",
    );
    s.fragmentShader = "varying vec3 vCanopy;\n" + s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      float radius=length(vCanopy.xz);
      float angle=atan(vCanopy.z,vCanopy.x);
      float panel=angle*96./6.2831853;
      float fw=max(fwidth(panel),.0001);
      float seam=(1.-smoothstep(.006,.006+fw,abs(fract(panel+.5)-.5)))*min(1.,.04/fw);
      float ring=radius/12.;
      float rw=max(fwidth(ring),.0001);
      float join=(1.-smoothstep(.003,.003+rw,abs(fract(ring+.5)-.5)))*min(1.,.025/rw);
      float panelShade=.975+.025*cos(angle*96.);
      float edgeWeather=smoothstep(152.,183.,radius)*.065;
      diffuseColor.rgb*=panelShade-seam*.19-join*.06-edgeWeather;
    `,
    );
  };
  function mesh(g, m, pos = [0, 0, 0]) {
    const obj = new T.Mesh(g, m);
    obj.position.fromArray(pos);
    pieces.push(obj);
    return obj;
  }
  function beam(a, b, r, m = cable, rTop = r) {
    const av = new T.Vector3(...a),
      bv = new T.Vector3(...b),
      delta = bv.clone().sub(av);
    const o = mesh(
      new T.CylinderGeometry(rTop, r, delta.length(), 6),
      m,
      av.add(bv).multiplyScalar(0.5).toArray(),
    );
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    return o;
  }
  function box(p, size, m, angle = 0) {
    const o = mesh(new T.BoxGeometry(...size), m, p);
    o.rotation.y = angle;
    return o;
  }
  const radius = 182.5;
  const roofHeight = (r, a) =>
    52 -
    42 * Math.pow(r / radius, 1.7) +
    Math.pow(r / radius, 12) * 3.2 * (1 - Math.cos(a * 24));
  const point = (r, a, lift = 0) => [
    Math.cos(a) * r,
    roofHeight(r, a) + lift,
    Math.sin(a) * r,
  ];
  const positions = [],
    uv = [],
    indices = [];
  const steps = 192,
    rings = 48;
  for (let j = 0; j <= rings; j++)
    for (let i = 0; i <= steps; i++) {
      const r = (j / rings) * radius,
        a = (i / steps) * Math.PI * 2;
      positions.push(...point(r, a));
      uv.push(i / steps, j / rings);
      if (j < rings && i < steps) {
        const k = j * (steps + 1) + i;
        indices.push(
          k,
          k + steps + 1,
          k + 1,
          k + 1,
          k + steps + 1,
          k + steps + 2,
        );
      }
    }
  const geom = new T.BufferGeometry();
  geom.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  mesh(geom, roof);
  // Recessed glazed perimeter, structural piers and scalloped fabric eaves.
  mesh(new T.CylinderGeometry(178, 178, 8.4, 192, 1, true), glass, [0, 5, 0]);
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    beam(
      [Math.cos(a) * 178, 1, Math.sin(a) * 178],
      point(178, a, -0.5),
      0.16,
      silver,
    );
  }
  // Suspended radial and circumferential cable net above the fabric.
  for (const r of [58, 100, 137, 166])
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2,
        b = ((i + 1) / 96) * Math.PI * 2;
      beam(point(r, a, 0.45), point(r, b, 0.45), 0.065);
    }
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    for (let j = 0; j < 12; j++)
      beam(point(25 + j * 13, a, 0.35), point(38 + j * 13, a, 0.35), 0.055);
  }
  for (let mast = 0; mast < 12; mast++) {
    const a = (mast * Math.PI) / 6 + Math.PI / 12,
      cs = Math.cos(a),
      sn = Math.sin(a);
    // Outward-raked square lattice, tapering from 3.4 m to 0.7 m across.
    const corner = (y, k) => {
      const rr = 99 + y * 0.18,
        w = (3.4 - y * 0.027) / 2;
      const u = k === 0 || k === 3 ? -w : w,
        v = k < 2 ? -w : w;
      return [cs * (rr + u) - sn * v, y, sn * (rr + u) + cs * v];
    };
    for (let k = 0; k < 4; k++)
      beam(corner(3, k), corner(100, k), 0.21, metal, 0.12);
    for (let y = 4; y < 98; y += 4)
      for (let k = 0; k < 4; k++) {
        const next = (k + 1) % 4;
        beam(corner(y, k), corner(y, next), 0.1, metal);
        beam(corner(y, k), corner(Math.min(100, y + 4), next), 0.075, metal);
        beam(corner(y, next), corner(Math.min(100, y + 4), k), 0.075, metal);
      }
    const top = [cs * 117, 98, sn * 117];
    for (const [r, offset] of [
      [46, 0],
      [83, -0.23],
      [83, 0.23],
      [139, -0.19],
      [139, 0.19],
      [180, -0.13],
      [180, 0.13],
    ]) {
      const end = point(r, a + offset, 1.2);
      beam(top, end, 0.09);
      beam(point(r, a + offset, 0.2), end, 0.19, dark);
    }
    mesh(new T.CylinderGeometry(3, 3.5, 1.2, 24), dark, point(107, a, 0.6));
    beam(
      [cs * 117, 100, sn * 117],
      [cs * 117.7, 104, sn * 117.7],
      0.14,
      metal,
      0.045,
    );
  }
  // The roof walk is a narrow fabric path over the dome, with safety rails and summit deck.
  const walkAngle = -0.38,
    ca = Math.cos(walkAngle),
    sa = Math.sin(walkAngle);
  function walkPoint(t, side = 0, lift = 0) {
    const r = Math.abs(t),
      a = walkAngle + (t < 0 ? Math.PI : 0);
    return [
      ca * t - sa * side,
      roofHeight(r, a) + 0.65 + lift,
      sa * t + ca * side,
    ];
  }
  for (let t = -179; t < 179; t += 3.5) {
    const a = new T.Vector3(...walkPoint(t)),
      b = new T.Vector3(...walkPoint(Math.min(t + 3.5, 179)));
    const plank = box(
      a.clone().add(b).multiplyScalar(0.5).toArray(),
      [2.9, 0.22, a.distanceTo(b)],
      dark,
    );
    plank.quaternion.setFromUnitVectors(
      new T.Vector3(0, 0, 1),
      b.sub(a).normalize(),
    );
    for (const side of [-1.5, 1.5]) {
      beam(walkPoint(t, side), walkPoint(t, side, 1.05), 0.035, silver);
      beam(
        walkPoint(t, side, 1.05),
        walkPoint(Math.min(t + 3.5, 179), side, 1.05),
        0.035,
        silver,
      );
    }
  }
  mesh(new T.CylinderGeometry(5.2, 5.2, 0.35, 32), silver, [0, 53.1, 0]);
  // Actual OSM locations of the twelve circular ventilation/service towers.
  for (const [h, poly] of services) {
    const p = poly.slice(0, -1),
      x = p.reduce((s, v) => s + v[0], 0) / p.length - origin.x,
      z = p.reduce((s, v) => s + v[1], 0) / p.length - origin.z;
    const r = Math.sqrt(
      Math.abs(
        p.reduce((s, v, i) => {
          const q = p[(i + 1) % p.length];
          return s + v[0] * q[1] - q[0] * v[1];
        }, 0),
      ) /
        2 /
        Math.PI,
    );
    const hh = Math.min(h, 24);
    mesh(new T.CylinderGeometry(r * 0.91, r * 0.91, hh - 2, 24), dark, [
      x,
      hh / 2,
      z,
    ]);
    for (const y of [hh * 0.26, hh * 0.72])
      mesh(new T.CylinderGeometry(r, r, hh * 0.27, 32, 1, true), silver, [
        x,
        y,
        z,
      ]);
    const rail = mesh(new T.TorusGeometry(r, 0.14, 5, 48), silver, [
      x,
      hh + 0.7,
      z,
    ]);
    rail.rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      beam(
        [x + Math.cos(a) * r, hh - 2, z + Math.sin(a) * r],
        [x + Math.cos(a) * r, hh + 1, z + Math.sin(a) * r],
        0.07,
        silver,
      );
    }
  }
  // Low perimeter plinth; detailed paving remains at ground level.
  mesh(new T.CylinderGeometry(181, 181, 1, 192), stone, [0, 0.3, 0]);
  const result = mergeStaticMeshes(pieces);
  for (const o of pieces) o.geometry.dispose();
  result.position.copy(origin);
  scene.add(result);
  return {
    meshes: result.children.length,
    masts: 12,
    diameter: 365,
    height: 104,
  };
}
