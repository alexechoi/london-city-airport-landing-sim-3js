import { test } from "node:test";
import assert from "node:assert/strict";
import { collisionIndex } from "../src/collision.js";
const building = { minX: 0, maxX: 20, minZ: 0, maxZ: 20, h: 12 };
test("low buildings collide, clear overflight does not", () => {
  const c = collisionIndex([building]);
  assert.equal(
    c.hit({ x: 10, y: 8, z: -30 }, { x: 10, y: 8, z: 10 }),
    building,
  );
  assert.equal(c.hit({ x: 10, y: 30, z: -30 }, { x: 10, y: 30, z: 10 }), null);
});
test("swept query catches fast crossings through a building and grid boundary", () => {
  const c = collisionIndex([{ ...building, minX: 155, maxX: 175 }]);
  assert.ok(c.hit({ x: 165, y: 8, z: -200 }, { x: 165, y: 8, z: 200 }));
  assert.equal(
    c.hit({ x: 250, y: 8, z: -200 }, { x: 250, y: 8, z: 200 }),
    null,
  );
});
