# StormTracker V10 — Simple Interface, Measure Tool, Live Map Scale (17 October 2026)

## Status and branch
- **Operator priority change:** Pause cyclone ingestion/replay work; do not delete current source-backed cyclone fixtures or QA. Focus on usability and navigation.
- **Working branch:** `feature/v10-simple-ui-measure-scale-20261017`.
- **Preview:** `/preview/incremental-3d/live3d-operational-v9.html` after reviewed CI/main merge and Pages deployment.
- **Production freeze:** `v9.20.2` at `b8be458acbae942a3bb0b530a5c17618b6d03134` remains pinned in the published site root. NO production UX redesign before operator visual acceptance.

## Simple by default
- Updated visual hierarchy and touch targets. The radar selector remains on the map; radar window, Load, Refresh, Play and Latest remain easy to reach.
- Shows simple Street/Satellite, 3-D terrain, road closures, outages and flood signal controls. All existing underlying controls retain their DOM IDs and handlers.
- **More options** displays the full existing UI including science, legends, storm labels, radar/3-D opacity and source diagnostics. **Simple view** returns to the uncluttered layout. No changes to checked/unchecked layer state when switching modes.
- On narrow screens, compact controls occupy the top portion; the map stays dominant below. Sidebar hide/show still works.
- The archived cyclone panel remains in Advanced QA only and continues to be explicitly NOT LIVE; no new cyclone development has been conducted by this branch.

## Manual measure
1. Press **Measure** on the map.
2. Tap the start location, then additional locations to form a multi-segment line; metres/kilometres appear in the measurement panel.
3. Use **Undo point**, **Clear**, or **Done · pan map**. **Done** keeps the line and returns normal map interaction. **×** closes and clears the measurement.
4. The tool captures touches/clicks with a temporary, invisible map shield while active; map panning is deliberately paused during measurement, avoiding collisions with other click-to-inspect handlers. It resumes when done. For longer routes, zoom out before pressing Measure.
5. Measurement is **horizontal WGS84 geodesic distance** between selected points. It is not road route distance, ground slope or formal surveying. Points and lines clamp to terrain for display only.

## Live map scale
- Permanently available at bottom left of the map, above attribution and other UI.
- Uses the Cesium camera and local WGS84 geographic positions to calculate local metres per pixel, then picks a readable 1/2/5 * 10^n scale and renders the corresponding length.
- Recomputes on camera movement/resize, not radar-frame playback. If terrain cannot be picked (e.g. globe out of view), hides instead of displaying a stale/wrong scale. Approximate local horizontal ground scale, not a global invariant at a tilted view.

## Required acceptance testing
- [ ] Desktop Edge and Chrome at 1920x1080 and 1366x768: never clipped and sidebar always scrolls.
- [ ] iPhone portrait/landscape: radar selection, Play, More options/return and map are usable with finger-sized hit targets; no horizontal clipping.
- [ ] Rapid zoom, pitch and pan with satellite and street: scale updates and does not overlap essential controls.
- [ ] Measure one, two and multiple points; Undo, Clear, Done, close/reopen; camera move restored; no false road-routing claim.
- [ ] While measure is active, tapping radar site icons or closure markers cannot trigger their click handlers.
- [ ] Regression: default Mt Stapylton, multi-radar, native BoM reflectivity/Doppler, ≥40 dBZ inferred 3-D, legends, storm labels off, tracks, cones, road closure, outages, gauges and existing archived cyclone QA.
- [ ] GPU/CPU and cleanup after repeated measure cycles: measurement entities isolated, no duplicate handlers, no continuous scale polling per weather frame.
- [ ] Full `npm test` including `run-friendly-map-tools-v1-tests.mjs`, Pages build verification and operator visual sign-off.

### Remaining UX considerations
The first cut is intentionally conservative: it changes hierarchy and control exposure without altering underlying weather behaviour. Fine-tune sidebar emphasis and mobile toolbar spacing against actual screenshots before any new production release. Map marker/source attributions and genuine science distinctions must remain accessible.
