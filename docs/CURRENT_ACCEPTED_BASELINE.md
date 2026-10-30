# V10.2.31 verified current warning statuses — 30 October 2026

This additive warning-only maintenance fix uses the authoritative BoM Queensland current-warnings summary to report **No current warnings** for individually verified absent products even when WMO CAP history is truncated. It preserves separate active and polygon-pending states, accurate source timestamps, false all-clear safeguards, and standard/high-end distinction between warned phenomena and retrospective observations. The immutable V10.2.30 warning scientific and operational baseline remains unchanged. [Operator guide](OPERATOR_GUIDE_CURRENT.md) · [Release notes](RELEASE_NOTES_V10.2.31.md) · [Wishlist](ACTIVE_WISHLIST.md).

---
# Current StormTracker V10.2.29 warning capability — 30 October 2026

**Production warning polygon baseline (pending final public release seal):** See [V10.2.29 release notes](RELEASE_NOTES_V10.2.29.md), [operator guide](OPERATOR_GUIDE_CURRENT.md) and [active wishlist](ACTIVE_WISHLIST.md). Source-issued IDQ21033 regional, IDQ21035 detailed threat geometry, authentic geometry lifecycle, over-satellite/under-radar rendering, stateful camera-controller Locate, and tap-to-open existing LDMG/DDMG report are additive and do not alter the accepted V10.2.0 radar science and V10.2.24 hydrology/IFD stack. The separately designated official IDQ65652 detailed storm-location source is preconfigured with source-specific VERY DANGEROUS labels, but live IDQ65652 cells were not available at audit time; per-cell live acceptance remains open, not marked operationally proven. Every earlier sealed version remains unchanged.

**Release discipline:** Create a NEW annotated `v10.2.29` tag and `restore/v10.2.29` branch only after the current GitHub Pages build and public source checks succeed. The existing V10.2.28 baseline points at the historical source commit and must not move.

---
# StormTracker — current accepted production V10.2.26 (27 October 2026)

**Latest verified working code:** V10.2.25. **Final documentation-only seal:** V10.2.26. This document supersedes the earlier V10.2.5 header; older source-pin detail below is retained solely as historical engineering evidence.

- The original native BoM radar, Doppler, tracking and inferred-3-D foundation is STILL pinned to immutable V10.2.0 `047b3bd1c66b0ed5f070d2298202f46d0cd8dae2`; its `_site/BUILD.txt` marker is **not** the moving composite release version.
- All verified V10.2.24 floods, significant rainfall/IFD-AEP, road types, outage and operational map behaviours remain untouched.
- The V10.2.25 opt-in BoM thunderstorm/severe-weather layer delivers original issued polygons under radar, `IDQ21035` (SEQ detailed) and `IDQ21033` (QLD regional) filters; interactive BoM bulletin/validity info; comprehensive official LGA-based LDMG and disaster district intersections without a minimum-area cutoff; 15-minute and manual refresh; cancellation and revised polygon lifecycle. **Live authentic source polygon appearance has not yet been proved against an actual active warning**. It must show unavailable on missing/failed feeds, not claim no warnings.
- Latest documentation references: [V10.2.26 final freeze](RELEASE_NOTES_V10.2.26.md), [V10.2.25 functional release](RELEASE_NOTES_V10.2.25.md), [live-linked operator guide](OPERATOR_GUIDE_CURRENT.md), [development handover](DEVELOPMENT_HANDOVER_CURRENT.md), [rollback instructions](BASELINE_RESTORE.md).
- The previous `v10.2.25`/`restore/v10.2.25` **must remain at exactly** `d9620f6cbc411bfee029d9fa9d170752aa7c34f2`. Seal the *new* `v10.2.26`/`restore/v10.2.26` only after full Pages QA/public verification. The existing Cloudflare relay is a separately deployed service; it is not frozen by a Git Pages tag.

**Historical baseline notes follow and must not be confused with the latest accepted version.**

## Underlying immutable V10.2.0 scientific source baseline

> **Current composite production handover — 20 October 2026:** [DEVELOPMENT_HANDOVER_CURRENT.md](DEVELOPMENT_HANDOVER_CURRENT.md) and [OPERATOR_GUIDE_CURRENT.md](OPERATOR_GUIDE_CURRENT.md). This existing document records the **immutable V10.2.0 source pin**, not all subsequently accepted maintenance overlays. For the latest shipped rainfall, radar-source and layer fixes, follow the current handover while preserving the original sealed pin and recovery references.


