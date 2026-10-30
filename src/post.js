import * as T from "three";
import { ContactOcclusionPass } from "./contact-occlusion.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// Scene-linear grading adapted from Slop New York's MIT-licensed post-processing.js.
// Tone mapping and display conversion happen exactly once, in OutputPass.
export function createPost(renderer, scene, camera, software = false) {
  const composer = new EffectComposer(renderer);
  renderer.info.autoReset = false;
  composer.renderTarget1.samples = software ? 0 : 4;
  composer.renderTarget2.samples = software ? 0 : 4;
  for (const target of [composer.renderTarget1, composer.renderTarget2]) {
    target.depthTexture = new T.DepthTexture(1, 1, T.UnsignedIntType);
  }
  composer.addPass(new RenderPass(scene, camera));
  // Logarithmic-depth fallback requires a different reconstruction. Reverse depth
  // is supported on current desktop/mobile WebGL2 browsers; preserve fallback rendering.
  if (renderer.capabilities.reversedDepthBuffer)
    composer.addPass(new ContactOcclusionPass(camera, true));
  const grade = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      aspect: { value: innerWidth / innerHeight },
    },
    vertexShader:
      "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `uniform sampler2D tDiffuse;uniform float aspect;varying vec2 vUv;
    void main(){
      vec3 color=max(texture2D(tDiffuse,vUv).rgb,vec3(0.));
      float luma=dot(color,vec3(.2126,.7152,.0722));
      color*=mix(vec3(.975,1.005,1.03),vec3(1.),smoothstep(.02,.6,luma));
      color*=mix(vec3(1.),vec3(1.025,1.005,.98),smoothstep(.6,3.,luma));
      color*=pow(max(luma,.0001)/.18,.065);
      color=mix(vec3(dot(color,vec3(.2126,.7152,.0722))),color,1.045);
      float radius=length((vUv-.5)*vec2(aspect,1.))/length(vec2(aspect,1.)*.5);
      color*=1.-smoothstep(.45,1.,radius)*.065;
      gl_FragColor=vec4(max(color,vec3(0.)),1.);
    }`,
  });
  composer.addPass(grade);
  composer.addPass(new SMAAPass());
  composer.addPass(new OutputPass());
  return {
    render: () => {
      renderer.info.reset();
      composer.render();
    },
    resize(w, h) {
      composer.setSize(w, h);
      grade.uniforms.aspect.value = w / h;
    },
  };
}
