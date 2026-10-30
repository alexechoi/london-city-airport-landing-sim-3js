# Visual review — 30 October 2026

This pass was reviewed with fixed camera screenshots of the O2, One Canada Square, the west approach and the runway. The photographs are references, not textures projected over the scene.

| Area | Reference and visible correction |
| --- | --- |
| O2 | [Wikimedia aerial photograph](https://commons.wikimedia.org/wiki/File:O2_Arena_(9499773307).jpg): replaced the scaled hemisphere and thin poles with a shallow membrane, scalloped perimeter, panel seams, twelve outward-raked lattice masts, cable network, roof walk and cylindrical service structures. [Rendered view](../public/screenshots/o2.png). |
| Thames crossings | OSM tags identified the Blackwall and Silvertown tunnels. Underground roads were incorrectly appearing as bridges. Removed 198 core road ways and 2,004 context sections using the original tunnel metadata. |
| One Canada Square | [Wikimedia photograph](https://commons.wikimedia.org/wiki/File:London_MMB_S6_Canary_Wharf.jpg): pale window bays, different upper-floor glazing, a roof collar and a crown seated on the tower. Reduced the heavy horizontal roof striping. [Rendered view](../public/screenshots/one-canada-square.png). |
| Other architecture | Roof equipment varies in placement and size; flat roofs no longer use the large dark camouflage pattern. Photographic brick, concrete and slate maps combine with filtered, individually seeded facade patterns. |
| Ground and water | Mapped streets, parks and water boundaries; quays, cars, buses and streetlights; pedestrian paving. Small water-wave detail fades at distance, and warm diffuse light no longer turns the Thames into a brown mirror. |
| Daylight | CC0 HDR sky supplies image-based lighting; the visible sky blends into the same horizon haze as the scenery. Scene-linear grading, SMAA and hardware multisampling reduce edge aliasing. |

The wider city still uses simplified OSM extrusions and estimated heights where tags are missing. It is not photogrammetric scenery. The O2 is a reference-based architectural approximation. Fine lattice elements intentionally do not cast sub-pixel shadow-map shadows, which caused sparkle on the canopy.

## Verification

- Eight unit tests cover wall/roof normals, swept building collision, flight, touchdown and braking.
- Browser checks passed for both approaches, touchdown, braking, crash/retry, demo, mobile controls, loading gates and load-failure retry after the HDR/postprocessing pass.
- The capture script rejects browser/console errors and records the actual scene at deterministic simulation times, including the O2 shot.
- Four cardinal camera headings on both runways, flight outside the old boundary, building impacts and restart cleanup are covered by `scripts/check-revision.mjs`.

The offline MP4 is demonstration media, not a real-time frame-rate measurement. Hardware uses multisampling; detected software renderers use a cheaper normal-play configuration. Capture explicitly requests full quality.

Sources, asset licenses and reconstruction scripts are in [SOURCES.md](SOURCES.md).
