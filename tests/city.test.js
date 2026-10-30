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
        assert.ok(
          geometric.dot(supplied) > 0.99,
          "normal must face the same side as its triangle",
        );
      }
    }
  });
