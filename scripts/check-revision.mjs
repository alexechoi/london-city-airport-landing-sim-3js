import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir("work/revision", { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=" + (process.env.CAPTURE_ANGLE || "swiftshader"),
    "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.setDefaultTimeout(120000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto(process.env.SITE_URL || "http://localhost:5173");
await page.waitForFunction(
  () => {
    if (window.__ready) {
      sim.freeze();
      return true;
    }
    return false;
  },
  null,
  { timeout: 180000 },
);
await page.waitForLoadState("networkidle");
await page.evaluate(() => sim.freeze());
for (const runway of ["09", "27"])
  for (const heading of [0, 90, 180, 270]) {
    const v = await page.evaluate(
      ({ runway, heading }) => {
        sim.choose(runway);
        sim.start("fly");
        sim.setFlight({ x: 2500, z: 4000, y: 800, heading });
        sim.advance(0);
        return { p: sim.camera.position, done: sim.flight.done };
      },
      { runway, heading },
    );
    const sign = runway === "09" ? -1 : 1,
      px = runway === "09" ? -2500 : 2500,
      pz = runway === "09" ? -5508 : 4000;
    assert.ok(
      Math.abs(
        v.p[0] -
          px +
          Math.sin((heading * Math.PI) / 180) * sign * 66,
      ) < 0.01,
    );
    assert.ok(
      Math.abs(
        v.p[2] -
          pz -
          Math.cos((heading * Math.PI) / 180) * sign * 66,
      ) < 0.01,
    );
    assert.equal(v.done, false);
  }
await page.evaluate(() => {
  sim.choose("09");
  sim.start("fly");
});
for (let i = 0; i < 48; i++) {
  await page.evaluate((i) => {
    sim.setFlight({ heading: i * 1.8, y: 560, z: 5500 - i * 3 });
    sim.advance(0);
  }, i);
  await page.screenshot({
    path: `work/revision/${String(i).padStart(3, "0")}.jpg`,
    type: "jpeg",
    quality: 88,
  });
}
await page.evaluate(() => {
  sim.choose("27");
  sim.start("fly");
  const b = sim.buildings.find((b) => b.h > 80 && b.minZ < -4000);
  sim.setFlight({ x: (b.minX + b.maxX) / 2, z: b.maxZ + 12, y: 60 });
  sim.advance(0.01);
  sim.advance(0.25);
  sim.advance(0);
});
assert.equal(await page.evaluate(() => sim.impact.visible), true);
await page.screenshot({ path: "work/revision/impact.png" });
await page.evaluate(() => {
  sim.advance(2);
  sim.advance(0);
});
assert.equal(await page.locator("#result").isVisible(), true);
await page.click("#again");
assert.equal(await page.evaluate(() => sim.impact.visible), false);
assert.deepEqual(errors, []);
console.log(
  "PASS: both runways, four camera headings, free flight within the London region, impact and restart; 48 motion frames captured.",
);
await browser.close();
