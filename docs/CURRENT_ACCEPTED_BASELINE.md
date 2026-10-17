# StormTracker — V10.2.0 cyclone UI baseline (17 October 2026)

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
