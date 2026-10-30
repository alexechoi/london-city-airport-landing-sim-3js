import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir("work/screenshots", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--ignore-gpu-blocklist",
    "--use-angle=" + (process.env.CAPTURE_ANGLE || "swiftshader"),
    "--enable-unsafe-swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(180000);
const errors = [];
page.on("pageerror", (e) => {errors.push(e.message);console.log("PAGE ERROR",e.message)});
page.on("console", (m) => {
  if (m.type() === "error") {errors.push(m.text());console.log("CONSOLE ERROR",m.text())}
});
let unblock;
const gate = new Promise((resolve) => (unblock = resolve));
await page.route("**/london.json", async (route) => {
  await gate;
  await route.continue();
});
await page.goto(process.env.SITE_URL || "http://localhost:5173", {
  waitUntil: "domcontentloaded",
});
assert.equal(await page.locator("#loading").isVisible(), true);
await page.screenshot({ path: "work/screenshots/loading.png" });
unblock();
await page.waitForFunction(() => {if(window.__ready){sim.freeze();return true;}return false;}, null, { timeout: 180000 });
await page.waitForFunction(() => document.getElementById("loading").hidden);
await page.evaluate(() => sim.freeze());
await page.screenshot({ path: "work/screenshots/03-title.png" });
assert.equal(await page.locator("#runway-number").textContent(), "09");
await page.click("#fly");
await page.evaluate(() => sim.advance(0));
await page.screenshot({ path: "work/screenshots/04-west-approach.png" });
for (const approach of ["09", "27"]) {
  await page.evaluate((a) => {
    sim.choose(a);
    sim.start("fly");
    sim.setFlight({ x: 0, y: 4.4, z: -220, pitch: -1, bank: 0, speed: 125 });
    sim.advance(0.01);
  }, approach);
  assert.equal(await page.evaluate(() => sim.flight.ground), true);
  await page.evaluate(() => {
    for (let i = 0; i < 650; i++) sim.advance(1 / 60, { " ": true });
  });
  assert.equal(await page.evaluate(()=>sim.flight.done),false);
  await page.evaluate(a=>{sim.setFlight({x:a==='09'?171:-171,z:a==='09'?-84:-1424,heading:a==='09'?90:-90,speed:0});sim.advance(0);},approach);
  assert.equal(await page.locator("#result-title").textContent(),"Parked at gate 4.");
  assert.equal(await page.locator("#result").isVisible(), true);
}
await page.evaluate(() => {
  sim.start("fly");
  sim.setFlight({ x: 80, y: 4.4, z: -220, pitch: -1, speed: 125 });
  sim.advance(0.01);
});
assert.equal(
  await page.locator("#result-title").textContent(),
  "Approach missed.",
);
await page.click("#again");
assert.equal(await page.locator("#result").isVisible(), false);
await page.click("#menu");
await page.click("#demo");
await page.evaluate(() => sim.renderAt(23));
await page.screenshot({ path: "work/screenshots/05-final.png" });
await page.keyboard.press("Escape");
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "work/screenshots/06-mobile.png" });
assert.deepEqual(errors, []);
console.log(
  "PASS: both approaches, touchdown, braking, crash, retry, demo, mobile; no browser errors.",
);
const failed = await browser.newPage();
await failed.route("**/london.json", (r) => r.abort());
await failed.goto(process.env.SITE_URL || "http://localhost:5173");
await failed.waitForSelector("#loading[data-failed=true]");
assert.equal(await failed.locator("#load-retry").isVisible(), true);
console.log("PASS: loading screen gates scenery and shows retry on failure.");
await browser.close();
