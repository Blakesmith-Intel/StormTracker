# StormTracker V9.20.2 — Development and Operations Handover

**Deployment model:** Static GitHub Pages, only source from a frozen V9.20.2 SHA; browser-only Cesium 1.145, existing transport-only Cloudflare relay for original BoM feeds. The `main` branch can advance experimentally without changing the sealed root. The source SHA is recorded in `docs/CURRENT_ACCEPTED_BASELINE.md` and `/BUILD.txt` following reviewed cutover.

## Active source contracts

- `frontend/src/live3d-operational-v9.js`: primary BoM radar loop, valid source UTC, native Doppler, empirical 3-D and experimental QA path. `INCREMENTAL_VOLUME_PREVIEW` still denotes the visually approved persistent renderer on root as well as `/preview/incremental-3d/`.
- `frontend/src/incremental-volume-renderer-v1.js`: keyed in-place Cesium glyph reuse, no whole-volume fade; `supplemental-radar-volume-v1.js` and `supplemental-volume-sampling-v1.js` handle source-matched supplementary ≥40 dBZ samples, up to three selected additional sites.
- `frontend/src/volume-category-profile-cache-v1.js`: per-display-frame dBZ-category memoisation, same physical model/profile/confidence calculation, no new measured values.
- `frontend/src/multi-radar-display-v9.js`: BoM source timestamp keyed data and provider caches, cancellation and one bounded optional-source stage budget; do not let a stale optional source block primary radar or appear as a new genuine scan.
- `frontend/src/context-layers/basemap-manager-v1.js`: **persistent Global World Imagery satellite UNDERLAY → DEA GeoMAD 2025 → NSW detailed on high zoom → QLD detailed always at state regional range**. Official original imagery remains above fallback; global underlay remains visible during camera moves and upstream DEA tile failures. Street selection remains OSM, and historical Street-only QA must remain isolated.
- `frontend/src/context-layers/qld-town-label-layer-v1.js`: camera matrix/viewport guard preventing unnecessary DOM projections when only radar changes.
- `frontend/src/responsive-memory-diagnostics-v1.js`: accessible viewport-sized scrollable modal, on-demand JS cache/glyph and playback metrics; complete JSON copy, no continuous polling. Chromium GPU process total is not tab-specific.
- `frontend/src/operational-dashboard-v9-1.css`: sidebar/map responsive controls; full-width diagnostic modal must never be clipped by the sidebar.
- `frontend/src/context-layers/`: authentic QLD traffic and power outages, flood gauge display, QFD rescue assistance layers, map credits, state border and geographic labels.

## QA and release discipline

Run `npm test`, `node --check relay/worker.js`, feature/review CI, deterministic Pages build from an EXACT source SHA, and public GET of `/BUILD.txt`. Existing `.github/workflows/pages.yml` seals annotated release tags and restore refs only after public verification. Retain historical `/preview/radar-history-fix/` V9.18 accepted build and the isolated `/preview/incremental-3d/` ongoing QA build. Both older V9.20.1 and V9.19 must remain recoverable.

Mandatory checks: `frontend/tests/run-full-fidelity-quality-contract-v1-tests.mjs`, `run-basemap-manager-v1-tests.mjs`, `run-v9-next-satellite-panning-gpu-guard-tests.mjs`, `run-secondary-radar-3d-coverage-v9-20-tests.mjs`, `run-responsive-memory-diagnostics-v1-tests.mjs` and other frontend tests. Operator visual acceptance is compulsory for quality-affecting changes.

## Next product milestones

1. **Official tropical-cyclone forecast track geometry** as a separately switchable informational layer using BoM official public geospatial source, with observed vs forecast track, forecast time, uncertainty and warnings/watch metadata if actually provided. No made-up interpolated track, official issued/valid times only.
2. **Official BoM severe-thunderstorm warning regions** — detailed/local and regional products for Queensland and **only NSW areas intersecting radar-site coverage**; use official warning geometry, real start/expiry, source link and region clipping. Distinguish warning polygons from algorithmic storm tracks.
3. **V10 authentic AURA Doppler/wind candidate R&D** — no public new warning classifier before access to consecutive genuine BoM AURA HDF5 radial velocity sweeps and historical Gympie/Cooloola and Christmas 2023 Gold Coast verification. See `docs/V10_OFFICIAL_WARNING_DATA_PLAN.md`.

None of the next three milestones may silently alter the sealed V9.20.2 root until separately tested, visually accepted and reviewed.
