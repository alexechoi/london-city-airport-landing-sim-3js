import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { addCity } from "../src/city.js";
// Inverted supplied normals make every lit wall shade as if its back faced the sun.
for (const clockwise of [false, true])
  test(`wall and roof lighting normals match triangle winding (${clockwise ? "CW" : "CCW"} footprint)`, () => {
    const scene = new T.Scene(),
      material = new T.MeshStandardMaterial();
    let ring = [
      [0, 0],
      [20, 0],
      [20, 12],
      [0, 12],
    ];
    if (clockwise) ring.reverse();
    ring.push(ring[0]);
    addCity(
      scene,
      { buildings: [[18, ring, "office"]] },
      Array(11).fill(material),
      material,
    );
    for (const object of scene.children) {
      const p = object.geometry.attributes.position,
        n = object.geometry.attributes.normal;
      for (let i = 0; i < p.count; i += 3) {
        const a = new T.Vector3().fromBufferAttribute(p, i),
          b = new T.Vector3().fromBufferAttribute(p, i + 1),
          c = new T.Vector3().fromBufferAttribute(p, i + 2);
        const geometric = b.sub(a).cross(c.sub(a)).normalize(),
          supplied = new T.Vector3().fromBufferAttribute(n, i);
        if (Math.abs(supplied.y) < 0.1) {
          const fromCentre = a.clone().sub(new T.Vector3(10, 9, 6));
          assert.ok(
            fromCentre.dot(supplied) > 0,
            "wall normal must point outside footprint",
          );
        }
        assert.ok(
          geometric.dot(supplied) > 0.99,
          "normal must face the same side as its triangle",
        );
      }
    }
  });

test('long residential terraces retain pitched roofs and collision height', () => {
  const scene = new T.Scene(), material = new T.MeshStandardMaterial();
  const ring = [[0,0],[70,0],[70,10],[0,10],[0,0]];
  const colliders = addCity(scene, {buildings:[[6,ring,'house']]}, Array(11).fill(material), material);
  const roof = scene.children.at(-1).geometry;
  roof.computeBoundingBox();
  assert.ok(roof.boundingBox.max.y > 9, 'terrace has a raised ridge');
  assert.ok(Math.abs(colliders[0].h-roof.boundingBox.max.y)<.001, 'collision includes roof ridge');
  for(const mesh of scene.children) {
    const p=mesh.geometry.attributes.position, n=mesh.geometry.attributes.normal;
    for(let i=0;i<p.count;i+=3) {
      const a=new T.Vector3().fromBufferAttribute(p,i), b=new T.Vector3().fromBufferAttribute(p,i+1), c=new T.Vector3().fromBufferAttribute(p,i+2);
      assert.ok(b.sub(a).cross(c.sub(a)).normalize().dot(new T.Vector3().fromBufferAttribute(n,i))>.99);
    }
  }
});

test('facade windows fit complete bays and storeys on different wall lengths', () => {
  const scene=new T.Scene(), material=new T.MeshStandardMaterial();
  addCity(scene,{buildings:[[53,[[0,0],[31,0],[31,19],[0,19],[0,0]],'office']]},Array(11).fill(material),material);
  const wall=scene.children[0].geometry, uv=wall.attributes.uv, layout=wall.attributes.building;
  for(let i=0;i<uv.count;i++) {
    for(const value of [uv.getX(i)/layout.getY(i),uv.getY(i)/layout.getZ(i)])
      assert.ok(Math.abs(value-Math.round(value))<.00001,'window edge lands on a complete bay');
  }
});
