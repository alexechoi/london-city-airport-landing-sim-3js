import "./style.css";
import { buildO2 } from "./o2.js";
import { addLandmarkDetails } from "./landmarks.js";
import { mergeStaticMeshes } from "./batching.js";
import { Impact } from "./impact.js";
import { collisionIndex } from "./collision.js";
import { buildUrbanGround } from "./ground.js";
import { architecturalDetails } from "./architecture.js";
import { createCityMaterials, surfaceMaterial } from "./materials.js";
import { addContextCity } from "./context-city.js";
import { addVegetation } from "./vegetation.js";
import { addCity } from "./city.js";
window.setLoadingProgress(8, "Loading London map data");
const [mapData, waterData, contextData, parkData] = await Promise.all([
  fetch("/london.json").then((r) => r.json()),
  fetch("/water.json").then((r) => r.json()),
  fetch("/context.json").then((r) => r.json()),
  fetch("/parks.json").then((r) => r.json()),
]);
window.setLoadingProgress(30, "Constructing the airport and skyline");
await new Promise((resolve) =>
  requestAnimationFrame(() => requestAnimationFrame(resolve)),
);
import * as T from "three";
let texturesReady = false,
  renderedFrames = 0;
T.DefaultLoadingManager.onStart = () => {
  texturesReady = false;
};
T.DefaultLoadingManager.onProgress = (url, loaded, total) =>
  window.setLoadingProgress(
    Math.min(94, 70 + Math.round((loaded / total) * 24)),
    "Loading surface textures",
  );
