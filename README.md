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

Custom Start opens the hard-mode map. Click a starting point, set a compass heading and altitude, then launch airborne at 140 knots. Drag to pan, scroll or use +/− to zoom; arrow keys move the selected point. Retry preserves your custom start. Normal approach buttons return to the standard setup. Banking reaches ±75° with 60°/s roll authority; turn rate responds to bank and airspeed.

Wings must be level, touchdown must be inside the runway, sink rate below 4 m/s and speed below 150 knots. Alignment and sink rate determine your score. The runway is narrow: use small inputs. Buildings, including low-rise buildings and the terminal, are collidable. Building strikes trigger a fireball, smoke, debris and (when sound is enabled) impact audio. Background-tab play pauses automatically; press P to resume.

## Cinematic and capture

Watch flythrough, or add `?demo`. Four looping 10-second shots: Canary Wharf, the O2 and Greenwich Peninsula, steep final, and touchdown. H hides titles, P pauses, Escape exits. The capture script records four five-second shots (skyline, O2, final and touchdown) as JPEG frames and an H.264 MP4 with ffmpeg:

```sh
npm run dev
node scripts/capture.mjs
```

Install Chromium and ffmpeg, or set `CHROMIUM_PATH`. Captures go into `work/`, which is gitignored. `node scripts/check-browser.mjs` runs the browser checks.

## Rendering

Real London OSM footprints, surrounding districts, waterways, green spaces and roads, batched PBR facades with aligned colour, normal, roughness and metalness maps, textured roofs, metric scene coordinates, detailed GPL-licensed E190 model and BA livery, photographic ground surfaces, photographic HDR daylight and matching horizon haze, Ultra-Water FFT slopes with planar water reflections, HDR multisampling and SMAA, view-following scenery shadows, runway/PAPI lights, and synthesised engine audio. Flight dynamics and some scenery are approximate.

See [sources and licenses](docs/SOURCES.md). Application: Apache-2.0. OSM-derived databases: ODbL. Vendored Ultra-Water: MIT. Surface photography and authored ambientCG facade textures: CC0. E190 aircraft assets: GPL-2.0-or-later with source included. Land-cover raster: CC BY 4.0. This is an independent entertainment project.

Netlify uses `netlify.toml`: `npm run build`, publish `dist`. No server, paid map service or runtime secrets are required.

## Demo media

- [Revised 20-second flythrough](public/flythrough.mp4)
- [Title screen](public/screenshots/title.png)
- [Final approach screenshot](public/screenshots/approach.jpg)

Media links show this branch’s assets; production may run an earlier revision.

The revised video is rendered from the actual Three.js scene at 1280×720, 24 fps, H.264/AAC.

[One Canada Square close-up](public/screenshots/one-canada-square.png) · [Revised skyline](public/screenshots/skyline.jpg)

## Rendering and control fixes

The renderer uses reversed depth where supported, with a logarithmic-depth fallback for kilometre-scale scenery, separated ground layers, anisotropic facade textures and softer water slopes. Redundant overlapping road surfaces and randomly placed trees were removed. The chase camera follows the aircraft heading with a small side offset; leaving the approach does not end the flight.

`node scripts/check-revision.mjs` checks all four cardinal camera headings on both approaches, flight outside the old boundary, impact effects and retry cleanup, and saves 48 motion frames.

Revision evidence: [chase view](public/screenshots/chase.jpg), [building impact](public/screenshots/explosion.png), [camera turn capture](public/camera-check.mp4).

## Architecture and materials

The city uses six authored PBR facade families with recessed frames, blinds, brick and curtain-wall details. Per-building seeds vary tint, window bay widths, storey heights and texture offsets. Curtain walls reflect a static Canary Wharf city probe. Surrounding districts retain brick, stone, industrial and glass material families, including during custom flights. Normal, roughness, metalness and occlusion maps share metric UVs; mipmaps and anisotropic filtering reduce distant shimmer. Landmark shaders retain filtered geometric patterns. Residential footprints receive pitched roofs where their shape supports them. Tall buildings have roof parapets, corner trim and plant equipment. One Canada Square’s 205 m body and 30 m pyramid share the same OSM footprint.

Ground surfaces use separate asphalt, paving, roof and vegetation materials, with world-space wear and filtered joints. Land cover is derived from the attributed aerial reference. Tree placement excludes mapped water, roads and building bounds. The loading overlay remains visible until the aircraft, scenery, textures and first rendered frames are ready; failed loads offer retry.


The O2 is modelled as a 365 m tensioned canopy with a 52 m apex, twelve outward-raked 100 m lattice masts, cable stays, a roof walk and cylindrical service towers at their mapped locations. Quay walls, road-aligned cars and buses, and streetlights add scale to the waterfront. References and licensing are in `docs/SOURCES.md`.

For Linux machines with Mesa, the capture script also supports `CAPTURE_ANGLE=gl-egl` with `LIBGL_ALWAYS_SOFTWARE=1 EGL_PLATFORM=surfaceless`. Capture uses full-quality antialiasing; normal play adapts multisampling and reflection resolution on detected software renderers. The video is rendered offline and is not a real-time performance benchmark.

[Custom-start map](public/screenshots/custom-start-desktop.png) · [Mobile map setup](public/screenshots/custom-start-mobile.png) · [Steep banking](public/screenshots/steep-bank.png)
