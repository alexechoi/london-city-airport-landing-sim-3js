# Sources, attribution and scope

## Geography
© OpenStreetMap contributors, https://www.openstreetmap.org/copyright (ODbL 1.0). `public/london.json` is a derived database of 21,392 building footprints with available height/level tags and 9,528 visible road ways. The central map was downloaded through the Overpass API, 30 October 2026. Missing building heights generally use 2 floors; apartments and offices with that fallback are estimated at 5–7 floors; footprints are real, many heights are estimates. `public/context.json`, `public/water.json` and `public/parks.json` derive from OpenFreeMap/OpenMapTiles OSM vector tiles (planet version `20261025_080012_pt`, https://tiles.openfreemap.org/planet). Context contains 98,936 surrounding building outlines. Individual small footprints are retained along the western flight corridor; farther low-rise groups are joined and simplified for distance rendering. The context importer infers residential treatment from low building heights; it is not a surveyed building-use or roof-shape database. An additional 62,528 mapped road sections extend the street network beyond the core area. Water polygons are joined across tile boundaries and preserve holes; green spaces retain areas above 400 m². `scripts/fetch-context.py` and `scripts/compact-context.py` reproduce these derivatives. These derived databases are distributed under ODbL, independently of the Apache-2.0 application code. Attribution is visible in the application footer.

The local frame places runway 27's threshold at approximately 51.50494 N, 0.06602 E, rotated 2.8° from east. The hand-modelled 1,508 × 30 m runway, apron, terminal and navigation lights are reference-based approximations. Visual surroundings are not surveyed scenery. Surrounding London uses simplified mapped footprints and height bands, rendered in geographic cells.

## Visual reference
- London City Airport's own aerial image: https://images.ctfassets.net/lmkdg513arga/Zad75iAnQxHw3FSbWi268/5b11d71922eeaf1f282436bfeff6b1b7/lcy-sky-view.png
  Reference only; not included in the application. Used to compare runway proportions, paired docks, apron and skyline.
- Airport airspace consultation (5.5° approach): https://www.londoncityairport.com/corporate/airspace-change-process
- NATS aerodrome dimensions: https://www.aurora.nats.co.uk/htmlAIP/Publications/2019-01-03-AIRAC/graphics/27155.pdf
- Tube simulator inspiration: https://github.com/alexechoi/3js-tube-simulator
- City material reference: https://github.com/mrdoob/slop-newyork. Reviewed `js/tsl-materials.js`, `js/buildings.js`, `js/building-details.js`, and `js/city-grid.js`. The box-filtered periodic pulse in `src/materials.js` and `src/curtain-wall.js` is adapted from that MIT-licensed code; license retained in `src/vendor/slop-new-york/LICENSE`. Facade interiors, seeded window variation, metre-scale brick courses, material roughness and paving use a WebGL implementation of those techniques.

## Water
Ultra-Water: https://github.com/Humpalumps/Ultra-Water, MIT license included in `src/vendor/ultra-water/LICENSE`. Uses its Tessendorf/JONSWAP FFT simulation with a 64² grid, 4 cascades and 15 Hz updates. Three slope cascades feed Three.js Water's planar reflection surface. This is an adapted dock-water renderer, not Ultra-Water's full ocean/underwater pipeline.
Three.js Water: MIT licensed as part of Three.js. `src/vendor/three-water/Water.js` adapts the reflection clip plane for reversed depth; its MIT license is retained alongside it.

## Surface photography
Poly Haven, CC0: https://polyhaven.com/license
- asphalt_02: `public/textures/asphalt.jpg`
- rough_concrete: `public/textures/concrete.jpg`
- aerial_grass_rock: `public/textures/grass.jpg`
- brick_wall_001, red_brick_03, concrete_wall_003: wall diffuse, normal and roughness maps
- concrete_pavement: pavement surface photography
- roof_slates_02: slate roof surface photography
Downloaded 1K diffuse JPEGs from https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/ . Facade layout and tint use deterministic per-building seeds.

## Aircraft and flight
FlightGear E-Jet family Embraer 190 mesh and British Airways livery, GPL-2.0-or-later. Source, conversion instructions, authors and license are supplied in `assets-source/e190/`; the derived model is `public/models/e190.glb`. The BA atlas originated on the E170 and is an approximate fit to the E190, including its registration. Brand names identify the depicted aircraft; no affiliation or endorsement. Flight dynamics are deliberately simplified. This is an entertainment demo, not flight training or a navigation tool.

Fonts: DM Sans and Manrope via Google Fonts, SIL Open Font License. System sans fallback is available offline.

## Satellite ground
Sentinel-2 cloudless 2024 by EOX IT Services GmbH, CC BY 4.0: https://s2maps.eu/ . Contains modified Copernicus Sentinel data 2024. Source WMS: https://tiles.maps.eox.at/wms , layer s2cloudless-2024. Cropped to 0.16°W–0.16°E, 51.45–51.565°N, resampled to 4096×2304 and rotated into the local frame at runtime. The photograph is retained as reference; its vegetation classification and broad luminance (`landcover.jpg`, red/green data channels) control ground material blending and tree placement. The full flight area now shares this coverage; western districts no longer fall back to uniform paving. `scripts/prepare-landcover.py --download` refreshes the source and mask from the shared `src/landcover-bounds.json`. Roads and buildings are rendered geometry, not pixels from the satellite photograph. Water geometry now comes from the mapped polygons above.

