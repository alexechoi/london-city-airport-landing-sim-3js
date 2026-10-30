import * as T from "three";
function inside(x, z, p) {
  let hit = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i],
      b = p[j];
    if (
      a[1] > z != b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      hit = !hit;
  }
  return hit;
}
export async function addVegetation(
  scene,
  landcover,
  waterRings,
  collisions,
  roads,
  parks = [],
) {
  if (!landcover.image)
    await new Promise((resolve, reject) => {
      landcover.source.data?.addEventListener?.("load", resolve);
      const tick = () => (landcover.image ? resolve() : setTimeout(tick, 30));
      tick();
      setTimeout(() => reject(new Error("Land cover unavailable")), 30000);
    });
  const canvas = document.createElement("canvas");
  canvas.width = landcover.image.width;
  canvas.height = landcover.image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(landcover.image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const rings = waterRings.map((p) => ({
    p,
    x0: Math.min(...p.map((v) => v[0])),
    x1: Math.max(...p.map((v) => v[0])),
    z0: Math.min(...p.map((v) => v[1])),
    z1: Math.max(...p.map((v) => v[1])),
  }));
  const roadCells = new Set();
  for (const [, p] of roads)
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1],
        b = p[i],
        n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 8);
      for (let k = 0; k <= n; k++) {
        const x = Math.floor((a[0] + ((b[0] - a[0]) * k) / n) / 16),
          z = Math.floor((a[1] + ((b[1] - a[1]) * k) / n) / 16);
        for (let dx = -1; dx <= 1; dx++)
          for (let dz = -1; dz <= 1; dz++) roadCells.add(`${x + dx},${z + dz}`);
      }
    }
  let seed = 754;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const spots = [];
  const parkCells=new Map();
  for(const park of parks) {
    const xs=park.outer.map(p=>p[0]),zs=park.outer.map(p=>p[1]);
    for(let x=Math.floor(Math.min(...xs)/250);x<=Math.floor(Math.max(...xs)/250);x++)
      for(let z=Math.floor(Math.min(...zs)/250);z<=Math.floor(Math.max(...zs)/250);z++) {
        const key=x+','+z;if(!parkCells.has(key))parkCells.set(key,[]);parkCells.get(key).push(park);
      }
  }
  function mappedParkCover(x,z) {
    for(const p of parkCells.get(Math.floor(x/250)+','+Math.floor(z/250))||[]) {
      if(!inside(x,z,p.outer)||p.holes.some(h=>inside(x,z,h)))continue;
      // Keep central lawns open: tree groups follow park boundaries.
      let edge=Infinity;
      for(let i=1;i<p.outer.length;i++) {
        const a=p.outer[i-1],b=p.outer[i],dx=b[0]-a[0],dz=b[1]-a[1];
        const t=T.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);
        edge=Math.min(edge,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
      }
      return edge<23?1:0;
    }
    return 0;
  }
  for (let x = -5500; x < 6000; x += 21)
    for (let z = -13300; z < 5300; z += 21) {
      const px = x + rnd() * 16,
        pz = z + rnd() * 16;
      const e = pz * 0.998806 + px * 0.04885,
        n = px * 0.998806 - pz * 0.04885,
        u = (0.06602 + e / 69298 + 0.05) / 0.16,
        v = (51.53 - (51.50494 + n / 111320)) / 0.05;
      const inRaster=u>=0&&u<1&&v>=0&&v<1;
      const cover = inRaster ? pixels[
          (Math.floor(v * canvas.height) * canvas.width +
            Math.floor(u * canvas.width)) *
            4
        ] / 255 : mappedParkCover(px,pz);
      if (
        cover < 0.65 ||
        rnd() > 0.55 ||
        roadCells.has(`${Math.floor(px / 16)},${Math.floor(pz / 16)}`)
      )
        continue;
      if (Math.abs(px) < 440 && pz > -2300 && pz < 200) continue;
      if (
        rings.some(
          (r) =>
            px >= r.x0 &&
            px <= r.x1 &&
            pz >= r.z0 &&
            pz <= r.z1 &&
            inside(px, pz, r.p),
        )
      )
        continue;
      const point = { x: px, y: 4, z: pz };
      if (collisions.hit(point, point)) continue;
      spots.push([px, pz, 5 + rnd() * 7, rnd()]);
    }
  const leaf = new T.MeshStandardMaterial({ color: 0x697c3f, roughness: 1 });
  const bark = new T.MeshStandardMaterial({ color: 0x554839, roughness: 1 });
  const geometries = [0, 1].map((detail) => {
    const g = new T.IcosahedronGeometry(1, detail),
      a = g.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const v = new T.Vector3().fromBufferAttribute(a, i);
      v.multiplyScalar(0.94 + 0.08 * Math.sin(v.x * 17 + v.y * 11 + v.z * 13));
      a.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  });
  const treeCells = new Map();
  for (const spot of spots) {
    const key = `${Math.floor(spot[0] / 600)},${Math.floor(spot[1] / 600)}`;
    if (!treeCells.has(key)) treeCells.set(key, []);
    treeCells.get(key).push(spot);
  }
  const dummy = new T.Object3D();
  for (const [key, trees] of treeCells) {
    const [gx, gz] = key.split(",").map(Number);
    const cx = gx * 600 + 300,
      cz = gz * 600 + 300;
    const lod = new T.LOD();
    lod.position.set(cx, 0, cz);
    for (const detail of [1, 0]) {
      const group = new T.Group();
      const crowns = new T.InstancedMesh(
        geometries[detail],
        leaf,
        trees.length * 3,
      );
      const trunks = detail
        ? new T.InstancedMesh(
            new T.CylinderGeometry(0.22, 0.4, 1, 5),
            bark,
            trees.length,
          )
        : null;
      trees.forEach(([x, z, h, r], i) => {
        if (trunks) {
          dummy.position.set(x - cx, h * 0.28, z - cz);
          dummy.scale.set(1, h * 0.56, 1);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          trunks.setMatrixAt(i, dummy.matrix);
        }
        for (let j = 0; j < 3; j++) {
          dummy.position.set(
            x - cx + Math.sin(j * 2.1 + r) * h * 0.16,
            h * 0.65 + (j === 0 ? h * 0.1 : 0),
            z - cz + Math.cos(j * 2.1 + r) * h * 0.16,
          );
          dummy.scale.set(h * 0.3, h * 0.35, h * 0.3);
          dummy.rotation.set(0, r * 6, 0);
          dummy.updateMatrix();
          crowns.setMatrixAt(i * 3 + j, dummy.matrix);
          crowns.setColorAt(
            i * 3 + j,
            new T.Color().setHSL(
              0.2 + r * 0.045,
              0.27 + r * 0.1,
              0.25 + r * 0.1,
            ),
          );
        }
      });
      crowns.castShadow = true;
      crowns.receiveShadow = true;
      group.add(crowns);
      if (trunks) {
        trunks.castShadow = true;
        group.add(trunks);
      }
      lod.addLevel(group, detail ? 0 : 650, 0.15);
    }
    scene.add(lod);
  }
  return spots.length;
}
