import * as T from "three";
export function airfieldMaterial(kind) {
  const asset = { asphalt: "clean_asphalt", concrete: "concrete_floor_worn_001", grass: "leafy_grass" }[kind];
  const load = (channel, color = false) => {
    const t = new T.TextureLoader().load(`/textures/ground/${asset}-${channel}.jpg`);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 16;
    if (color) t.colorSpace = T.SRGBColorSpace;
    return t;
  };
  const m = new T.MeshStandardMaterial({ map: load("color", true), normalMap: load("normal"), roughnessMap: load("rough"), roughness: .95, color: 0xffffff });
  m.normalScale.set(.4,.4);
  m.customProgramCacheKey = () => `airfield-${kind}`;
  m.onBeforeCompile = s => {
    s.vertexShader = "varying vec3 vAirfield;\n" + s.vertexShader;
    s.vertexShader = s.vertexShader.replace("#include <uv_vertex>", `#include <uv_vertex>
      vAirfield=(modelMatrix*vec4(position,1.)).xyz;
      vec3 wn=abs(normalize(mat3(modelMatrix)*normal));
      vec2 metric=wn.y>.5?vAirfield.xz:(wn.x>.5?vAirfield.zy:vAirfield.xy);
      vec2 texUV=metric/${kind === "grass" ? "3." : kind === "asphalt" ? "4." : "6."};
      vMapUv=texUV;vNormalMapUv=texUV;vRoughnessMapUv=texUV;
    `);
    s.fragmentShader = "varying vec3 vAirfield;\n" + s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      vec2 p=vAirfield.xz;
      ${kind === "concrete" ? "diffuseColor.rgb*=2.2;" : ""}
      ${kind === "concrete" ? `vec2 q=abs(fract(p/6.+.5)-.5)*6.;vec2 fw=max(fwidth(p),vec2(.001));float seam=max(1.-smoothstep(.014,.014+fw.x,q.x),1.-smoothstep(.014,.014+fw.y,q.y));diffuseColor.rgb*=1.-seam*.18;` : ""}
      ${kind === "asphalt" ? `float centre=exp(-pow(p.x/5.,2.));float touch=max(exp(-pow((p.y+320.)/185.,2.)),exp(-pow((p.y+1188.)/185.,2.)));float tyre=.55+.45*sin(p.x*8.)*(1.-smoothstep(.8,3.14,fwidth(p.x*8.)));diffuseColor.rgb*=1.-centre*touch*tyre*.42;` : ""}
      ${kind === "grass" ? `float lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));float mow=sin(p.y*.11)*.5*(1.-smoothstep(.8,3.14,fwidth(p.y*.11)))+.5;diffuseColor.rgb=vec3(.10,.155,.043)*(.65+lum*1.8)*(.92+.08*mow);` : ""}
    `);
  };
  return m;
}
