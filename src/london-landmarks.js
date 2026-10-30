import * as T from "three";
import { mergeStaticMeshes } from "./batching.js";
import { facadeMaterial } from "./facade-materials.js";

export const landmarkSites = {
  shard: [-.0865,51.5045], eye: [-.1195,51.5033], gherkin: [-.0803,51.5145],
  leadenhall: [-.0823,51.5139], walkie: [-.08357,51.5113], bishopsgate: [-.08320,51.51435],
  heron: [-.08096,51.51630], crystal: [.01630,51.50730], dockside: [.0472488,51.507743],
};
export function londonPoint(lon,lat) {
  const a=2.8*Math.PI/180,e=(lon-.06602)*111320*Math.cos(51.505*Math.PI/180),n=(lat-51.50494)*111320;
  return new T.Vector3(n*Math.cos(a)+e*Math.sin(a),0,e*Math.cos(a)-n*Math.sin(a));
}
// Remove overlapping OSM building parts, including the Eye's capsule extrusions.
export function reserveLandmarks(core,context) {
  const ranges={shard:46,eye:78,gherkin:38,leadenhall:37,walkie:36,bishopsgate:43,heron:34,crystal:31,dockside:105};
  for(const [name,coords] of Object.entries(landmarkSites)) {
    const origin=londonPoint(...coords),data=["crystal","dockside"].includes(name)?core:context;
    for(const b of data.buildings) {
      const p=b[1],x=p.reduce((s,v)=>s+v[0],0)/p.length,z=p.reduce((s,v)=>s+v[1],0)/p.length;
      if(name==="dockside" ? Math.abs(x-origin.x)<35&&Math.abs(z-origin.z)<105 : Math.hypot(x-origin.x,z-origin.z)<ranges[name]) b[4]="bespoke";
    }
  }
}

