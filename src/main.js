import "./style.css";
import { cinematicPose, TOUR_TITLES } from "./cinematic.js";
import { reserveLandmarks, buildLondonLandmarks } from "./london-landmarks.js";
import { addBoundaryWeather, applyBoundaryFog } from "./weather.js";
import { facadeMaterial } from "./facade-materials.js";
import { airfieldMaterial } from "./airfield-materials.js";
import { REGION, regionClearance, GATE, atGate, onAirportPavement } from "./flight-region.js";
import { initCustomStart } from "./custom-start.js";
import { addDaylightSky } from "./daylight.js";
import { captureCityReflections } from "./city-reflections.js";
import { createPost } from "./post.js";
import { addStreetDetails } from "./street-details.js";
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
import { addCityCells } from "./city.js";
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
let sceneryConstructed = false;
let texturesReady = false,
  renderedFrames = 0;
T.DefaultLoadingManager.onStart = () => {
  texturesReady = false;
};
T.DefaultLoadingManager.onProgress = (url, loaded, total) =>
  window.setLoadingProgress(
    url.endsWith(".hdr")
      ? 45
      : Math.min(
          sceneryConstructed ? 94 : 65,
          (sceneryConstructed ? 70 : 45) + Math.round((loaded / total) * 20),
        ),
    url.endsWith(".hdr")
      ? "Loading daylight environment"
      : "Loading surface textures",
  );
T.DefaultLoadingManager.onLoad = () => {
  texturesReady = true;
};
T.DefaultLoadingManager.onError = () => window.loadingFailed();
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { Water } from "./vendor/three-water/Water.js";
import {
  OceanSim,
  defaultOceanParams,
} from "./vendor/ultra-water/water/OceanSim.js";
import {
  initialFlight,
  stepFlight,
  landingVerdict,
  customFlightState,
} from "./flight.js";
const $ = (id) => document.getElementById(id);
const gl = $("world").getContext("webgl2", {
  antialias: true,
  powerPreference: "high-performance",
});
const supportsReverseDepth = !!gl?.getExtension("EXT_clip_control");
const debugRenderer = gl?.getExtension("WEBGL_debug_renderer_info");
const softwareRenderer =
  debugRenderer &&
  /swiftshader|llvmpipe|software/i.test(
    gl.getParameter(debugRenderer.UNMASKED_RENDERER_WEBGL),
  );
const conserveResources =
  softwareRenderer && !new URLSearchParams(location.search).has("capture");
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
scene.fog = new T.FogExp2(0xb8c6cf, 0.00010);
const weather = addBoundaryWeather(scene);
const camera = new T.PerspectiveCamera(
  48,
  innerWidth / innerHeight,
  0.5,
  26000,
);
camera.layers.enable(1);
const post = createPost(renderer, scene, camera, conserveResources);
const sun = new T.Vector3(-0.431, 0.743, -0.509).normalize();
window.setLoadingProgress(33, "Loading daylight environment");
const daylight = await new HDRLoader().loadAsync("/textures/daylight-sky.hdr");
daylight.mapping = T.EquirectangularReflectionMapping;
addDaylightSky(scene, daylight, supportsReverseDepth, 2.868);
scene.environmentRotation.y = 2.868;
scene.environment = daylight;
scene.environmentIntensity = 0.18;
scene.add(new T.HemisphereLight(0xbcd4ee, 0x7d7568, 0.75));
const sunlight = new T.DirectionalLight(0xfff0d9, 3.8);
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
let seed = 41;
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
const mat = (c, r = 0.8, m = 0) =>
  new T.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const grass = airfieldMaterial("grass"),
  concrete = airfieldMaterial("concrete"),
  asphalt = airfieldMaterial("asphalt"),
  white = mat(0xe3ded0),
  glass = mat(0x60818c, 0.23, 0.65),
  dark = mat(0x283b48, 0.45, 0.3),
  yellow = mat(0xcbb66d);
