# StormTracker Edge — historical cyclone terrain warning and viewport overflow fix

**Scope:** Isolated browser QA preview. Sealed V9.20.2 production stays pinned to its accepted source SHA.

## Operator evidence

1. Microsoft Edge console repeatedly reported `Entity geometry outlines are unsupported on terrain. Outlines will be disabled` during the Koji/Yasi QA preview.
2. An optional BoM station history request via Cloudflare returned `502 Bad Gateway`; the flood layer logged that it retained current BoM flood bulletins.
3. Screenshot demonstrated controls sidebar protruding beyond a resized browser's visible area.

A logged Cesium warning and HTTP 502 do **not independently prove** what caused an Edge renderer process crash, but the new historical geometry created needless Cesium entity/GPU updates. This patch fixes the actionable regressions and keeps runtime monitoring available.

## Targeted fixes

- Historical cyclone polygons are still rendered with all original BoM/Queensland source vertices, holes, classification and source issue times. `polygon.outline:true` is removed because Cesium cannot outline ground-classified polygons.
- A separate source-vertex `polyline` with `clampToGround:true` draws every outer boundary and inner hole at full resolution. No artificial simplification or shape-based warning inference.
- Instead of clearing/readding every Koji/Yasi track, fix, polygon and border on every timeline scrub, keyed Cesium entities are preserved and only changed elements added/retired. Full source boundary Cartesian conversions are cached per archived polygon during one loaded case and freed when changing cases.
- `#app` stays within `100dvh`. `#controlSidebar` now has a bounded height with vertical scrolling in Edge/Chromium including short-height desktop, narrow screens and landscape mobile. Dynamically appended Historical cyclones and Memory diagnostics panels are full-width grid rows. The map still receives remaining viewport height.
- App entrypoint, runtime and CSS asset queries updated to prevent Edge reusing old offending files.
- Existing flood history relay 502 guard already serialises optional history lookups, enforces a 15-minute cooldown on 502 and retains current bulletin source. **The 502 is external/upstream** and not treated as a fatal browser exception; no misleading 'history available' data is created.

## QA verification

- Automated full frontend tests, package/dry-run and public preview deploy must pass.
- `run-historical-koji-yasi-replay-v1-tests.mjs`: no unsupported terrain polygon outline, real ground polyline boundaries; unchanged timeline moment cannot allocate new entities, timestamp scrubbing still removes expired archived issues; Koji original wind polygon full 1405-vertex ring preserved.
- `run-edge-cyclone-sidebar-stability-v1-tests.mjs`: all desktop/mobile responsive breakpoint constraints and fresh HTML/CSS/JS asset versions enforced.
- Operator Edge visual check: resize browser to compact height and narrow width; scroll sidebar to its last status item; enable historical Koji, scrub several issue times; watch memory and the console for Cesium warnings/WebGL deleted-texture problems; repeat with Yasi. A river 502 may remain if BoM upstream is failing, but it must not repeat rapidly or stop the primary map.

## Protected scientific and visual baseline

Original full-resolution reflectivity/Doppler, high-quality ≥40 dBZ inferred 3-D (including secondary radars), 3-D terrain, verified satellite coverage and authentic historical archive geometry remain unchanged. Do not promote to sealed production before browser confirmation. If Edge continues to crash, capture its `edge://crashes` entry or GPU/process error and a performance snapshot; do not assume either logged warning caused a renderer crash.
