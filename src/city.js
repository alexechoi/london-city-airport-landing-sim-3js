import * as T from "three";
// Real footprints, metric wall UVs, roof triangles; batch by material, not by building.
export function addCity(scene, data, materials, roofMaterial, seedOffset = 0) {
  const uniqueMaterials = [...new Set(materials)],
    materialSlots = materials.map((m) => uniqueMaterials.indexOf(m));
  const batches = uniqueMaterials.map(() => ({ p: [], n: [], u: [], b: [] })),
    roofs = { p: [], n: [], u: [], b: [] };
  const colliders = [];
  let parameters = [0, 2.6, 3.2, 10];
  function tri(b, a, c, d, n, uv) {
    for (let i = 0; i < 3; i++) {
      b.p.push(...[a, c, d][i]);
      b.n.push(...n);
      b.u.push(...uv[i]);
      b.b.push(...parameters);
    }
  }
  for (let index = 0; index < data.buildings.length; index++) {
    const [height, poly, type] = data.buildings[index];
    if (poly.length < 4) continue;
    const h = Math.min(310, height),
      b =
        batches[
          materialSlots[
            seedOffset === 0 && index === 10
              ? 9
              : seedOffset === 0 && index === 11
                ? 10
                : seedOffset === 0 && index === 4525
                  ? 5
                  : /industrial|warehouse|service|shed|garage|hangar/.test(type)
                    ? 7
                    : height > 45
                      ? index === 10
                        ? 6
                        : [0, 5, 0, 6][index % 4]
                      : /house|terrace/.test(type)
                        ? 2 + (index % 2)
                        : 1 + (index % 4)
          ]
        ];
    const rnd = ((index * 2654435761) >>> 0) / 4294967296;
    parameters = [
      (index + seedOffset) * 0.73 + 1,
      seedOffset === 0 && index === 10
        ? 3.2
        : height > 45
          ? 1.7 + rnd * 0.8
          : 2.5 + rnd * 0.7,
      seedOffset === 0 && index === 10
        ? 4.1
        : seedOffset === 0 && index === 11
          ? 4.43
          : height > 45
            ? 3.6 + rnd * 0.3
            : 3.05,
      height,
    ];
    const points = poly.slice(0, -1);
    const residential = /house|terrace/.test(type) && h < 16;
    let roofRise = 0,
      roofFrame = null;
    if (residential) {
      let best = 0,
        angle = 0;
      for (let j = 0; j < points.length; j++) {
        const a = points[j],
          b = points[(j + 1) % points.length],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len > best) {
          best = len;
          angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
        }
      }
      const cs = Math.cos(angle),
        sn = Math.sin(angle),
        projected = points.map(([x, z]) => [x * cs + z * sn, -x * sn + z * cs]);
      const us = projected.map((p) => p[0]),
        vs = projected.map((p) => p[1]),
        u0 = Math.min(...us),
        u1 = Math.max(...us),
        v0 = Math.min(...vs),
        v1 = Math.max(...vs);
      const area =
        Math.abs(
          points.reduce((sum, p, i) => {
            const q = points[(i + 1) % points.length];
            return sum + p[0] * q[1] - q[0] * p[1];
          }, 0),
        ) / 2;
      if (
        area / ((u1 - u0) * (v1 - v0)) > 0.78 &&
        v1 - v0 < 20 &&
        u1 - u0 < 40
      ) {
        roofRise = Math.min(3.2, (v1 - v0) * 0.36);
        roofFrame = { cs, sn, u0, u1, v0, v1 };
      }
    }
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        c = points[(i + 1) % points.length],
        dx = c[0] - a[0],
        dz = c[1] - a[1],
        length = Math.hypot(dx, dz);
      if (length < 0.05) continue;
      const normal = [-dz / length, 0, dx / length],
        v0 = [a[0], 0, a[1]],
        v1 = [c[0], 0, c[1]],
        v2 = [c[0], h, c[1]],
        v3 = [a[0], h, a[1]];
      tri(b, v0, v1, v2, normal, [
        [0, 0],
        [length, 0],
        [length, h],
      ]);
      tri(b, v0, v2, v3, normal, [
        [0, 0],
        [length, h],
        [0, h],
      ]);
      minX = Math.min(minX, a[0]);
      maxX = Math.max(maxX, a[0]);
      minZ = Math.min(minZ, a[1]);
      maxZ = Math.max(maxZ, a[1]);
    }
    if (roofFrame) {
      const { cs, sn, u0, u1, v0, v1 } = roofFrame;
      const v = (v0 + v1) / 2,
        inset = Math.min((u1 - u0) * 0.22, (v1 - v0) * 0.5);
      const point = (u, v, y) => [u * cs - v * sn, y, u * sn + v * cs];
      const a = point(u0, v0, h),
        b = point(u1, v0, h),
        c = point(u1, v1, h),
        d = point(u0, v1, h),
        r0 = point(u0 + inset, v, h + roofRise),
        r1 = point(u1 - inset, v, h + roofRise);
      for (const face of [
        [a, b, r1],
        [a, r1, r0],
        [b, c, r1],
        [c, d, r0],
        [c, r0, r1],
        [d, a, r0],
      ]) {
        const normal = new T.Vector3()
          .subVectors(new T.Vector3(...face[1]), new T.Vector3(...face[0]))
          .cross(
            new T.Vector3().subVectors(
              new T.Vector3(...face[2]),
              new T.Vector3(...face[0]),
            ),
          )
          .normalize();
        if (normal.y < 0) {
          face.reverse();
          normal.negate();
        }
        tri(
          roofs,
          ...face,
          normal.toArray(),
          face.map((p) => [p[0] / 4, p[2] / 4]),
        );
      }
    } else {
      const shape = points.map((p) => new T.Vector2(p[0], p[1]));
      for (const f of T.ShapeUtils.triangulateShape(shape, [])) {
        const p = f.map((i) => [points[i][0], h, points[i][1]]);
        tri(
          roofs,
          p[2],
          p[1],
          p[0],
          [0, 1, 0],
          [p[2], p[1], p[0]].map((v) => [v[0] / 25, v[2] / 25]),
        );
      }
    }
    if (h > 2) colliders.push({ minX, maxX, minZ, maxZ, h: h + roofRise });
  }
  function mesh(b, m) {
    if (!b.p.length) return;
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(b.p, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(b.n, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(b.u, 2));
    g.setAttribute("building", new T.Float32BufferAttribute(b.b, 4));
    g.computeBoundingSphere();
    const o = new T.Mesh(g, m);
    o.castShadow = true;
    o.receiveShadow = true;
    scene.add(o);
  }
  batches.forEach((b, i) => mesh(b, uniqueMaterials[i]));
  mesh(roofs, roofMaterial);
  return colliders;
}