## Landmark photograph comparisons
Wikimedia photographs were inspected as reference only and are not bundled:
- One Canada Square: https://commons.wikimedia.org/wiki/File:London_MMB_S6_Canary_Wharf.jpg — pale facade panels, paired window bays, roof collar and ribbed pyramid.
- HSBC: https://commons.wikimedia.org/wiki/File:HSBC_Tower_-_September_2012.JPG — reflective blue glazing, floor bands and upper-facade signage.
Landmark signs and the Newfoundland structural lattice are modelled approximations.

### Millennium Dome / The O2 architectural reference

The hand-built model in `src/o2.js` uses the documented 365 m diameter, 52 m canopy apex and twelve 100 m masts. The shallow membrane, outward-raked lattice columns, cable fan, rooftop walkway and cylindrical service towers were studied against [Wikimedia: O2 Arena (9499773307)](https://commons.wikimedia.org/wiki/File:O2_Arena_(9499773307).jpg) and the [RSHP Millennium Dome project](https://rshp.com/projects/culture-and-leisure/millennium-dome/). Reference photographs are not included in the shipped assets. The model is an approximation, not a surveyed reconstruction.

### Daylight and final rendering

Poly Haven `kloofendal_48d_partly_cloudy_puresky`, CC0: https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky . The 2K HDR photograph supplies the visible sky and image-based lighting, with matching environment/background rotation. Three.js EffectComposer applies HDR multisampling, SMAA edge antialiasing and a single ACES/display conversion. The gentle scene-linear contrast and shadow/highlight grading in `src/post.js` adapts the MIT-licensed Slop New York `post-processing.js`; attribution and license remain in `src/vendor/slop-new-york/`.

Surrounding context buildings are excluded from the water reflection pass, while the detailed core city remains reflected. Software renderers use a lower-cost antialiasing/reflection configuration during normal play; the capture URL requests full quality.

Underground road sections are excluded using OSM `tunnel`, `location=underground` and vector-tile `brunnel=tunnel` tags. This prevents the Blackwall and Silvertown tunnels appearing as bridges across the Thames. `scripts/filter-underground-roads.py` applies the same correction to the original Overpass extract and cached context tiles. Pedestrian routes use paving rather than asphalt.

## Facade PBR materials

ambientCG, CC0: https://docs.ambientcg.com/license/ . Authored PBR facade materials (not photographs): [Facade001](https://ambientcg.com/view?id=Facade001), [Facade005](https://ambientcg.com/view?id=Facade005), [Facade006](https://ambientcg.com/view?id=Facade006), [Facade018A](https://ambientcg.com/view?id=Facade018A), [Facade019A](https://ambientcg.com/view?id=Facade019A), and [Facade020A](https://ambientcg.com/view?id=Facade020A). Recessed window frames, blinds, brickwork and metal panels use aligned colour and OpenGL normal maps. AO, roughness and metalness are packed into RGB channels without colour-space conversion. `scripts/fetch-facades.py` reproduces the assets from the 1K JPG archives. Metric UVs vary bay and storey dimensions by building, with deterministic offsets and tint; landmark proportions retain dedicated materials. These are reusable facade families, not individual scans of every building.

Curtain-wall reflections use a static 256-pixel cube probe above Canary Wharf, captured once after textures load. This approximates the district skyline in the glass without recapturing six scene views every frame. It is not a separate, position-correct reflection for each building. The HDR sky remains the diffuse environment; glass reflectance is calibrated separately from the source colour maps.

## Airfield and London landmark revision

The airfield uses Poly Haven CC0 `clean_asphalt`, `concrete_floor_worn_001` and `leafy_grass`, with 1K diffuse, OpenGL normal and roughness maps. `scripts/fetch-airfield-textures.py` downloads the source files. Materials repeat in world metres; concrete joints, touchdown tyre wear and mowing variation are additional shader details. The same photographed ground surfaces contribute to city paving, roads and green spaces.

New landmark models are reference-based approximations at geographic positions, replacing overlapping OSM building parts. Reference photographs were inspected and are not distributed:
- [The Shard](https://commons.wikimedia.org/wiki/File:The_Shard_at_sunset_2017_(cropped).jpg): tapered faceted glass and split crown.
- [Leadenhall and the Gherkin](https://commons.wikimedia.org/wiki/File:Cheesegrater_and_Gherkin.jpg): sloping mega-frame, rounded profile and spiral glazing.
- [20 Fenchurch Street](https://commons.wikimedia.org/wiki/File:Walkie-Talkie_-_Sept_2015_(cropped).jpg) and [22 Bishopsgate](https://commons.wikimedia.org/wiki/File:22.Reza_05.jpg): widened upper floors and faceted stepped massing.
- [London Eye](https://commons.wikimedia.org/wiki/File:London-Eye-2009.JPG): twin wheel rim, spokes, cantilever A-frame and 32 upright capsules.
- [City Hall / the Crystal](https://commons.wikimedia.org/wiki/File:Siemens_Crystal_Building,_London.jpg): folded green-blue glazing.
- [Newham Dockside offices](https://commons.wikimedia.org/wiki/File:Offices_on_the_Dockside_-_geograph.org.uk_-_4962612.jpg): four-storey glazing, stone piers and sunshades.

Landmark dimensions and surrounding heights are approximate. One static City reflection probe supplements the Canary Wharf probe. Moving road vehicles follow connected OSM road segments; traffic signals and road priority are simplified. The flying area is bounded inside the shipped map, with cloud banks and rising haze near its edge.
