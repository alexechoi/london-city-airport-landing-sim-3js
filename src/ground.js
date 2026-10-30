import * as T from "three";
import { surfaceMaterial } from "./materials.js";
export function buildUrbanGround(scene, data) {
  const positions = [],
    colors = [],
    vertices = [];
  const roads = [],
    sidewalks = [],
    roadUV = [];
  const palettes = [
    new T.Color(0x5b5c55),
    new T.Color(0x74746c),
    new T.Color(0x696c63),
  ];
  function quad(list, a, b, c, d) {
    for (const p of [a, b, c, a, c, d]) list.push(...p);
  }
  // A connected, untextured street surface avoids stretching satellite pixels at low altitude.
  for (const [kind, p] of data.roads) {
    let travelled = 0;
    const w = ["motorway", "trunk"].includes(kind)
      ? 7.5
      : ["primary", "secondary"].includes(kind)
        ? 5
        : 2.7;
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1],
        b = p[i],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz);
      if (len < 0.3) continue;
      const nx = dz / len,
        nz = -dx / len;
      for (const [list, width, y] of [
        [sidewalks, w + 1.5, 0.02],
        [roads, w, 0.08],
      ])
        quad(
          list,
          [a[0] + nx * width, y, a[1] + nz * width],
          [a[0] - nx * width, y, a[1] - nz * width],
          [b[0] - nx * width, y, b[1] - nz * width],
          [b[0] + nx * width, y, b[1] + nz * width],
        );
      for (const uv of [
        [travelled, w],
        [travelled, -w],
        [travelled + len, -w],
        [travelled, w],
        [travelled + len, -w],
        [travelled + len, w],
      ])
        roadUV.push(uv[0], uv[1], w > 4 ? 1 : 0);
      travelled += len;
    }
  }
  function mesh(arr, mat) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(arr, 3));
    if (arr === roads)
      g.setAttribute("roadUV", new T.Float32BufferAttribute(roadUV, 3));
    g.computeVertexNormals();
    const o = new T.Mesh(g, mat);
    o.receiveShadow = true;
    scene.add(o);
  }
  mesh(sidewalks, surfaceMaterial("paving"));
  mesh(roads, surfaceMaterial("road"));
  // Building plots ground the blocks, leaving gardens between streets.
  for (let i = 0; i < data.buildings.length; i++) {
    const [h, p] = data.buildings[i];
    if (p.length < 4) continue;
    const shape = p.slice(0, -1).map((v) => new T.Vector2(...v));
    const cx = shape.reduce((v, p) => v + p.x, 0) / shape.length,
      cz = shape.reduce((v, p) => v + p.y, 0) / shape.length;
    const expanded = shape.map((p) => {
      const dx = p.x - cx,
        dz = p.y - cz,
        l = Math.hypot(dx, dz) || 1;
      return new T.Vector2(p.x + (dx / l) * 1.4, p.y + (dz / l) * 1.4);
    });
    for (const f of T.ShapeUtils.triangulateShape(expanded, []))
      for (const idx of [f[2], f[1], f[0]]) {
        const p = expanded[idx];
        positions.push(p.x, -0.05, p.y);
        colors.push(...palettes[i % 3].toArray());
      }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const plots = new T.Mesh(g, surfaceMaterial("paving"));
  plots.receiveShadow = true;
  scene.add(plots);
}