const airportMeshes = [];
function box(x, y, z, w, h, d, m, parent = scene) {
  const geometry = new T.BoxGeometry(w,h,d);
  if(m.userData.pbrFacade) {
    const p=geometry.attributes.position,n=geometry.attributes.normal,uv=[],data=[];
    for(let i=0;i<p.count;i++) {uv.push(Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i),Math.abs(n.getY(i))>.5?p.getZ(i):p.getY(i));data.push(47,1.6,4.2,h);}
    geometry.setAttribute("uv",new T.Float32BufferAttribute(uv,2));geometry.setAttribute("building",new T.Float32BufferAttribute(data,4));
  }
  const o = new T.Mesh(geometry, m);
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
  windSpeed: 5.8,
  fetchKm: 2,
  waveScale: 0.32,
  swellScale: 0,
};
const ocean = new OceanSim(renderer, oceanParams);
ocean.update(0);
renderer.setRenderTarget(null);
const waters = [];
function water(x, z, w, d, geometry) {
  const o = new Water(geometry || new T.PlaneGeometry(w, d), {
    textureWidth: conserveResources ? 512 : 1024,
    textureHeight: conserveResources ? 512 : 1024,
    waterNormals: normals,
    sunDirection: sun,
    sunColor: 0xfff0d9,
    waterColor: 0x4b5b58,
    distortionScale: 2.4,
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
    `vec4 getNoise(vec2 uv){vec2 slope=texture2D(uSlope0,uv/600.0).xy;float eyeDistance=length(cameraPosition.xz-uv);slope+=texture2D(uSlope1,uv/85.0).xy*(1.-smoothstep(150.,1200.,eyeDistance));slope+=texture2D(uSlope2,uv/12.0).xy*(1.-smoothstep(30.,250.,eyeDistance));slope*=0.65;return vec4(-slope.x,-slope.y,1.0,1.0);}
` +
    o.material.fragmentShader.slice(en);
  o.material.fragmentShader = o.material.fragmentShader.replace(
    "reflectionSample + specularLight, reflectance",
    "reflectionSample * 0.42 + specularLight * 0.35, reflectance * 0.7",
  );
  o.material.fragmentShader = o.material.fragmentShader.replace(
    "sunColor * diffuseLight * 0.3 + scatter",
    "sunColor * diffuseLight * 0.06 + scatter * 1.8",
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
  if (plane.visible && plane.position.y < 100) renderer.shadowMap.needsUpdate = true;
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
box(-63, 0.98, -754, 30, 0.2, 1508, asphalt);
for (const z of [-150,-600,-1250]) box(-31.5, 1, z, 63, .16, 30, asphalt);
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
    [-62, 1.13, 0],
    [-62, 1.13, -1480],
  ],
  0xdbc174,
);
for (const z of [-150, -600, -1250]) {
  box(-31.5, 1.13, z, 63, .015, .22, yellow);
  for (const x of [-24,-26]) box(x,1.14,z,.15,.015,28,yellow);
}
// Continuous taxi route and a clear stand reserved for the player.
box(-63,1.13,-754,.22,.015,1508,yellow);
box(-107,1.13,-1250,88,.015,.22,yellow);
box(-108,1.13,-1337,.22,.015,174,yellow);
box(-140,1.13,-1424,64,.015,.22,yellow);
box(-182,1.14,-1424,.3,.015,12,yellow);
for (let i=0;i<7;i++) {
  const z=-1220-i*68;
  label(String(i+1),-190,1.15,z,8,10,"#e4c566");
  box(-166,1.12,z,56,.015,.18,yellow);
}
// Terminal: metric curtain-wall glazing, standing-seam roof and rooftop plant.
const terminalGlass=facadeMaterial("Facade001",{modern:true,tint:0xc6d6d5});
terminalGlass.envMap=daylight;terminalGlass.envMapRotation.y=2.868;terminalGlass.envMapIntensity=1;
const roofMetal=mat(0xb9c2c3,.48,.3);roofMetal.envMap=daylight;roofMetal.envMapIntensity=.3;
roofMetal.onBeforeCompile=s=>{
  s.vertexShader="varying vec3 vRoofWorld;\n"+s.vertexShader;
  s.vertexShader=s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nvRoofWorld=(modelMatrix*vec4(position,1.)).xyz;");
  s.fragmentShader="varying vec3 vRoofWorld;\n"+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\nfloat r=abs(fract(vRoofWorld.z/.7+.5)-.5)*.7;float seam=1.-smoothstep(.012,.012+fwidth(vRoofWorld.z),r);diffuseColor.rgb*=1.-seam*.18;");
};
box(-255, 9, -1450, 65, 18, 570, concrete);
box(-218, 10, -1450, 4, 15, 555, terminalGlass);
for(const y of [5.8,10,14.2])box(-215.8,y,-1450,.18,.16,555,dark);
for (let z = -1730; z < -1160; z += 28) {
  box(-253, 19, z, 70, 2, 24, roofMetal);
  box(-215, 9, z, 1, 18, 1, dark);
}
for(let z=-1700;z<-1160;z+=68) {
  box(-267,21,z,8,2,5,roofMetal);box(-267,22.1,z,7,.15,4,dark);
  for(let k=0;k<5;k++)box(-270+k*1.4,22.2,z,.12,.16,4,white);
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
// Explicit maps preserve each facade's reflection strength. Scene.environmentIntensity
// otherwise overrides MeshStandardMaterial.envMapIntensity in Three.js.
for (const material of buildingMats) {
  if (!material.userData.pbrFacade) continue;
  material.envMap = daylight;
  material.envMapRotation.y = scene.environmentRotation.y;
}
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
// The hand-built airport replaces OSM blocks on the runway and apron.
for (const b of mapData.buildings) {
  const p=b[1], x=p.reduce((n,v)=>n+v[0],0)/p.length, z=p.reduce((n,v)=>n+v[1],0)/p.length;
  if (x>-330&&x<85&&z>-1800&&z<25) b[4]="bespoke";
}
reserveLandmarks(mapData, contextData);
const cityModels = buildLondonLandmarks(scene, daylight);
const cityRoof = surfaceMaterial("roof");
const cityColliders = addCityCells(scene, mapData, buildingMats, cityRoof);
cityColliders.push(
  { minX: -288, maxX: -218, minZ: -1735, maxZ: -1165, h: 21 },
  { minX: -313, maxX: -287, minZ: -1853, maxZ: -1827, h: 57 },
);
const architectureStats = architecturalDetails(scene, [...mapData.buildings, ...contextData.buildings]);
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
for (let i = 0; i < 12; i++) {
  const a = (i * Math.PI) / 6 + Math.PI / 12,
    cs = Math.cos(a),
    sn = Math.sin(a);
  cityColliders.push({
    minX: o2Collision.x + Math.min(cs * 99, cs * 117) - 2,
    maxX: o2Collision.x + Math.max(cs * 99, cs * 117) + 2,
    minZ: o2Collision.z + Math.min(sn * 99, sn * 117) - 2,
    maxZ: o2Collision.z + Math.max(sn * 99, sn * 117) + 2,
    h: 104,
  });
}
cityColliders.push(...cityModels.colliders);
const collisions = collisionIndex(cityColliders);
const vegetationCount = await addVegetation(
  scene,
  landcover,
  waterData.map((p) => p.outer),
  collisions,
  [...mapData.roads,...contextData.roads],
  parkData,
);
const streetStats = addStreetDetails(scene, mapData.roads, waterData);
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
  mat(0x667e90, 0.38, 0.65),
);
pyramid.rotation.y = Math.PI / 4 - 0.125;
pyramid.position.set(canadaX, 220, canadaZ);
pyramid.material.envMapIntensity = 1.8;
pyramid.material.onBeforeCompile = (s) => {
  s.vertexShader = "varying float vCrownHeight;\n" + s.vertexShader;
  s.vertexShader = s.vertexShader.replace(
    "#include <begin_vertex>",
    "#include <begin_vertex>\nvCrownHeight=position.y;",
  );
  s.fragmentShader = "varying float vCrownHeight;\n" + s.fragmentShader;
  s.fragmentShader = s.fragmentShader.replace(
    "#include <color_fragment>",
    "#include <color_fragment>\nfloat q=vCrownHeight/1.5;float fw=max(fwidth(q),.0001);float stripe=abs(fract(q+.5)-.5);float seam=clamp((.015-stripe)/fw+.5,0.,1.)*min(1.,.03/fw);diffuseColor.rgb*=1.-seam*.12;",
  );
};
pyramid.castShadow = true;
scene.add(pyramid);
const crownCollar = box(
  canadaX,
  205,
  canadaZ,
  crownWidth,
  1.5,
  crownWidth,
  mat(0xaab5b9, 0.35, 0.6),
);
crownCollar.rotation.y = -0.125;
cityColliders.push({
  minX: canadaX - crownWidth / 2,
  maxX: canadaX + crownWidth / 2,
  minZ: canadaZ - crownWidth / 2,
  maxZ: canadaZ + crownWidth / 2,
  h: 235,
});
const o2 = geo(0.0032, 51.503);
const o2Stats = buildO2(scene, o2, o2Services);
sceneryConstructed = true;
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
  if (i === 3) continue; // Gate 4 is reserved for the player.
  const a = aircraft();
  a.position.set(-151, 4, -1220 - i * 68);
  a.rotation.y = Math.PI / 2;
  scene.add(a);
  box(-180, 2, -1220 - i * 68, 4, 4, 6, white);
} // parked regional jets
const airportBatch = mergeStaticMeshes(airportMeshes);
airportMeshes.forEach((o) => scene.remove(o));
scene.add(airportBatch);
applyBoundaryFog(scene);
let approach = "09";
let customStart = null;
function worldPos(x, y, z) {
  return approach === "09"
    ? new T.Vector3(-x, y, -1508 - z)
    : new T.Vector3(x, y, z);
}
function choose(v) {
  customStart = null;
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
  view = 0;
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
  if (m === "fly" && customStart)
    Object.assign(flight, customFlightState(customStart, approach));
  demoTime = 0;
  result = null;
  paused = false;
  keys = {};
  plane.visible = true;
}
$("fly").onclick = () => {
  customStart = null;
  start("fly");
};
const customMode = initCustomStart({
  buildings: [...mapData.buildings, ...contextData.buildings],
  roads: [...mapData.roads, ...contextData.roads],
  water: waterData,
  parks: parkData,
  getRunway: () => approach,
  validate: (p) => regionClearance(p)<100 ? {reason:"Choose a point inside the London flying area."} : collisions.hit(p, p),
  onStart: (config) => {
    choose(config.runway);
    customStart = config;
    start("fly");
  },
});
$("custom-mode").onclick = () => customMode.open();
$("demo").onclick = () => start("demo");
$("restart").onclick = $("again").onclick = () => start("fly");
$("camera").onclick = () => (view = (view + 1) % 4);
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
  if (e.key.toLowerCase() === "c") view = (view + 1) % 4;
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
    ? flight.outOfRange
      ? "Flight area exited."
      : flight.crashed
      ? "Aircraft lost."
      : "Approach missed."
    : "Parked at gate 4.";
  $("result-copy").textContent = crash
    ? result?.reason || "Runway overrun. Apply the brakes after touchdown."
    : `Gate 4 reached · Touchdown ${Math.round(-flight.touchZ)} m past the threshold · ${Math.round(Math.abs(flight.touchVs) * 196.85)} ft/min`;
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
    if (regionClearance(wp) < 0) {
      result = { reason: "You left the London flying area. Start a new approach to fly again." };
      flight.outOfRange = true;
      report(true);
      return;
    }
    if (flight.ground && !onAirportPavement(wp)) {
      result = { reason: "You left the paved airport surface. Follow the yellow taxi lines at walking speed." };
      report(true);
      return;
    }
    const struck = collisions.hit(previous, wp);
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
        flight.throttle = 0;
        flight.y = 4.5;
        flight.pitch = 0;
        flight.bank = 0;
      } else report(true);
    }
    if (flight.ground && atGate(wp, flight.speed, -flight.heading*Math.PI/180+(approach === "09" ? Math.PI : 0))) report();
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
  if (view === 0 || view === 1) {
    camera.position.copy(plane.position).add(
      dir
        .clone()
        .multiplyScalar(-66)
        .add(new T.Vector3(-dir.z * (view === 1 ? 14 : 0), 18, dir.x * (view === 1 ? 14 : 0))),
    );
    camera.lookAt(
      plane.position
        .clone()
        .addScaledVector(dir, 65)
        .add(new T.Vector3(0, -2, 0)),
    );
    plane.visible = true;
  } else if (view === 2) {
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
  const gatePoint=new T.Vector3(GATE.x,12,GATE.z).project(camera);
  $("gate-marker").hidden=!flight.ground||flight.done||gatePoint.z>1||gatePoint.z< -1||Math.abs(gatePoint.x)>.95||Math.abs(gatePoint.y)>.9;
  $("gate-marker").style.left=(gatePoint.x*.5+.5)*innerWidth+"px";
  $("gate-marker").style.top=(-gatePoint.y*.5+.5)*innerHeight+"px";
  $("camera").textContent = ["CHASE · C", "OFFSET · C", "NOSE · C", "EXTERNAL · C"][view];
  $("speed").textContent = Math.round(flight.speed);
  $("alt").textContent = Math.max(0, Math.round((flight.y - 4.5) * 3.28084));
  $("vs").textContent = Math.round(flight.vs * 196.85);
  $("thrust").style.width = flight.throttle * 100 + "%";
  $("distance").textContent =
    (
      (customStart && !flight.ground
        ? Math.hypot(flight.x, flight.z)
        : Math.max(0, flight.z)) / 1852
    ).toFixed(1) + " NM";
  const ideal = Math.max(0, flight.z) * Math.tan((5.5 * Math.PI) / 180) + 4.5,
    err = flight.y - ideal;
  const runwayBearing = (Math.atan2(-flight.x, flight.z) * 180) / Math.PI;
  const bearingError = (((runwayBearing - flight.heading + 180) % 360 + 360) % 360) - 180;
  const customCue =
    Math.abs(bearingError) < 12
      ? "RUNWAY AHEAD · JOIN FINAL"
      : bearingError < 0
        ? "TURN LEFT TOWARD RUNWAY"
        : "TURN RIGHT TOWARD RUNWAY";
  $("guide").textContent = paused
    ? "PAUSED · P TO RESUME"
    : flight.ground
      ? flight.speed > 22 ? "BRAKE BELOW 20 KT · EXIT TO TAXIWAY" : "TAXI TO GATE 4 · W/S THRUST · ←/→ STEER"
      : customStart && (flight.z < 0 || Math.abs(flight.x) > 300 || Math.abs(bearingError) > 30)
        ? customCue
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
    ? "TAXI · GATE 4"
    : flight.speed < 100
      ? "STALL · ADD THRUST"
      : "CLEARED TO LAND";
  if (!flight.ground && regionClearance(plane.position) < 1200 && !flight.done)
    $("guide").textContent = "EDGE OF FLYING AREA · TURN BACK";
  if (flight.ground) $("distance").textContent = Math.round(Math.hypot(plane.position.x-GATE.x,plane.position.z-GATE.z))+" M TO GATE 4";
  $("deviation").textContent =
    err > 15 ? "○ ○ ○ ●" : err < -15 ? "● ● ● ○" : "● ● ○ ○";
}
function cinematic(t) {
  const pose=cinematicPose(t,cityModels.sites,approach);
  plane.visible=true;
  plane.position.copy(pose.position);
  plane.rotation.order="YXZ";
  plane.rotation.set(pose.pitch,pose.yaw,pose.bank);
  camera.position.copy(pose.camera);camera.lookAt(pose.target);
  $("shot-title").textContent=TOUR_TITLES[pose.segment];
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
let cityReflectionsReady = false;
let last = performance.now();
let manual = false;
function render(now) {
  if (manual) {
    requestAnimationFrame(render);
    return;
  }
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
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
  if (texturesReady && !cityReflectionsReady) {
    window.setLoadingProgress(96, "Reflecting the Canary Wharf skyline");
    const savedPosition = camera.position.clone();
    camera.position.set(-430, 125, -5680);
    updateShadows();
    captureCityReflections(renderer, scene, buildingMats, waters, plane, camera.position);
    camera.position.set(430, 150, -10550);
    shadowFocus.set(Infinity,0,Infinity);
    updateShadows();
    captureCityReflections(renderer, scene, cityModels.cityMaterials, waters, plane, camera.position);
    camera.position.copy(savedPosition);
    shadowFocus.set(Infinity, 0, Infinity);
    cityReflectionsReady = true;
  }
  streetStats.update(paused ? 0 : dt);
  cityModels.update(elapsed);
  updateShadows();
  weather.update(camera);
  post.render();
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
  post.resize(innerWidth, innerHeight);
});
window.sim = {
  start,
  get customStart() {
    return customStart;
  },
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
    weather.update(camera);
  post.render();
  },
  renderAt(t) {
    manual = true;
    streetStats.update(1/24);
    cityModels.update(t);
    cinematic(t);
    ocean.time = t;
    ocean.update(0);
    renderer.setRenderTarget(null);
    waters.forEach((w) => {
      w.material.uniforms.time.value = t * 0.32;
      for (let i = 0; i < 3; i++)
        w.material.uniforms["uSlope" + i].value = ocean.slope[i];
    });
    updateShadows();
    weather.update(camera);
  post.render();
  },
  renderer,
  architectureStats,
  o2Stats,
  streetStats,
  landmarks: cityModels.sites,
  get fogDensity() { return scene.fog.density; },
  vegetationCount,
  setContactOcclusion(enabled) {post.setOcclusion(enabled);post.render();},
  setShadows(enabled, normalBias = 0.65) {
    renderer.shadowMap.enabled = enabled;
    sunlight.shadow.normalBias = normalBias;
    renderer.shadowMap.needsUpdate = true;
    weather.update(camera);
  post.render();
  },
  landmark: { position: [canadaX, 205, canadaZ], crownWidth },
  inspect(position, target) {
    manual = true;
    plane.visible = false;
    camera.position.fromArray(position);
    camera.lookAt(...target);
    updateShadows();
    weather.update(camera);
  post.render();
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
    streetStats.update(dt);
    cityModels.update(elapsed += dt);
    keys = k;
    updateFlight(dt);
    if (dt === 0) {
      updateShadows();
      weather.update(camera);
  post.render();
    }
  },
};
if (new URLSearchParams(location.search).has("demo")) start("demo");
