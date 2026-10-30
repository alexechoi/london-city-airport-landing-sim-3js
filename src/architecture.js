import * as T from "three";
// Shared instanced geometry adds silhouette and facade depth without per-building draw calls.
export function architecturalDetails(scene, buildings) {
  const trim = [],
    plant = [],
    caps = [];
  const dummy = new T.Object3D();
  function push(list, x, y, z, w, h, d, angle = 0) {
    list.push({ x, y, z, w, h, d, angle });
  }
  for (let i = 0; i < buildings.length; i++) {
    const [height, raw, type] = buildings[i];
    const p = raw.slice(0, -1);
    if (p.length < 3) continue;
    const cx = p.reduce((a, b) => a + b[0], 0) / p.length,
      cz = p.reduce((a, b) => a + b[1], 0) / p.length;
    if (Math.abs(cx) > 1100 || cz < -7200 || cz > 500) continue;
    if (/house|terrace/.test(type) && height < 16) continue;
    const tall = height > 45;
    const floorHeight =
      i === 10
        ? 4.1
        : i === 11
          ? 4.43
          : 3.6 + (((i * 2654435761) >>> 0) / 4294967296) * 0.3;
    for (let j = 0; j < p.length; j++) {
      const a = p[j],
        b = p[(j + 1) % p.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz);
      if (len < 2) continue;
      const angle = -Math.atan2(dz, dx),
        x = (a[0] + b[0]) / 2,
        z = (a[1] + b[1]) / 2;
      push(caps, x, height + 0.3, z, len + 0.25, 0.6, 0.3, angle);
      if (tall) {
        push(trim, a[0], height / 2, a[1], 0.28, height, 0.28);
        for (let y = floorHeight; y < height; y += floorHeight)
          push(trim, x, y, z, len, 0.12, 0.22, angle);
        if (len > 12)
          for (let k = 5; k < len; k += 5) {
            const u = k / len;
            push(
              trim,
              a[0] + dx * u,
              height / 2,
              a[1] + dz * u,
              0.12,
              height,
              0.18,
              angle,
            );
          }
      }
    }
    const xs = p.map((v) => v[0]),
      zs = p.map((v) => v[1]),
      w = Math.max(...xs) - Math.min(...xs),
      d = Math.max(...zs) - Math.min(...zs);
    if (w > 14 && d > 14 && height > 8) {
      push(
        plant,
        cx,
        height + 1,
        cz,
        Math.min(5, w * 0.2),
        2,
        Math.min(7, d * 0.2),
      );
      push(
        caps,
        cx,
        height + 2.1,
        cz,
        Math.min(5.4, w * 0.22),
        0.22,
        Math.min(7.4, d * 0.22),
      );
      if (tall) {
        push(plant, cx - 3, height + 2, cz + 4, 2, 4, 2);
        push(trim, cx, height + 7, cz, 0.18, 14, 0.18);
      }
    }
  }
  function batch(items, material) {
    const m = new T.InstancedMesh(
      new T.BoxGeometry(1, 1, 1),
      material,
      items.length,
    );
    items.forEach((v, i) => {
      dummy.position.set(v.x, v.y, v.z);
      dummy.scale.set(v.w, v.h, v.d);
      dummy.rotation.set(0, v.angle, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }
  batch(
    trim,
    new T.MeshStandardMaterial({
      color: 0x8c9aa3,
      roughness: 0.35,
      metalness: 0.65,
    }),
  );
  batch(
    plant,
    new T.MeshStandardMaterial({
      color: 0x4e5a5d,
      roughness: 0.8,
      metalness: 0.25,
    }),
  );
  batch(caps, new T.MeshStandardMaterial({ color: 0x999a94, roughness: 0.8 }));
  return { trim: trim.length, plant: plant.length, parapets: caps.length };
}
