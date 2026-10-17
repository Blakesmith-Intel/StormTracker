# StormTracker — Current Accepted Production Baseline: V10.1.0 (17 October 2026)

**Accepted and source-pinned production:** `11f0012170c4632bd5ef2448bf5671326fdd287e` · immutable annotated tag `v10.1.0` · independent restore branch `restore/v10.1.0`. Release references are created **only after** successful public Pages deployment and source-asset verification.

**Production:** https://blakesmith-intel.github.io/StormTracker/

**Public build marker:** `SEALED StormTracker V10.1.0 source 11f0012170c4632bd5ef2448bf5671326fdd287e`.

## Operator-accepted baseline

- Single simple, viewport-bounded sidebar with no expanded/hidden legacy UI; always-on terrain, UTC/AEST time, source refresh indicators, BoM rain and Doppler playback controls, useful radar/site and incident controls.
- Primary BoM radar + up to **three additional** selected radars, source-measured reflectivity in **dBZ**, unchanged full-fidelity ≥40 dBZ **inferred** 3-D, and primary-only ST storm tracks and illustrative +90-minute motion cones.
- All BoM Doppler-capable selected sites, including Brewarrina **IDR93I**, use the **single existing production** Cloudflare relay. Moree and Grafton remain **rain-only**. Brewarrina native Doppler was verified in October 2026 as authentic source-timestamped BoM history and 512×512 source PNG; radar-centred projection tests passed. Its control-point image registration remains provisional and must **not** be authorised for wind/circulation science until separately verified (`analysisGeorefVerified=false`).
- In native Doppler playback, the **primary site is the master UTC clock**. Each extra Doppler radar independently selects the closest *actual* published BoM scan within **±8 minutes**. Like multi-site rain, the images are **prepared and staged before** primary presentation, then ready sites are **committed together at the primary frame boundary**. Optional preparation is bounded (350 ms); unavailable sites are omitted rather than popping in late or displaying stale observation times. The source status shows each displayed site's real signed UTC offset.
- Doppler is BoM **radial velocity**, not measured ground-level surface gusts. The application does **not** combine different stations into a fabricated velocity field, infer missing wind scans, or include unverified secondary-source wind in primary track science.
- Original QLD/NSW satellite continuity, town labels, flood gauges, road closures, power outages, QFD rescue assistance, customer counts, map measuring and browser/mobile stability remain intact.

## Immutable recovery and later work

**Prior accepted V10.0.0:** `v10.0.0` and `restore/v10.0.0` still point to `e3f7f6d007f52e4ca48e103288bc5ffa77fac9b5`. Prior `v9.20.2` and `restore/v9.20.2` stay at `b8be458acbae942a3bb0b530a5c17618b6d03134`; all older references remain untouched.

The public root is built from this **specific source commit**, not automatically from later development on `main`. The separate preserved V9.18 diagnostic and incremental-3D QA preview remain available. Next work: official BoM cyclone forecast track and uncertainty polygons with genuine source/issue/valid-time validation; this is not a live cyclone warning product today.
