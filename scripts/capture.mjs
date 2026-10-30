import { chromium } from "playwright";
import { mkdir, copyFile, rm, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const duration = 30,
  fps = 24,
  frames = duration * fps;
if (!process.env.CAPTURE_RESUME)
  await rm("work/frames", { recursive: true, force: true });
await mkdir("work/frames", { recursive: true });
const saved = new Set(await readdir("work/frames"));
let firstFrame = 0;
if (process.env.CAPTURE_RESUME)
  while (firstFrame < frames && saved.has(String(firstFrame).padStart(5, "0") + ".jpg")) firstFrame++;
console.log(`Capturing from frame ${firstFrame}/${frames}`);
await mkdir("public/screenshots", { recursive: true });
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
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto(
  (process.env.SITE_URL || "http://localhost:5173") + "/?demo&capture",
);
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
await page.evaluate(async () => {
  await document.fonts.ready;
  sim.freeze();
});
await page.evaluate(() => {
  document.getElementById("menu").click();
  sim.inspect([-620,390,-2550],[0,0,-600]);
});
await page.screenshot({path: "public/screenshots/title.png"});
await page.evaluate(() => {
  sim.start("demo");
  sim.renderAt(34);
  document.getElementById("caption").hidden = true;
});
await page.screenshot({ path: "public/screenshots/o2.png" });
console.log("O2 review captured", new Date().toISOString());
await page.evaluate(() => {
  const [x, y, z] = sim.landmark.position;
  sim.inspect([x - 290, y + 50, z - 240], [x, 150, z]);
  document.getElementById("caption").hidden = true;
});
await page.screenshot({ path: "public/screenshots/one-canada-square.png" });
await page.evaluate(() => sim.start("demo"));
if (errors.length) throw new Error(errors.join("\n"));
for (let i = firstFrame; i < frames; i++) {
  await page.evaluate(
    (t) => sim.renderAt(t),
    [0, 8, 16, 24, 32, 43][Math.min(5, Math.floor(i / (fps * 5)))] +
      (i % (fps * 5)) / fps,
  );
  await page.screenshot({
    path: `work/frames/${String(i).padStart(5, "0")}.jpg`,
    type: "jpeg",
    quality: 92,
    timeout: 180000,
  });
  if (i % 24 === 0) console.log(`${i}/${frames} @ ${new Date().toISOString()}`);
}
console.log(
  "Capture geometry",
  await page.evaluate(() => ({
    triangles: sim.renderer.info.render.triangles,
    calls: sim.renderer.info.render.calls,
    vegetation: sim.vegetationCount,
    architecture: sim.architectureStats,
  })),
);
await browser.close();
if (errors.length) throw new Error(errors.join("\n"));
await copyFile("work/frames/00024.jpg", "public/screenshots/shard.jpg");
await copyFile("work/frames/00144.jpg", "public/screenshots/city.jpg");
await copyFile("work/frames/00264.jpg", "public/screenshots/eye.jpg");
await copyFile("work/frames/00384.jpg", "public/screenshots/skyline.jpg");
await copyFile("work/frames/00504.jpg", "public/screenshots/o2.jpg");
await copyFile("work/frames/00624.jpg", "public/screenshots/approach.jpg");
await copyFile("work/frames/00704.jpg", "public/screenshots/touchdown.jpg");
const r = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    "work/frames/%05d.jpg",
    "-f",
    "lavfi",
    "-i",
    "anoisesrc=color=brown:amplitude=0.12:sample_rate=44100",
    "-filter:a",
    "highpass=f=60,lowpass=f=900,volume=0.35,afade=t=in:d=1,afade=t=out:st=28:d=2",
    "-c:v",
    "libx264",
    "-crf",
    "18",
    "-preset",
    "medium",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    "-movflags",
    "+faststart",
    "work/london-city-flythrough.mp4",
  ],
  { stdio: "inherit" },
);
process.exitCode = r.status;
if (r.status === 0)
  await copyFile("work/london-city-flythrough.mp4", "public/flythrough.mp4");
