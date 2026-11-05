import * as T from "three";
import { addCity } from "./city.js";
// Geographic cells keep the real surrounding London geometry independently cullable.
export function addContextCity(scene, data, materials, roof) {
  // Keep a small set of shared batches, but retain glass, brick, stone and
  // industrial identities when a custom flight leaves the central district.
  materials = materials.map((m, i) =>
    [0, 5, 6, 10].includes(i) ? materials[i===10?0:i]
      : [2, 3].includes(i) ? materials[i]
      : i === 4 ? materials[4]
      : i === 7 ? materials[7]
      : materials[8],
  );
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
    // Kilometres-away districts need not be redrawn into sub-pixel water reflections.
    // Layer 1 is visible in the main camera; Water's mirror camera uses layer 0.
    group.traverse((o) => {
      if (o.isMesh) o.layers.set(1);
    });
    offset += buildings.length;
  }
  return colliders;
}
