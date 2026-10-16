# StormTracker V9.20.0 — approved sealed production baseline (16 October 2026)

**User acceptance:** On 16 October 2026 the operator tested the corrected incremental 3-D browser preview, confirmed the flickering had disappeared and reported that browser memory use had **approximately halved**. They explicitly requested production deployment and sealing. These are operator observations, not independent browser benchmarks.

| Reference | Frozen commit | Purpose |
| --- | --- | --- |
| **V9.20.0 production source** | `aba409fd1609e7bf7be6bf3c098b7fb6a14d89d1` | Site root copied from exact immutable source; no moving-main build |
| **Release tag** | `v9.20.0` | Annotated, must dereference to the above source after public verification |
| **Recovery branch** | `restore/v9.20.0` | Created at the above source only after public deployment verification |
| Immediate historical rollback V9.19.0 | `d317c17a6a8f706a0d867cb852db1e8d3f9ffac0` | Existing `v9.19.0` and `restore/v9.19.0` must not move |
| Earlier recovery V9.18.0 | `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd` | Existing `v9.18.0` and `restore/v9.18.0` must not move |
| Accepted V9.18 diagnostic | `acfa0ebd3717a793369e3e887e2d1a54785620b7` | Remains at `/preview/radar-history-fix/` |

## Release acceptance and invariants

- Exactly the corrected preview 3-D rendering logic is active on the root production page, including persistent source pixel-indexed glyphs across observed and display-only frames; in-place updates; no whole-cloud opacity fade or switching between frame-wide and track-specific rendering.
- Removed redundant historical track 3-D point/footprint array retention while preserving top-height/trend/support summaries; bounded decoded radar providers, Cesium idle tile cache and secondary frame buffers.
- Genuine BoM 2-D reflectivity (dBZ), native Doppler source time, inferred >=40 dBZ display floor, vertical display exaggeration 1.0×, storm IDs and +90-minute cones remain source-faithful and unmodified.
- Main radar default and up to 3 selectable additional Queensland/NSW sites remain. Secondary 3-D glyphs are retired when their radars are deselected.
- Official Queensland and NSW/DEA regional satellite coverage, regional place labels, old radar marker icons, flood gauge thresholds/colours, road closure/power outage/QFD incident context and GPU-safe interaction remain.
- Storm labels remain **off by default** and refer to the primary radar only, as described beside the control.
- No unverified V10 AURA Doppler circulation detections are promoted into V9.

## Release integrity

1. `scripts/build-current-site.sh` copies the production site from `checked/production-v9.20.0`, checked out at exactly `aba409fd1609e7bf7be6bf3c098b7fb6a14d89d1`, not mutable main.
2. `.github/workflows/pages.yml` runs all repository, old QA and pinned release tests; checks exact output marker `SEALED StormTracker V9.20.0 source aba409fd1609e7bf7be6bf3c098b7fb6a14d89d1`.
3. Only after successful **public** Pages verification does the workflow create and independently verify the annotated tag `v9.20.0` and branch `restore/v9.20.0` at the exact SHA above. An unexpected existing ref must cause failure, not a ref move.
4. Older release tags and restore branches are immutable and must remain functional.
5. The isolated incremental 3-D preview is retained for diagnostic comparison but does **not** supply production files; the older V9.18 accepted preview remains a separate reference.

See `docs/RELEASE_NOTES_V9.20.0.md`, `docs/HANDOVER_V9.20.0.md`, `docs/USER_GUIDE_V9.20.0.md` and `docs/BASELINE_RESTORE.md`.
