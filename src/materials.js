import * as T from "three";
import { facadeMaterial } from "./facade-materials.js";
// WebGL implementation of the material techniques in Slop New York's tsl-materials.js.
// The box-filtered pulse is adapted from that MIT-licensed source; see vendor/slop-new-york/LICENSE.
const common = /* glsl */ `
float hashCity(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noiseCity(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hashCity(i),hashCity(i+vec2(1,0)),f.x),mix(hashCity(i+vec2(0,1)),hashCity(i+vec2(1,1)),f.x),f.y);}
float integralPulse(float t,float a,float b){return floor(t)*(b-a)+clamp(fract(t),a,b)-a;}
float pulse(float p,float a,float b,float width){float h=max(width,.0001)*.5;return clamp((integralPulse(p+h,a,b)-integralPulse(p-h,a,b))/(2.*h),0.,1.);}
float band(float p,float period,float width){float q=p/period;return 1.-pulse(fract(q),width/period,1.-width/period,fwidth(q));}
`;
const vertex = `attribute vec4 building;flat varying vec4 vBuilding;varying vec2 vMetric;varying vec3 vCityPosition;varying vec3 vCityNormal;`;
const setup = `vBuilding=building;vMetric=uv;vCityPosition=(modelMatrix*vec4(position,1.)).xyz;vCityNormal=normalize(mat3(modelMatrix)*normal);`;
const photoCache = new Map();
function surfacePhoto(name, colour = true) {
  const key = name + colour;
  if (photoCache.has(key)) return photoCache.get(key);
  const texture = new T.TextureLoader().load("/textures/" + name + ".jpg");
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.anisotropy = 8;
  if (colour) texture.colorSpace = T.SRGBColorSpace;
  photoCache.set(key, texture);
  return texture;
}
export function createCityMaterials() {
  const styles = [
    [0x667987, 0x29495b, true],
    [0xc1b49c, 0x283b44, false],
    [0x945a44, 0x263a42, false],
    [0xa28e6a, 0x32464c, false],
    [0xb2b3ac, 0x293d49, false],
    [0x555a5c, 0x223239, true],
    [0xafb7bb, 0x52636c, true],
    [0x969b98, 0x223239, false],
    [0xa19a8c, 0x29495b, false],
    [0xc3cccd, 0x506d80, false],
    [0xadbfc5, 0x3e7e91, true],
  ];
  return styles.map(([wall, glass, modern], idx) => {
    const facades = {
      0: ["Facade001", { modern: true }],
      1: ["Facade018A", { tint: 0xe4dfd5 }],
      2: ["Facade020A", {}],
      3: ["Facade018A", {}],
      4: ["Facade019A", { tint: 0xe0e1dd }],
      5: ["Facade005", { modern: true }],
      6: ["Facade006", { modern: true }],
      8: ["Facade018A", { context: true }],
      10: ["Facade001", { modern: true, tint: 0xc0e2ea }],
    };
    if (facades[idx]) return facadeMaterial(...facades[idx]);
    const mat = new T.MeshStandardMaterial({
      roughness: 0.7,
      metalness: 0.08,
      side: T.FrontSide,
      envMapIntensity: modern ? 1.5 : 1,
    });
    const photoName =
      idx === 2
        ? "red_brick_03"
        : idx === 3
          ? "brick_wall_001"
          : idx === 1 || idx === 4
            ? "concrete_wall_003"
            : null;
    if (photoName) {
      mat.normalMap = surfacePhoto(photoName + "-nor_gl", false);
      mat.normalMap.repeat.set(0.5, 0.5);
      mat.normalScale.set(0.35, 0.35);
    }
    mat.customProgramCacheKey = () => `london-facade-${idx}`;
    mat.onBeforeCompile = (s) => {
      if (photoName)
        s.uniforms.wallPhoto = { value: surfacePhoto(photoName + "-Diffuse") };
      s.uniforms.wallTint = { value: new T.Color(wall) };
      s.uniforms.glassTint = { value: new T.Color(glass) };
      s.vertexShader = vertex + "\n" + s.vertexShader;
      s.vertexShader = s.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n" + setup,
      );
      s.fragmentShader =
        `${photoName ? "uniform sampler2D wallPhoto;" : ""}uniform vec3 wallTint;uniform vec3 glassTint;flat varying vec4 vBuilding;varying vec2 vMetric;varying vec3 vCityPosition;varying vec3 vCityNormal;\n${common}\n` +
        s.fragmentShader;
      s.fragmentShader = s.fragmentShader.replace(
        "#include <color_fragment>",
        /* glsl */ `
      #include <color_fragment>
      float identity=vBuilding.x;
      vec2 grid=vMetric/vec2(vBuilding.y,vBuilding.z), cell=fract(grid), fw=max(fwidth(grid),vec2(.0001));
      float detail=1.-smoothstep(.22,1.,max(fw.x,fw.y));
      float room=mix(.5,hashCity(floor(grid)+vec2(identity,identity*.37)),detail);
      float modern=${idx === 8 ? "step(40.,vBuilding.w)" : modern ? "1." : "0."};
      float wx=${idx === 9 ? "mix(.15,.065,step(185.,vMetric.y))" : "mix(.23,.035,modern)"},wy=${idx === 9 ? "mix(.18,.10,step(185.,vMetric.y))" : "mix(.23,.20,modern)"};
      float opening=pulse(cell.x,wx,1.-wx,fw.x)*pulse(cell.y,wy,.93,fw.y);
      ${idx === 7 ? `opening*=smoothstep(vBuilding.w-3.5,vBuilding.w-2.8,vMetric.y);` : ""}
      ${idx === 9 ? `opening*=1.-smoothstep(200.,201.,vMetric.y);opening*=1.-(smoothstep(173.,173.4,vMetric.y)*(1.-smoothstep(175.5,176.,vMetric.y)));` : ""}
      float reveal=pulse(cell.x,wx-.025,1.-wx+.025,fw.x)*pulse(cell.y,wy-.025,.95,fw.y);
      float frame=pulse(cell.x,.488,.512,fw.x)*opening;
      float row=vMetric.y/.075;
      float brick=pulse(fract(vMetric.x/.225+mod(floor(row),2.)*.5),.035,.965,fwidth(vMetric.x/.225))*pulse(fract(row),.06,.94,fwidth(row));
      float weather=noiseCity(vec2(vMetric.x*.3+identity,vMetric.y*.032));
      float tone=.78+hashCity(vec2(identity,7.))* .36;
      vec3 masonry=wallTint*tone*mix(.8,1.06,brick)*mix(.8,1.,weather);
      float courses=band(vMetric.y,3.2*4.,.10);
      masonry=mix(masonry,vec3(.43,.42,.38),courses*.28);
      vec3 wallBase=mix(masonry,wallTint*tone,modern);
      ${idx === 9 ? `wallBase=wallTint*(.94+weather*.06);` : ""}
      ${photoName ? `vec3 photoWall=texture2D(wallPhoto,vMetric*.5).rgb;wallBase=mix(wallBase,photoWall*tone,.85);` : ""}
      ${idx === 7 ? `wallBase=wallTint*tone*(1.-band(vMetric.x,.3,.035)*.18);reveal=opening;` : ""}
      vec3 viewDir=normalize(cameraPosition-vCityPosition);
      vec3 n=normalize(vCityNormal);
      vec3 refl=reflect(-viewDir,n);
      float fres=pow(1.-abs(dot(viewDir,n)),2.2);
      float elevation=clamp(refl.y*.65+.42,0.,1.);
      vec3 skyColour=mix(vec3(.45,.51,.55),vec3(.13,.27,.40),elevation);
      float azimuth=atan(refl.z,refl.x)*3.+identity*.13;
      float silhouetteHeight=.15+noiseCity(vec2(azimuth*2.,identity))*.25;
      float reflectedTower=1.-smoothstep(silhouetteHeight-.02,silhouetteHeight+.02,elevation);
      skyColour=mix(skyColour,vec3(.07,.11,.14),reflectedTower*.65);
      // Recessed room: angle-dependent back wall and floor, with independently seeded blinds.
      vec2 inside=cell-vec2(dot(viewDir,vec3(n.z,0.,-n.x)),viewDir.y)*.18;
      float backWall=pulse(fract(inside.x),.14,.86,fw.x)*pulse(fract(inside.y),.2,.85,fw.y);
      vec3 interior=mix(vec3(.025,.037,.045),vec3(.16,.17,.16),backWall);
      float blind=pulse(cell.y,.65+room*.2,.93,fw.y)*step(.54,room);
      interior=mix(interior,vec3(.34,.31,.25),blind*.65);
      vec3 glazing=mix(interior,glassTint,.4);
      glazing=mix(glazing,skyColour,.30+fres*.45)*mix(.87,1.08,room);
      vec3 facade=mix(wallBase,vec3(.23,.24,.23),reveal);
      facade=mix(facade,glazing,opening);
      facade=mix(facade,wallTint*.7,frame*.5);
      float footAO=mix(.65,1.,smoothstep(0.,20.,vMetric.y));
      diffuseColor.rgb=facade*footAO;
      `,
      );
      if (photoName)
        s.fragmentShader = s.fragmentShader.replace(
          "#include <normal_fragment_maps>",
          "#include <normal_fragment_maps>\nnormal=normalize(mix(normal,nonPerturbedNormal,opening));",
        );
      s.fragmentShader = s.fragmentShader.replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor=mix(.88,.16+room*.07,opening);",
      );
      s.fragmentShader = s.fragmentShader.replace(
        "#include <metalnessmap_fragment>",
        "#include <metalnessmap_fragment>\nmetalnessFactor=mix(.03,.32,opening);",
      );
      s.fragmentShader = s.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance+=skyColour*opening*(.07+.08*fres);",
      );
    };
    return mat;
  });
}
export function surfaceMaterial(kind = "paving", landcover = null) {
  const m = new T.MeshStandardMaterial({
    roughness: 0.9,
    side: kind === "roof" ? T.FrontSide : T.DoubleSide,
  });
  m.customProgramCacheKey = () => `london-ground-${kind}`;
  const floorPhoto =
    kind === "park"
      ? surfacePhoto("ground/leafy_grass-color")
      : kind === "paving"
        ? surfacePhoto("concrete_pavement-Diffuse")
        : kind === "roof"
          ? surfacePhoto("roof_slates_02-Diffuse")
          : kind === "road"
            ? surfacePhoto("ground/clean_asphalt-color")
            : null;
  const normalName = kind === "road" ? "ground/clean_asphalt-normal" : kind === "park" ? "ground/leafy_grass-normal" : kind === "paving" ? "concrete_pavement-nor_gl" : kind === "roof" ? "ground/concrete_floor_02-normal" : null;
  if (normalName) { m.normalMap=surfacePhoto(normalName,false);m.normalScale.set(.3,.3); }
  m.onBeforeCompile = (s) => {
    if (kind === "terrain") {
      s.uniforms.grassSurface={value:surfacePhoto("ground/leafy_grass-color")};
      s.uniforms.urbanSurface={value:surfacePhoto("ground/concrete_floor_02-color")};
    }
    if (floorPhoto) s.uniforms.floorPhoto = { value: floorPhoto };
    if (kind === "roof") s.uniforms.flatRoofPhoto = { value: surfacePhoto("concrete") };
    s.vertexShader =
      (kind === "road" ? "attribute vec3 roadUV;varying vec3 vRoadUV;" : "") +
      (kind === "roof"
        ? "attribute vec4 building;flat varying float vRoofSeed;flat varying float vRoofSlope;"
        : "") +
      "varying vec3 vGround;\n" +
      s.vertexShader;
    s.vertexShader = s.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvGround=(modelMatrix*vec4(position,1.)).xyz;" +
        (kind === "road" ? "vRoadUV=roadUV;" : "") +
        (kind === "roof"
          ? "vRoofSeed=building.x;vRoofSlope=1.-step(.995,normal.y);"
          : ""),
    );
    if(normalName) s.vertexShader=s.vertexShader.replace("#include <normal_vertex>","#include <normal_vertex>\nvNormalMapUv=(modelMatrix*vec4(position,1.)).xz/4.;");
    if (landcover) s.uniforms.landcover = { value: landcover };
    s.fragmentShader =
      `${kind === "terrain" ? "uniform sampler2D grassSurface;uniform sampler2D urbanSurface;" : ""}${kind === "roof" ? "uniform sampler2D flatRoofPhoto;" : ""}${floorPhoto ? "uniform sampler2D floorPhoto;" : ""}${kind === "roof" ? "flat varying float vRoofSeed;flat varying float vRoofSlope;" : ""}${kind === "road" ? "varying vec3 vRoadUV;" : ""}${landcover ? "uniform sampler2D landcover;" : ""}varying vec3 vGround;\n${common}\n` +
      s.fragmentShader;
    const road = kind === "road",
      roof = kind === "roof",
      terrain = kind === "terrain";
    s.fragmentShader = s.fragmentShader.replace(
      "#include <color_fragment>",
      /* glsl */ `
    #include <color_fragment>
    vec2 p=vGround.xz;float footprint=length(fwidth(p));
    float broad=noiseCity(p*.075),medium=noiseCity(p*.75),fine=mix(.5,noiseCity(p*18.),1.-smoothstep(.03,.12,footprint));
    float damp=smoothstep(.58,.83,noiseCity(p*.21));
    vec3 base=${road ? "mix(vec3(.055,.064,.073),vec3(.105,.113,.12),medium*.4+broad*.4+fine*.2)" : roof ? "mix(vec3(.17,.18,.19),vec3(.18,.19,.20),fine)" : terrain ? "mix(vec3(.21,.23,.20),vec3(.29,.30,.27),broad)" : "mix(vec3(.29,.285,.27),vec3(.34,.33,.31),broad*.5+medium*.5)"};
    float seam=max(band(p.x,${roof ? "4." : ".9"},.012),band(p.y,${roof ? "4." : ".6"},.012));
    ${road ? `float repairMask=pulse(fract(p.x/9.),.15,.8,fwidth(p.x/9.))*pulse(fract(p.y/11.),.2,.7,fwidth(p.y/11.))*step(.7,hashCity(floor(p/vec2(9.,11.))));base*=1.-repairMask*.25;` : terrain ? "" : `base*=1.-seam*.28;`}
    ${
      terrain && landcover
        ? `vec2 en=vec2(p.y*.998806+p.x*.04885,p.x*.998806-p.y*.04885);
    vec2 geoUV=vec2((.06602+en.x/69298.+.05)/.16,(51.50494+en.y/111320.-51.48)/.05);
    float vegetation=texture2D(landcover,clamp(geoUV,vec2(.001),vec2(.999))).r;
    float inMap=step(0.,geoUV.x)*step(geoUV.x,1.)*step(0.,geoUV.y)*step(geoUV.y,1.);
    vegetation=mix(.35,vegetation,inMap);
    vec3 garden=texture2D(grassSurface,p/6.).rgb*mix(.8,1.05,broad);
    base=mix(texture2D(urbanSurface,p/7.).rgb*.65,garden,vegetation);`
        : ""
    }
${roof ? `base=mix(base,texture2D(flatRoofPhoto,p/6.).rgb*.65,.7*(1.-vRoofSlope));base*=.82+hashCity(vec2(vRoofSeed,17.))*.32;` : ""}
${floorPhoto ? `vec3 photographed=texture2D(floorPhoto,p/${kind === "road" ? "5." : "4."}).rgb;base=mix(base,photographed*${kind === "roof" ? ".72" : ".8"},${kind === "road" ? ".5" : kind === "roof" ? ".75*vRoofSlope" : ".75"});` : ""}
    base*=mix(.97,1.03,fine)*(1.-damp*${roof ? ".015" : ".08"});
    ${road ? `float lineWidth=max(fwidth(vRoadUV.y),.001);float centre=clamp((.11-abs(vRoadUV.y))/lineWidth+.5,0.,1.)*min(1.,.11/lineWidth);float dash=pulse(fract(vRoadUV.x/9.),0.,.33,fwidth(vRoadUV.x/9.));base=mix(base,vec3(.62,.60,.52),centre*dash*vRoadUV.z*.75);` : ""}
${kind === "park" ? `base=mix(vec3(.07,.12,.035),vec3(.14,.20,.075),medium*.5+broad*.5);base*=.8+.5*dot(photographed,vec3(.333));` : ""}
    diffuseColor.rgb*=base;
    `,
    );
    s.fragmentShader = s.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      "#include <roughnessmap_fragment>\nroughnessFactor=mix(.94,.46,damp*.65);",
    );
  };
  return m;
}
