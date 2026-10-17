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

## Verified publication context for historical radar volume acquisition

The [Australian Unified Radar Archive operational-radar catalogue](https://www.openradar.io/operational-radars/radar-products) states that Level 1 operational radar archives are genuine ungridded ODIM HDF5 radar volumes and are licensed under **CC BY 4.0**. It distinguishes these from derived Level 1b/2 products (CC BY-NC 4.0), and notes their update pattern. The [operational-radar collection](https://www.openradar.io/operational-radars) indicates Level 1 updates about **48 hours behind real time**, which is suitable for archived case validation, **not** for real-time alert delivery. Authoritative reference dataset: Soderholm, Protat and Jakob (2019), DOI [10.25914/508X-9A12](https://doi.org/10.25914/508X-9A12). NCI lists a [THREDDS data service](https://nci.org.au/services/data-collections-and-services) for public-file access.

**Current access gate:** dataset documentation and licensing confirmed; we have **not yet authenticated a specific 2023/2025 storm-case HDF5 sweep**, nor confirmed radial velocity/dealias metadata or produced case-level accuracy statistics. Keep the existing radar PNG-derived candidates visibly labelled experimental. The next retrieval milestone is identifying and fetching a few consecutive original Level 1 `VRADH`/`VRAD` (actual quantity names require inspection) volumes per event, checking time/geometry/Nyquist metadata, and performing dealiased analysis with preserved input hashes. No HDF5 bytes belong in GitHub source or public Pages builds.

## Doppler-first correction following operator QA — 17 October 2026

**Root cause verified:** the initial V10.3 branch called `syncSevereStormAlerts` only from the reflectivity renderer. The production-aligned reflectivity loader intentionally returned `records:[]` for Doppler, because rain and native Doppler have independent playback timelines. Its Doppler-only renderer never called the research detector. The resulting orange hook echo could appear on a particular reflectivity frame; yellow/red had no genuine velocity evidence in that path. This is **not acceptable wind-alert analysis**.

**Corrected on isolated V10.3 research source:**

- A native Doppler-only playback commit now invokes `syncIndependentDopplerResearch`, using its actual decoded original BoM radial-velocity pixels and **the preceding independent source-timestamped Doppler frame**. The new `doppler-persistence-v10-3.js` requires same-radar, non-inferred, verified georeferencing, distinct increasing source UTC no more than 15 minutes apart, nearby same-sign ≥60 km/h clusters of at least three distinct pixels per scan, and no close opposing ≥40 km/h cluster. Never treat image speed as a 90/125 km/h surface gust. A Doppler-only research pin now shows both original scan timestamps rather than incorrectly claiming reflectivity evidence.
- Where observed reflectivity history is playing, **the QA-only analyzer fetches independent genuine BoM Doppler PNG history** and pairs each actual radar and velocity scan within eight minutes, rather than consuming the deliberately empty rain-playback Doppler record state. Both **yellow wind** and **red hook-plus-couplet** require the same radar/track to have evidence in two different consecutive velocity scans and in two observed reflectivity frames. **Orange** remains a two-observation reflectivity-shape candidate and is never labelled Doppler-confirmed.
- Analysis stays completely **off by default**, only behind the V10.3 preview toggle. Asynchronous Doppler requests are token-guarded and stale results are discarded after playback changes. No forecast/inferred frames, fabricated source timestamps, storms extrapolated between frames, assumed winds aloft or unauthorised alert push notifications.
- Absence of a signal means **no qualifying indicator from the available original observations**, not an all-clear or a negative severe-weather forecast. Raw radial-velocity image aliasing and beam height remain unresolved. A radar signature is NOT an official BoM warning.

**Scope/verification:** Added offline synthetic positive and negative suites for two consecutive original Doppler frames, rejected single scans, reused source UTC, mismatched radar, alias-range violations, repeated pixels and opposing directions. Integration with actual published simultaneous event scans and false-alarm rates has **not yet been verified**. Only after CI and public-QA preview verification should this be called a completed *Doppler-first research implementation*. V10.2.0 production remains immutably pinned.
