# StormTracker Browser Playback and Stability Audit — 16 October 2026

## Scope and observation
Operator supplied a desktop screenshot of a Longreach rain-only 30-minute sequence at **0.19 observed completed frames/s against a 2.2 frames/s requested cadence**, with all 24 recent frames slower than target, three radar sites selected and inferred 3-D at 100%.

**Important:** This meter measures *time to complete a weather playback transaction*, including downloads, projection/decoding, Cesium imagery handover, data prep and rendering. It is **not** browser graphics redraw FPS or a direct GPU benchmark. It can be low because one source scan has to wait for independent supplemental imagery. The exact cause requires live instrumented browser diagnostics.

## Investigated components and outcome

| Scope | Code and evidence | Action | Status |
| --- | --- | --- | --- |
| Primary 3-D CPU | `live3d-operational-v9.js/renderInferredVolume` recalculated empirical profile and confidence classification for every active pixel despite 15 fixed measured BoM categories | One source-exact inferred profile per category/settings **per frame**, same dBZ, altitude/confidence and 40 dBZ filter; no changed input science | Implemented in QA |
| Supplemental original raster decoding | `multi-radar-display-v9.js/prepare` re-runs masking and primary PNG canvas reprojection after each loop even if selected BoM source UTC already observed | Bounded prepared SingleTile-provider cache, keyed by full site selection/mask context and genuine UTC; on failed provider clear it; on selection change clear it | Implemented in QA |
| Multi-site frame-cache churn | 8 cached optional frames cannot retain two supplementary sites × six frames | 12 frames on narrow screens, 18 wide; 6/12 prepared providers respectively, bounded; diagnostic counts in Memory panel | Implemented in QA |
| Optional-site timeout amplification | `multi-radar-display-v9.js/stageSite` gave three sequential phases their own 2.2s timeout, potentially delaying a weather frame over 6 seconds per struggling extra site; stale cached rejected/pending promises could also prevent a later recovered scan at the same UTC | Shared finite 3.2s maximum stage budget; clear losing timers and failed LRU entries, allow genuine same-UTC retry, expose stage outcome and cache hit counts | Implemented in QA |
| Hidden storm-track GPU work | `renderHybridTracks` recreated invisible Cesium polyline geometry even while Labels were off (the accepted default) | Omit invisible polyline primitives; generate on explicit Labels enable; preserve labels and cone controls | Implemented in QA |
| Town label redraws | `qld-town-label-layer-v1.js` reprojects and touches HTML labels at **every weather-rendered Cesium postRender**, including when map camera is stationary | Compare exact Cesium view matrices and viewport size; only skip redundant weather-only DOM projection. Pans, zoom, mode and changed visible label sets always repaint | Implemented in QA |
| GPU texture retirement | `imagery-layer-retirement-v1.js` correctly defers layer destruction for at least 2 render frames and 500ms | Retain; changing too early risks `bindTexture: attempt to use deleted object` | Explicitly retained |
| Terrain GPU/cache | Cesium `globe.tileCacheSize`, high-res 3-D terrain, camera SSE governor already bounded in V9.20 | Retain; do not downgrade satellite/terrain accuracy to hide source or renderer slowness | Audited |
| Source synchronization | `radar-imagery-handover-v1.js` waits for genuine new SingleTile to be staged; optional radars are date/UTC matched | Do **not** bypass atomic handover or label older/newer optional radar images as the same observation | Retained |
| Locality upstream ArcGIS | QLD gazetteer capped at 15 serial queries with retry/backoff, NSW lookup similarly bounded | Retain rate limiting and navigation deferral; monitor if close-range locality queries are frequent | Audited |
| Storm history 3-D preprocessing | `buildMeasuredTrackVolume` still builds temporary full per-track point/footprint arrays before keeping only high-support summary even in optimised 3-D mode | Potential future targeted allocation reduction, **not modified** because track trend/uncertainty reporting must stay scientifically unchanged | Future candidate |
| Extra radar sample min-hash | V9.20.1 samples up to 250 real ≥40 dBZ source pixels per extra site and updates only changed glyphs | **Preserve**. Coarsening/hardcoded stride caused an earlier visible regression | Protected by existing regression |

## Validation requirements before production promotion
1. `npm test` full suites and identical Pages dry-run pass.
2. In the preview, load Longreach 30-minute rain radar, turn on three site windows in total, keep 3-D volume at 100%, play at 1× through at least two complete loops, and confirm **all** selected sites with genuine ≥40 dBZ echoes show 3-D glyphs.
3. Compare **Playback** throughput vs V9.20.1 in the same browser, network conditions, selected UTC window, scene/camera and hardware. The 0.19/2.2 numbers alone do not establish a reproducible post-fix result.
4. On-demand Memory diagnostics capture: primary and per-site secondary glyph counts, active source frames, prepared provider cache occupancy, tile cache, existing GPU retirement counters and actual radar/3-D playback transaction times. Browser GPU process memory is shared and cannot be treated as a per-tab measurement.
5. Rapid pan/zoom and switching primary/additional radar sites must not hang, produce WebGL deleted-texture errors, falsify BoM source UTC, lose volumetric coverage or permanently grow caches.
6. Never modify the sealed V9.20.1 `v9.20.1` tag or `restore/v9.20.1` branch. Publish only a separately gated isolated QA preview until operator approval.

## Next potential high-value work if observed throughput stays slow
- Measure which component dominates from the enriched on-demand playback timing: optional-site network/staging, client-side PNG generation, primary inferred geometry, or Cesium GPU render pressure.
- Investigate measured source raster reuse that avoids even re-masking large national WMTS buffers on a return to an already seen UTC **without duplicating large full-frame arrays in memory**.
- If source latency dominates, make staged futures cancel quickly and prioritise visible primary observation without mislabelled older secondary timestamps.
- If sustained 3-D draw calls dominate, profile per-site glyph counts and billboard collections first; make any per-site display budget adaptive only after explicit visual comparison so the Longreach/Ravenshoe failure does not recur.

The changes in this audit intentionally avoid the high-risk operations above until there is quantitative evidence from the operator's browser.

## Mandatory operator quality lock (16 October 2026)
The operator has expressly prohibited trading radar or 3-D visual quality for FPS. Preserve **native source-grid BoM reflectivity and Doppler**, existing ≥40 dBZ empirical 3-D detail, source-matched 3-D coverage for primary plus up to three additional radars, colours, apparent storm structure and no-flicker updates. Any faster alternative that downgrades the published native 2-D source raster or coarsens current 3-D rendering is **not an acceptable optimisation**. Optimise CPU, uploads, GPU lifecycle and source I/O only. Details and release checks: `docs/NON_NEGOTIABLE_VISUAL_FIDELITY.md` and `frontend/tests/run-full-fidelity-quality-contract-v1-tests.mjs`.

The on-demand Memory diagnostics modal must be readable within the viewport (including narrow browser windows) and support full untruncated JSON copying; do not render the JSON into the narrow sidebar or start background polling.
