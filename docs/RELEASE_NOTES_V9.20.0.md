# StormTracker V9.20.0 — Production Release Notes
**Release date:** 16 October 2026  
**Approval:** Operator visually accepted the incremental 3-D QA build on 16 October, reporting no flicker and approximately 50% lower browser memory use versus the previous test. This is operator-reported browser performance, not a laboratory measurement.

## What's new
- The primary and up to three additional radar sites use persistent, source-aligned inferred 3-D geometry across genuine observations and display-only gap frames.
- Changes in dBZ update retained Cesium glyphs in place. No overlapping whole-cloud fade, no switching between track-specific and frame-wide volumes.
- Selected secondary radar glyphs retain a stable geographic sampling lattice. Removing a radar from the selection frees its associated 3-D GPU collections.
- Memory controls: bounded decoded image-provider cache (3 narrow/6 wide), globe idle tile cache (48 narrow/72 wide), secondary frame cache (8), retention of active BoM source history plus a limited older cache, and compacted historical track 3-D summary records.
- On-demand Memory diagnostics in the sidebar; original BoM reflectivity, native Doppler, geographic labels, 40 dBZ display minimum and 1× vertical exaggeration are preserved.
- Stable reload via versioned script/iframe URLs.

## Safety and source integrity
All source BoM 2-D reflectivity/dBZ, official product UTC, independent native Doppler, track computation, storm cones, incident layers and official satellite sources remain unchanged. Inferred 3-D heights are presentation only, not measured radar elevations. Labels remain off by default and cover primary tracked cells only.

## Promotion and recovery
The release pipeline must use a pinned immutable V9.20.0 production source commit, verify public build markers and smoke-test static resources, *then* create an annotated `v9.20.0` tag and a `restore/v9.20.0` recovery branch at the same source. Existing `v9.19.0` and `restore/v9.19.0` remain unchanged.

**Acceptance:** The operator confirms the flicker is gone and memory use approximately halved on the preview. All automated regressions and final public deployment verification must pass before sealing.
