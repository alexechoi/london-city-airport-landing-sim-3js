import * as T from "three";
const textures = new Map();
function texture(name, kind) {
  const key = name + "-" + kind;
  if (textures.has(key)) return textures.get(key);
  const t = new T.TextureLoader().load(
    "/textures/facades/" + key + (kind === "ORM" ? ".png" : ".jpg"),
  );
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = 8;
  if (kind === "Color") t.colorSpace = T.SRGBColorSpace;
  textures.set(key, t);
  return t;
}
const layouts = {
  Facade001: [16, 10],
  Facade005: [32, 24],
  Facade006: [14, 8],
  Facade018A: [6, 6],
  Facade019A: [6, 6],
  Facade020A: [6, 6],
};
export function facadeMaterial(
  name,
  { tint = 0xffffff, modern = false, context = false } = {},
) {
  const orm = texture(name, "ORM"),
    layout = layouts[name];
  const material = new T.MeshStandardMaterial({
    color: tint,
    map: texture(name, "Color"),
    normalMap: texture(name, "NormalGL"),
    aoMap: orm,
    roughnessMap: orm,
    metalnessMap: orm,
    metalness: 1,
    roughness: 0.9,
    aoMapIntensity: 0.75,
    envMapIntensity: modern ? 1.25 : 0.45,
  });
  material.normalScale.set(modern ? 0.035 : 0.65, modern ? 0.035 : 0.65);
  material.userData.pbrFacade = true;
  material.userData.reflectiveFacade = modern;
  material.customProgramCacheKey = () => `pbr-facade-${name}-${context}`;
  material.onBeforeCompile = (s) => {
    s.vertexShader =
      "attribute vec4 building;flat varying float facadeSeed;varying float facadeHeight;flat varying float facadeTotalHeight;\n" +
      s.vertexShader;
    s.vertexShader = s.vertexShader.replace(
      "#include <uv_vertex>",
      `#include <uv_vertex>
      facadeSeed=fract(building.x*.173);facadeHeight=position.y;facadeTotalHeight=building.w;
      vec2 tiles=vec2(${layout[0].toFixed(1)},${layout[1].toFixed(1)});
      vec2 cell=vec2(building.y,building.z);
      vec2 offset=floor(fract(vec2(building.x*.123,building.x*.373))*tiles)/tiles;
      vec2 facadeUV=uv/(tiles*cell)+offset;
      vMapUv=facadeUV;vNormalMapUv=facadeUV;vAoMapUv=facadeUV;vRoughnessMapUv=facadeUV;vMetalnessMapUv=facadeUV;
    `,
    );
    s.fragmentShader =
      "flat varying float facadeSeed;varying float facadeHeight;flat varying float facadeTotalHeight;\n" +
      s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      ${modern ? "diffuseColor.rgb=pow(max(diffuseColor.rgb,vec3(.001)),vec3(.55));" : ""}
      diffuseColor.rgb*=.91+facadeSeed*.18;
      diffuseColor.rgb*=mix(.79,1.,smoothstep(0.,8.,facadeHeight));
      ${context ? "float grey=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(grey)*vec3(.87,.94,1.),smoothstep(35.,60.,facadeTotalHeight));" : ""}
    `,
    );
  };
  return material;
}
