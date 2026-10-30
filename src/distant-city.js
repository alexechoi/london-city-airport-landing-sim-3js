import * as T from "three";
// Coarse, explicitly illustrative background beyond the downloaded OSM bounds.
// Keeps the horizon continuous without paying for full-detail geometry 10 km away.
export function addDistantCity(scene) {
  let state = 9391;
  const random = () =>
    (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296;
  const blocks = [];
  for (let x = -10000; x <= 10000; x += 82)
    for (let z = -15000; z <= 9000; z += 82) {
      const e = z * 0.998806 + x * 0.04885,
        n = x * 0.998806 - z * 0.04885,
        lon = 0.06602 + e / 69298,
        lat = 51.50494 + n / 111320;
      if (lon > -0.052 && lon < 0.113 && lat > 51.478 && lat < 51.532) continue;
      if (Math.hypot(x, z + 2800) > 11000 || random() > 0.53) continue;
      // Leave a broad downstream Thames corridor clear in the eastern distance.
      if (z > 1800 && x < -650 && x > -1800) continue;
      const height = 6 + random() * 18 + (random() > 0.985 ? 50 : 0);
      blocks.push([
        x + random() * 24,
        z + random() * 24,
        height,
        14 + random() * 32,
        14 + random() * 28,
        random(),
      ]);
    }
  const material = new T.MeshStandardMaterial({
    color: 0xa1a3a0,
    roughness: 0.9,
  });
  const mesh = new T.InstancedMesh(
      new T.BoxGeometry(1, 1, 1),
      material,
      blocks.length,
    ),
    dummy = new T.Object3D();
  blocks.forEach(([x, z, h, w, d, r], i) => {
    dummy.position.set(x, h / 2 - 1, z);
    dummy.scale.set(w, h, d);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(
      i,
      new T.Color().setHSL(0.09 + r * 0.06, 0.04 + r * 0.05, 0.48 + r * 0.14),
    );
  });
  mesh.receiveShadow = true;
  scene.add(mesh);
  return blocks.length;
}
