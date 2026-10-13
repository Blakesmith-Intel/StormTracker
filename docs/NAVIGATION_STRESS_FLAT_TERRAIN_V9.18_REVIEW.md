# StormTracker — Shared camera pressure and flat terrain A/B investigation
**13 October 2026 · isolated QA only**

## Observed symptoms and hypothesis
The user reproduced a browser map crash even on the prior `/preview/street-only/` (all satellite basemaps absent), although it tolerated more rapid navigation than the satellite version. Therefore removing satellite imagery is beneficial but not sufficient to prevent all crashes. The remaining shared scene still loads ArcGIS 3-D elevation, Cesium terrain/tiles, BoM radar/Doppler imagery, weather 3-D primitives, interactive context data, and geographic labels. On desktop the existing input handler executed `camera.lookAt`, lookAtTransform, snapshot and a Cesium render request *once per individual mousemove*, without limiting the rate to display frames.

These are plausible performance contributors, not confirmed causal attribution for all crashes (GPU context loss / OS or Safari termination has not been observed directly).

## Isolated change 1: frame-batched desktop navigation
- `frontend/src/stormtracker-camera-v1.js` now accumulates all horizontal and vertical mouse displacement within a requestAnimationFrame.
- At most one Cesium view update is produced per display frame, including repeated scroll-wheel changes.
- Pan/orbit/tilt retain summed pixel displacement, nav start occurs before camera mutation, touch input remains controlled by its prior independent RAF implementation.
- Pending movement is committed on pointerup/cancel/lostpointercapture and wheel quiet; callback is cancelled on teardown.
- Programmatic camera actions still behave synchronously. No BoM data or feature layers are changed.

## Isolated change 2: Street-only + *flat terrain* control
`https://blakesmith-intel.github.io/StormTracker/preview/street-flat/`

Compared against `https://blakesmith-intel.github.io/StormTracker/preview/street-only/`, both share the exact operational source, OpenStreetMap-only background and the newly frame-batched desktop navigation. Street-flat also calls `terrainManager.setEnabled(false,{persist:false})` on startup, explicitly sets an ellipsoid terrain provider and disables the 3-D elevation checkbox. The browser will **not request the ArcGIS WorldElevation3D terrain provider** for the flat route. Geographic town labels, original radar/Doppler, threat cones, 3-D storm inference, road closures, flood signals and outages remain active.

The flat-terrain route must **not** alter the saved terrain or basemap preference. Moving from this preview to normal production leaves the user's prior settings unchanged. The normal `street-only` preview retains its original ArcGIS 3-D terrain preference.

## Automated checks
- Full frontend `npm test`, including high-rate desktop gesture regression.
- 150 mousemove samples coalesce into one Cesium camera update with preserved drag motion.
- Wheel bursts likewise coalesce; overlapping pointer and wheel input maintain the satellite-suspension lifecycle.
- Destruction cancels any pending animation callback; queued final motion is flushed on pointer release.
- Flat-terrain unit check verifies no elevation provider is constructed and storage remains unchanged.
- GitHub Pages publishes the new preview at `/preview/street-flat/`, validates served files and the new camera module; production root HTML remains byte-for-byte sealed V9.18.0.

## Practical stress test
On the **same device** and ideally same radar, compare:
1. Street-only with **3-D terrain enabled** (existing control).
2. Street-flat with **3-D terrain disabled** (new control).

Pan rapidly for 60 seconds, scroll in/out aggressively, rotate the view and repeat with multiple radars and 3-D volumes. The number of stalls, tab crashes, responsiveness and rendering fidelity matter more than apparent FPS alone.

If Street-flat is materially more stable than Street-only, terrain tile loading/GPU memory is a likely significant contributor and can be optimized without permanently removing terrain. If both still crash, investigate runtime WebGL context loss, GPU memory pressure, storm sprite geometry and 3-D rendering together. No automatic production release or conclusions from Node tests alone.

## Release
PR review staging only. `.github/workflows/pages.yml` continues to publish original sealed V9.18.0 root pinned at `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd`. Do not promote without operator confirmation.
