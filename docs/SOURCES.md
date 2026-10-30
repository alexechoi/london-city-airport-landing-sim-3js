# Sources, attribution and scope

## Geography
© OpenStreetMap contributors, https://www.openstreetmap.org/copyright (ODbL 1.0). `public/london.json` is a derived database of 21,392 building footprints with available height/level tags and 9,726 road ways. `public/water.json` contains 271 water polygons. Downloaded through the Overpass API, 30 October 2026. Missing building heights use 2 floors; footprints are real, many heights are estimates. The Thames ribbon is hand approximated; docks use OSM polygons. These derived databases are distributed under ODbL, independently of the Apache-2.0 application code. Attribution is visible in the application footer.

The local frame places runway 27's threshold at approximately 51.50494 N, 0.06602 E, rotated 2.8° from east. The hand-modelled 1,508 × 30 m runway, apron, terminal and navigation lights are reference-based approximations. Visual surroundings are not surveyed scenery.

## Visual reference
- London City Airport's own aerial image: https://images.ctfassets.net/lmkdg513arga/Zad75iAnQxHw3FSbWi268/5b11d71922eeaf1f282436bfeff6b1b7/lcy-sky-view.png
  Reference only; not included in the application. Used to compare runway proportions, paired docks, apron and skyline.
- Airport airspace consultation (5.5° approach): https://www.londoncityairport.com/corporate/airspace-change-process
- NATS aerodrome dimensions: https://www.aurora.nats.co.uk/htmlAIP/Publications/2019-01-03-AIRAC/graphics/27155.pdf
- Tube simulator inspiration: https://github.com/alexechoi/3js-tube-simulator
- Geographic city batching inspiration: https://github.com/mrdoob/slop-newyork (no code copied).

## Water
Ultra-Water: https://github.com/Humpalumps/Ultra-Water, MIT license included in `src/vendor/ultra-water/LICENSE`. Uses its Tessendorf/JONSWAP FFT simulation with a 64² grid, 4 cascades and 15 Hz updates. Three slope cascades feed Three.js Water's planar reflection surface. This is an adapted dock-water renderer, not Ultra-Water's full ocean/underwater pipeline.
Three.js Water and Sky: MIT licensed as part of Three.js.

## Surface photography
Poly Haven, CC0: https://polyhaven.com/license
- asphalt_02: `public/textures/asphalt.jpg`
- rough_concrete: `public/textures/concrete.jpg`
- aerial_grass_rock: `public/textures/grass.jpg`
Downloaded 1K diffuse JPEGs from https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/ . Facades and aircraft paint are generated in the application.

## Aircraft and flight
Procedural British Airways CityFlyer-inspired Embraer 190, approximate dimensions, blue belly, titles, registration and stylised Union flag tail. Brand names identify the depicted aircraft; no affiliation or endorsement. Flight dynamics are deliberately simplified. This is an entertainment demo, not flight training or a navigation tool.

Fonts: DM Sans and Manrope via Google Fonts, SIL Open Font License. System sans fallback is available offline.

## Satellite ground
Sentinel-2 cloudless 2024 by EOX IT Services GmbH, CC BY 4.0: https://s2maps.eu/ . Contains modified Copernicus Sentinel data 2024. Source WMS: https://tiles.maps.eox.at/wms , layer s2cloudless-2024. Cropped to 0.05°W–0.11°E, 51.48–51.53°N, resampled to 4096×2048 and rotated into the local frame at runtime. This is a regional ground colour reference, not high-resolution photogrammetry.
