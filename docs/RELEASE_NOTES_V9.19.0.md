# StormTracker V9.19.0 — Release notes

**Acceptance:** Operator confirmed the 15 October 2026 `/preview/next-baseline/` candidate sufficiently functional and expressly authorised promotion to production. Final cutover remains conditional on release CI and public Pages verification. The deployed `BUILD.txt` is the authoritative source-commit record.

## What's new since sealed V9.18.0

- **Browser stability:** deferred Cesium imagery-layer retirement, bounded BoM reflectivity history discovery/request pressure, throttled locality searches, guarded GPU hover interactions, sequential optional BoM station-history requests with cooldown, and improved failure isolation.
- **Multi-radar:** primary plus up to three additional sites with measured source-time image handover, bounded inferred 3-D volume and real-observation hold (up to 15 minutes) across display-only inferred primary steps. Inferred steps do **not** wait for optional supplemental downloads or manufacture a new BoM scan.
- **Basemaps:** continuous Queensland official satellite coverage from regional scale, DEA 2025 GeoMAD regional continuity for NSW, NSW government high-resolution aerial imagery only at appropriate close scale; reduced navigation flicker; names above weather volume.
- **Interface:** a hide/show sidebar that preserves map/playback state; Labels now **off by default**, with in-app note that StormTracker storm-cell tracking and labels apply only to the **primary** radar. Place-name labels are independent.
- **Storm tracking:** >=40 dBZ connected-source-pixel segmentation, reduced duplicate/stale trails, source-anchored +90-minute cone tip and 0m indicator, with +30/+60/+90-minute markers. Measured boundary exit tolerance stays 500m, position follow threshold 150m. Heading adaptation uses corroborated motion rather than unsupported centroid noise.
- **Motion confidence:** a cone is **withheld** when the newest measured displacement is too small or changes direction inconsistently; it resumes when two genuine measured intervals support coherent movement. No extrapolation from an inferred display frame. This avoids misleading 90-minute guidance on unsupported ~7km/h centroid motion.
- **Flood signals:** qualifying rapid river rises above minor are green; BoM moderate yellow, BoM major red (including steady/falling while classified); unusual tidal screening cyan. Flood classification remains BoM-derived.
- **Context:** unplanned road closures and electricity outages remain separate; QFD selected rescue categories retained.

## Meteorological and safety constraints

Original BoM reflectivity is in dBZ and is never replaced by synthetic observed scans. Doppler is **radial velocity**, not cell translation. StormTracker inferred 3-D is a visual model, not an official vertical radar retrieval. Storm ID labels/tracking cover the primary radar only; other radars contribute imagery and inferred 3-D, not independent track IDs. The motion cone is an experimental trend envelope and **not an official BoM severe-weather warning** or probability forecast. Uncertain motion should display **no cone**.

## Verification and rollback

Pre-promotion browser acceptance was granted for the full `next-baseline` candidate, including the final motion-confidence changes. A promotion is complete only when:
1. All release-source JS regressions and relay syntax tests pass.
2. The deploy workflow checks out and publishes the exact immutable V9.19.0 release source commit, not a mutable `main` checkout.
3. `/BUILD.txt` identifies that commit and `/src/live3d-operational-v9.js` contains the production safety gates.
4. The `v9.19.0` tag and `restore/v9.19.0` branch point to the same source commit.
5. Existing `v9.18.0`/`restore/v9.18.0` remain unchanged.

Rollback: repin the production source to `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd`, deploy and verify public `BUILD.txt`. Do **not** move old tags or restore branches.
