import * as T from "three";
import { addCity } from "./city.js";
// Geographic cells keep the real surrounding London geometry independently cullable.
export function addContextCity(scene, data, materials, roof) {
  materials = materials.map(() => materials[8]);
  const cells = new Map();
  for (const b of data.buildings) {
    const p = b[1];
    const x = p.reduce((n, v) => n + v[0], 0) / p.length,
      z = p.reduce((n, v) => n + v[1], 0) / p.length;
    const key = `${Math.floor(x / 1000)},${Math.floor(z / 1000)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(b);
  }
  const colliders = [];
  let offset = 100000;
  for (const buildings of cells.values()) {
    const group = new T.Group();
    scene.add(group);
    colliders.push(...addCity(group, { buildings }, materials, roof, offset));
    offset += buildings.length;
  }
  return colliders;
}
