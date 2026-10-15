# StormTracker V9.19.0 — Engineering handover

## Immutable production source

The Pages workflow and `scripts/build-current-site.sh` must reference the **exact user-approved release-source commit**; verify `/BUILD.txt`, annotated tag `v9.19.0` and branch `restore/v9.19.0`. The SHA is recorded in `docs/CURRENT_ACCEPTED_BASELINE.md` after cutover.

Legacy production V9.18.0 remains `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd`. The separately pinned historical accepted QA remains `acfa0ebd3717a793369e3e887e2d1a54785620b7`.

## Key files and scientific boundaries

- `frontend/src/live3d-operational-v9.js`: interface, measured-track selection, source-time playback and cone UI, production route activation of bounded discovery and deferred imagery resources.
- `frontend/src/radar-source.js`, `radar-request-pressure-v1.js`, `bom-wmts-loop-v2.js`: source-faithful BoM history with bounded probes. Original WMTS 400 unavailable-timestamp responses remain possible.
- `frontend/src/multi-radar-display-v9.js`, `supplemental-observed-anchor-v1.js`, `radar-imagery-handover-v1.js`: atomic measured time handover, inferred-step nonblocking logic, bounded authentic secondary hold, and ≤3 supplemental radar windows.
- `frontend/src/adaptive-threat-cone-v1.js`, `track-threat-cone-v1.js`: genuinely observed centroid motion, evidence threshold/withhold, polygon observed tip, source-only directional updates and deterministic replay. Do not treat inferred display timestamps as measurements.
- `frontend/src/storm-track-label-overlay-v1.js`: storm-cell DOM dot/label, linked toggle, default OFF. Primary-radar tracks only; do not imply additional radars generate storm IDs.
- `frontend/src/context-layers/basemap-manager-v1.js`: permanent QLD state satellite over DEA, regional DEA NSW, detailed NSW aerial when close; Cesium terrain independent.
- `frontend/src/context-layers/river-gauge-layer-v1.js` and `river-gauges-operational-v1.js`: BoM bulletin classifications authoritative; optional river history serialised; green minor rapid rise/yellow moderate/red major/cyan tidal anomaly. Third-party infrastructure errors cannot create fake readings.
- `frontend/src/context-layers/{power-outages-operational-v1,flood-road-closures-operational-v1,river-gauges-operational-v1}.js`: no synchronous per-mouse-move Cesium GPU pick on production; details on explicit click still supported.

## Deployment discipline

- Production HTML is **not** assumed to be equal to `main`. Build from pinned source, including scripts and source-controlled static NSW catalogue.
- Critical fix at release cutover: the old QA-only path switches are now deliberately active on the production `live3d-operational-v9.html` route. See `run-v9-19-production-route-contract-tests.mjs`; merely copying preview source without those switches is **not** a valid release.
- Preserve the V9.18.0 immutable release and historical accepted preview for rapid rollback. Never move existing tags/restore refs.
- Run `npm test`, `node --check relay/worker.js`, deterministic Pages builder, public `BUILD.txt` and specific asset checks. Only then call release sealed.
- Leave the external Cloudflare Worker unchanged; this release is a Pages/browser deployment.
- V10 severe-weather detection and historic AURA volume work are separate research priorities, not part of V9.19.0.

## Acceptance / follow-ups

User accepted the full next-baseline preview on 15 October 2026 after a focused Mt Isa +90m cone review. Future tracking across *all* supplemental radars is **not** included; the UI explicitly notes this limitation. Optional upstream WMTS 400 / river station HTTP 502 remain graceful errors unless functionality fails. Any new feature must pass isolated browser preview and explicit promotion.
