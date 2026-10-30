import * as T from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// Reuse the colour pass depth: no second rendering of London's millions of triangles.
// View-space samples keep the contact radius in metres, independent of flight altitude.
export class ContactOcclusionPass extends Pass {
  constructor(camera, reversedDepth) {
    super();
    this.aoMaterial=new T.ShaderMaterial({
      uniforms: { tDiffuse: {value:null}, tDepth:{value:null}, inverseProjection:{value:camera.projectionMatrixInverse}, resolution:{value:new T.Vector2()}, reversed:{value:reversedDepth}, projectionScale:{value:1} },
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`
      uniform sampler2D tDiffuse,tDepth;
      uniform mat4 inverseProjection;
      uniform vec2 resolution;
      uniform bool reversed;
      uniform float projectionScale;
      varying vec2 vUv;
      vec3 positionAt(vec2 uv){
        float d=texture2D(tDepth,uv).x;
        vec4 p=inverseProjection*vec4(uv*2.-1.,reversed?d:d*2.-1.,1.);
        return p.xyz/p.w;
      }
      void main(){

        float depth=texture2D(tDepth,vUv).x;
        if((reversed&&depth<.000001)||(!reversed&&depth>.999999)){gl_FragColor=vec4(1.,26000.,0.,1.);return;}
        vec3 p=positionAt(vUv);
        vec2 pixel=1./resolution;
        vec3 l=positionAt(vUv-vec2(pixel.x,0.)),r=positionAt(vUv+vec2(pixel.x,0.));
        vec3 b=positionAt(vUv-vec2(0.,pixel.y)),t=positionAt(vUv+vec2(0.,pixel.y));
        vec3 dx=abs(l.z-p.z)<abs(r.z-p.z)?p-l:r-p;
        vec3 dy=abs(b.z-p.z)<abs(t.z-p.z)?p-b:t-p;
        vec3 n=normalize(cross(dx,dy));
        if(dot(n,-p)<0.)n=-n;
        float radius=14.;
        float pixels=clamp(radius*projectionScale/max(-p.z,1.),2.,42.);
        float occlusion=0.;
        for(int i=0;i<24;i++){
          float f=float(i);
          float a=f*2.39996323;
          float distanceScale=sqrt((f+.5)/24.);
          vec2 uv=vUv+vec2(cos(a),sin(a))*pixels*distanceScale*pixel;
          vec3 delta=positionAt(clamp(uv,pixel,1.-pixel))-p;
          float d=length(delta);
          float horizon=max(dot(n,delta)/max(d,.001)-.12,0.);
          occlusion+=horizon*(1.-smoothstep(.2,radius,d));
        }
        float ao=clamp(1.-occlusion/24.*3.2,.57,1.);
        // Leave distant haze intact and avoid a dirty outline around aircraft/rooftops.
        ao=mix(ao,1.,smoothstep(1800.,6500.,-p.z));
        gl_FragColor=vec4(ao,-p.z,0.,1.);
      }`
    });
    this.camera=camera;
    this.target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false,minFilter:T.NearestFilter,magFilter:T.NearestFilter});
    this.combine=new T.ShaderMaterial({
      uniforms:{ tDiffuse:{value:null}, tAO:{value:this.target.texture}, tDepth:{value:null}, inverseProjection:{value:camera.projectionMatrixInverse}, reversed:{value:reversedDepth}, aoResolution:{value:new T.Vector2()} },
      vertexShader:this.aoMaterial.vertexShader,
      fragmentShader:`
        uniform sampler2D tDiffuse,tAO,tDepth;
        uniform mat4 inverseProjection;
        uniform bool reversed;
        uniform vec2 aoResolution;
        varying vec2 vUv;
        void main(){
          float d=texture2D(tDepth,vUv).x;
          vec4 p=inverseProjection*vec4(vUv*2.-1.,reversed?d:d*2.-1.,1.);
          float z=-p.z/p.w;
          vec2 point=vUv*aoResolution-.5,base=floor(point),f=fract(point);
          float total=0.,weight=0.;
          for(int y=0;y<2;y++)for(int x=0;x<2;x++){
            vec2 offset=vec2(float(x),float(y));
            vec2 sampleAO=texture2D(tAO,(base+offset+.5)/aoResolution).rg;
            vec2 b=mix(1.-f,f,offset);
            float w=b.x*b.y*exp(-abs(sampleAO.g-z)/max(.4,z*.002));
            total+=sampleAO.r*w;weight+=w;
          }
          float ao=weight>.0001?total/weight:1.;
          vec4 colour=texture2D(tDiffuse,vUv);
          gl_FragColor=vec4(colour.rgb*ao,colour.a);
        }`
    });
    this.quad=new FullScreenQuad(null);
  }
  render(renderer,writeBuffer,readBuffer){
    const w=Math.ceil(readBuffer.width/2),h=Math.ceil(readBuffer.height/2);
    if(this.target.width!==w||this.target.height!==h)this.target.setSize(w,h);
    const uniforms=this.aoMaterial.uniforms;
    uniforms.tDepth.value=readBuffer.depthTexture;
    uniforms.resolution.value.set(readBuffer.width,readBuffer.height);
    uniforms.projectionScale.value=readBuffer.height*this.camera.projectionMatrix.elements[5]*.5;
    this.quad.material=this.aoMaterial;
    renderer.setRenderTarget(this.target);this.quad.render(renderer);
    this.combine.uniforms.tDiffuse.value=readBuffer.texture;
    this.combine.uniforms.tDepth.value=readBuffer.depthTexture;
    this.combine.uniforms.aoResolution.value.set(w,h);
    this.quad.material=this.combine;
    renderer.setRenderTarget(this.renderToScreen?null:writeBuffer);this.quad.render(renderer);
  }
  dispose(){this.target.dispose();this.aoMaterial.dispose();this.combine.dispose();this.quad.dispose();}
}
