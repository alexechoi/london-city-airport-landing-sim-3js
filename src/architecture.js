import * as T from "three";
// Shared instanced geometry adds silhouette and facade depth without per-building draw calls.
export function architecturalDetails(scene, buildings) {
  const trim = [],
    plant = [],
    caps = [],
    chimneys = [],
    solar = [];
  const dummy = new T.Object3D();
  function push(list, x, y, z, w, h, d, angle = 0) {
    list.push({ x, y, z, w, h, d, angle });
  }
  for (let i = 0; i < buildings.length; i++) {
    const [height, raw, type] = buildings[i];
    if (buildings[i][4] || i === 10) continue;
    const p = raw.slice(0, -1);
    if (p.length < 3) continue;
    const cx = p.reduce((a, b) => a + b[0], 0) / p.length,
      cz = p.reduce((a, b) => a + b[1], 0) / p.length;
    if (Math.abs(cx) > 1800 || cz < -7200 || cz > 500) continue;
    function inside(x, z) {
      let hit = false;
      for (let j = 0, k = p.length - 1; j < p.length; k = j++) {
        const a = p[j],
          b = p[k];
        if (
          a[1] > z != b[1] > z &&
          x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
        )
          hit = !hit;
      }
      return hit;
    }
    let seed = (i + 19) * 17831;
    const random = () =>
      (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    if (/house|terrace/.test(type) && height < 16) {
      if (inside(cx, cz) && i % 3 !== 0) {
        push(chimneys, cx, height + 2, cz, 0.7, 4, 0.95);
        push(caps, cx, height + 4.05, cz, 0.9, 0.18, 1.15);
      }
      continue;
    }
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
        // Most mullions are represented by the facade normal maps. Generic
        // geometry at unrelated intervals produced conflicting grids and shimmer.
        if (i === 11)
          for (let y = floorHeight; y < height; y += floorHeight)
            push(trim, x, y, z, len, 0.12, 0.22, angle);
      }
    }
    const xs = p.map((v) => v[0]),
      zs = p.map((v) => v[1]),
      w = Math.max(...xs) - Math.min(...xs),
      d = Math.max(...zs) - Math.min(...zs);
    if (w > 14 && d > 14 && height > 8) {
      const count = tall ? 3 + (i % 4) : 1 + (i % 3);
      for (let k = 0; k < count; k++) {
        const x = cx + (random() - 0.5) * w * 0.65,
          z = cz + (random() - 0.5) * d * 0.65,
          ww = 2 + random() * 4,
          dd = 2 + random() * 5,
          hh = 0.8 + random() * 1.5;
        if (
          ![
            [x - ww / 2, z - dd / 2],
            [x + ww / 2, z - dd / 2],
            [x - ww / 2, z + dd / 2],
            [x + ww / 2, z + dd / 2],
          ].every(([x, z]) => inside(x, z))
        )
          continue;
        push(plant, x, height + hh / 2, z, ww, hh, dd);
        push(caps, x, height + hh + 0.1, z, ww + 0.2, 0.2, dd + 0.2);
        for (let vent = 0; vent < 3; vent++)
          push(
            trim,
            x - ww * 0.3 + vent * ww * 0.3,
            height + hh + 0.3,
            z,
            0.15,
            0.2,
            dd * 0.8,
          );
      }
      if (tall && inside(cx, cz))
        push(trim, cx, height + 6, cz, 0.16, 12, 0.16);
      if (!tall && w * d > 700 && i % 4 === 0)
        for (let a = -2; a <= 2; a++)
          for (let b = -1; b <= 1; b++) {
            const x = cx + a * 3,
              z = cz + b * 4;
            if (
              [
                [x - 1.3, z - 1.6],
                [x + 1.3, z + 1.6],
              ].every(([x, z]) => inside(x, z))
            )
              push(solar, x, height + 0.45, z, 2.6, 0.35, 3.2);
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
  batch(
    chimneys,
    new T.MeshStandardMaterial({ color: 0x795c47, roughness: 0.95 }),
  );
  batch(
    solar,
    new T.MeshStandardMaterial({
      color: 0x19394b,
      roughness: 0.24,
      metalness: 0.6,
      envMapIntensity: 4,
    }),
  );
  return {
    chimneys: chimneys.length,
    solar: solar.length,
    trim: trim.length,
    plant: plant.length,
    parapets: caps.length,
  };
}
