import "./style.css";
import { addCity } from "./city.js";
const [mapData, waterData] = await Promise.all([
  fetch("/london.json").then((r) => r.json()),
  fetch("/water.json").then((r) => r.json()),
]);
import * as T from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { Water } from "three/addons/objects/Water.js";
import {
  OceanSim,
  defaultOceanParams,
} from "./vendor/ultra-water/water/OceanSim.js";
import { initialFlight, stepFlight, landingVerdict } from "./flight.js";
const $ = (id) => document.getElementById(id),
  renderer = new T.WebGLRenderer({
    canvas: $("world"),
    antialias: true,
    powerPreference: "high-performance",
  });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
const scene = new T.Scene();
scene.fog = new T.FogExp2(0xb8c1c0, 0.00019);
const camera = new T.PerspectiveCamera(
  48,
  innerWidth / innerHeight,
  0.5,
  26000,
);
const sun = new T.Vector3(-0.7, 0.22, -0.5).normalize();
const sky = new Sky();
sky.scale.setScalar(40000);
scene.add(sky);
Object.assign(sky.material.uniforms.turbidity, { value: 5 });
sky.material.uniforms.rayleigh.value = 1.5;
sky.material.uniforms.mieCoefficient.value = 0.006;
sky.material.uniforms.sunPosition.value.copy(sun);
scene.add(new T.HemisphereLight(0xdce9f4, 0x9c8b70, 2.5));
const sunlight = new T.DirectionalLight(0xffdfb1, 3.2);
sunlight.position.copy(sun).multiplyScalar(4000);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048, 2048);
Object.assign(sunlight.shadow.camera, {
  left: -1400,
  right: 1400,
  top: 1400,
  bottom: -1400,
  near: 1,
  far: 9000,
});
sunlight.shadow.bias = -0.0003;
sunlight.target.position.set(0, 0, -750);
scene.add(sunlight.target);
scene.add(sunlight);
let seed = 41;
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
const mat = (c, r = 0.8, m = 0) =>
  new T.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const grass = mat(0x777b54),
  concrete = mat(0xa19e8e),
  asphalt = mat(0x343b3b),
  white = mat(0xe3ded0),
  glass = mat(0x60818c, 0.23, 0.65),
  dark = mat(0x283b48, 0.45, 0.3),
  yellow = mat(0xcbb66d);
