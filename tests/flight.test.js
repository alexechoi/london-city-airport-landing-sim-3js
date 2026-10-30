import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialFlight,
  stepFlight,
  landingVerdict,
  customFlightState,
} from "../src/flight.js";
test("stable 5.5 degree final follows reference approach", () => {
  const s = initialFlight();
  for (let i = 0; i < 1200; i++) stepFlight(s, {}, 1 / 60);
  assert.ok(s.z < 1800 && s.z > 1600);
  assert.ok(Math.abs(s.y - s.z * Math.tan((5.5 * Math.PI) / 180)) < 8);
});
test("only safe on-runway touchdown earns a score", () => {
  const s = { ...initialFlight(), z: -250, y: 4.5, x: 1, vs: -1, pitch: 0 };
  assert.equal(landingVerdict(s).safe, true);
  for (const change of [
    { x: 16 },
    { z: 1 },
    { z: -1510 },
    { vs: -6 },
    { speed: 170 },
    { bank: 20 },
  ])
    assert.equal(landingVerdict({ ...s, ...change }).safe, false);
});
test("braking stops aircraft within runway", () => {
  const s = { ...initialFlight(), ground: true, z: -250, y: 4.5 };
  for (let i = 0; i < 900; i++) stepFlight(s, { " ": true }, 1 / 60);
  assert.equal(s.speed, 0);
  assert.ok(s.z > -1508);
});
test("throttle and pitch clamp and banking turns left", () => {
  const s = initialFlight();
  for (let i = 0; i < 600; i++)
    stepFlight(s, { w: true, ArrowLeft: true, ArrowDown: true }, 1 / 60);
  assert.ok(s.throttle <= 1);
  assert.ok(s.pitch <= 12);
  assert.ok(s.x < 0);
});

test("held aileron allows steep banks and tight turns at approach speed", () => {
  const left = { ...initialFlight(), y: 1000, pitch: 0 },
    right = { ...initialFlight(), y: 1000, pitch: 0 };
  for (let i = 0; i < 480; i++) {
    stepFlight(left, { ArrowLeft: true }, 1 / 60);
    stepFlight(right, { ArrowRight: true }, 1 / 60);
  }
  assert.ok(left.bank >= 70 && left.bank <= 75);
  assert.ok(right.bank <= -70 && right.bank >= -75);
  assert.ok(left.heading < -90 && right.heading > 90);
  assert.ok(Math.abs(left.heading + right.heading) < 0.001);
  const bank = left.bank;
  for (let i = 0; i < 120; i++) stepFlight(left, {}, 1 / 60);
  assert.ok(
    left.bank > 0 && left.bank < bank * 0.4,
    "releasing aileron gently levels the wings",
  );
});

test("custom starts preserve chosen world position and compass heading for either runway", () => {
  for (const runway of ["09", "27"])
    for (const bearing of [0, 90, 180, 270]) {
      const config = { x: 1700, z: -4800, altitudeFt: 2200, bearing };
      const s = customFlightState(config, runway);
      const world = (s) =>
        runway === "09" ? { x: -s.x, z: -1508 - s.z } : { x: s.x, z: s.z };
      assert.deepEqual(world(s), { x: config.x, z: config.z });
      assert.ok(Math.abs(s.y - 670.56) < 0.001);
      stepFlight(s, {}, 1 / 60);
      const p = world(s),
        dx = p.x - config.x,
        dz = p.z - config.z,
        a = (2.8 * Math.PI) / 180;
      const east = dz * Math.cos(a) + dx * Math.sin(a),
        north = dx * Math.cos(a) - dz * Math.sin(a);
      const actual = ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
      assert.ok(
        Math.abs(((actual - bearing + 540) % 360) - 180) < 0.001,
        "aircraft nose matches compass bearing",
      );
    }
});
