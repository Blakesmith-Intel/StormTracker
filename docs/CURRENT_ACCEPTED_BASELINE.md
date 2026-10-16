# StormTracker — Current Accepted Production Baseline: V9.20.2 (16 October 2026)

**Operator approval:** The continuous-satellite underlay correction shown in the operator's Queensland–NSW screen recording has been tested by the operator, who expressly confirmed: **“that's fixed it. Seal this as the production baseline, update all user and development documentation.”**

## Pinned build and recovery

| Release | Pinned source commit | Tags/recovery |
| --- | --- | --- |
| **V9.20.2 accepted production** | `b8be458acbae942a3bb0b530a5c17618b6d03134` | Annotated `v9.20.2` and `restore/v9.20.2`, created only after public Pages verification |
| Historical V9.20.1 | `efaceb59427f0b71859b15a61a6758a80d08547e` | `v9.20.1`, `restore/v9.20.1`; earlier secondary-volume restoration |
| Historical V9.20.0 | `aba409fd1609e7bf7be6bf3c098b7fb6a14d89d1` | `v9.20.0`, `restore/v9.20.0`; old secondary-3D regression |
| Historical V9.19.0 | `d317c17a6a8f706a0d867cb852db1e8d3f9ffac0` | `v9.19.0`, `restore/v9.19.0` |
| Historical V9.18.0 | `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd` | `v9.18.0`, `restore/v9.18.0` |
| Historical accepted V9.18 diagnostic | `acfa0ebd3717a793369e3e887e2d1a54785620b7` | `/preview/radar-history-fix/` |

**Public production:** https://blakesmith-intel.github.io/StormTracker/

**Marker:** `SEALED StormTracker V9.20.2 source b8be458acbae942a3bb0b530a5c17618b6d03134`

## Acceptance detail

- QLD high-resolution official imagery unchanged, DEA regional NSW imagery above an opaque global Esri World Imagery fallback, NSW official aerial imagery still available on close zoom. No more empty blue Cesium globe when a DEA WMTS tile is missing or outside the state imagery rectangles. One persistent background imagery provider across panning/zooming.
- Native original BoM full-grid dBZ source imagery and native Doppler, source UTC, genuine scan history, up to three additional selected radar sites, ≥40 dBZ source-based empirical 3-D volumes, original palette and 1× height exaggeration unchanged.
- Persistent delta Cesium glyphs, fixed secondary source sampling/cleanup, category-profile CPU cache, bounded supplemental stage/source caches and resilient optional radar timeouts.
- Full-width scrollable on-demand Memory diagnostics dialog with untruncated Copy JSON; Labels off by default, primary-only storm IDs and motion cones.
- Existing QLD power/road, official flood signal and QFD rescue context unchanged.
- Full quality lock described by `docs/NON_NEGOTIABLE_VISUAL_FIDELITY.md`; no reduction of original measured pixels or accepted inferred storm structure for FPS.

## Feature freeze

Official live cyclone forecast tracks, BoM severe-thunderstorm warning polygons for QLD and radar-covered NSW, and V10 AURA candidate analysis are **future milestones**; none is an untested addition to this accepted release. See `docs/V10_OFFICIAL_WARNING_DATA_PLAN.md` and `docs/ACTIVE_WISHLIST.md`.

## Source pin and validation

Release pipeline checks out `checked/production-v9.20.2` at exactly `b8be458acbae942a3bb0b530a5c17618b6d03134`, runs full source test plus static artifact audit, verifies the public root marker and original high-res imagery and multi-radar 3-D scripts, and only then creates the immutable annotated tag and restore branch. Do not repoint tags or restore branches.
