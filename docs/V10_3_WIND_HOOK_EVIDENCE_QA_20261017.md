# V10.3 — Wind, hook-echo and circulation evidence research

**17 October 2026 · isolated QA branch only · sealed V10.2.0 not altered.**

## Operator outcome

1. Restore candidate identification from observed reflectivity and original BoM radial Doppler: **strong same-direction radial wind** (yellow), **persistent hook-shaped reflectivity** (orange) and **hook plus local opposite-sign Doppler couplet** (red). These are experimental radar *signatures*, **NOT official severe thunderstorm/tornado warnings**, and not confirmed surface winds.
2. Scientific QA is explicitly opt-in, available **only** on `/preview/incremental-3d/`, with no detection work when disabled and no extra production toggle or incident-layer clutter. Normal radar, Doppler, 3-D and storm-label operation is unchanged.
3. Remove the historical Jasper/Alfred observed-case buttons, original GML upload, archived case heading and archived map stamp **from the operational Cyclones panel**, on both `index.html` and direct operational HTML. Keep those reference fixtures and original BoM GML decoder functional and accessible **only in the isolated QA viewer**. The active cyclone panel continues to provide source-current forecast controls and an authoritative BoM link. This is a rendered-production-only panel cleanup and must not erase the archived test materials.
4. Keep cyclone latest-source error distinct from BoM's exact `Currently no tropical cyclone warnings` phrase, which is allowed only following a verified fresh empty source check. Live cyclone FTP-to-HTTPS transport is still an outstanding development milestone.

## Existing detector evidence and original research

Ported and modernised from [original open research PR #62](https://github.com/Blakesmith-Intel/StormTracker/pull/62), not from production. The initial research and negative controls are in `frontend/src/severe-storm-v10.js` and `frontend/tests/run-severe-storm-v10-tests.mjs`. The original V9 hook shape is a two-frame observed reflectivity arc near a genuine ≥40 dBZ segmented ST track. A close Doppler couplet in the same radar and track adds *potential tornadic circulation signature* but **does not validate rotation**: Doppler aliasing, beam height, sampling and storm morphology remain unresolved.

BoM's **90 km/h damaging** and **125 km/h destructive** thresholds refer to surface wind gusts, **not** the radial velocity field retrieved from its PNG/GIF radar display. The presently decoded public image product's palette is around ±70 km/h; a 90 km/h radar or gust warning would be scientifically unjustified on this source. The *research* radial-speed threshold is 60 km/h **and explicitly labelled "radial at radar beam height"**, not a 90 km/h damaging gust.

Until trustworthy original radial-velocity sweeps (or a separately verified official BoM weather-station gust observation feed) are available, do not introduce a claim that the application detects actual 90/125 km/h damaging/destructive gusts, downbursts or tornadoes.

## Important additional QA gates

- Process **observed** reflectivity only; no 3-D inferred volume, interpolated Doppler, projected tracks or missing/ambiguous scan UTC.
- Doppler samples must be from known native source-georeferenced radar sites, include an original BoM source-UTC basis, align within eight minutes to the reflectivity observation and stay within the authentic ±70 km/h palette. This first calibrated QA scope uses Gympie 08, Marburg 50, Mt Stapylton 66. Additional Queensland radar sites require evidence of accurate georeferencing before whitelisting.
- Deduplicate exact source radar pixel indices before cluster size counting. Three repetitions of one pixel must never qualify as a cluster.
- A strong same-direction research candidate needs at least three ≥60 km/h pixels spatially within 5 km, without an adjacent opposite-sign ≥40 km/h cluster within 8 km.
- Persistent hooks require two authentic observations no more than 15 minutes apart. Local opposite-sign coupling does not prove rotation or an actual tornado, especially with unresolved velocity folding.
- Attach original source UTC and whether the viewer is showing latest, historical or stale frames. No notifications or emergency-management use.
- Keep candidate pin colours/symbols distinct and tappable, with an official BoM radar link. No label overload; research disabled by default.

## Next genuine-case QA

Recreate original-source Doppler/reflectivity replay for **Gympie, 24 November 2025**, and the **Christmas 2023 South-East Queensland derecho** as previously selected controls. Verify archived BoM original frames and metadata before claiming evidence is authentic. Add clean negatives: ordinary showers, curved nonrotating echoes, single-scan arcs, noise, anechoic/clutter boundaries, missing scans, Doppler aliasing and different radar/source UTC. Present confusion matrix / evidence snapshots only after raw source test sets are acquired; current unit fixture positives are **synthetic, not historical validation**.

Historical AURA genuine HDF5 radial-velocity archive retrieval and QC/dealiasing were previously identified as unverified dependencies; do not claim AURA data access or historical detector accuracy yet.

## Release boundary

Current branch: `feature/v10-3-wind-hook-evidence-qa-20261017`. The QA preview functionality requires publishing this branch's browser preview in a future isolated build, with verified visual QA on iPhone and desktop. **Production root is still sourced from the immutable sealed V10.2.0 commit**, irrespective of the development branch. Promote the operator-facing cyclone-only UI tidy separately or with a future release after it passes CI and visual acceptance; do not merge experimental signatures into an active emergency-warning service.

To run: `npm test` and in particular `frontend/tests/run-severe-storm-v10-tests.mjs` and `frontend/tests/run-operational-cyclone-panel-v1-tests.mjs`; compare the current baseline's Cesium/navigation, radar playback, and incident layers on both desktop and mobile.
