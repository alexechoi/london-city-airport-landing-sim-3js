import * as T from 'three';

// Metric, analytically filtered curtain walls. The periodic integral follows
// Slop New York's MIT-licensed filteredPulse (vendor/slop-new-york/LICENSE).
// Glass uses the district's captured environment, rather than baked reflections.
export function curtainWallMaterial(style = 0) {
  const material = new T.MeshStandardMaterial({
    color: 0xffffff, roughness: .24, metalness: .65, envMapIntensity: 1.4,
  });
  material.userData.pbrFacade = true;
  material.userData.reflectiveFacade = true;
  material.customProgramCacheKey = () => `metric-curtain-wall-${style}`;
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute vec4 building; flat varying vec4 vCurtain; varying vec2 vCurtainUV;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvCurtain=building;vCurtainUV=uv;');
    shader.fragmentShader = /* glsl */ `
      flat varying vec4 vCurtain;
      varying vec2 vCurtainUV;
      float curtainHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float curtainIntegral(float t,float a,float b){return floor(t)*(b-a)+clamp(fract(t),a,b)-a;}
      float curtainPulse(float t,float a,float b,float w){float h=max(w,.0001)*.5;return clamp((curtainIntegral(t+h,a,b)-curtainIntegral(t-h,a,b))/(2.*h),0.,1.);}
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', /* glsl */ `
      #include <color_fragment>
      vec2 grid=vCurtainUV/vCurtain.yz;
      vec2 fw=max(fwidth(grid),vec2(.0001));
      vec2 cell=fract(grid);
      float seed=curtainHash(vec2(vCurtain.x,9.));
      float design=floor(seed*4.);
      float detail=1.-smoothstep(.18,.8,max(fw.x,fw.y));
      float room=mix(.5,curtainHash(floor(grid)+vec2(vCurtain.x,17.)),detail);
      float mullion=mix(.018,.035,step(1.5,design));
      float spandrel=mix(.12,.24,step(.5,design));
      float pane=curtainPulse(grid.x,mullion,1.-mullion,fw.x)*curtainPulse(grid.y,spandrel,.982,fw.y);
      float horizontal=1.-curtainPulse(grid.y,.012,.988,fw.y);
      float vertical=1.-curtainPulse(grid.x,mullion,1.-mullion,fw.x);
      // Silver, charcoal and blue-green glazing vary by building, with gently
      // different panel coatings and office blinds rather than random bright pixels.
      vec3 glass=mix(vec3(.075,.09,.10),vec3(.17,.19,.19),seed);
      ${style === 1 ? 'glass*=vec3(.72,.76,.77);' : style === 2 ? 'glass*=vec3(1.06,1.04,.96);' : ''}
      glass*=mix(vec3(1.10,1.,.90),vec3(.80,1.,1.06),curtainHash(vec2(vCurtain.x,42.)));
      glass*=mix(.92,1.08,room);
      vec3 frame=mix(vec3(.045,.050,.052),vec3(.18,.19,.19),step(1.5,design));
      vec3 spandrelColor=glass*mix(.48,.80,seed);
      float blind=curtainPulse(grid.y,.64+room*.27,.965,fw.y)*step(.64,room)*detail;
      glass=mix(glass,vec3(.30,.29,.26),blind*.26);
      vec3 wall=mix(spandrelColor,glass,pane);
      wall=mix(wall,frame,max(vertical,horizontal));
      // Mechanical louvres near the crown and a taller glazed entrance level.
      float mechanical=step(.65,seed)*smoothstep(vCurtain.w-5.,vCurtain.w-4.6,vCurtainUV.y);
      float louvre=curtainPulse(vCurtainUV.y/.28,.15,.65,fwidth(vCurtainUV.y/.28));
      wall=mix(wall,frame*(.55+.25*louvre),mechanical*.8);
      float lobby=1.-smoothstep(4.2,4.4,vCurtainUV.y);
      wall=mix(wall,glass*.75,lobby*(1.-vertical));
      diffuseColor.rgb=wall*mix(.78,1.,smoothstep(0.,12.,vCurtainUV.y));
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\nroughnessFactor=mix(.46,.18+room*.045,pane)*(1.-mechanical*.08);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>',
      '#include <metalnessmap_fragment>\nmetalnessFactor=mix(.35,.72,pane);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', /* glsl */ `
      #include <normal_fragment_maps>
      // Restrained pane bowing; faded before a pane becomes subpixel.
      vec3 tangent=normalize(dFdx(-vViewPosition)*dFdy(vCurtainUV.y)-dFdy(-vViewPosition)*dFdx(vCurtainUV.y));
      normal=normalize(normal+tangent*(cell.x-.5)*.009*pane*detail);
    `);
  };
  return material;
}
