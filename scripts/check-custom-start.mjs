import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir("work/screenshots", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=" + (process.env.CAPTURE_ANGLE || "swiftshader"),
    "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader",
  ],
});
const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
p.setDefaultTimeout(180000);
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await p.goto(process.env.SITE_URL || "http://localhost:5173");
await p.waitForFunction(() => {
  if (window.__ready) {
    sim.freeze();
    return true;
  }
  return false;
});
await p.waitForFunction(() => document.getElementById("loading").hidden);
await p.click("#custom-mode");
assert.equal(await p.locator("#custom-start").isVisible(), true);
await p.screenshot({ path: "work/screenshots/custom-start-desktop.png" });
const box = await p.locator("#start-map").boundingBox();
const landmark = await p.evaluate(() => sim.landmark.position);
const a = (2.8 * Math.PI) / 180,
  e = landmark[2] * Math.cos(a) + landmark[0] * Math.sin(a),
  n = landmark[0] * Math.cos(a) - landmark[2] * Math.sin(a);
await p
  .locator("#start-map")
  .click({
    position: {
      x: box.width / 2 + ((e + 3500) * box.width) / 21000,
      y: box.height / 2 - (n * box.width) / 21000,
    },
  });
await p.fill("#start-altitude", "300");
assert.equal(await p.locator("#launch-custom").isDisabled(), true);
await p.fill("#start-altitude", "2300");
await p.locator("#start-bearing").fill("250");
await p.selectOption("#start-runway", "27");
await p.locator("#start-bearing").fill("250");
await p.click("#launch-custom");
assert.equal(await p.locator("#custom-start").isVisible(), false);
const state = await p.evaluate(() => ({ f: sim.flight, c: sim.customStart }));
assert.ok(state.c);
assert.equal(state.c.bearing, 250);
assert.equal(state.c.runway, "27");
assert.ok(Math.abs(state.f.y - 2300 * 0.3048) < 0.001);
assert.ok(Math.abs(state.f.x - state.c.x) < 0.001);
assert.ok(Math.abs(state.f.z - state.c.z) < 0.001);
await p.evaluate(() => {
  for (let i = 0; i < 90; i++) sim.advance(1 / 60, { ArrowLeft: true });
  sim.advance(0);
});
assert.ok(await p.evaluate(() => sim.flight.bank > 70));
await p.screenshot({ path: "work/screenshots/steep-bank.png" });
await p.click("#restart");
assert.ok(Math.abs((await p.evaluate(() => sim.flight.x)) - state.c.x) < 0.001);
await p.click("#menu");
await p.setViewportSize({ width: 390, height: 844 });
await p.click("#custom-mode");
await p.screenshot({ path: "work/screenshots/custom-start-mobile.png" });
await p.click("#close-custom");
await p.click("#fly");
assert.equal(await p.evaluate(() => sim.customStart), null);
assert.deepEqual(errors, []);
console.log(
  "PASS: custom map placement, unsafe altitude prevention, chosen compass heading, east approach, steep bank, exact-start retry, mobile panel and normal-mode reset.",
);
await browser.close();
