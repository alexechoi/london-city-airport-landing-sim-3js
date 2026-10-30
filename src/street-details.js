import * as T from "three";
// Lightweight instanced details follow mapped roads and water boundaries, not a random grid.
export function addStreetDetails(scene, roads, water) {
  const bodies = [],
    cabs = [],
    rubber = [],
    lamps = [],
    heads = [],
    walls = [],
    copings = [],
    bollards = [],
    busWindows = [];
  const traffic = [], animated = [], graph = new Map();
  const nodeKey = p => Math.round(p[0]/2)+","+Math.round(p[1]/2);
  for (const [kind,p] of roads) {
    if (!/^(primary|secondary|tertiary|residential|trunk|unclassified)$/.test(kind)) continue;
    for(let i=1;i<p.length;i++) {
      const a=p[i-1],b=p[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(len<1)continue;
      for(const [from,to] of [[a,b],[b,a]]) {
        const k=nodeKey(from);if(!graph.has(k))graph.set(k,[]);
        graph.get(k).push({a:from,b:to,len,w:/trunk/.test(kind)?7.5:/primary|secondary/.test(kind)?5:2.7});
      }
    }
  }
  let vehicle = null;
  const occupied = new Set(),
    d = new T.Object3D();
  const paint = [0xe7e4dd, 0x526475, 0x252e35, 0x8e2622, 0xa5a9a8, 0x58665d];
  const put = (list, x, y, z, w, h, l, angle = 0, color = null) =>
    list.push({ x, y, z, w, h, l, angle, color, vehicle,
      localX: vehicle ? Math.cos(angle)*(x-vehicle.x)-Math.sin(angle)*(z-vehicle.z):0,
      localZ: vehicle ? Math.sin(angle)*(x-vehicle.x)+Math.cos(angle)*(z-vehicle.z):0 });
  const near = (x, z) => Math.abs(x) < 1900 && z > -7350 && z < 100;
  let seed = 81713;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (const [kind, p] of roads) {
    if (
      !/^(primary|secondary|tertiary|residential|trunk|unclassified)$/.test(
        kind,
      )
    )
      continue;
    const w = /trunk/.test(kind)
      ? 7.5
      : /primary|secondary/.test(kind)
        ? 5
        : 2.7;
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1],
        b = p[i],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz);
      if (len < 24) continue;
      const nx = dz / len,
        nz = -dx / len,
        angle = Math.atan2(dx, dz);
      for (let t = 12 + rand() * 18; t < len - 8; t += 38 + rand() * 60) {
        const side = rand() < 0.5 ? -1 : 1,
          x = a[0] + (dx * t) / len + nx * w * 0.48 * side,
          z = a[1] + (dz * t) / len + nz * w * 0.48 * side;
        if (!near(x, z)) continue;
        const key = Math.round(x / 9) + "," + Math.round(z / 9);
        if (occupied.has(key)) continue;
        occupied.add(key);
        const bus = w > 4 && rand() < 0.08,
          ww = bus ? 2.5 : 1.8,
          ll = bus ? 10.8 : 4.3,
          hh = bus ? 3.8 : 0.95;
        const edge = side === -1 ? {a,b,len,w} : {a:b,b:a,len,w};
        vehicle = {edge,t:side===-1?t:len-t,speed:bus?7:8+rand()*5,x,z,angle:angle+(side===1?Math.PI:0)};
        traffic.push(vehicle);
        const travelAngle=vehicle.angle;
        put(
          bodies,
          x,
          hh / 2 + 0.45,
          z,
          ww,
          hh,
          ll,
          travelAngle,
          bus ? 0xb72824 : paint[Math.floor(rand() * paint.length)],
        );
        if (bus) {
          for (const y of [1.7, 3.25])
            put(busWindows, x, y, z, ww + 0.025, 0.78, ll * 0.83, travelAngle);
        } else put(cabs, x, 1.35, z, 1.57, 0.62, 2.25, travelAngle);
        for (const longitudinal of [-ll * 0.31, ll * 0.31])
          for (const lateral of [-ww * 0.49, ww * 0.49])
            put(
              rubber,
              x + Math.sin(angle) * longitudinal + Math.cos(angle) * lateral,
              0.48,
              z + Math.cos(angle) * longitudinal - Math.sin(angle) * lateral,
              0.22,
              0.62,
              0.62,
              travelAngle,
            );
      }
      vehicle = null;
      for (let t = 8; t < len; t += 50) {
        const x = a[0] + (dx * t) / len + nx * (w + 1),
          z = a[1] + (dz * t) / len + nz * (w + 1);
        if (!near(x, z)) continue;
        const key = "l" + Math.round(x / 20) + "," + Math.round(z / 20);
        if (occupied.has(key)) continue;
        occupied.add(key);
        put(lamps, x, 4, z, 0.14, 8, 0.14);
        put(
          heads,
          x - nx * 0.6,
          8,
          z - nz * 0.6,
          0.32,
          0.18,
          1.5,
          angle + Math.PI / 2,
        );
      }
    }
  }
  vehicle = null;
  for (const { outer, holes } of water)
    for (const p of [outer, ...holes])
      for (let i = 1; i < p.length; i++) {
        const a = p[i - 1],
          b = p[i],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          len = Math.hypot(dx, dz),
          x = (a[0] + b[0]) / 2,
          z = (a[1] + b[1]) / 2;
        if (
          !near(x, z) ||
          len < 2 ||
          len > 350 ||
          (z > -2100 && Math.abs(x) < 500)
        )
          continue;
        const angle = Math.atan2(dx, dz);
        put(walls, x, -0.55, z, 0.9, 2.1, len, angle);
        put(copings, x, 0.55, z, 1.2, 0.18, len, angle);
        if (len > 14)
          for (let t = 6; t < len; t += 24)
            put(
              bollards,
              a[0] + (dx * t) / len,
              1.05,
              a[1] + (dz * t) / len,
              0.25,
              0.9,
              0.25,
            );
      }
  function batch(items, color, metalness = 0, roughness = 0.8) {
    const material = new T.MeshStandardMaterial({
      color,
      metalness,
      roughness,
    });
    const m = new T.InstancedMesh(
      new T.BoxGeometry(1, 1, 1),
      material,
      items.length,
    );
    items.forEach((v, i) => {
      d.position.set(v.x, v.y, v.z);
      d.scale.set(v.w, v.h, v.l);
      d.rotation.set(0, v.angle, 0);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      if (v.color !== null) m.setColorAt(i, new T.Color(v.color));
    });
    if(items.some(v=>v.vehicle)) {
      m.instanceMatrix.setUsage(T.DynamicDrawUsage);
      m.frustumCulled=false;
      animated.push({mesh:m,items});
    }
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }
  batch(bodies, 0xffffff, 0.35, 0.35);
  batch(cabs, 0x29434d, 0.45, 0.2);
  batch(busWindows, 0x1b303a, 0.35, 0.25);
  batch(rubber, 0x202326);
  batch(lamps, 0x657073, 0.5);
  batch(heads, 0xc6c7b6, 0.3);
  batch(walls, 0x67685d);
  batch(copings, 0xa5a295);
  batch(bollards, 0x344448, 0.5);
  return {
    update(dt) {
      for(const v of traffic) {
        v.t+=dt*v.speed;
        let guard=0;
        while(v.t>v.edge.len && guard++<8) {
          v.t-=v.edge.len;
          const e=v.edge, options=(graph.get(nodeKey(e.b))||[]).filter(q=>nodeKey(q.b)!==nodeKey(e.a));
          const dx=(e.b[0]-e.a[0])/e.len,dz=(e.b[1]-e.a[1])/e.len;
          options.sort((a,b)=>((b.b[0]-b.a[0])*dx+(b.b[1]-b.a[1])*dz)/b.len-((a.b[0]-a.a[0])*dx+(a.b[1]-a.a[1])*dz)/a.len);
          v.edge=options[0]||{a:e.b,b:e.a,len:e.len,w:e.w};
        }
        const e=v.edge, dx=(e.b[0]-e.a[0])/e.len,dz=(e.b[1]-e.a[1])/e.len;
        v.x=e.a[0]+dx*v.t-dz*e.w*.48;
        v.z=e.a[1]+dz*v.t+dx*e.w*.48;
        v.angle=Math.atan2(dx,dz);
      }
      for(const {mesh,items} of animated) {
        items.forEach((part,i)=>{
          const v=part.vehicle;if(!v)return;
          d.position.set(v.x+Math.cos(v.angle)*part.localX+Math.sin(v.angle)*part.localZ,part.y,v.z-Math.sin(v.angle)*part.localX+Math.cos(v.angle)*part.localZ);
          d.rotation.set(0,v.angle,0);d.scale.set(part.w,part.h,part.l);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);
        });
        mesh.instanceMatrix.needsUpdate=true;
      }
    },
    sample: () => traffic.slice(0,3).map(v=>[v.x,v.z]),
    vehicles: bodies.length,
    lamps: lamps.length,
    quaySegments: walls.length,
  };
}
