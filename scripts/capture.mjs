import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const duration = 24,
  fps = 24,
  frames = duration * fps;
await mkdir("work/frames", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});
page.on("pageerror", (e) => console.log("ERROR", e.message));
await page.goto((process.env.SITE_URL || "http://localhost:5173") + "/?demo");
await page.waitForFunction(() => window.__ready, null, { timeout: 180000 });
await page.waitForLoadState("networkidle");
await page.evaluate(async () => {
  await document.fonts.ready;
  sim.freeze();
});
for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => sim.renderAt(t), (i / frames) * 39.95);
  await page.screenshot({
    path: `work/frames/${String(i).padStart(5, "0")}.jpg`,
    type: "jpeg",
    quality: 92,
    timeout: 180000,
  });
  if (i % 24 === 0) console.log(`${i}/${frames}`);
}
await browser.close();
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
    "sine=frequency=65:sample_rate=44100",
    "-filter:a",
    "volume=0.035,afade=t=in:d=1,afade=t=out:st=22:d=2",
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
