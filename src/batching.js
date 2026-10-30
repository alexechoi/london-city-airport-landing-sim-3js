import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
// Merge immutable meshes by material while retaining their world transforms.
// Aircraft has fixed landing gear for this landing demo and no skeletal animation.
export function mergeStaticMeshes(objects) {
  const buckets = new Map();
  for (const object of objects) {
    if (!object.isMesh || Array.isArray(object.material)) continue;
    object.updateWorldMatrix(true, false);
    const geometry = (
      object.geometry.index
        ? object.geometry.toNonIndexed()
        : object.geometry.clone()
    ).applyMatrix4(object.matrixWorld);
    for (const name of Object.keys(geometry.attributes))
      if (!["position", "normal", "uv"].includes(name))
        geometry.deleteAttribute(name);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    if (!geometry.attributes.uv)
      geometry.setAttribute(
        "uv",
        new T.BufferAttribute(
          new Float32Array(geometry.attributes.position.count * 2),
          2,
        ),
      );
    const bucket = buckets.get(object.material.uuid) || {
      material: object.material,
      geometries: [],
    };
    bucket.geometries.push(geometry);
    buckets.set(object.material.uuid, bucket);
  }
  const result = new T.Group();
  for (const { material, geometries } of buckets.values()) {
    const geometry = mergeGeometries(geometries);
    if (!geometry) throw new Error("Static mesh attributes do not match");
    const mesh = new T.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    result.add(mesh);
    geometries.forEach((g) => g.dispose());
  }
  return result;
}