**Accepted and sealed production:** `047b3bd1c66b0ed5f070d2298202f46d0cd8dae2` · verified annotated tag [`v10.2.0`](https://github.com/Blakesmith-Intel/StormTracker/releases/tag/v10.2.0) and recovery branch [`restore/v10.2.0`](https://github.com/Blakesmith-Intel/StormTracker/tree/restore/v10.2.0). Both were verified after successful GitHub Pages production deployment in [run 39012793972](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/39012793972). The previous independently sealed V10.1.1 remains an immutable emergency recovery point.

**Production:** https://blakesmith-intel.github.io/StormTracker/

**Verified public build marker:** `SEALED StormTracker V10.2.0 source 047b3bd1c66b0ed5f070d2298202f46d0cd8dae2`.

## Preserved accepted radar platform

- Single simple, viewport-bounded sidebar with no expanded/hidden legacy UI. **Hide controls** now removes the entire desktop sidebar column or mobile top row, so the weather map fills the browser; **Show controls** restores the compact sidebar. CSS and root iframe cache keys were both renewed. Always-on terrain, UTC/AEST time, source refresh indicators, BoM rain and Doppler playback controls and incident controls are otherwise unchanged.
- Primary BoM radar + up to **three additional** selected radars, source-measured reflectivity in **dBZ**, unchanged full-fidelity ≥40 dBZ **inferred** 3-D, and primary-only ST storm tracks and illustrative +90-minute motion cones.
- All BoM Doppler-capable selected sites, including Brewarrina **IDR93I**, use the **single existing production** Cloudflare relay. Moree and Grafton remain **rain-only**. Brewarrina native Doppler was verified in October 2026 as authentic source-timestamped BoM history and 512×512 source PNG; radar-centred projection tests passed. Its control-point image registration remains provisional and must **not** be authorised for wind/circulation science until separately verified (`analysisGeorefVerified=false`).
- In native Doppler playback, the **primary site is the master UTC clock**. Each extra Doppler radar independently selects the closest *actual* published BoM scan within **±8 minutes**. Like multi-site rain, the images are **prepared and staged before** primary presentation, then ready sites are **committed together at the primary frame boundary**. Optional preparation is bounded (350 ms); unavailable sites are omitted rather than popping in late or displaying stale observation times. The source status shows each displayed site's real signed UTC offset.
- Doppler is BoM **radial velocity**, not measured ground-level surface gusts. The application does **not** combine different stations into a fabricated velocity field, infer missing wind scans, or include unverified secondary-source wind in primary track science.
- Original QLD/NSW satellite continuity, town labels, flood gauges, road closures, power outages, QFD rescue assistance, customer counts, map measuring and browser/mobile stability remain intact.

## BoM tropical cyclone interface (V10.2.0)

- The historical Jasper/Alfred tracks remain **observed-only**, separate from original forecast-track GML. An original issued BoM GML file can still be imported in the cyclone panel.
- Cyclone source-validated feed UI is opt-in and off by default; original 72/120-hour polygons only if genuinely present, not generated from observed tracks.
- **No live BoM FTP-to-HTTPS bridge has been deployed** into this public GitHub Pages site. A source failure must display 'Unable to verify current tropical cyclone warnings' and link BoM.
- Only a **verified and current empty source check** can display **'Currently no tropical cyclone warnings'**. Do not show that text based on a failed request, expired data or a historical sample.
- Real anonymous FTP access and authentic Fina GML decoding passed via a one-shot GitHub runner. Automatic advice `IDQ20023/26/29` matching to forecast GML is a later stage.

## Immutable recovery and later work

**Previous sealed V10.1.1:** `v10.1.1` and `restore/v10.1.1` point to `711d65a72a483b319e80711a09cfeabe2f69bbcd`. Never repoint.

**Prior accepted V10.1.0:** `v10.1.0` and `restore/v10.1.0` still point to `11f0012170c4632bd5ef2448bf5671326fdd287e`. 

**Prior accepted V10.0.0:** `v10.0.0` and `restore/v10.0.0` still point to `e3f7f6d007f52e4ca48e103288bc5ffa77fac9b5`. Prior `v9.20.2` and `restore/v9.20.2` stay at `b8be458acbae942a3bb0b530a5c17618b6d03134`; all older references remain untouched.

The public root is built from this **specific source commit**, not automatically from later development on `main`. The separate preserved V9.18 diagnostic and incremental-3D QA preview remain available. Next work: official BoM cyclone forecast track and uncertainty polygons with genuine source/issue/valid-time validation; this is not a live cyclone warning product today.


## Release sealing repair — 17 October 2026

PR [#162](https://github.com/Blakesmith-Intel/StormTracker/pull/162) separates production deployment from post-publication ref sealing. The sealed source is immutable and the runner creates genuine annotated Git tags via Git Data REST rather than attempting a workflow-restricted `git push`. The deployment and sealing jobs both completed successfully; the tag points to the exact source SHA above. Recovery points V10.1.1 and earlier are unchanged. Metadata failures can be retried separately without publishing duplicate Pages artifacts.
