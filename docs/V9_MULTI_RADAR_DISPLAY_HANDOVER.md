# V9.16.15 preview — multiple Queensland radar display windows

**Status:** isolated V9 enhancement branch, based on sealed production commit `0c7424abdc659e5874595473c0e91953ffa0a48b`. Does NOT merge, retag or deploy over V9.16.14 without review.

## User experience

The **primary radar** selector remains in the top-right of StormTracker. A new **Radars 1** button opens a site checklist of all Queensland BoM radar locations. Select up to **three additional sites** (four total including primary). Use **Fit selected** to centre the map across selected sites, or **Primary only** to clear additions. Primary site appears checked and locked in the checklist. Extra radar sites can be added/removed while playback is paused or running; no primary-history reload is needed.

- Original BoM *measured 2-D reflectivity* is displayed as additional geographic windows. These are windows of the BoM public WMTS national reflectivity field — **not separate raw-site scans or a scientifically fused multi-radar product**.
- All supplemental imagery is requested with the exact **UTC timestamp of the primary displayed measured rain frame**. No fabricated wind speeds or interpolated source timestamps.
- Shared/overlapping native WMTS tiles are hidden from later windows, avoiding duplicated opacity and apparent rain intensity inflation.
- No add-on layer may linger when its requested source time becomes outdated; source/radar switches, Doppler-only mode, and missing measured frames clear overlays immediately. Slow or missing supplemental imagery does not block the primary playback clock.
- Existing 2-D primary radar raster, inferred 3-D volume, ST labels/tracks, threat cones, BoM native Doppler-only loop, performance optimisations, basemap, flood/road/power layers remain unchanged.
- Existing global `radarOpacity` slider applies equally to supplemental measured reflectivity. Extra radar imagery never affects 3-D opacity or native Doppler's 100% opacity.
- The original urban/rural map foreground labels remain DOM overlays on top of all additional Cesium raster layers.
- Default **one primary radar**. Multi-radar selections are transient to the page, not persistent across reloads; this is deliberate for safe opt-in preview.

## Technical structure

- `frontend/src/multi-radar-display-v9.js`: source window masking, selection cap, map extent, browser-only controller, bounded cache (18 measured frames), stale result generation tokens.
- `frontend/src/live3d-operational-v9.js`: primary frame-commit hook and primary-switch/Doppler-only cleanup; no changes to ST science or primary BoM source-selection functions.
- `frontend/live3d-operational-v9.html`: accessible multi-select checklist and map framing controls.
- `frontend/src/operational-dashboard-v9-1.css`: responsive popover and control layout.
- `frontend/tests/run-v9-multi-radar-display-tests.mjs`: selection, overlapping tile transparency, native timestamp matching, cancellation, cache, opacity, and critical source-mode constraints.

### Operational limitations / QA gates

1. **Up to four total sites** limits additional network, browser memory and 2-D conversion work. Rendering *all* Queensland radar windows simultaneously has not been validated as safe for mobile browsers.
2. Since the national WMTS reflectivity feed represents a unified weather mosaic, two physical radar stations in the same part of SEQ may have substantially overlapping windows. Selecting both should display only additional geographic coverage, not double-painted echoes.
3. When rain playback is faster than supplemental BoM tile requests, secondary areas might temporarily disappear rather than show a **wrong-timestamp storm**. Primary source playback must remain smooth. Browser tests should measure extra-window lag and acceptable frame coverage on iOS Safari and desktop.
4. This is multi-radar *rain display* **only**. Doppler source and tracks/3-D analysis still follow the primary selected radar. A true independent multi-Doppler player or multi-window scientific track fusion would be a separate product change, not included in this preview.
5. Read-only browser smoke test: primary 66 + 50 + 08 (overlap in SEQ); distant 66 + 24 (fit); switch to Doppler-only (all extra rain gone); return to rain and adjust opacity; rapidly change primary and secondary sites; confirm labels/geography overlay above 2-D/3-D; test latest and 60/120/180-minute rain loops.
6. Release only after manual visual acceptance, responsive playback/frame timing checks and a green CI run. Restore point is the sealed V9.16.14 commit above.

**No further Cloudflare Worker instances, server-hosted instances, paid APIs, synthetic weather frames, or on-device background tasks are introduced.**
