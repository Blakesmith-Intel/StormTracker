# StormTracker — sealed production V9.19.0 recovery procedure

**New accepted release source:** `d317c17a6a8f706a0d867cb852db1e8d3f9ffac0` (V9.19.0), approved on 15 October 2026. Permanent recovery ref: `restore/v9.19.0`. Release tag: `v9.19.0`, created by the Pages workflow **after successful public verification**; the annotated tag must dereference to the exact SHA above.

**Previous production V9.18.0:** `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd` with old tag `v9.18.0` and `restore/v9.18.0`. These must NEVER move. Historical diagnostic QA: `acfa0ebd3717a793369e3e887e2d1a54785620b7`, branch `restore/v9.18-accepted-diagnostic-20261013` and public `/preview/radar-history-fix/`. Historical experiments: `archive/pre-cleanup-20261013`.

## Check the live release

- `https://blakesmith-intel.github.io/StormTracker/BUILD.txt` must read `SEALED StormTracker V9.19.0 source d317c17a6a8f706a0d867cb852db1e8d3f9ffac0`.
- `/src/live3d-operational-v9.js` must contain `PUBLISHED_PRODUCTION_RUNTIME` and `shouldPrepareSupplementalForPlayback`; `/src/adaptive-threat-cone-v1.js` must contain `credibleMeasuredMotionAtObservation`.
- `/preview/radar-history-fix/BUILD.txt` must continue to identify `acfa0ebd3717a793369e3e887e2d1a54785620b7`.
- The production root must enable accepted bounded BoM radar/texture and locality safety guards (not just the former preview route), satellite continuity and click-only GPU marker inspection.
- The public release tag `v9.19.0` and `restore/v9.19.0` should refer to the exact same release source; check annotated tag dereference.

## To revert production to V9.18.0

1. Create an isolated recovery branch from current `main`. Preserve ALL existing tags and restore branches.
2. In `.github/workflows/pages.yml`, change the production checkout/pin and integrity checks to the old V9.18.0 source SHA. In `scripts/build-current-site.sh`, change the pinned root source and marker to `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd`. Do not repoint `restore/v9.19.0` or move `v9.19.0`.
3. Run `npm test`, `node --check relay/worker.js`, and the Pages dry-run tests. Merge only the reviewed rollback PR.
4. Verify `/BUILD.txt` at the **public root** identifies the restored V9.18.0 source; check map/radar and click behavior. The historical accepted QA can remain online independently.

## Future releases

Do not assume that `main` is production. Production is ALWAYS an immutable pinned source. Use a separate preview/branch for new changes, source-faithful BoM time rules and browser acceptance, then explicitly promote. The new baseline's threat cone withholds unsupported movement; avoid restoring the old cone just to display an arrow.

Release guides: `CURRENT_ACCEPTED_BASELINE.md`, `RELEASE_NOTES_V9.19.0.md`, `HANDOVER_V9.19.0.md`, `USER_GUIDE_V9.19.0.md`.
