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

WebGL2 desktop browser recommended. Touch controls are provided on small screens. The central map and wider London context are shipped locally; building geometry is generated in the browser. A loading screen covers asset downloads and scene construction.

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

Wings must be level, touchdown must be inside the runway, sink rate below 4 m/s and speed below 150 knots. Alignment and sink rate determine your score. The runway is narrow: use small inputs. Buildings, including low-rise buildings and the terminal, are collidable. Building strikes trigger a fireball, smoke, debris and (when sound is enabled) impact audio. Background-tab play pauses automatically; press P to resume.

## Cinematic and capture

Watch flythrough, or add `?demo`. Four looping 10-second shots: Canary Wharf, the O2 and Greenwich Peninsula, steep final, and touchdown. H hides titles, P pauses, Escape exits. The capture script records four five-second shots (skyline, O2, final and touchdown) as JPEG frames and an H.264 MP4 with ffmpeg:

```sh
npm run dev
node scripts/capture.mjs
```

Install Chromium and ffmpeg, or set `CHROMIUM_PATH`. Captures go into `work/`, which is gitignored. `node scripts/check-browser.mjs` runs the browser checks.

## Rendering

Real London OSM footprints, surrounding districts, waterways, green spaces and roads, batched textured facades and roofs, metric scene coordinates, detailed GPL-licensed E190 model and BA livery, photographic ground surfaces, photographic HDR daylight and matching horizon haze, Ultra-Water FFT slopes with planar water reflections, HDR multisampling and SMAA, view-following scenery shadows, runway/PAPI lights, and synthesised engine audio. Flight dynamics and some scenery are approximate.

See [sources and licenses](docs/SOURCES.md). Application: Apache-2.0. OSM-derived databases: ODbL. Vendored Ultra-Water: MIT. Photographic surface textures: CC0. E190 aircraft assets: GPL-2.0-or-later with source included. Land-cover raster: CC BY 4.0. This is an independent entertainment project.

Netlify uses `netlify.toml`: `npm run build`, publish `dist`. No server, paid map service or runtime secrets are required.

## Demo media

- [Revised 20-second flythrough](https://city-landing.alexchoi.xyz/flythrough.mp4)
- [Live production screenshot](https://city-landing.alexchoi.xyz/screenshots/title.png)
- [Final approach screenshot](https://city-landing.alexchoi.xyz/screenshots/approach.jpg)

The revised video is rendered from the actual Three.js scene at 1280×720, 24 fps, H.264/AAC.

[One Canada Square close-up](https://city-landing.alexchoi.xyz/screenshots/one-canada-square.png) · [Revised skyline](https://city-landing.alexchoi.xyz/screenshots/skyline.jpg)

## Rendering and control fixes

The renderer uses reversed depth where supported, with a logarithmic-depth fallback for kilometre-scale scenery, separated ground layers, anisotropic facade textures and softer water slopes. Redundant overlapping road surfaces and randomly placed trees were removed. The chase camera follows the aircraft heading with a small side offset; leaving the approach does not end the flight.

`node scripts/check-revision.mjs` checks all four cardinal camera headings on both approaches, flight outside the old boundary, impact effects and retry cleanup, and saves 48 motion frames.

Revision evidence: [chase view](https://city-landing.alexchoi.xyz/screenshots/chase.jpg), [aircraft](https://city-landing.alexchoi.xyz/screenshots/aircraft.png), [building impact](https://city-landing.alexchoi.xyz/screenshots/explosion.png), [camera turn capture](https://city-landing.alexchoi.xyz/camera-check.mp4).

## Architecture and materials

The city uses deterministic individual building seeds for facade tint, window bay widths, glazing, blinds and weathering. Masonry and curtain-wall shaders operate in metres; box-filtered window and brick patterns settle to their average at distance to reduce shimmer. Residential footprints receive pitched roofs where their shape supports them. Tall buildings have instanced mullions, roof parapets and plant equipment. One Canada Square’s 205 m body and 30 m pyramid share the same OSM footprint.

Ground surfaces use separate asphalt, paving, roof and vegetation materials, with world-space wear and filtered joints. Land cover is derived from the attributed aerial reference. Tree placement excludes mapped water, roads and building bounds. The loading overlay remains visible until the aircraft, scenery, textures and first rendered frames are ready; failed loads offer retry.


The O2 is modelled as a 365 m tensioned canopy with a 52 m apex, twelve outward-raked 100 m lattice masts, cable stays, a roof walk and cylindrical service towers at their mapped locations. Quay walls, road-aligned cars and buses, and streetlights add scale to the waterfront. References and licensing are in `docs/SOURCES.md`.

For Linux machines with Mesa, the capture script also supports `CAPTURE_ANGLE=gl-egl` with `LIBGL_ALWAYS_SOFTWARE=1 EGL_PLATFORM=surfaceless`. Capture uses full-quality antialiasing; normal play adapts multisampling and reflection resolution on detected software renderers. The video is rendered offline and is not a real-time performance benchmark.