function box(x, y, z, w, h, d, m, parent = scene) {
  const o = new T.Mesh(new T.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}
function line(points, color = 0xe1d7b3) {
  const o = new T.Line(
    new T.BufferGeometry().setFromPoints(
      points.map((p) => new T.Vector3(...p)),
    ),
    new T.LineBasicMaterial({ color }),
  );
  scene.add(o);
  return o;
}
// Generated microtextures keep the repository self-contained.
function texture(kind) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = kind === "facade" ? "#748080" : "#74776a";
  g.fillRect(0, 0, 256, 256);
  if (kind === "facade") {
    for (let y = 4; y < 256; y += 25)
      for (let x = 3; x < 256; x += 24) {
        g.fillStyle =
          rand() > 0.23
            ? ["#273d49", "#45616d", "#91a6ad", "#ac9d79"][
                Math.floor(rand() * 4)
              ]
            : "#aab1ad";
        g.fillRect(x, y, 15, 17);
      }
  } else {
    for (let i = 0; i < 18000; i++) {
      const n = Math.floor(rand() * 90 + 70);
      g.fillStyle = `rgba(${n},${n},${n - 10},.2)`;
      g.fillRect(rand() * 256, rand() * 256, 1, 1);
    }
  }
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  return t;
}
const groundTex = texture("ground");
groundTex.repeat.set(80, 80);
const terrain = mat(0x8b8976);
terrain.map = groundTex;
box(0, -5, -2500, 24000, 8, 20000, terrain);
const loader = new T.TextureLoader();
function photo(url, repeat) {
  const t = loader.load("/textures/" + url + ".jpg");
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
const paving = photo("concrete", 20);
concrete.map = paving;
grass.map = photo("grass", 15);
asphalt.map = photo("asphalt", 8);
terrain.map = photo("grass", 800);
terrain.color.setHex(0x939b86);

// EOX Sentinel-2 cloudless aerial ground, CC BY 4.0. North-up geographic image
// transformed into the same rotated metric frame as the OSM geometry.
const satellite = loader.load("/textures/london-satellite.jpg");
satellite.colorSpace = T.SRGBColorSpace;
satellite.anisotropy = renderer.capabilities.getMaxAnisotropy();
const satelliteMaterial = new T.MeshStandardMaterial({
  map: satellite,
  roughness: 1,
  color: 0xe2e2df,
});
const satellitePlane = new T.Mesh(
  new T.PlaneGeometry(
    0.16 * 111320 * Math.cos((51.505 * Math.PI) / 180),
    0.05 * 111320,
  ),
  satelliteMaterial,
);
satellitePlane.rotation.order = "YXZ";
satellitePlane.rotation.y = -(Math.PI / 2 - (2.8 * Math.PI) / 180);
satellitePlane.rotation.x = -Math.PI / 2;
const se = (0.03 - 0.06602) * 111320 * Math.cos((51.505 * Math.PI) / 180),
  sn = (51.505 - 51.50494) * 111320,
  sa = (2.8 * Math.PI) / 180;
satellitePlane.position.set(
  sn * Math.cos(sa) + se * Math.sin(sa),
  -0.9,
  se * Math.cos(sa) - sn * Math.sin(sa),
);
satellitePlane.receiveShadow = true;
scene.add(satellitePlane);
// Royal Albert Dock (north), King George V Dock (south), and the Thames.
const normalCanvas = document.createElement("canvas");
normalCanvas.width = normalCanvas.height = 128;
const ng = normalCanvas.getContext("2d"),
  im = ng.createImageData(128, 128);
for (let i = 0; i < im.data.length; i += 4) {
  im.data[i] = 125 + rand() * 6;
  im.data[i + 1] = 125 + rand() * 6;
  im.data[i + 2] = 255;
  im.data[i + 3] = 255;
}
ng.putImageData(im, 0, 0);
const normals = new T.CanvasTexture(normalCanvas);
normals.wrapS = normals.wrapT = T.RepeatWrapping;
const oceanParams = {
  ...defaultOceanParams(),
  windSpeed: 3.2,
  fetchKm: 2,
  waveScale: 0.5,
  swellScale: 0,
};
const ocean = new OceanSim(renderer, oceanParams);
ocean.update(0);
renderer.setRenderTarget(null);
const waters = [];
function water(x, z, w, d, geometry) {
  const o = new Water(geometry || new T.PlaneGeometry(w, d), {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: normals,
    sunDirection: sun,
    sunColor: 0xffe4bc,
    waterColor: 0x18383a,
    distortionScale: 2.7,
    fog: true,
  });
  o.rotation.x = -Math.PI / 2;
  o.position.set(x, -0.6, z);
  o.material.uniforms.uSlope0 = { value: ocean.slope[0] };
  o.material.uniforms.uSlope1 = { value: ocean.slope[1] };
  o.material.uniforms.uSlope2 = { value: ocean.slope[2] };
  o.material.fragmentShader = o.material.fragmentShader.replace(
    "uniform sampler2D normalSampler;",
    `uniform sampler2D normalSampler; uniform sampler2D uSlope0;uniform sampler2D uSlope1;uniform sampler2D uSlope2;`,
  );
  const st = o.material.fragmentShader.indexOf("vec4 getNoise("),
    en = o.material.fragmentShader.indexOf("void sunLight", st);
  o.material.fragmentShader =
    o.material.fragmentShader.slice(0, st) +
    `vec4 getNoise(vec2 uv){vec2 slope=texture2D(uSlope0,uv/600.0).xy+texture2D(uSlope1,uv/85.0).xy+texture2D(uSlope2,uv/12.0).xy;return vec4(-slope.x,-slope.y,1.0,1.0);}
` +
    o.material.fragmentShader.slice(en);
  scene.add(o);
  waters.push(o);
  return o;
}
const shapes = waterData.map(
  (points) => new T.Shape(points.map((p) => new T.Vector2(p[0], -p[1]))),
);
// Broad tidal Thames ribbon, sampled along its Greenwich and Silvertown bends.
const riverCoords = [
  [-0.055, 51.507],
  [-0.041, 51.501],
  [-0.033, 51.49],
  [-0.022, 51.483],
  [-0.008, 51.482],
  [0.004, 51.485],
  [0.01, 51.493],
  [0.003, 51.503],
  [0.003, 51.508],
  [0.014, 51.509],
  [0.024, 51.502],
  [0.034, 51.496],
  [0.05, 51.496],
  [0.067, 51.495],
  [0.087, 51.492],
  [0.11, 51.493],
  [0.14, 51.49],
];
function geo(lon, lat) {
  const e = (lon - 0.06602) * 111320 * Math.cos((51.505 * Math.PI) / 180),
    n = (lat - 51.50494) * 111320,
    a = (2.8 * Math.PI) / 180;
  return new T.Vector3(
    n * Math.cos(a) + e * Math.sin(a),
    0,
    e * Math.cos(a) - n * Math.sin(a),
  );
}
const riverCurve = new T.CatmullRomCurve3(
  riverCoords.map(([lon, lat]) => geo(lon, lat)),
);
const bankA = [],
  bankB = [];
for (let i = 0; i <= 240; i++) {
  const t = i / 240,
    p = riverCurve.getPoint(t),
    v = riverCurve.getTangent(t),
    width = 180;
  bankA.push(new T.Vector2(p.x + v.z * width, -p.z + v.x * width));
  bankB.push(new T.Vector2(p.x - v.z * width, -p.z - v.x * width));
}
shapes.push(new T.Shape([...bankA, ...bankB.reverse()]));
water(0, 0, 0, 0, new T.ShapeGeometry(shapes));
// Each reflection hides every other water plane to avoid recursive reflection passes.
for (const w of waters) {
  const reflect = w.onBeforeRender;
  w.onBeforeRender = function (...args) {
    const others = waters.filter((o) => o !== w);
    others.forEach((o) => (o.visible = false));
    reflect.apply(this, args);
    others.forEach((o) => (o.visible = true));
  };
}
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
// Raised runway island, quays, parallel taxiway, apron.
box(0, 0, -754, 170, 2, 1610, grass);
box(0, 1.04, -754, 30, 0.14, 1508, asphalt);
box(-63, 0.8, -754, 26, 0.2, 1508, concrete);
box(-129, 0, -1400, 175, 2, 760, concrete);
box(-167, 0, -825, 60, 2, 420, concrete);
for (const x of [-87, 87]) box(x, -0.1, -754, 3, 3, 1608, concrete);
for (const x of [-395, 415]) box(x, -0.4, -754, 5, 4, 2600, concrete);
for (let z = -20; z > -1508; z -= 30) {
  if (z % 60 === -20) box(0, 1.15, z, 0.6, 0.03, 20, white);
  for (const x of [-14.5, 14.5]) box(x, 1.15, z, 0.25, 0.04, 30, white);
}
for (const z of [-28, -1480])
  for (let x = -11; x <= 11; x += 2.5) box(x, 1.18, z, 1.5, 0.03, 24, white);
for (const z of [-230, -380, -1130])
  for (const x of [-8, 8]) box(x, 1.18, z, 3, 0.03, 22, white);
function label(text, x, y, z, w, d, color = "#e7e4d8") {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = color;
  g.textAlign = "center";
  g.font = "bold 190px Arial";
  g.fillText(text, 256, 205);
  const m = new T.MeshBasicMaterial({
    map: new T.CanvasTexture(c),
    transparent: true,
    depthWrite: false,
  });
  const o = new T.Mesh(new T.PlaneGeometry(w, d), m);
  o.rotation.x = -Math.PI / 2;
  o.position.set(x, y, z);
  scene.add(o);
  return o;
}
label("27", 0, 1.23, -78, 20, 30);
const n = label("09", 0, 1.23, -1430, 20, 30);
n.rotation.z = Math.PI;
const glow = new T.MeshBasicMaterial({ color: 0xffdc96 });
const redglow = new T.MeshBasicMaterial({ color: 0xff4934 });
const green = new T.MeshBasicMaterial({ color: 0x80ffb0 });
const bulbGeo = new T.SphereGeometry(0.55, 6, 4);
function bulb(x, y, z, m) {
  const o = new T.Mesh(bulbGeo, m);
  o.position.set(x, y, z);
  scene.add(o);
}
for (let z = 0; z >= -1508; z -= 30)
  for (const x of [-16, 16]) bulb(x, 1.8, z, glow);
for (let x = -14; x < 15; x += 3) bulb(x, 1.5, 0, green);
for (let z = 40; z < 400; z += 30) {
  box(0, 1, z, 1, 2, 1, concrete);
  for (let x = -3; x <= 3; x += 3) bulb(x, 2.5, z, glow);
}
for (let x = -34; x > -48; x -= 4) bulb(x, 2, -220, x < -40 ? redglow : glow);
line(
  [
    [-62, 1.05, 0],
    [-62, 1.05, -1480],
  ],
  0xdbc174,
);
for (const z of [-150, -600, -1250])
  line(
    [
      [-62, 1.1, z],
      [-55, 1.1, z - 40],
      [-15, 1.2, z - 75],
    ],
    0xdbc174,
  );
// Terminal: glazed frontage, sawtooth roof, passenger piers and ramp equipment.
box(-255, 9, -1450, 65, 18, 570, concrete);
box(-218, 10, -1450, 4, 15, 555, glass);
for (let z = -1730; z < -1160; z += 28) {
  box(-253, 19, z, 70, 2, 24, white);
  box(-215, 9, z, 1, 18, 1, dark);
}
label("LONDON CITY AIRPORT", -253, 20.2, -1440, 54, 280, "#314652");
function cylinder(r1, r2, h, m, x, y, z, parent = scene) {
  const o = new T.Mesh(new T.CylinderGeometry(r1, r2, h, 16), m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}
// Digital control tower.
cylinder(4, 6, 42, concrete, -300, 21, -1840);
cylinder(11, 7, 7, glass, -300, 44, -1840);
cylinder(13, 11, 2, white, -300, 49, -1840);
box(-300, 56, -1840, 1, 13, 1, dark);
// Buildings: batched facades and roofs, thousands of windows.
const facade = texture("facade");
const buildingMats = [0xaab0ac, 0x939c9c, 0xa99f90, 0x87959b, 0xb9b4a5].map(
  (c) => {
    const m = mat(c, 0.68, 0.05);
    m.map = facade;
    m.side = T.DoubleSide;
    return m;
  },
);
const buildingData = [];
const cityColliders = addCity(scene, mapData, buildingMats, concrete);
// Canary Wharf, positioned west of the airport; One Canada Square's pyramid.
const pyramid = new T.Mesh(
  new T.ConeGeometry(39, 25, 4),
  mat(0xc2c6be, 0.3, 0.6),
);
pyramid.rotation.y = Math.PI / 4;
pyramid.position.set(-230, 232, -5950);
scene.add(pyramid);
// O2 dome and its twelve yellow masts, south-west across the Thames.
const dome = new T.Mesh(
  new T.SphereGeometry(180, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2),
  white,
);
dome.scale.y = 0.23;
dome.position.set(-1350, 0, -4000);
scene.add(dome);
for (let i = 0; i < 12; i++) {
  const a = (i * Math.PI) / 6,
    x = -1350 + Math.cos(a) * 140,
    z = -4000 + Math.sin(a) * 140;
  cylinder(1, 1.4, 87, yellow, x, 43, z);
  line(
    [
      [x, 86, z],
      [-1350, 38, -4000],
    ],
    0xd6cfba,
  );
}
// Dockside trees, instanced for a small draw-call budget.
const treeGeo = new T.IcosahedronGeometry(1, 1),
  treeMat = mat(0x5a6850);
const trees = new T.InstancedMesh(treeGeo, treeMat, 650);
const td = new T.Object3D();
for (let i = 0; i < 650; i++) {
  let x = (rand() - 0.5) * 8500,
    z = rand() * 8000 - 6000;
  if (Math.abs(x) < 570) x += x < 0 ? -700 : 700;
  if (x > 720 && x < 1800) x = -700;
  td.position.set(x, 5, z);
  td.scale.set(3 + rand() * 4, 5 + rand() * 4, 3 + rand() * 4);
  td.updateMatrix();
  trees.setMatrixAt(i, td.matrix);
}
scene.add(trees);
function aircraft() {
  const a = new T.Group(),
    paint = mat(0xe2e3db, 0.34, 0.25),
    blue = mat(0x1b3349, 0.4, 0.3);
  const skin = paint.clone();
  skin.vertexColors = true;
  const fusGeo = new T.CylinderGeometry(1.65, 1.4, 29, 40, 1);
  const colours = [];
  for (let i = 0; i < fusGeo.attributes.position.count; i++) {
    const z = fusGeo.attributes.position.getZ(i);
    const c = new T.Color(z > 0.35 ? 0x132c50 : 0xf0f1ec);
    colours.push(c.r, c.g, c.b);
  }
  fusGeo.setAttribute("color", new T.Float32BufferAttribute(colours, 3));
  const fus = new T.Mesh(fusGeo, skin);
  fus.rotation.x = Math.PI / 2;
  a.add(fus);
  const nose = new T.Mesh(new T.SphereGeometry(1.7, 24, 16), paint);
  nose.scale.set(1, 1, 2);
  nose.position.z = -14.5;
  a.add(nose);
  const tail = new T.Mesh(new T.SphereGeometry(1.45, 20, 12), paint);
  tail.scale.set(1, 1, 2.8);
  tail.position.z = 14;
  a.add(tail);
  function wing(points, m) {
    const shape = new T.Shape();
    points.forEach(([x, z], i) =>
      i ? shape.lineTo(x, z) : shape.moveTo(x, z),
    );
    const o = new T.Mesh(
      new T.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: false }),
      m,
    );
    o.rotation.x = Math.PI / 2;
    a.add(o);
    return o;
  }
  wing(
    [
      [-1, -2],
      [-14, 5],
      [-14, 7],
      [-1, 3],
      [1, 3],
      [14, 7],
      [14, 5],
      [1, -2],
    ],
    paint,
  );
  wing(
    [
      [-1, 12],
      [-5, 15],
      [-5, 16],
      [5, 16],
      [5, 15],
      [1, 12],
    ],
    paint,
  );
  const tailCanvas = document.createElement("canvas");
  tailCanvas.width = tailCanvas.height = 512;
  const tg = tailCanvas.getContext("2d");
  tg.fillStyle = "#10264c";
  tg.fillRect(0, 0, 512, 512);
  tg.strokeStyle = "#f4f2ec";
  tg.lineWidth = 95;
  tg.beginPath();
  tg.moveTo(-80, 500);
  tg.bezierCurveTo(90, 490, 320, 180, 540, -30);
  tg.stroke();
  tg.strokeStyle = "#c62036";
  tg.lineWidth = 47;
  tg.beginPath();
  tg.moveTo(-40, 510);
  tg.bezierCurveTo(160, 400, 300, 130, 550, 0);
  tg.stroke();
  tg.strokeStyle = "#f4f2ec";
  tg.lineWidth = 55;
  tg.beginPath();
  tg.moveTo(10, -30);
  tg.lineTo(512, 440);
  tg.stroke();
  tg.strokeStyle = "#c62036";
  tg.lineWidth = 22;
  tg.stroke();
  const tailMat = new T.MeshStandardMaterial({
    map: new T.CanvasTexture(tailCanvas),
    side: T.DoubleSide,
    roughness: 0.55,
  });
  const finGeo = new T.BufferGeometry();
  finGeo.setAttribute(
    "position",
    new T.Float32BufferAttribute(
      [0, 1, 10, 0, 7.5, 14, 0, 7.5, 16, 0, 1, 16],
      3,
    ),
  );
  finGeo.setAttribute(
    "uv",
    new T.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 1, 0], 2),
  );
  finGeo.setIndex([0, 1, 2, 0, 2, 3]);
  finGeo.computeVertexNormals();
  a.add(new T.Mesh(finGeo, tailMat));
  const titlesCanvas = document.createElement("canvas");
  titlesCanvas.width = 2048;
  titlesCanvas.height = 256;
  const cg = titlesCanvas.getContext("2d");
  cg.fillStyle = "#14294b";
  cg.font = "bold 115px Georgia";
  cg.textAlign = "center";
  cg.fillText("BRITISH AIRWAYS", 1024, 130);
  cg.fillStyle = "#be2638";
  cg.beginPath();
  cg.moveTo(1760, 50);
  cg.quadraticCurveTo(1960, -20, 1880, 130);
  cg.quadraticCurveTo(1930, 30, 1760, 50);
  cg.fill();
  cg.font = "40px Arial";
  cg.fillText("G-LCYD    EMBRAER 190", 1050, 218);
  const titleMat = new T.MeshBasicMaterial({
    map: new T.CanvasTexture(titlesCanvas),
    transparent: true,
    side: T.DoubleSide,
    depthWrite: false,
  });
  for (const x of [-1.66, 1.66]) {
    const titleMesh = new T.Mesh(new T.PlaneGeometry(12, 1.5), titleMat);
    titleMesh.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2;
    titleMesh.position.set(x, 0.65, -6);
    a.add(titleMesh);
  }
  const belly = box(0, -1.4, -0.5, 1.8, 0.35, 28, blue, a);
  for (const x of [-14, 14]) {
    const tip = box(x, 0.6, 6, 0.15, 1.5, 2, blue, a);
    tip.rotation.z = x < 0 ? 0.25 : -0.25;
  }
  for (const x of [-5, 5]) {
    const eng = new T.Mesh(new T.CylinderGeometry(0.95, 0.8, 4, 20), paint);
    eng.rotation.x = Math.PI / 2;
    eng.position.set(x, -1.2, 2);
    a.add(eng);
    const exhaust = new T.Mesh(new T.CircleGeometry(0.66, 20), dark);
    exhaust.position.set(x, -1.2, 4.03);
    a.add(exhaust);
    const intake = new T.Mesh(new T.CircleGeometry(0.72, 20), dark);
    intake.rotation.y = Math.PI;
    intake.position.set(x, -1.2, -0.05);
    a.add(intake);
  }
  for (const x of [-1.67, 1.67])
    for (let z = -8; z < 9; z += 1.4) box(x, 0.4, z, 0.06, 0.5, 0.7, dark, a);
  box(0, 0.85, -15.2, 2.4, 0.7, 0.6, dark, a);
  for (const x of [-1, 1])
    for (const z of [-7, 4]) {
      box(x, -2, z, 0.15, 2, 0.15, dark, a);
      const wheel = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 0.3, 12), dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, -3, z);
      a.add(wheel);
    }
  return a;
}
const plane = aircraft();
scene.add(plane);
for (let i = 0; i < 7; i++) {
  const a = aircraft();
  a.position.set(-151, 4, -1220 - i * 68);
  a.rotation.y = Math.PI / 2;
  scene.add(a);
  box(-180, 2, -1220 - i * 68, 4, 4, 6, white);
} // parked regional jets
// Subtle volumetric-looking cloud banks.
const cloudMat = new T.MeshBasicMaterial({
  color: 0xe6e1d5,
  transparent: true,
  opacity: 0.065,
  depthWrite: false,
});
for (let i = 0; i < 35; i++) {
  const c = new T.Mesh(new T.SphereGeometry(1, 12, 8), cloudMat);
  c.position.set(
    (rand() - 0.5) * 22000,
    1300 + rand() * 1200,
    -9000 + rand() * 16000,
  );
  c.scale.set(500 + rand() * 1000, 45 + rand() * 65, 200 + rand() * 500);
}
let approach = "09";
function worldPos(x, y, z) {
  return approach === "09"
    ? new T.Vector3(-x, y, -1508 - z)
    : new T.Vector3(x, y, z);
}
function choose(v) {
  approach = v;
  $("west").classList.toggle("selected", v === "09");
  $("east").classList.toggle("selected", v === "27");
  $("runway-number").textContent = v;
  $("reticle-runway").textContent = v;
  document.querySelector(".flightbar b span").textContent = "→ RWY " + v;
}
$("west").onclick = () => choose("09");
$("east").onclick = () => choose("27");
let mode = "intro",
  flight = initialFlight(),
  keys = {},
  elapsed = 0,
  demoTime = 0,
  view = 0,
  paused = false,
  result = null,
  hideTitles = false;
