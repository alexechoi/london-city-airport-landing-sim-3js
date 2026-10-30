import * as T from "three";
import { REGION, regionClearance } from "./flight-region.js";
export function addBoundaryWeather(scene) {
  const canvas=document.createElement("canvas");canvas.width=canvas.height=256;
  const c=canvas.getContext("2d");
  for(let i=0;i<12;i++) {
    const x=70+Math.sin(i*4.7)*42+i*8,y=128+Math.cos(i*2.4)*30,r=42+i%4*7;
    const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,"rgba(240,245,246,.25)");g.addColorStop(1,"rgba(225,232,236,0)");
    c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const mat=new T.MeshBasicMaterial({map:texture,transparent:true,opacity:.42,depthWrite:false,fog:true});
  const clouds=[];
  for(let i=0;i<72;i++) {
    const side=i%4,t=Math.floor(i/4)/17;
    const p=new T.Vector3(
      side===0?REGION.minX-250:side===1?REGION.maxX+250:T.MathUtils.lerp(REGION.minX,REGION.maxX,t),
      420+(i*179%560),
      side===2?REGION.minZ-250:side===3?REGION.maxZ+250:T.MathUtils.lerp(REGION.minZ,REGION.maxZ,t),
    );
    const m=new T.Mesh(new T.PlaneGeometry(1200+i%3*250,520),mat);m.position.copy(p);scene.add(m);clouds.push(m);
  }
  return { update(camera) {
    const margin=regionClearance(camera.position), haze=Math.max(0,1-margin/850);
    scene.fog.density=.00010+Math.min(1,haze*haze)*.002;
    for(const cloud of clouds) cloud.quaternion.copy(camera.quaternion);
  }};
}

// Fade the scenery itself at the map perimeter, so the edge is also hidden when
// viewed from well inside London. Camera-only fog cannot hide a nearby side edge.
export function applyBoundaryFog(scene) {
  const seen=new Set();
  const haze=position=>`float borderEdge=min(min(${position}.x-(${REGION.minX.toFixed(1)}),${REGION.maxX.toFixed(1)}-${position}.x),min(${position}.z-(${REGION.minZ.toFixed(1)}),${REGION.maxZ.toFixed(1)}-${position}.z));float borderMist=1.-smoothstep(-250.,1050.,borderEdge);gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,borderMist);`;
  scene.traverse(o=>{
    for(const m of (Array.isArray(o.material)?o.material:[o.material])) {
      if(!m||!m.fog||seen.has(m))continue;seen.add(m);
      if(m.isShaderMaterial) {
        if(m.fragmentShader.includes("varying vec4 worldPosition;"))m.fragmentShader=m.fragmentShader.replace("#include <fog_fragment>","#include <fog_fragment>\n"+haze("worldPosition"));
        continue;
      }
      const original=m.onBeforeCompile,cache=m.customProgramCacheKey.bind(m),key=cache();
      m.customProgramCacheKey=()=>key+"-region-fog";
      m.onBeforeCompile=function(s,...rest) {
        original.call(this,s,...rest);
        s.vertexShader="varying vec3 vBoundaryPosition;\n"+s.vertexShader;
        s.vertexShader=s.vertexShader.replace("#include <project_vertex>",`#include <project_vertex>
          vec4 boundaryLocal=vec4(transformed,1.);
          #ifdef USE_INSTANCING
          boundaryLocal=instanceMatrix*boundaryLocal;
          #endif
          vBoundaryPosition=(modelMatrix*boundaryLocal).xyz;
        `);
        s.fragmentShader="varying vec3 vBoundaryPosition;\n"+s.fragmentShader;
        s.fragmentShader=s.fragmentShader.replace("#include <fog_fragment>","#include <fog_fragment>\n"+haze("vBoundaryPosition"));
      };
      m.needsUpdate=true;
    }
  });
}
