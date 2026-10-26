# StormTracker V10.2.23 — operator-accepted situational-awareness production freeze

**Accepted by operator:** 26 October 2026 (AEST).  
**Public service:** https://blakesmith-intel.github.io/StormTracker/  
**Current on-site operator-guide link:** [Current operator guide](OPERATOR_GUIDE_CURRENT.md).  
**Release references (created only after successful public deployment):** annotated Git tag `v10.2.23`, recovery branch `restore/v10.2.23`. Both must resolve to the *same exact* release-source commit SHA. Never move or recycle either reference.  
**Immutable foundation:** BoM radar / Doppler / cyclone interface V10.2.0 pinned to `047b3bd1c66b0ed5f070d2298202f46d0cd8dae2`; accepted maintenance overlays are assembled through `scripts/build-current-site.sh`. V10.2.23 denotes the complete accepted *composite*, not a replacement of the V10.2.0 science pin.

## Operator-approved complete release scope

### Original weather, radar and incident functions preserved
- BoM genuine 2-D reflectivity in **dBZ**, native Doppler with multi-site source-UTC synchronization and accurate site registration, optional ≥40 dBZ inferred 3-D at original 1.0× exaggeration.
- Browser rain-only 30/60/90/120/180-minute windows and separate all-available Doppler playback; keep genuine observation times.
- Storm identifiers and illustrative cones, optional labels off by default; selectable Street/Satellite basemaps, scale/measure and responsive mobile/desktop sidebar.
- Unplanned QLD road-closure **road lines and markers**; affected-area overlays for provider-published unplanned power outages; selected QFD published assistance jobs.
- Significant BoM rainfall **≥50 mm**, original station positions/identity, automatic official exact-location IFD rarity lookup, tier colour and severity layering, two read-only on-screen rain reports, unchanged original rainfall/AEP collection and caching.

### Flood gauge behaviour accepted after October 24–26 QA
- **Exact BoM station-ID** observation reconciliation and valid 2026 BoM flood stages in the station's reported datum. No unverified height/datum conversion or station-name borrowing.
- Official **major > moderate > minor** stage displayed in the existing coloured gauge symbol. Station-verified crossing height is informational at every stage; **amber bridge/water** marker applies only where its crossed threshold lies *below* the first official flood stage. Amber can appear below minor even at a gauge that has an official minor height.
- Map flood icons keep the uniform previously accepted physical dimensions and remain geographically attached to the actual gauge. Map and legend stay matched; most severe layers render on top.
- True measured height delta divided by actual elapsed observation time, with legitimate **30–120-minute** observations, **90-minute** live-marker freshness and **signed rise/fall rate** displayed independently of BoM informational tendency.
- Rapid-rise modifier on minor/moderate/major/eligible crossing icons; remove the blue arrow promptly when the measured rapid-rise condition ends without clearing the genuine underlying stage/crossing icon.
- Tide protection is based on each station's available source evidence: source-verified **non-tidal** stations (even within 125 km of the coast) use the original **0.30 m/hour** rise screening; source-verified **tidal** sites suppress ordinary tidal rates; unresolved coastal sites retain original **1.40 m/hour** conservative screening. No invented metadata. Existing internal diagnostics count verified tidal, verified non-tidal, observed tidal-pattern and unverified coastal gauges.
- Cached false flood readings independently contradicted by BoM station observations are excluded; unsupported old flood/crossing/post-rise markers **expire at 24 hours**, and post-rise monitoring clears after **one** genuine new measurement returns near the station's verified pre-rise level or below its published crossing. An absent marker is never proof of safety.
- Flood gauges poll at approximately **10-minute** intervals, can be manually refreshed and have their own read-only **moderate/major or crossing-exceedance** report, with stale last-confirmed crossing readings clearly identified instead of described as current.

### Documentation and safety
- The existing **Operator guide ↗** site heading links directly to `docs/OPERATOR_GUIDE_CURRENT.md`. This release updates **that exact existing file**; no added panel, altered link location, modified icon sizing, or user-interface redesign.
- Explicit distinctions maintained: StormTracker rapid-rise and Doppler hazard candidates **are not official BoM warnings**; a reported crossing level is **not an official road closure**; no fabricated current cyclone geometry or false all-clear.

## Freeze and recovery rules

1. Run the existing full frontend regression suite and source-locked composite production build. Confirm GitHub Pages **deploy** has passed including the real public-site checks, and compare actual published flood code with this release.
2. Only after public deployment succeeds, seal **the exact source SHA of this release commit** as a new, annotated `v10.2.23` Git tag and independent `restore/v10.2.23` branch. Confirm they point at the identical immutable commit; **never repoint older refs**.
3. Retain this freeze untouched for operational use. Future experiments, wishlist features or improvements should use fresh isolated branches and new release numbers. Do not quietly incorporate them into this accepted baseline.
4. Public Pages site, Cloudflare Worker and persistent `radar-ftp-feed/ifd.json` must be audited independently; a static-site tag does not freeze external live data, change upstream BoM observations or tag the separately hosted Worker.
5. **Restore:** review both the immutable V10.2.0 source and the accepted overlay code at `v10.2.23` / `restore/v10.2.23`, then deploy that exact composite under a reviewed rollback process. Never force-update the sealed reference.

**Changed files for this release:** operator guide, release notes, current handover pointer, repository release summary, and deployment/release-verification workflow only. **No source JavaScript, BoM parsing, UI HTML/CSS, AEP science, radar imagery or relay code changes.**