export function buildLondonLandmarks(scene,environment) {
  const parts=[],colliders=[],sites={},cityMaterials=[];
  const steel=new T.MeshStandardMaterial({color:0xb8c2c5,metalness:.55,roughness:.4,envMap:environment,envMapIntensity:.45});
  const white=new T.MeshStandardMaterial({color:0xc5ccca,metalness:.2,roughness:.55});
  const dark=new T.MeshStandardMaterial({color:0x22353c,metalness:.45,roughness:.3,envMap:environment,envMapIntensity:.75});
  const glass=(tint=0xb3cbd1)=>{
    const m=new T.MeshStandardMaterial({color:tint,metalness:.72,roughness:.24,envMap:environment,envMapIntensity:1.15});
    m.color.multiplyScalar(.28);
    m.normalScale=new T.Vector2(0,0);
    m.userData.pbrFacade=true;m.userData.reflectiveFacade=true;
    m.customProgramCacheKey=()=>"landmark-curtain-wall-v1";
    m.onBeforeCompile=s=>{
      s.vertexShader='attribute vec4 building;varying vec2 vWindowMetres;\n'+s.vertexShader;
      s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWindowMetres=uv;');
      s.fragmentShader='varying vec2 vWindowMetres;\n'+s.fragmentShader;
      s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec2 cell=vWindowMetres/vec2(1.5,3.8),fw=max(fwidth(cell),vec2(.0001));
        vec2 edge=abs(fract(cell+.5)-.5);
        vec2 lines=(1.-smoothstep(vec2(.012,.018),vec2(.012,.018)+fw,edge))*min(vec2(1.),vec2(.024,.036)/fw);
        float panel=fract(sin(dot(floor(cell),vec2(127.1,311.7)))*43758.5453);
        float detail=1.-smoothstep(.3,1.5,max(fw.x,fw.y));
        diffuseColor.rgb*=mix(.94,.88+panel*.12,detail);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.06,.075,.085),max(lines.x,lines.y)*.85);
      `);
    };
    cityMaterials.push(m);return m;
  };
  const blue=glass(),silver=glass(0xd5dedb),teal=glass(0x94bbb7);
  const rawGlass=new T.MeshStandardMaterial({color:0x789aa8,metalness:.8,roughness:.2,envMap:environment,envMapIntensity:1.3});
  rawGlass.envMapRotation.y=2.868;
  const darkGlass=rawGlass.clone();darkGlass.color.set(0x29434b);
  let origin=new T.Vector3(),rotation=0;
  function toWorld(p) {return new T.Vector3(...p).applyAxisAngle(new T.Vector3(0,1,0),rotation).add(origin);}
  function add(geometry,material,position=[0,0,0],rot=0) {
    const mesh=new T.Mesh(geometry,material);mesh.position.copy(toWorld(position));mesh.rotation.y=rotation+rot;mesh.castShadow=true;mesh.receiveShadow=true;parts.push(mesh);return mesh;
  }
  function metric(g,seed=41) {
    const p=g.getAttribute("position"),n=g.getAttribute("normal"),uv=[],b=[];
    for(let i=0;i<p.count;i++) {uv.push(Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i),Math.abs(n.getY(i))>.5?p.getZ(i):p.getY(i));b.push(seed,1.65,3.8,300);}
    g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));g.setAttribute("building",new T.Float32BufferAttribute(b,4));return g;
  }
  function box(x,y,z,w,h,d,m=blue) {return add(metric(new T.BoxGeometry(w,h,d)),m,[x,y,z]);}
  function beam(a,b,r=.18,m=steel) {
    const start=toWorld(a),end=toWorld(b),v=end.clone().sub(start);
    const mesh=new T.Mesh(new T.CylinderGeometry(r,r,v.length(),6),m);
    mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());mesh.castShadow=r>.3;parts.push(mesh);
  }
  function face(points,m=blue) {
    const g=new T.BufferGeometry(),p=[];
    for(let i=1;i<points.length-1;i++)p.push(...points[0],...points[i],...points[i+1]);
    g.setAttribute("position",new T.Float32BufferAttribute(p,3));g.computeVertexNormals();
    const mesh=add(metric(g),m);mesh.material.side=T.DoubleSide;return mesh;
  }
  function site(name,height,radius,rot=0) {
    origin=londonPoint(...landmarkSites[name]);rotation=rot;sites[name]={position:origin.toArray(),height};
    colliders.push({minX:origin.x-radius,maxX:origin.x+radius,minZ:origin.z-radius,maxZ:origin.z+radius,h:height});
  }
  // Eight tapering glass faces with separated, unequal crown blades.
  site("shard",309.6,32,.25);
  const ring=[[-25,-22],[5,-30],[28,-17],[30,13],[12,29],[-17,26],[-31,7],[-30,-12]];
  const at=(p,y)=>[p[0]*(1-y/330),y,p[1]*(1-y/330)];
  for(let j=0;j<ring.length;j++) {
    const a=ring[j],b=ring[(j+1)%ring.length];
    face([at(a,10),at(b,10),at(b,260),at(a,260)],j%3===0?silver:blue);
    beam(at(a,10),at(a,260),.14);
    const peak=[309.6,299,303,291,307,297,300,287][j],aa=at(a,260),bb=at(b,260);
    // Open slivers leave real sky gaps at the crown, rather than a solid pyramid.
    const apex=at([(a[0]+b[0])*.5,(a[1]+b[1])*.5],peak);
    face([aa,bb,apex],j%2?rawGlass:blue);beam(aa,apex,.1);beam(bb,apex,.1);
    for(let y=264;y<peak-5;y+=5) {
      const t=(y-260)/(peak-260),left=aa.map((v,k)=>v+(apex[k]-v)*t),right=bb.map((v,k)=>v+(apex[k]-v)*t);
      beam(left,right,.08,steel);
    }
  }
  box(0,5,0,60,10,54,silver);box(-8,11,15,48,12,37,blue);
  // The Gherkin: curved profile, triangulated glazing and six dark spirals.
  site("gherkin",180,32);
  const profile=[[0,22],[12,28],[40,32],[75,31],[110,27],[140,20],[164,11],[180,.6]];
  function radius(y) {let i=1;while(i<profile.length-1&&profile[i][0]<y)i++;const a=profile[i-1],b=profile[i];return T.MathUtils.lerp(a[1],b[1],(y-a[0])/(b[0]-a[0]));}
  const curvedProfile=new T.SplineCurve(profile.map(([y,r])=>new T.Vector2(r,y))).getPoints(100);
  const gherkinGlass=rawGlass.clone();gherkinGlass.color.set(0x9ab2bc);gherkinGlass.roughness=.26;
  const gherkinOrigin=origin.clone();
  gherkinGlass.onBeforeCompile=s=>{
    s.uniforms.gherkinOrigin={value:gherkinOrigin};
    s.vertexShader='uniform vec3 gherkinOrigin;varying vec3 vGherkin;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGherkin=position-gherkinOrigin;');
    s.fragmentShader='varying vec3 vGherkin;\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float theta=atan(vGherkin.z,vGherkin.x)/6.2831853;
      float spiral=fract(theta*6.-vGherkin.y*.009);
      float aa=max(fwidth(spiral),.004);
      float stripe=smoothstep(.10,.10+aa,spiral)*(1.-smoothstep(.29,.29+aa,spiral));
      diffuseColor.rgb*=mix(1.,.30,stripe);
      vec2 diagonal=vec2(theta*36.+vGherkin.y/9.,theta*36.-vGherkin.y/9.);
      vec2 distance=abs(fract(diagonal+.5)-.5);
      vec2 width=max(fwidth(diagonal),vec2(.001));
      vec2 frame=(1.-smoothstep(vec2(.04),vec2(.04)+width,distance))*min(vec2(1.),vec2(.08)/width);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.08,.10,.12),max(frame.x,frame.y)*.9);
    `);
  };
  add(new T.LatheGeometry(curvedProfile,96),gherkinGlass);
  // Leadenhall's sloping south face, expressed mega-frame and northern service core.
  site("leadenhall",225,33,-.1);
  const base=[[-23,0,-32],[23,0,-32],[23,0,32],[-23,0,32]],top=[[-23,225,15],[23,225,15],[23,225,32],[-23,225,32]];
  for(let j=0;j<4;j++)face([base[j],base[(j+1)%4],top[(j+1)%4],top[j]],blue);
  box(0,112.5,34,40,225,9,dark);
  for(let y=0;y<224;y+=28) {
    const z=-32+47*y/225,zt=-32+47*(y+28)/225;
    beam([-23,y,z],[23,y,z],.55);beam([-23,y,z],[23,y+28,zt],.4);beam([23,y,z],[-23,y+28,zt],.4);
    for(const x of [-23,23]) {beam([x,y,z],[x,y+28,32],.35);beam([x,y,32],[x,y+28,zt],.35);}
  }
  // Walkie-Talkie: widened curved upper floors and the enclosed sky garden.
  site("walkie",160,34,.08);
  const wp=(i,y)=>{const a=i/32*Math.PI*2,w=22+11*Math.pow(y/160,1.5),d=16+7*y/160;return [Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),.3)*w,y,Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),.3)*d];};
  for(let i=0;i<32;i++)for(let y=0;y<156;y+=12) {
    face([wp(i,y),wp(i+1,y),wp(i+1,Math.min(160,y+12)),wp(i,Math.min(160,y+12))],y>=144?darkGlass:teal);
    beam(wp(i,y),wp(i,Math.min(160,y+12)),.27,white);
  }
  for(let i=0;i<20;i++) {
    const x0=-33+i*3.3,x1=x0+3.3,roof=x=>152+8*Math.sqrt(Math.max(0,1-(x/33)**2));
    face([[x0,roof(x0),-23],[x1,roof(x1),-23],[x1,roof(x1),23],[x0,roof(x0),23]],rawGlass);
    for(const z of [-23,23])beam([x0,roof(x0),z],[x1,roof(x1),z],.65,white);
    if(i%2===0)beam([x0,roof(x0),-23],[x0,roof(x0),23],.15,white);
  }
  // 22 Bishopsgate has an irregular faceted footprint and stepped crown.
  site("bishopsgate",278,39,.1);
  const outline=[[-28,-28],[13,-31],[31,-17],[33,10],[18,26],[-15,29],[-30,12]];
  const levels=[0,238,260,278];
  for(let j=0;j<outline.length;j++)for(let k=0;k<3;k++) {
    const a=outline[j],b=outline[(j+1)%outline.length],y=levels[k],h=levels[k+1],shrink=k===2?.86:1;
    face([[a[0]*shrink,y,a[1]*shrink],[b[0]*shrink,y,b[1]*shrink],[b[0]*shrink,h,b[1]*shrink],[a[0]*shrink,h,a[1]*shrink]],j%2?blue:silver);
    beam([a[0]*shrink,y,a[1]*shrink],[a[0]*shrink,h,a[1]*shrink],.2);
  }
  box(0,277,0,45,2,41,steel);
  site("heron",230,30,-.1);
  box(0,80,0,42,160,43,blue);box(7,174,0,28,28,40,silver);box(12,195,0,18,14,36,blue);
  beam([12,202,0],[12,230,0],.55);for(const x of [-19,-9,3,18])beam([x,0,-22],[x,188,-22],.35,steel);
  // Crystal / City Hall: folded, leaning green-blue glass volumes, no masonry.
  site("crystal",24,46,-.2);
  const greenGlass=glass(0x608f83);greenGlass.normalScale.set(.035,.035);greenGlass.envMapIntensity=.7;greenGlass.userData.reflectiveFacade=false;
  const crystals=[
    [[-20,1,-39],[18,1,-39],[25,18,-44],[-22,24,-40]],
    [[-22,24,-40],[25,18,-44],[23,13,-1],[-23,16,-1]],
    [[-23,16,-1],[23,13,-1],[21,24,40],[-18,17,43]],
    [[-18,17,43],[21,24,40],[16,1,36],[-17,1,38]],
    [[-20,1,-39],[-22,24,-40],[-23,16,-1],[-18,17,43],[-17,1,38]],
    [[18,1,-39],[16,1,36],[21,24,40],[23,13,-1],[25,18,-44]],
  ];
  for(const f of crystals) {face(f,greenGlass);for(let i=0;i<f.length;i++)beam(f[i],f[(i+1)%f.length],.13,dark);}
  box(0,4,0,30,8,73,darkGlass);
  // Newham Dockside / Building 1000: four-storey glazing, stone piers and deep sunshades.
  site("dockside",19,102,-.049);
  Object.assign(colliders.at(-1),{minX:origin.x-29,maxX:origin.x+29});
  const dockGlass=glass(0xa7bcb6);dockGlass.userData.reflectiveFacade=false;dockGlass.envMapIntensity=.9;
  const stone=new T.MeshStandardMaterial({color:0xc7c3b3,roughness:.82});
  box(0,8.5,0,42,17,196,dockGlass);
  box(0,17.6,0,45,1.2,200,white);
  for(const z of [-97,-48,0,48,97]) {
    box(-22,8.5,z,2,17,8,stone);box(22,8.5,z,2,17,8,stone);
  }
  for(const y of [4.2,8.4,12.6,17]) {
    for(let k=0;k<4;k++)box(-24-k*.75,y,0,.32,.16,196,white);
    for(let z=-94;z<98;z+=8)beam([-22,y,z],[-27,y,z],.09,steel);
  }
  box(0,1,0,48,2,204,stone);
  // London Eye: double rim and triangulated frame, cable spokes, A-frame and 32 capsules.
  site("eye",135,65,.12);
  const eyeOrigin=origin.clone(),eyeRotation=rotation;
  const wheel=new T.Group();wheel.position.copy(origin);wheel.rotation.y=rotation;scene.add(wheel);
  const wheelParts=[];
  function wheelBeam(a,b,r,m=white) {
    const d=new T.Vector3(...b).sub(new T.Vector3(...a)),mesh=new T.Mesh(new T.CylinderGeometry(r,r,d.length(),5),m);
    mesh.position.set(...a).add(new T.Vector3(...b)).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());wheelParts.push(mesh);
  }
  for(const z of [-2.2,2.2]) {const tor=new T.Mesh(new T.TorusGeometry(60.5,.38,6,160),white);tor.position.set(0,70,z);wheelParts.push(tor);}
  const spokePoints=[];
  for(let i=0;i<96;i++) {
    const a=i/96*Math.PI*2,b=(i+1)/96*Math.PI*2;
    const p=(angle,z)=>[Math.cos(angle)*60.5,70+Math.sin(angle)*60.5,z];
    wheelBeam(p(a,-2.2),p(b,2.2),.12);wheelBeam(p(a,2.2),p(a,-2.2),.12);
    spokePoints.push(0,70,i%2?2:-2,...p(a,i%2?-2.2:2.2));
  }
  const wheelFrame=mergeStaticMeshes(wheelParts);wheelFrame.position.y=-70;wheel.add(wheelFrame);
  wheel.position.y+=70;
  const spokeMesh=new T.LineSegments(new T.BufferGeometry().setAttribute("position",new T.Float32BufferAttribute(spokePoints,3)),new T.LineBasicMaterial({color:0x697b84,transparent:true,opacity:.6}));
  spokeMesh.position.y=-70;wheel.add(spokeMesh);
  beam([-30,0,26],[0,70,4],1.3,white);beam([30,0,26],[0,70,4],1.3,white);beam([0,70,-4],[0,70,12],2.2,white);
  box(0,2,12,66,4,20,white);
  const capsuleMaterial=new T.MeshStandardMaterial({color:0xa2b9bf,metalness:.12,roughness:.18,transparent:true,opacity:.48,depthWrite:false,envMap:environment,envMapIntensity:.8});
  const capsules=new T.InstancedMesh(new T.SphereGeometry(1,16,10),capsuleMaterial,32),floors=new T.InstancedMesh(new T.BoxGeometry(1,1,1),white,32);
  const frames=new T.InstancedMesh(new T.TorusGeometry(2.15,.12,5,24),white,64);
  scene.add(capsules,floors,frames);const dummy=new T.Object3D();
  function update(time=0) {
    const turn=time*Math.PI*2/1800;
    wheel.rotation.z=turn;
    for(let i=0;i<32;i++) {
      const a=i/32*Math.PI*2+turn;
      dummy.position.set(Math.cos(a)*64,70+Math.sin(a)*64,0).applyAxisAngle(new T.Vector3(0,1,0),eyeRotation).add(eyeOrigin);
      dummy.rotation.set(0,eyeRotation,0);dummy.scale.set(4.1,2.25,2.6);dummy.updateMatrix();capsules.setMatrixAt(i,dummy.matrix);
      for(let side=0;side<2;side++) {
        const centre=dummy.position.clone();
        dummy.position.add(new T.Vector3(side?2.6:-2.6,0,0).applyAxisAngle(new T.Vector3(0,1,0),eyeRotation));
        dummy.rotation.set(0,eyeRotation+Math.PI/2,0);dummy.scale.set(1.08,1,1);dummy.updateMatrix();frames.setMatrixAt(i*2+side,dummy.matrix);
        dummy.position.copy(centre);
      }
      dummy.rotation.set(0,eyeRotation,0);dummy.position.y-=1.8;dummy.scale.set(6,.35,3.5);dummy.updateMatrix();floors.setMatrixAt(i,dummy.matrix);
    }
    frames.instanceMatrix.needsUpdate=capsules.instanceMatrix.needsUpdate=floors.instanceMatrix.needsUpdate=true;
  }
  update();capsules.computeBoundingSphere();floors.computeBoundingSphere();frames.computeBoundingSphere();
  scene.add(mergeStaticMeshes(parts));
  return {sites,colliders,cityMaterials,update};
}
