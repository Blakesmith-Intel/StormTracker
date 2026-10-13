# Cross-device satellite navigation stall — isolated V9.18 review candidate
13 October 2026

## User symptoms and scope
- Initial iPhone report: intermittent pauses while panning in both Street and Satellite. V9.18 mobile RAF gesture batching improved but did not eliminate them.
- Further observation: 15–30 second hangs during satellite camera movement, less severe on accelerated desktops but present there too.
- The common imagery path uses DEA regional satellite beneath **two independently tiled, geographically overlapping** QLD and NSW official detail sources, with state detail staging/fading during zoom. Cesium can request fine-resolution imagery repeatedly as the camera moves. This is a plausible workload contributor, **not a measured attribution of every stall**.

## Change
- Keep one authoritative browser-only global map, original BoM radar/Doppler data, 3-D, tracks and all contextual overlays.
- During actual mobile touch pan/pinch/twist or desktop mouse drag/orbit/tilt/scroll-wheel zoom:
  - Notify the basemap manager **before** the camera moves.
  - Temporarily hide only NSW and QLD **background imagery layers** using `layer.show = false`, preventing further high-resolution tile request churn for these layers. All radar/Doppler and real storm analyses remain visible. Genuine DEA GeoMAD stays as the pan map, with OSM beneath.
  - Cancel pending recovery if another drag starts before the prior one settles.
  - After the final movement, wait 700ms then stage official fine satellite imagery at the final camera location. Require two globe-ready frames before fade in, as in the existing basemap source contract.
- On desktop, activation occurs only after real mouse movement beyond the existing 4-pixel threshold, or on a real wheel zoom event. Discrete scroll ticks share an input quiet window. Combined wheel+pointer input ends only when both sources are idle; no needless reload between scroll events.
- Mobile retains frame-batched gestures and 360ms place decluttering; desktop retains the previous label cadence and normal stationary resolution. `cameraPerformance` interaction SSE still manages regular Cesium globe detail.
- No special treatment of a single map provider, no offline cache, server, paid tier or substituted radar pixels.

## Automated verification
- Existing complete `npm test` suite.
- Basemap unit regression: sustained navigation over local NSW/QLD zoom, both state layers hidden, DEA retained, no reactivation during repeated camera postRender, repeated drag cancelling pending resume, staging and fade after settle, cleanup.
- Mobile gesture regression: touch begins imagery suspension **before** pan; end/cancel/lost capture resume once; a burst of 80 pointer samples still produces one camera update.
- New desktop gesture regression: 150 pan events produce one suspension; tiny movement does not; repeated discrete wheel events hold imagery paused; overlapping wheel/pointer sources do not restore early; destruction restores.
- GitHub Actions full suite and isolated same-origin Pages GET smoke checks for the proposed preview.

## Manual browser QA before production
Preview: `https://blakesmith-intel.github.io/StormTracker/preview/satellite-navigation/` (only after successful Pages deployment). Verify on iPhone Safari and desktop Chrome/Edge:
- Pan for 30–60 seconds over QLD and NSW border with Satellite selected. Map should still respond and show DEA regional during movement.
- Release camera, allow detail to settle and confirm QLD/NSW government imagery appears without permanent pixelation or large gaps. At close zoom, satellite returns to original detail.
- Try scroll-wheel bursts and rapid drag/zoom changes. Repeat with the full 4-radar selection and 3-D volumes.
- Repeat in Street mode; no change to source map, weather or labels.
- Compare against the sealed `/StormTracker/` production root.

**Not proven:** Automated JavaScript tests do not guarantee elimination of 15–30 second WebGL/GPU stalls on physical hardware. If freezes persist, capture mobile Safari or desktop performance trace and investigate Cesium terrain tile memory/budget, imagery cache consumption, WebGL context loss, CPU frame analysis and large weather overlays next.

## Safety and deployment
The Pages workflow still checks out `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd` for sealed production V9.18.0, verifies byte equality of published root HTML and only packages candidate files under `preview/satellite-navigation/`. **Do not promote into production without user visual confirmation.**
