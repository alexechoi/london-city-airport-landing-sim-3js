import * as T from "three";
// Photographic sky with an atmospheric horizon that matches the scene's distance fog.
// Camera rotation is used without translation, so the sky remains infinitely distant.
export function addDaylightSky(scene, hdr, reversedDepth, rotation) {
  const material = new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      skyMap: { value: hdr },
      hazeColor: { value: scene.fog.color },
      rotation: { value: rotation },
      brightness: { value: 0.85 },
    },
    vertexShader: `varying vec3 direction;void main(){direction=position;vec4 p=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);gl_Position=vec4(p.xy,${reversedDepth ? "0." : "p.w"},p.w);}`,
    fragmentShader: `uniform sampler2D skyMap;uniform vec3 hazeColor;uniform float rotation;uniform float brightness;varying vec3 direction;
    void main(){
      vec3 ray=normalize(direction);
      float cs=cos(rotation),sn=sin(rotation);
      vec3 lookup=vec3(ray.x*cs-ray.z*sn,ray.y,ray.x*sn+ray.z*cs);
      vec2 uv=vec2(atan(lookup.z,lookup.x)/6.2831853+.5,asin(clamp(lookup.y,-1.,1.))/3.14159265+.5);
      vec3 color=texture2D(skyMap,uv).rgb*brightness;
      float haze=exp(-max(ray.y,0.)*18.);
      gl_FragColor=vec4(mix(color,hazeColor,haze),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  });
  const sky = new T.Mesh(new T.BoxGeometry(2, 2, 2), material);
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  scene.add(sky);
}