let audio, osc, gain;
function initAudio() {
  if (audio) return;
  audio = new AudioContext();
  osc = audio.createOscillator();
  osc.type = "sawtooth";
  gain = audio.createGain();
  gain.gain.value = 0;
  const low = audio.createBiquadFilter();
  low.frequency.value = 230;
  osc.connect(low).connect(gain).connect(audio.destination);
  osc.start();
}
let sound = false;
$("sound").onclick = () => {
  initAudio();
  audio.resume();
  sound = !sound;
  $("sound").textContent = sound ? "SOUND ON" : "SOUND OFF";
};
function start(m) {
  mode = m;
  document.body.classList.add("play");
  $("hud").hidden = m !== "fly";
  $("caption").hidden = m !== "demo";
  $("result").hidden = true;
  flight = initialFlight();
  if (approach === "09") {
    flight.z = 6000;
    flight.y = 582;
  }
  demoTime = 0;
  result = null;
  paused = false;
  keys = {};
  plane.visible = true;
}
$("fly").onclick = () => start("fly");
$("demo").onclick = () => start("demo");
$("restart").onclick = $("again").onclick = () => start("fly");
$("camera").onclick = () => (view = (view + 1) % 3);
function exit() {
  mode = "intro";
  document.body.classList.remove("play");
  $("hud").hidden = $("caption").hidden = $("result").hidden = true;
  plane.visible = false;
}
$("menu").onclick = exit;
addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key))
    e.preventDefault();
  keys[e.key.toLowerCase().length === 1 ? e.key.toLowerCase() : e.key] = true;
  if (e.repeat) return;
  if (e.key === "Escape") exit();
  if (e.key.toLowerCase() === "r" && mode === "fly") start("fly");
  if (e.key.toLowerCase() === "c") view = (view + 1) % 3;
  if (e.key.toLowerCase() === "p") paused = !paused;
  if (e.key.toLowerCase() === "h") {
    hideTitles = !hideTitles;
    $("caption").hidden = hideTitles || mode !== "demo";
  }
  if (e.key.toLowerCase() === "m") $("sound").click();
});
addEventListener(
  "keyup",
  (e) =>
    (keys[e.key.toLowerCase().length === 1 ? e.key.toLowerCase() : e.key] =
      false),
);
addEventListener("blur", () => {
  keys = {};
  if (mode === "fly") paused = true;
});
document.querySelectorAll("[data-key]").forEach((b) => {
  b.onpointerdown = (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    keys[b.dataset.key] = true;
  };
  b.onpointerup = b.onpointercancel = () => (keys[b.dataset.key] = false);
});
function report(crash = false) {
  flight.done = true;
  $("result").hidden = false;
  $("result-title").textContent = crash
    ? "Approach missed."
    : "Welcome to London.";
  $("result-copy").textContent = crash
    ? result?.reason || "Runway overrun. Apply the brakes after touchdown."
    : `Touchdown ${Math.round(-flight.touchZ)} m past the threshold · ${Math.round(Math.abs(flight.touchVs) * 196.85)} ft/min`;
  $("score").textContent = crash ? "TRY AGAIN" : `${result.score} / 100`;
}
function updateFlight(dt) {
  if (!flight.done) {
    stepFlight(flight, keys, dt);
    const wp = worldPos(flight.x, flight.y, flight.z);
    if (
      !flight.ground &&
      cityColliders.some(
        (b) =>
          wp.x > b.minX - 6 &&
          wp.x < b.maxX + 6 &&
          wp.z > b.minZ - 8 &&
          wp.z < b.maxZ + 8 &&
          wp.y < b.h + 3,
      )
    ) {
      result = {
        reason:
          "Building strike. Keep above the skyline and follow the glideslope.",
      };
      report(true);
    }
    if (!flight.done && !flight.ground && flight.y <= 4.5) {
      result = landingVerdict(flight);
      flight.touchZ = flight.z;
      flight.touchVs = flight.vs;
      if (result.safe) {
        flight.ground = true;
        flight.y = 4.5;
        flight.pitch = 0;
        flight.bank = 0;
      } else report(true);
    }
    if (flight.ground && flight.speed < 2) report();
    if (flight.ground && flight.z < -1508) report(true);
    if (Math.abs(flight.x) > 4000 || flight.z < -2500) report(true);
  }
  plane.position.copy(worldPos(flight.x, flight.y, flight.z));
  plane.rotation.order = "YXZ";
  plane.rotation.set(
    (flight.pitch * Math.PI) / 180,
    (-flight.heading * Math.PI) / 180 + (approach === "09" ? Math.PI : 0),
    (flight.bank * Math.PI) / 180,
  );
  const dir = new T.Vector3(
    Math.sin((flight.heading * Math.PI) / 180),
    0,
    -Math.cos((flight.heading * Math.PI) / 180),
  ).multiplyScalar(approach === "09" ? -1 : 1);
  if (view === 0) {
    camera.position
      .copy(plane.position)
      .add(new T.Vector3(0, 9, approach === "09" ? -92 : 92));
    camera.lookAt(
      plane.position
        .clone()
        .addScaledVector(dir, 130)
        .add(new T.Vector3(0, -2, 0)),
    );
    plane.visible = true;
  } else if (view === 1) {
    camera.position
      .copy(plane.position)
      .add(new T.Vector3(0, 1, approach === "09" ? 12 : -12));
    camera.lookAt(
      plane.position
        .clone()
        .addScaledVector(dir, 300)
        .add(new T.Vector3(0, flight.pitch * 3, 0)),
    );
    plane.visible = false;
  } else {
    camera.position.copy(plane.position).add(new T.Vector3(40, 13, 20));
    camera.lookAt(plane.position);
    plane.visible = true;
  }
  $("speed").textContent = Math.round(flight.speed);
  $("alt").textContent = Math.max(0, Math.round((flight.y - 4.5) * 3.28084));
  $("vs").textContent = Math.round(flight.vs * 196.85);
  $("thrust").style.width = flight.throttle * 100 + "%";
  $("distance").textContent = (Math.max(0, flight.z) / 1852).toFixed(1) + " NM";
  const ideal = Math.max(0, flight.z) * Math.tan((5.5 * Math.PI) / 180) + 4.5,
    err = flight.y - ideal;
  $("guide").textContent = paused
    ? "PAUSED · P TO RESUME"
    : flight.ground
      ? "HOLD SPACE TO BRAKE"
      : flight.y < 25
        ? "FLARE · GENTLY RAISE THE NOSE"
        : Math.abs(flight.x) > 18
          ? "ALIGN WITH THE CENTRELINE"
          : err > 18
            ? "TOO HIGH · LOWER THE NOSE"
            : err < -18
              ? "TOO LOW · RAISE THE NOSE"
              : "ON GLIDESLOPE";
  $("status").textContent = flight.ground
    ? "TOUCHDOWN"
    : flight.speed < 100
      ? "STALL · ADD THRUST"
      : "CLEARED TO LAND";
  $("deviation").textContent =
    err > 15 ? "○ ○ ○ ●" : err < -15 ? "● ● ● ○" : "● ● ○ ○";
}
const titles = [
  "Above Canary Wharf.",
  "London. A different perspective.",
  "The famous 5.5° approach.",
  "Welcome to London City.",
];
function cinematic(t) {
  const segment = Math.floor(t / 10) % 4,
    u = (t % 10) / 10;
  plane.visible = true;
  plane.rotation.set(0, Math.PI, 0);
  if (segment === 0) {
    plane.position.set(0, 465 - u * 145, -6500 + u * 1500);
    camera.position.copy(plane.position).add(new T.Vector3(-55, 20, -95));
    camera.lookAt(plane.position.clone().add(new T.Vector3(0, 0, 40)));
  } else if (segment === 1) {
    plane.position.set(0, 180 - u * 70, -3300 + u * 650);
    camera.position.set(-620 + u * 180, 350 - u * 55, -2650 + u * 350);
    camera.lookAt(0, 0, -700);
  } else if (segment === 2) {
    plane.position.set(0, Math.max(5, 70 - u * 66), -2220 + u * 680);
    camera.position.copy(plane.position).add(new T.Vector3(-28, 9, -43));
    camera.lookAt(plane.position.clone().add(new T.Vector3(0, 0, 50)));
    plane.rotation.x = 0.04;
  } else {
    plane.position.set(0, 4.5, -1500 + u * 700);
    camera.position.copy(plane.position).add(new T.Vector3(-28, 9, -40));
    camera.lookAt(plane.position.clone().add(new T.Vector3(0, 0, 30)));
  }
  if (approach === "27") {
    plane.position.z = -1508 - plane.position.z;
    plane.position.x = -plane.position.x;
    plane.rotation.y = 0;
    const target = new T.Vector3();
    camera.getWorldDirection(target);
    const look = camera.position.clone().addScaledVector(target, 1000);
    camera.position.z = -1508 - camera.position.z;
    camera.position.x = -camera.position.x;
    look.z = -1508 - look.z;
    look.x = -look.x;
    camera.lookAt(look);
  }
  $("shot-title").textContent =
    approach === "27" && segment === 0
      ? "Over the Royal Docks."
      : titles[segment];
}
function intro(t) {
  plane.visible = false;
  if (approach === "09") {
    camera.position.set(-620 + Math.sin(t * 0.05) * 40, 390, -2550);
    camera.lookAt(0, 0, -600);
  } else {
    camera.position.set(630 + Math.sin(t * 0.05) * 40, 330, 700);
    camera.lookAt(-80, 0, -1000);
  }
}
let last = performance.now();
let manual = false;
function render(now) {
  if (manual) {
    requestAnimationFrame(render);
    return;
  }
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  elapsed += dt;
  if (mode === "intro") intro(elapsed);
  else if (mode === "demo") {
    if (!paused) demoTime += dt;
    cinematic(demoTime);
  } else updateFlight(paused ? 0 : dt);
  if (Math.floor(elapsed * 15) !== Math.floor((elapsed - dt) * 15)) {
    ocean.update(1 / 15);
    renderer.setRenderTarget(null);
    waters.forEach((w) => {
      for (let i = 0; i < 3; i++)
        w.material.uniforms["uSlope" + i].value = ocean.slope[i];
    });
  }
  waters.forEach((w) => (w.material.uniforms.time.value += dt * 0.32));
  if (audio) {
    gain.gain.setTargetAtTime(sound ? 0.018 : 0, audio.currentTime, 0.1);
    osc.frequency.setTargetAtTime(
      45 + (mode === "fly" ? flight.throttle : 0.5) * 55,
      audio.currentTime,
      0.2,
    );
  }
  renderer.render(scene, camera);
  window.__ready = true;
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
window.sim = {
  start,
  get flight() {
    return flight;
  },
  get mode() {
    return mode;
  },
  setFlight(s) {
    Object.assign(flight, s);
  },
  seek(t) {
    demoTime = t;
    cinematic(t);
    renderer.render(scene, camera);
  },
  renderAt(t) {
    manual = true;
    cinematic(t);
    waters.forEach((w) => (w.material.uniforms.time.value = t * 0.32));
    renderer.render(scene, camera);
  },
  renderer,
  choose,
  freeze() {
    manual = true;
  },
  advance(dt, k = {}) {
    keys = k;
    updateFlight(dt);
    if (dt === 0) renderer.render(scene, camera);
  },
};
if (new URLSearchParams(location.search).has("demo")) start("demo");
