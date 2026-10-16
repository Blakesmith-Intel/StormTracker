# Experimental incremental 3-D volume preview — 16 October 2026

## Scope / how to test
- Public root stays pinned to sealed V9.19.0 source d317c17a6a8f706a0d867cb852db1e8d3f9ffac0.
- The new **review-only** build lives at `/preview/incremental-3d/live3d-operational-v9.html` once a Pages deployment has been verified.
- Primary radar and selected secondary radars use stable source-pixel indices as display geometry keys. All original BoM 2-D images, source timestamps, Doppler, storm-track analysis, and threat-cone logic remain unchanged.
- An unchanged radar category retains its original Cesium point/billboard across observations; changed pixels replace only their own glyphs; pixels dropping below the rendered threshold are retired.
- Short, bounded, display-only alpha morphs apply to changed glyphs during playback. The fallback is an instantaneous delta update if the animation would touch more than 3,500 glyphs, preventing long GPU stalls. Camera/terrain still render normally.
- Primary sampling stride is locked for the loaded loop based on the maximum candidate count across the loop, to avoid resizing the entire storm merely because a single frame crosses a dynamic stride threshold. Latest-only uses a fixed stride of 3. Secondary sites use anchored spatial sampling; their budget remains 250 sampled columns and 1,500 glyphs/site.
- Inference remains empirical and *not* a measured 3-D radar scan. No generated intermediate structures feed weather detection or observations.

## Acceptance checks before promotion
1. Run `npm test` and `bash scripts/build-current-site.sh` under the release-pin checkouts in CI.
2. Confirm the public root `BUILD.txt` is still the exact V9.19.0 SHA and both QA BUILD files match their intended sources.
3. Visually compare primary Brisbane Mt Stapylton, Gympie, and Mt Isa storms in a 60-minute loop on phone and desktop. Watch unchanged areas, cloud edges, frame changes, radar site switches, rapid pinch/zoom, 3-D opacity 0→100, vertical scale changes, and optional site visibility.
4. Measure changed glyph count via tooltip on *Rendered points*; inspect console for any WebGL deleted-texture or Cesium primitive errors. Check memory and frame rate with multiple selected radar sites.
5. Verify 2-D image and 3-D volume advance at the same genuine source scan, plus that interpolation remains display-only.
6. Do not merge experimental geometry into the sealed production release until the browser visual checks and source/geometry benchmarks pass.

## Known boundaries
- Delta reuse operates on quantised BoM categories (15-band reflectivity) at sampled source pixels; subtle within-band changes are not observable from these imagery inputs.
- Current CPU still computes per-frame summary metrics; the optimisation targets expensive Cesium/GPU primitive churn and avoids rebuilding unchanged columns.
- The short morph is a **presentation animation**, not a claim about the physical storm's continuous evolution between BoM observations. Sudden bulk changes exceed the animation budget and update immediately.
- Geometry resets on changing the primary radar, geometry footprint, sampling stride or display/inference settings; this is intentional.

## Memory safeguards added in the follow-up QA
- Primary and supplementary storm geometry uses one persistent collection each instead of storing a separate 3-D cloud for every scan. The existing release's 14-frame geometry cache is inactive on this preview route.
- Cesium's idle Globe terrain/imagery tile cache is capped at 72 tiles (wide layouts) / 48 tiles (narrow layouts), while still retaining all currently visible tiles. Do not reduce this further without checking satellite continuity.
- Keep only six decoded primary radar PNG providers in the browser's render cache (three on a narrow layout), while retaining **all observed frames currently needed for playback** and source-time alignment. Secondary raw frame promise cache is capped at eight.
- Outside the active observed time window, keep only 12 most recent cached radar source/result references rather than 48. This does not alter the persistent browser history, source data, or scientific model.
- The preview sidebar now provides **Memory QA (experimental)** → **Capture memory snapshot**. It reports live volume glyphs, decoded frame counts, Cesium imagery layers, capped cache size, browser JS heap where supported, and deferred image retirement. Chromium's GPU process is shared and cannot be attributed to this one tab from ordinary web APIs.
- Test on both mobile and desktop: first load, five loop repetitions, switch primary radar three times, select three supplementary radars, rapidly pan/zoom, then compare Task Manager figures. Inspect browser WebGL errors separately; optimisation is not accepted if any observed science / 2-D frame source-UTC alignment changes.
