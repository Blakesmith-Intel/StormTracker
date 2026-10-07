# V9.12.3 — Queensland place-name reliability and clutter control

## Issue
V9.12.1's rasterised Queensland Places MapServer text appeared and disappeared as Cesium switched imagery tiles or refined 3-D terrain. The V9.12.2 vector experiment replaced every map tile with all 758 settlement names, producing unacceptable mobile clutter; it was rolled back.

## Production-safe fix

- Load Queensland's official population-centre coordinates once; 758 source features reduce to 757 unique near-identical town/position pairs.
- Keep one geographic Cesium `LabelCollection` alive throughout map interaction and Street/QLD imagery changes.
- **Never display all towns at once.** The screen-space layout enforces a mobile cap of nine names, a much smaller cap at statewide scales, and no geographic labels at planetary altitude.
- Reject places behind the globe using Cesium's ellipsoidal occluder; reject off-screen and overlapping text using each label's projected screen position and approximate rendered bounds.
- Give geographic importance to population and remote settlement isolation. A small amount of priority persistence prevents near-tied labels flickering on slow camera movements.
- Street basemap already contains major-city names: don't duplicate places above 15,000 population as a second text overlay there.
- Keep label positions fixed to WGS84 geographic coordinates rather than reloading tile-bound label images.
- Recompute during camera motion with a throttled post-render watcher. No extra browser server and no unnecessary network polling.
- Leave the existing radar, Doppler, terrain, unplanned electrical outages, flood road closures and BoM gauge modules unchanged.

## Validation gate

- Mandatory Node regressions assert mobile label budget, screen collision avoidance over 758 overlapping synthetic towns, Queensland remoteness priority, camera/horizon occlusion, and single-fetch lifecycle.
- Dedicated *real Cesium* Chromium view at 390 CSS pixels, using the Queensland Government's live data, exercises Birdsville, Brisbane, statewide and low-angle horizon views.
- An additional Chromium smoke runs the full StormTracker mobile interface, checks drag interactions and Street/imagery switching, and enforces no overlapping QLD text in both modes.
- Screenshot evidence is uploaded as a short-lived artifact on the Visual QA GitHub Action; the full-app imagery tiles may continue animating and cannot always be captured as a stable screenshot, but numeric label checks remain mandatory.
- **Do not merge without both the complete StormTracker frontend regression suite and real-browser visual smoke succeeding.**

## Operational limitations

- This is screen-space collision control for our added QLD names; it does not participate in the original OpenStreetMap tile label placement system.
- The text remains geographically anchored and follows the map during deliberate pan, rotate and zoom actions, but individual names can be hidden when off-screen, behind the globe, or competing for the limited display space.
- All QA is Chromium-based; user acceptance on the actual iPhone is still required to verify iOS/Safari gesture behaviour.

## Rollback
V9.12.1 verified production baseline: `ee7f93fdaad4e739d40238c3eb79477f5f7ddd99`; restore branch `restore/v9.12.1`.
