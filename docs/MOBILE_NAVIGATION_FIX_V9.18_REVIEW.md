# V9.18 mobile map navigation — isolated review fix (13 October 2026)

## Symptom
Intermittent map pausing, hanging or unresponsive drag/pinch on iOS/mobile when moving around the operational Cesium map. The operator reports the same behaviour with Street and Satellite, so this candidate targets the common navigation/rendering path rather than changing image providers.

## Review scope (no science or production changes)
1. **RAF coalescing** — `frontend/src/touch-camera-gestures-v1.js` captures the newest touch positions and updates Cesium at most once per browser animation frame. Motion from all intermediate samples is retained, not truncated; the last pending displacement is flushed on touch-up and before adding/removing another finger.
2. **Interrupt recovery** — `lostpointercapture` and `pointercancel` clear stale touches (common after interrupted system/browser gestures). Pending RAF is cancelled on destroy.
3. **Label workload** — geographic QLD/NSW foreground labels still follow the camera on every rendered frame. Their expensive selection/collision pass is now limited to 360 ms on narrow screens versus the original 170 ms on desktop.
4. **Tile churn** — coarse-pointer interactions temporarily increase Cesium globe screen-space error from 4 to 12 while gestures occur, restoring full detail 380 ms after the last movement. Desktop behaviour remains 8 during interaction and restores after 160 ms.
5. **Cache invalidation** — updated module and iframe query strings ensure test builds load the new implementation rather than an older cached iPhone script.

These changes do **not** alter BoM radar pixels, Doppler timestamps, multi-radar selection, 3-D inference, tracks, severe-weather alerts, data refreshing, basemap choices, or the browser-only architecture.

## Automated regression
The full `npm test` suite runs on the fix branch and pull request. The touch regression exercises an 80-sample burst, pinch/rotation/tilt, final move on touch-up, 1-to-2-finger transition, missing pointer capture, cancellation, and teardown. Mobile label tracking and camera governor recovery have independent checks.

## Manual on-device QA before production
Open the **isolated review preview** at `/StormTracker/preview/mobile-navigation/` **after its Pages deployment finishes**. Leave the sealed `/StormTracker/` root alone.

- On iPhone Safari, one-finger pan quickly in multiple directions for 30 seconds in both Street and Satellite; no lockups, freezes or jumps.
- Pinch repeatedly while rotating/tilting, then lift each finger separately; camera should remain controllable after touch cancellation or switching apps.
- Repeat with four selected radar sites and populated 3-D weather; check radar frames/track labels remain correct and move with the map.
- Pause playback while panning; verify track labels, road closures and town names stay anchored; check storm frames are not silently advanced.
- Wait a moment after navigation; terrain/imagery should settle back to full normal detail.
- Compare with sealed production and visually approve before a production-release change.

## Release safety
`.github/workflows/pages.yml` still checks out **pinned V9.18.0** (`66d3da447ef7a4df53e7df49aa1ac06f86cb5afd`) for the live production root. The candidate is copied only to `preview/mobile-navigation/` alongside the production build. The main Pages root is verified byte-for-byte against the sealed baseline. No new server, relay, API key, or hosting service is introduced.

**Validation caveat:** Automated regression and branch validation are not a physical iOS/Safari hardware test. Production release is intentionally separate from this review candidate.
