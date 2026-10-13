# StormTracker street-only, no-satellite A/B performance test
**Date:** 13 October 2026
**Preview URL:** https://blakesmith-intel.github.io/StormTracker/preview/street-only/
**Comparator:** https://blakesmith-intel.github.io/StormTracker/preview/satellite-navigation/

## Purpose
The user reports that map dragging sometimes becomes unresponsive for up to 15–30 seconds, more often in Satellite mode than Street mode, on both mobile Safari and accelerated desktops. Previous RAF gesture coalescing and navigation-time suspension of QLD/NSW high-resolution tiles improved the experience without eliminating stalls. This isolated control removes **all satellite basemap providers entirely** to distinguish satellite work from other expensive scene/rendering work.

## What the experiment does
- The **single browser path** `/preview/street-only/` enables `STREET_ONLY_PERFORMANCE_TEST`. Other paths, including production and earlier previews, remain satellite-capable.
- Cesium is created with `baseLayer:false` as normal. Basemap manager constructs exactly **one** `OpenStreetMapImageryProvider`.
- Never constructs or loads **DEA regional WMTS, NSW Spatial Services aerial imagery or Queensland detailed satellite imagery**. No satellite-layer staging, blend/fade, per-frame detail polling, or satellite error subscriptions.
- If the browser has a saved Satellite preference, preview ignores it without overwriting storage. Programmatic satellite switches are forced back to Street, and the Satellite dropdown option is removed/disabled.
- Keeps **BoM reflectivity, Doppler, tracks, inferred 3-D volumes, emergency context layers, town labels, 3-D terrain, map controls, renderer and update cadence unchanged**. Weather radar tiles are not satellite imagery and remain.
- Shows an explicit test status under the selector.

## Quality checks
- Existing complete frontend `npm test` suite plus manager-specific QA on remembered Satellite preference, prohibited programmatic switching, exact one background provider, no detail listener and unchanged localStorage.
- Deployment stages same code/assets as the satellite-navigation comparison and checks route-specific guard.
- CI verifies deployed preview URL and served operational/runtime modules, as well as pinned V9.18.0 production root.

## How to compare
On the **same device**, open both preview URLs in separate fresh tabs one after another, start with the same radar location and camera height, and try to match 45–60 seconds of pan / drag + aggressive zoom and orbit. Repeat with 3-D and multiple radar sites enabled. Observe camera response, the duration/frequency of stalls, smoothness, label tracking, and whether freezes still occur while standing still.

| Outcome | Interpretation |
|---|---|
| Street-only smooth, satellite comparator freezes | Satellite basemap load/compositing is a plausible major contributor |
| Both freeze | Investigate terrain tile memory, WebGL context/GPU overload, weather overlay compositing, radar 3-D and other shared render loops |
| Both smooth | Satellite navigation suppression may have helped; gather longer physical-device samples before conclusion |

This test is **not** a proven performance fix. Browser hardware/WebGL profiling is still required to prove the mechanism.

## Release safety
The `main` branch may contain experiment code but the GitHub Pages workflow still publishes the root from sealed V9.18.0 commit `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd`. The new experiment exists only at `/preview/street-only/`; no automatic promotion to production.
