# StormTracker — V10.0.0 accepted production source

StormTracker is a **browser-only Queensland and southern NSW border BoM radar situational-awareness viewer**. It is **not** an official warning service or an emergency decision-making tool. Original source radar reflectivity is in **dBZ**, native Doppler is radial velocity, and vertical 3-D structures and storm cones are explicitly **empirical/inferred**, not measured 3-D weather radar.

## Current stable app

**https://blakesmith-intel.github.io/StormTracker/**

- **V10.0.0:** Single simplified interface, original native Doppler on supported additional radar sites with source-time matching, plus operator-accepted continuous QLD/NSW satellite basemap, high-quality persistent 3-D on primary and additional radar sites, original full-resolution BoM data, bounded caches/CPU performance optimisations, viewport-fit diagnostics. Pin/tag/restore SHA is in `docs/CURRENT_ACCEPTED_BASELINE.md` after CI cutover.
- Historical sealed `v9.20.1`: `efaceb59427f0b71859b15a61a6758a80d08547e`, `restore/v9.20.1`.
- Historical `v9.20.0`: `aba409fd1609e7bf7be6bf3c098b7fb6a14d89d1`; `v9.19.0`: `d317c17a6a8f706a0d867cb852db1e8d3f9ffac0`; `v9.18.0`: `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd`.
- Accepted historical V9.18 diagnostic: https://blakesmith-intel.github.io/StormTracker/preview/radar-history-fix/
- Current incremental QA preview: https://blakesmith-intel.github.io/StormTracker/preview/incremental-3d/live3d-operational-v9.html

## Core capabilities

- Original BoM reflectivity at native source grid, independent genuine radial Doppler (including selected additional verified sites); 1×/2×/3× timeline replay with source UTC and AEST.
- Primary radar plus up to 3 additional BoM sites; stable ≥40 dBZ inferred rounded volumetric depiction with per-site source pixel coverage and no whole-cloud flicker.
- Valid observed-pixel connected storm footprints, primary-only ST IDs, optional +90min illustrative cones, labels off by default.
- QLD original high-resolution satellite, DEA 2025 GeoMAD regional NSW and NSW official detail at close zoom, with genuine global satellite imagery filling upstream tile gaps rather than exposing blue globe.
- 3-D terrain, road closures, unplanned power outages, BoM flood signals and selected QFD incidents.
- Safe browser navigation/GPU texture retirement, bounded scan/provider caches, full-width scrollable **Memory diagnostics** with JSON copy.

## Development and documentation

- `frontend/` static Cesium browser runtime, source-science helpers and regression tests.
- `relay/` existing CORS transport-only Cloudflare Worker.
- `scripts/build-current-site.sh` production from pinned immutable source SHA, isolated QA previews.
- `docs/RELEASE_NOTES_V9.20.2.md`, `docs/USER_GUIDE_V9.20.2.md`, `docs/HANDOVER_V9.20.2.md` up-to-date release instructions.
- `docs/NON_NEGOTIABLE_VISUAL_FIDELITY.md`, `docs/SCIENTIFIC_CONTRACT.md`, `docs/CURRENT_ACCEPTED_BASELINE.md`, `docs/BASELINE_RESTORE.md` release invariants.
- `docs/V10_OFFICIAL_WARNING_DATA_PLAN.md`, `docs/ACTIVE_WISHLIST.md` current next work.

**Next milestones (in order):** 1. Official live BoM cyclone track spatial data, 2. official Queensland severe-thunderstorm warning polygons and NSW warnings within the installed radars' coverage, 3. V10 AURA genuine HDF5 radial-wind candidate science. **Not yet part of V9.20.2.** Only real, time-valid official geometry may be presented as a warning.

## Release process

Full `npm test` (including native multiple-Doppler clock/source regression), `node --check relay/worker.js`, Pages dry-run of the exact immutable source, public `BUILD.txt` and static asset checks, then annotated tag + restore branch **only after successful deployment**. The main branch remains a development stream and is NOT automatically the production app. Older tags and recovery branches are immutable.


**V10.0.0 immutable release source:** `e3f7f6d007f52e4ca48e103288bc5ffa77fac9b5`. Public `BUILD.txt` must show `SEALED StormTracker V10.0.0 source e3f7f6d007f52e4ca48e103288bc5ffa77fac9b5`; annotated tag `v10.0.0` and `restore/v10.0.0` are created only after public verification. Prior V9.20.2 refs remain unchanged. Next: authoritative BoM cyclone forecast tracks and official uncertainty polygons in isolated QA, with no inferred probabilities or fabricated warning geometry.
