# StormTracker — Sealed V9.20.1 and Recovery Procedure

**Current production:** `v9.20.1`, pinned source `efaceb59427f0b71859b15a61a6758a80d08547e`. The annotated `v9.20.1` tag and `restore/v9.20.1` branch are sealed only after live Pages source and asset verification. Do not publish unpinned main.

**Preserve these existing immutable rollback releases:**
- `v9.20.0` / `restore/v9.20.0`: `aba409fd1609e7bf7be6bf3c098b7fb6a14d89d1`. Previous low-memory primary 3-D release; secondary volumes absent (known regression).
- `v9.19.0` / `restore/v9.19.0`: `d317c17a6a8f706a0d867cb852db1e8d3f9ffac0`. Earlier geometry, stable secondary volumetrics; higher memory and frame flicker.
- `v9.18.0` / `restore/v9.18.0`: `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd`.
- Accepted V9.18 diagnostic `acfa0ebd3717a793369e3e887e2d1a54785620b7` at `/preview/radar-history-fix/`.

## Verify
The production public `https://blakesmith-intel.github.io/StormTracker/BUILD.txt` must read exactly `SEALED StormTracker V9.20.1 source efaceb59427f0b71859b15a61a6758a80d08547e`. Confirm `/src/supplemental-volume-sampling-v1.js` contains `hashSupplementalPixel`, `/src/supplemental-radar-volume-v1.js` contains `selectSupplementalVolumeSampleIndices`, `/src/live3d-operational-v9.js` contains `secondarySiteGlyphs`, and the document and iframe reference `v9.20.1-secondary-3d-fix`.

Check both `v9.20.1` (dereference annotated tag) and `restore/v9.20.1` point to source `efaceb59427f0b71859b15a61a6758a80d08547e`. The previous tags/branches must remain exactly at the source SHAs listed above.

## Roll back (if explicitly directed)
Use a new isolated maintenance branch. Select either V9.20.0 for lower-memory primary geometry or V9.19.0 for pre-optimisation secondary geometry. Change the Pages workflow and `scripts/build-current-site.sh` to pin the approved previous source and build marker, adjust contract tests, run dry-run and deploy, and verify the public `BUILD.txt` marker after roll back. **Never move/delete** existing tags or recovery branches.

V10 historical AURA wind and circulation validation is a separate development effort, not part of this release.
