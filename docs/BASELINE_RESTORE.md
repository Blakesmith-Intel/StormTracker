# StormTracker — V9.20.0 sealed release and rollback

**Production source:** `aba409fd1609e7bf7be6bf3c098b7fb6a14d89d1`, 16 October 2026. 
**Release tag:** `v9.20.0` (annotated, dereferences to the pinned source).
**Recovery branch:** `restore/v9.20.0` (same source SHA).

The tag and recovery branch are sealed **only after** the GitHub Pages workflow confirms the public V9.20.0 marker and V9.20 static assets. They are not created at the mutable maintenance branch's head.

## Historical protected recovery points

- **V9.19.0:** `d317c17a6a8f706a0d867cb852db1e8d3f9ffac0`, with existing `v9.19.0` and `restore/v9.19.0`.
- **V9.18.0:** `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd`, with existing `v9.18.0` and `restore/v9.18.0`.
- **Accepted V9.18 QA:** `acfa0ebd3717a793369e3e887e2d1a54785620b7`, published at `/preview/radar-history-fix/`.
- **Old full history:** `archive/pre-cleanup-20261013`.

All recovery references above must remain untouched, even during future feature development.

## Verify production

1. `https://blakesmith-intel.github.io/StormTracker/BUILD.txt` must equal:
   `SEALED StormTracker V9.20.0 source aba409fd1609e7bf7be6bf3c098b7fb6a14d89d1`
2. `/src/live3d-operational-v9.js` must enable the optimised 3-D renderer on root `live3d-operational-v9.html` and include `Memory diagnostics`, `incrementalVolumeRenderer.upsert`, source-time and GPU guards.
3. `/src/incremental-volume-renderer-v1.js` must contain `function upsert`; `/src/supplemental-radar-volume-v1.js` must contain `pruneSites`; `/src/volume-display-opacity-v1.js` must expose `updateVolumeDisplayPoint`.
4. Both `/index.html` and `/live3d-operational-v9.html` must contain the new `v9.20.0-optimised-3d-prod` version string, avoiding stale browser resources.
5. The historical V9.18 QA marker remains unchanged and source BoM imagery, radar tracks, selected radar windows, satellite layers and cones work.
6. The two new V9.20 refs must resolve to `aba409fd1609e7bf7be6bf3c098b7fb6a14d89d1`. An annotated tag must be peeled with `refs/tags/v9.20.0^{}` when checking the raw remote.

## Rollback to V9.19.0 if necessary

1. Create a **new** isolated rollback review branch from current main; never reset or move `v9.20.0`, `restore/v9.20.0` or the previous tag/branch.
2. Reconfigure the Pages workflow to check out V9.19.0 exact source `d317c17a6a8f706a0d867cb852db1e8d3f9ffac0` as the pinned production asset source.
3. Update the site packaging root source and `BUILD.txt` marker to V9.19.0. Preserve the V9.18 accepted diagnostic and archived sources.
4. Run the full frontend and relay checks and dry-run the exact Pages package. Merge only the reviewed rollback and confirm the public root marker changed back to the V9.19.0 SHA.
5. Do not restore the old unsupported 3-D fade or undo genuine source-time safeguards except as part of the explicit pinned release rollback.

## Rule for subsequent releases

Production is built from an immutable SHA, not a moving `main` head. Release a tested preview, secure the operator's approval, freeze source, verify public output, **then** seal refs. V10 authentic BoM AURA wind candidate development stays separate from these V9 maintenance releases.
