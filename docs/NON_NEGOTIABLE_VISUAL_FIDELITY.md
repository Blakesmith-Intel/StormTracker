# StormTracker — Non-negotiable radar and 3-D visual fidelity

**Status: Mandatory development and production-acceptance constraint**  
**Operator direction: 16 October 2026**

## Absolute requirements

1. **Full-resolution authentic BoM radar imagery.** Use the original publicly available BoM reflectivity and Doppler products at their native available source-grid resolution, their original palette/dBZ and true source UTC. Do not downsample the source raster, replace it with modelled/artificial frames, blur it for speed, intentionally lower the requested WMTS/native raster resolution, discard original observation timestamps, or hide original pixels to achieve a synthetic FPS improvement. A geographic projection of the source on the Cesium globe is allowed, but the decoded working raster retains the original source-grid dimensions; interpolation is never an additional official observation.
2. **High-quality inferred 3-D representation.** Preserve the operator-approved rounded volumetric storm depiction, detailed intensity/height variation, original BoM dBZ colour scale, stable persistent geometry, native ≥40 dBZ minimum visual threshold, 1× exaggeration default, editable opacity, and 3-D coverage from every selected eligible supplementary radar. The height profile is empirical/inferred, **not a measured radar elevation scan**. Do not quietly flatten, coarsen, delete, crop or simplify the visible storm structures to raise processing rate. Enhancements in fidelity are welcome but must be visually accepted.
3. **No radar-site tradeoffs.** The primary radar and up to three additional selected radars must each show their original 2-D reflectivity and source-matched inferred 3-D wherever legitimate ≥40 dBZ echoes exist. An empty echo at a site is not grounds to fabricate a cloud. Existing secondary source sampling is a legacy display budget, *not* authority to reduce it further; any proposal to increase fidelity requires careful performance and memory measurement.
4. **No visual flickering or source-time lies.** Use persistent in-place primitives and only display genuine aligned BoM observations. Native Doppler and reflectivity remain independent source products and source clocks. Never blend entire volumetric collections, substitute out-of-time scans, invent radar reflectivity frames as observations or reintroduce the GPU deleted-texture failures.
5. **Performance is an engineering constraint, not permission to sacrifice quality.** Optimise redundant calculations, category profile lookup, tile and source caching, promise cancellation, GPU resource ownership, render scheduling, off-screen-only work and DOM updates. If these are insufficient, disclose the remaining hardware/viewport limits and discuss a visually validated optional solution *before* changing fidelity.

## QA gate

Any release modifying radar imagery, 3-D renderer, scene scaling, radar site selection, source sampling, colour/threshold handling or image provider resolution must:
- Pass `frontend/tests/run-full-fidelity-quality-contract-v1-tests.mjs` and the full regression suite.
- Preserve source raster working canvas `frame.width × frame.height`, original category indices, colour palette and geographic display scaling.
- Retain ≥40 dBZ floor and intensity-dependent vertical profile, baseline 3-D glyph sampling and three additional site capacity; **do not further reduce sampling or set a lower display-resolution ratio simply to improve the FPS counter**.
- Demonstrate primary and supplemental 3-D continuity through a multi-cycle Longreach/QLD test with the basemap and 3-D terrain enabled.
- Compare viewport-dependent transaction time and visual quality separately. The operational 1× target ~2.2 completed radar transactions/s is **not** Cesium's screen-draw FPS and must not become a pretext for source image degradation.
- Preserve existing sealed recovery points (`v9.20.1`, `restore/v9.20.1` and older), and obtain visual acceptance before promoting the experimental performance preview to production.

**Current accepted science:** 2-D original BoM source and empirical, confidence-qualified 3-D presentation. The existing 250 sampled columns/1500 glyphs per supplemental radar represent an inherited graphical budget; they are *not* equivalent to a full measured 3-D radar volume. This quality lock prevents further reductions and prioritises increasing visual fidelity rather than trading it away.

If a high-quality feature cannot maintain the desired speed on a specific browser or screen, retain the quality and report the realistic speed.
