# StormTracker V9.19.0 — user-accepted production baseline (15 October 2026)

**User approval:** after the 15 October source-faithful Mt Isa ST0003 cone-confidence QA and earlier preview testing, the operator explicitly accepted the `next-baseline` candidate and requested that it become the new sealed production baseline. The exact V9.19.0 release source was separately validated for production-route guard parity.

| Reference | Immutable commit | Purpose |
| --- | --- | --- |
| **Sealed production V9.19.0** | `d317c17a6a8f706a0d867cb852db1e8d3f9ffac0` | Public root `https://blakesmith-intel.github.io/StormTracker/`, pinned build |
| **Release tag** | `v9.19.0` | Must dereference to the exact production source SHA |
| **Recovery branch** | `restore/v9.19.0` | New immutable recovery point at the same source |
| Historical sealed production V9.18.0 | `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd` | Preserve tag `v9.18.0` and branch `restore/v9.18.0` for rollback |
| Historical accepted V9.18 diagnostic | `acfa0ebd3717a793369e3e887e2d1a54785620b7` | Remains accessible at `/preview/radar-history-fix/` |
| Repository archive | `archive/pre-cleanup-20261013` | Historical previews/installers if needed |

## Release acceptance

- Genuine BoM reflectivity (dBZ), source-time stability, multi-radar nonblocking playback and <=3 additional radar windows.
- Continuous satellite regional view: Queensland official imagery; coherent DEA NSW at regional scale, NSW official detail at closer zoom.
- Responsive Cesium with guarded graphics/hover interaction, deferred imagery retirement, bounded data history and incidental upstream error isolation.
- Sidebar collapse/restore; storm Labels off by default, primary-radar-only explanatory note. Geographical names independent.
- Displayed storm 0m centroid marker plus +30/+60/+90m forecast segments. Cones issued only on reliable source-measured motion; withheld on unsupported low-speed/abrupt centroid turns, including the reviewed Mt Isa scenario.
- Flood gauge colours green qualifying minor rapid rise / yellow BoM moderate / red BoM major / cyan unusual tidal screening.
- Road closures, unplanned electricity outages, flood context and selected QFD response incidents preserved.

**Warnings:** Interpolated display frames are not meteorological measurements; secondary radar imagery does not generate extra storm IDs. A storm cone is a modelled trend envelope, not an official BoM warning. Doppler radial velocity is not storm translation speed.

## Source/release integrity rules

1. `scripts/build-current-site.sh` must copy the public root from **the exact V9.19.0 release commit**, never from mutable `main`.
2. `.github/workflows/pages.yml` must verify the production `/BUILD.txt`, source guard assets, source-data integrity and historical QA `BUILD.txt` before sealing.
3. The `v9.19.0` release tag is created **only after the public website verifies successfully**; it must resolve to `d317c17a6a8f706a0d867cb852db1e8d3f9ffac0`.
4. The previous V9.18.0 tag and recovery branch must never move.
5. Do not silently publish mutable `/preview/next-baseline/` alongside the sealed release. The historical accepted V9.18 diagnostic remains.
6. Changes for V10 experimental Doppler/wind/circulation detection require new branches and validated archived authentic AURA measurements.

Documentation: `docs/RELEASE_NOTES_V9.19.0.md`, `HANDOVER_V9.19.0.md`, `USER_GUIDE_V9.19.0.md`, `BASELINE_RESTORE.md`.
