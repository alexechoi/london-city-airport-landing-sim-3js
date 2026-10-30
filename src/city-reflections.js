import * as T from "three";

// One static district probe: neighbouring towers and streets contribute to the
// curtain walls without six extra scene renders on every animation frame.
export function captureCityReflections(renderer, scene, materials, waters, plane, position) {
  const target = new T.WebGLCubeRenderTarget(256, { type: T.HalfFloatType });
  const probe = new T.CubeCamera(1, 12000, target);
  probe.position.copy(position);
  const planeVisible = plane.visible;
  const waterState = waters.map(w => [w, w.material, w.onBeforeRender]);
  const river = new T.MeshBasicMaterial({ color: 0x53636a });
  plane.visible = false;
  for (const [w] of waterState) {
    w.material = river;
    w.onBeforeRender = () => {};
  }
  const pmrem = new T.PMREMGenerator(renderer);
  try {
    probe.update(renderer, scene);
    const environment = pmrem.fromCubemap(target.texture);
    for (const material of materials) {
      if (!material.userData.reflectiveFacade) continue;
      material.envMap = environment.texture;
      material.envMapRotation.set(0, 0, 0);
      material.envMapIntensity = 2;
      material.needsUpdate = true;
    }
  } finally {
    plane.visible = planeVisible;
    for (const [w, material, beforeRender] of waterState) {
      w.material = material;
      w.onBeforeRender = beforeRender;
    }
    target.dispose();
    pmrem.dispose();
    river.dispose();
    renderer.setRenderTarget(null);
  }
}
