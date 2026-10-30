# London City · Final Approach

An open-source Three.js landing challenge. Fly a British Airways-inspired Embraer 190 over Canary Wharf, descend between the Royal Docks and stop on London City's 1,508 m runway.

**Live:** https://city-landing.alexchoi.xyz · **Cinematic:** https://city-landing.alexchoi.xyz/?demo

## Run

```sh
npm install
npm run dev
npm run build
npm test
```

WebGL2 desktop browser recommended. Touch controls are provided on small screens. Initial scenery download is approximately 6 MB; building geometry is generated locally.

## Fly

Runway **09, from the west over Canary Wharf**, is the default. Select **27** for the east approach. Fly the 5.5° glideslope, aim for 125 knots, flare gently below 50 feet, and hold Space after touchdown.

| Control | Action |
| --- | --- |
| ↑ / ↓ | Nose down / nose up |
| ← / → | Bank left / right |
| W / S | Increase / decrease thrust |
| Space | Wheel brakes |
| C | Chase / nose / external camera |
| P | Pause / resume |
| R | Restart current approach |
| M | Sound on / off |
| Escape | Return to title |

Wings must be level, touchdown must be inside the runway, sink rate below 4 m/s and speed below 150 knots. Alignment and sink rate determine your score. The runway is narrow: use small inputs. Tall buildings are collidable. Background-tab play pauses automatically; press P to resume.

## Cinematic and capture

Watch flythrough, or add `?demo`. Four looping 10-second shots: Canary Wharf, dockside aerial, steep final, and touchdown. H hides titles, P pauses, Escape exits. The deterministic capture script creates PNG frames and an H.264 MP4 with ffmpeg:

```sh
npm run dev
node scripts/capture.mjs
```

Install Chromium and ffmpeg, or set `CHROMIUM_PATH`. Captures go into `work/`, which is gitignored. `node scripts/check-browser.mjs` runs the browser checks.

## Rendering

Real London OSM footprints and roads, batched textured facades and roofs, metric scene coordinates, procedural E190 and BA livery, photographic ground surfaces, atmospheric sky and distance haze, Ultra-Water FFT slopes with planar water reflections, static scenery shadows, runway/PAPI lights, and synthesised engine audio. Flight dynamics and some scenery are approximate.

See [sources and licenses](docs/SOURCES.md). Application: Apache-2.0. OSM-derived databases: ODbL. Vendored Ultra-Water: MIT. Photographic textures: CC0. This is an independent entertainment project.

Netlify uses `netlify.toml`: `npm run build`, publish `dist`. No server, paid map service or runtime secrets are required.