T.DefaultLoadingManager.onLoad = () => {
  texturesReady = true;
};
T.DefaultLoadingManager.onError = () => window.loadingFailed();
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Sky } from "three/addons/objects/Sky.js";
import { Water } from "./vendor/three-water/Water.js";
import {
  OceanSim,
  defaultOceanParams,
} from "./vendor/ultra-water/water/OceanSim.js";
import { initialFlight, stepFlight, landingVerdict } from "./flight.js";
const $ = (id) => document.getElementById(id);
const gl = $("world").getContext("webgl2", {
  antialias: true,
  powerPreference: "high-performance",
});
const supportsReverseDepth = !!gl?.getExtension("EXT_clip_control");
const renderer = new T.WebGLRenderer({
  canvas: $("world"),
  antialias: true,
  context: gl,
  reversedDepthBuffer: supportsReverseDepth,
  logarithmicDepthBuffer: !supportsReverseDepth,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFShadowMap;
const scene = new T.Scene();
scene.fog = new T.FogExp2(0xb8c6cf, 0.00012);
const camera = new T.PerspectiveCamera(
  48,
  innerWidth / innerHeight,
  0.5,
  26000,
);
const sun = new T.Vector3(-0.55, 0.48, -0.65).normalize();
const sky = new Sky();
sky.scale.setScalar(40000);
sky.material.fragmentShader = sky.material.fragmentShader.replace(
  "gl_FragColor = vec4( texColor, 1.0 );",
  "gl_FragColor = vec4( texColor * .45, 1.0 );",
);
scene.add(sky);
Object.assign(sky.material.uniforms.turbidity, { value: 5 });
sky.material.uniforms.rayleigh.value = 1.5;
sky.material.uniforms.mieCoefficient.value = 0.006;
sky.material.uniforms.sunPosition.value.copy(sun);
scene.add(new T.HemisphereLight(0xbcd4ee, 0x7d7568, 1.45));
const sunlight = new T.DirectionalLight(0xffdbad, 4.1);
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
sunlight.shadow.bias = supportsReverseDepth ? 0.00025 : -0.00025;
sunlight.shadow.normalBias = 0.65;
sunlight.target.position.set(0, 0, -750);
scene.add(sunlight.target);
scene.add(sunlight);
const environmentScene = new T.Scene();
environmentScene.add(sky.clone());
const pmrem = new T.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(environmentScene, 0.04).texture;
scene.environmentIntensity = 0.035;
pmrem.dispose();
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
const airportMeshes = [];
function box(x, y, z, w, h, d, m, parent = scene) {
  const o = new T.Mesh(new T.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  if (parent === scene) airportMeshes.push(o);
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
const loader = new T.TextureLoader();
const landcover = loader.load("/textures/landcover.jpg");
const terrain = surfaceMaterial("terrain", landcover);
const landMesh = new T.Mesh(
  new T.PlaneGeometry(50000, 50000, 150, 150),
  terrain,
);
landMesh.rotation.x = -Math.PI / 2;
landMesh.position.set(0, -2, -2500);
landMesh.receiveShadow = true;
scene.add(landMesh);
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
  waveScale: 0.12,
  swellScale: 0,
};
const ocean = new OceanSim(renderer, oceanParams);
ocean.update(0);
renderer.setRenderTarget(null);
const waters = [];
function water(x, z, w, d, geometry) {
  const o = new Water(geometry || new T.PlaneGeometry(w, d), {
    textureWidth: 1024,
    textureHeight: 1024,
    waterNormals: normals,
    sunDirection: sun,
    sunColor: 0xffe4bc,
    waterColor: 0x18383a,
    distortionScale: 0.65,
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
    `vec4 getNoise(vec2 uv){vec2 slope=texture2D(uSlope0,uv/600.0).xy+texture2D(uSlope1,uv/85.0).xy+texture2D(uSlope2,uv/12.0).xy; slope*=0.35;return vec4(-slope.x,-slope.y,1.0,1.0);}
` +
    o.material.fragmentShader.slice(en);
  o.material.fragmentShader = o.material.fragmentShader.replace(
    "reflectionSample + specularLight, reflectance",
    "reflectionSample * 0.42 + specularLight * 0.35, reflectance * 0.7",
  );
  scene.add(o);
  waters.push(o);
  return o;
}
const shapes = waterData.map(({ outer, holes }) => {
  const shape = new T.Shape(outer.map((p) => new T.Vector2(p[0], -p[1])));
  for (const ring of holes)
    shape.holes.push(new T.Path(ring.map((p) => new T.Vector2(p[0], -p[1]))));
  return shape;
});
// All docks and the Thames now use joined, mapped OSM water polygons.
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
const shadowFocus = new T.Vector3(Infinity, 0, Infinity);
function updateShadows() {
  const focus = new T.Vector3(camera.position.x, 0, camera.position.z);
  if (focus.distanceToSquared(shadowFocus) < 160 * 160) return;
  shadowFocus.copy(focus);
  sunlight.target.position.copy(focus);
  sunlight.position.copy(focus).addScaledVector(sun, 4000);
  sunlight.target.updateMatrixWorld();
  renderer.shadowMap.needsUpdate = true;
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
const bulbGeo = new T.SphereGeometry(0.16, 8, 6);
function bulb(x, y, z, m) {
  const o = new T.Mesh(bulbGeo, m);
  o.position.set(x, y, z);
  scene.add(o);
  airportMeshes.push(o);
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
  if (parent === scene) airportMeshes.push(o);
  return o;
}
// Digital control tower.
cylinder(4, 6, 42, concrete, -300, 21, -1840);
cylinder(11, 7, 7, glass, -300, 44, -1840);
cylinder(13, 11, 2, white, -300, 49, -1840);
box(-300, 56, -1840, 1, 13, 1, dark);
// Unique per-building material seeds, metric window bays and footprint-relative shaders.
const buildingMats = createCityMaterials();
// Enrich only the original two-floor fallback; explicit OSM heights remain unchanged.
for (let i = 0; i < mapData.buildings.length; i++) {
  const b = mapData.buildings[i];
  if (!b[3] || b[0] !== 6.2) continue;
  if (b[2] === "apartments") b[0] = 15.5 + (i % 3) * 3.1;
  else if (b[2] === "office") b[0] = 21.7;
}

// One Canada Square's surveyed height includes its crown. Build body and crown from one footprint.
const canadaBuilding = mapData.buildings.find(
  ([h, p]) => h > 200 && Math.hypot(p[0][0] + 295, p[0][1] + 5928) < 100,
);
const canadaFootprint = canadaBuilding[1].slice(0, -1);
const canadaBounds = {
  minX: Math.min(...canadaFootprint.map((p) => p[0])),
  maxX: Math.max(...canadaFootprint.map((p) => p[0])),
  minZ: Math.min(...canadaFootprint.map((p) => p[1])),
  maxZ: Math.max(...canadaFootprint.map((p) => p[1])),
};
canadaBuilding[0] = 205;
window.setLoadingProgress(55, "Building London architecture");
await new Promise((resolve) =>
  requestAnimationFrame(() => requestAnimationFrame(resolve)),
);
// Replace the generic extrusions of O2 service towers with their cylindrical architecture.
const o2Services = mapData.buildings.filter((b, i) => {
  if (i >= 508 && i <= 519) {
    b[4] = "o2-service";
    return true;
  }
  return false;
});
const cityRoof = surfaceMaterial("roof");
const cityColliders = addCity(scene, mapData, buildingMats, cityRoof);
cityColliders.push(
  { minX: -288, maxX: -218, minZ: -1735, maxZ: -1165, h: 21 },
  { minX: -313, maxX: -287, minZ: -1853, maxZ: -1827, h: 57 },
);
const architectureStats = architecturalDetails(scene, mapData.buildings);
buildUrbanGround(
  scene,
  { ...mapData, roads: [...mapData.roads, ...contextData.roads] },
  parkData,
);
cityColliders.push(
  ...addContextCity(scene, contextData, buildingMats, cityRoof),
);
cityColliders.push({ ...canadaBounds, h: 235 });
const o2Collision = geo(0.0032, 51.503);
cityColliders.push({
  minX: o2Collision.x - 180,
  maxX: o2Collision.x + 180,
  minZ: o2Collision.z - 180,
  maxZ: o2Collision.z + 180,
  h: 52,
});
const collisions = collisionIndex(cityColliders);
const vegetationCount = await addVegetation(
  scene,
  landcover,
  waterData.map((p) => p.outer),
  collisions,
  mapData.roads,
);
const impact = new Impact(scene);
addLandmarkDetails(scene, mapData);
// Crown shares the tower's bounds and sits directly on its 205 m roof.
const canadaX = (canadaBounds.minX + canadaBounds.maxX) / 2,
  canadaZ = (canadaBounds.minZ + canadaBounds.maxZ) / 2;
const crownWidth =
  Math.min(
    canadaBounds.maxX - canadaBounds.minX,
    canadaBounds.maxZ - canadaBounds.minZ,
  ) * 0.93;
const pyramid = new T.Mesh(
  new T.ConeGeometry(crownWidth / Math.SQRT2, 30, 4),
  mat(0xaab5b9, 0.3, 0.7),
);
pyramid.rotation.y = Math.PI / 4 - 0.049;
pyramid.position.set(canadaX, 220, canadaZ);
pyramid.material.envMapIntensity = 8;
pyramid.material.onBeforeCompile = (s) => {
  s.vertexShader = "varying float vCrownHeight;\n" + s.vertexShader;
  s.vertexShader = s.vertexShader.replace(
    "#include <begin_vertex>",
    "#include <begin_vertex>\nvCrownHeight=position.y;",
  );
  s.fragmentShader = "varying float vCrownHeight;\n" + s.fragmentShader;
  s.fragmentShader = s.fragmentShader.replace(
    "#include <color_fragment>",
    "#include <color_fragment>\nfloat stripe=abs(fract(vCrownHeight/1.5)-.5);float seam=1.-smoothstep(.02,.02+fwidth(vCrownHeight),stripe);diffuseColor.rgb*=1.-seam*.22;",
  );
};
pyramid.castShadow = true;
scene.add(pyramid);
box(
  canadaX,
  205,
  canadaZ,
  crownWidth,
  1.5,
  crownWidth,
  mat(0xaab5b9, 0.35, 0.6),
);
cityColliders.push({
  minX: canadaX - crownWidth / 2,
  maxX: canadaX + crownWidth / 2,
  minZ: canadaZ - crownWidth / 2,
  maxZ: canadaZ + crownWidth / 2,
  h: 235,
});
const o2 = geo(0.0032, 51.503);
const o2Stats = buildO2(scene, o2, o2Services);
window.setLoadingProgress(72, "Loading the Embraer 190 model");
const aircraftAsset = await new GLTFLoader().loadAsync("/models/e190.glb");
const aircraftParts = [];
aircraftAsset.scene.traverse((o) => {
  if (o.isMesh) aircraftParts.push(o);
});
const aircraftTemplate = mergeStaticMeshes(aircraftParts);
const assetBounds = new T.Box3().setFromObject(aircraftTemplate);
aircraftTemplate.position.set(
  -(assetBounds.min.x + assetBounds.max.x) / 2,
  -3.4 - assetBounds.min.y,
  -(assetBounds.min.z + assetBounds.max.z) / 2,
);
aircraftTemplate.traverse((o) => {
  if (o.isMesh) {
    o.castShadow = true;
    o.receiveShadow = true;
    if (o.material) {
      o.material.envMapIntensity = 0.5;
      if (o.material.map)
        o.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    }
  }
});
function aircraft() {
  const group = new T.Group();
  group.add(aircraftTemplate.clone(true));
  return group;
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
const airportBatch = mergeStaticMeshes(airportMeshes);
airportMeshes.forEach((o) => scene.remove(o));
scene.add(airportBatch);
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
  impact.reset();
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
  impact.reset();
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
function playImpactSound() {
  if (!sound || !audio) return;
  const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate),
    samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++)
    samples[i] =
      (Math.random() * 2 - 1) * Math.exp(-i / (audio.sampleRate * 0.45));
  const noise = audio.createBufferSource();
  noise.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 600;
  const volume = audio.createGain();
  volume.gain.value = 0.5;
  noise.connect(filter).connect(volume).connect(audio.destination);
  noise.start();
  noise.onended = () => {
    noise.disconnect();
    filter.disconnect();
    volume.disconnect();
  };
}
function report(crash = false) {
  flight.done = true;
  $("result").hidden = false;
  $("result-title").textContent = crash
    ? flight.crashed
      ? "Aircraft lost."
      : "Approach missed."
    : "Welcome to London.";
  $("result-copy").textContent = crash
    ? result?.reason || "Runway overrun. Apply the brakes after touchdown."
    : `Touchdown ${Math.round(-flight.touchZ)} m past the threshold · ${Math.round(Math.abs(flight.touchVs) * 196.85)} ft/min`;
  $("score").textContent = crash ? "TRY AGAIN" : `${result.score} / 100`;
}
function updateFlight(dt) {
  if (flight.crashed) {
    impact.update(dt);
    plane.visible = false;
    camera.lookAt(impact.origin);
    if (impact.age > 1.8 && $("result").hidden) report(true);
    return;
  }
  if (!flight.done) {
    const previous = worldPos(flight.x, flight.y, flight.z);
    stepFlight(flight, keys, dt);
    const wp = worldPos(flight.x, flight.y, flight.z);
    const struck = !flight.ground && collisions.hit(previous, wp);
    if (struck) {
      result = {
        reason:
          "Building strike. Keep above the skyline and follow the glideslope.",
      };
      flight.done = true;
      flight.crashed = true;
      $("status").textContent = "BUILDING IMPACT";
      $("guide").textContent = "AIRCRAFT LOST";
      const sides = [
        {
          d: Math.abs(wp.x - struck.minX),
          x: struck.minX - 3,
          z: Math.max(struck.minZ, Math.min(struck.maxZ, wp.z)),
          nx: -1,
          nz: 0,
        },
        {
          d: Math.abs(wp.x - struck.maxX),
          x: struck.maxX + 3,
          z: Math.max(struck.minZ, Math.min(struck.maxZ, wp.z)),
          nx: 1,
          nz: 0,
        },
        {
          d: Math.abs(wp.z - struck.minZ),
          z: struck.minZ - 3,
          x: Math.max(struck.minX, Math.min(struck.maxX, wp.x)),
          nx: 0,
          nz: -1,
        },
        {
          d: Math.abs(wp.z - struck.maxZ),
          z: struck.maxZ + 3,
          x: Math.max(struck.minX, Math.min(struck.maxX, wp.x)),
          nx: 0,
          nz: 1,
        },
      ];
      sides.sort((a, b) => a.d - b.d);
      const face = sides[0],
        contact = new T.Vector3(
          face.x,
          Math.max(3, Math.min(struck.h, wp.y)),
          face.z,
        );
      impact.trigger(contact);
      plane.visible = false;
      const forward = new T.Vector3(
        Math.sin((flight.heading * Math.PI) / 180),
        0,
        -Math.cos((flight.heading * Math.PI) / 180),
      ).multiplyScalar(approach === "09" ? -1 : 1);
      camera.position
        .copy(contact)
        .add(new T.Vector3(face.nx * 75, 25, face.nz * 75));
      camera.lookAt(contact);
      playImpactSound();
      return;
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
    camera.position.copy(plane.position).add(
      dir
        .clone()
        .multiplyScalar(-66)
        .add(new T.Vector3(-dir.z * 14, 18, dir.x * 14)),
    );
    camera.lookAt(
      plane.position
        .clone()
        .addScaledVector(dir, 65)
        .add(new T.Vector3(0, -2, 0)),
    );
    plane.visible = true;
  } else if (view === 1) {
    camera.position.copy(plane.position).add(
      dir
        .clone()
        .multiplyScalar(12)
        .add(new T.Vector3(0, 1, 0)),
    );
    camera.lookAt(
      plane.position
        .clone()
        .addScaledVector(dir, 300)
        .add(new T.Vector3(0, flight.pitch * 3, 0)),
    );
    plane.visible = false;
  } else {
    camera.position
      .copy(plane.position)
      .add(new T.Vector3(-dir.z * 40, 13, dir.x * 40))
      .addScaledVector(dir, -20);
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
    plane.position.set(0, 340 - u * 80, -6500 + u * 1500);
    camera.position.copy(plane.position).add(new T.Vector3(110, 35, -160));
    camera.lookAt(plane.position.clone().add(new T.Vector3(-70, -65, 220)));
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
  updateShadows();
  renderer.render(scene, camera);
  renderedFrames++;
  if (
    texturesReady &&
    renderedFrames > 2 &&
    !window.__ready &&
    !document.getElementById("loading").dataset.failed
  ) {
    window.__ready = true;
    window.setLoadingProgress(100, "Ready for departure");
    document.body.classList.remove("loading");
    document.getElementById("loading").classList.add("complete");
    setTimeout(() => (document.getElementById("loading").hidden = true), 500);
  }
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
    updateShadows();
    renderer.render(scene, camera);
  },
  renderAt(t) {
    manual = true;
    cinematic(t);
    waters.forEach((w) => (w.material.uniforms.time.value = t * 0.32));
    updateShadows();
    renderer.render(scene, camera);
  },
  renderer,
  architectureStats,
  o2Stats,
  vegetationCount,
  setShadows(enabled, normalBias = 0.65) {
    renderer.shadowMap.enabled = enabled;
    sunlight.shadow.normalBias = normalBias;
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
  },
  landmark: { position: [canadaX, 205, canadaZ], crownWidth },
  inspect(position, target) {
    manual = true;
    plane.visible = false;
    camera.position.fromArray(position);
    camera.lookAt(...target);
    updateShadows();
    renderer.render(scene, camera);
  },
  get camera() {
    return {
      position: camera.position.toArray(),
      direction: camera.getWorldDirection(new T.Vector3()).toArray(),
    };
  },
  get impact() {
    return { age: impact.age, visible: impact.group.visible };
  },
  get buildings() {
    return cityColliders;
  },
  choose,
  freeze() {
    manual = true;
  },
  advance(dt, k = {}) {
    keys = k;
    updateFlight(dt);
    if (dt === 0) {
      updateShadows();
      renderer.render(scene, camera);
    }
  },
};
if (new URLSearchParams(location.search).has("demo")) start("demo");
