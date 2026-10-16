# StormTracker V9.20.0 — Technical Handover
**Source branch:** `release/v9.20.0-optimised-3d-source-20261016` (freeze the validated SHA for release)

The production entrypoint is `frontend/index.html` (iframe of `live3d-operational-v9.html`). In `frontend/src/live3d-operational-v9.js`, the established `INCREMENTAL_VOLUME_PREVIEW` runtime flag now recognises the approved production `/live3d-operational-v9.html` route as well as the isolated `/preview/incremental-3d/` QA route; other QA routes remain excluded.

Rendering:
- `incremental-volume-renderer-v1.js` maintains persistent keyed Cesium glyphs and exposes `upsert`, mutating changed glyphs in place.
- `supplemental-radar-volume-v1.js` uses the same pathway per selected site, with spatially stable sampling; `pruneSites` discards deselected site collections.
- `volume-display-opacity-v1.js` persists source alpha when glyphs update, avoiding cumulative transparency errors.
- The full frame-wide empirical 3-D inference remains visible at genuine and display-only playback steps; duplicate track-specific 3-D geometry is not rendered. Track ID/scoring/cone computations remain unchanged.
- Historical track volume records keep high-support top and trend summary fields, not redundant point/footprint arrays, in optimised mode.

Memory:
- Decoded primary provider LRU, 3 or 6 entries.
- Cesium off-screen tile cache target, 48 or 72 (visible tiles are never intentionally dropped).
- Secondary frame promise cache 8; older source/result references limited while active playback observations are retained.
- Sidebar "Memory diagnostics" supplies on-demand metrics; a browser GPU process may be shared between tabs.

Regression expectations: `npm test`, `node --check relay/worker.js`, release package audit, public marker, data catalogue, opacity/cones/labels, fast pan/zoom and 3 additional radar windows. Do not use inferred values as source-measured inputs. Baseline rollback: `v9.19.0` at `d317c17a6a8f706a0d867cb852db1e8d3f9ffac0`.

Development for V10 authentic AURA wind candidate classification continues separately; this V9 release contains no unverified detection products.
