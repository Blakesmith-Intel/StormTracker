# StormTracker — V9.17.0 production

**Live:** https://blakesmith-intel.github.io/StormTracker/

Browser-only Queensland and border-region situational-awareness radar display. Uses original public Bureau of Meteorology (BoM) **reflectivity in dBZ throughout** (not estimated mm/h), optional Doppler radial velocity, empirically **inferred** (not measured) 3-D radar echoes and observed-pixel storm tracking. GitHub Pages serves the application; the existing Cloudflare Worker relays permitted source files only.

## Current capabilities

- **22 selectable radar coverage windows:** all 19 existing Queensland stations plus **Brewarrina (93), Moree (53) and Grafton (28)** in NSW. These locations select windows of the *national BoM WMTS mosaic*, not independent fused radar scans. Source reflectivity and 2-D history are unchanged.
- The selected **primary** radar controls tracked storms, inferred 3-D, radar clock and supported Doppler. Add **up to three** other 2-D reflectivity windows. Overlap, stale timestamps and supplemental-load failures cannot manufacture a new primary observation.
- **Small single-colour SVG radar-dish markers** on the map are clickable/tappable to select the primary source. The name is available in the dropdown, accessible button label and hover tooltip. Map towns stay separate.
- **Rounded cloud-like inferred 3-D sprites** use the **same 15-category original BoM dBZ colour palette** as 2-D imagery; volumes display only at **≥40 dBZ**. No rain-rate conversions and no synthetic cloud-top measurements.
- **Per-source-pixel intensity** controls each rendered column's *presentation-only* height multiplier (1.0–1.4). Weaker echoes appear shorter; strong cores appear taller. The independent manual vertical-exaggeration control defaults to **1.0×**. Empirical five-event AURA vertical profiles, confidence, occupancy and source-pixel dBZ remain unchanged.
- Connected-pixel storm tracking: 40 dBZ threshold, ≥16 **observed** connected pixels, gap joining within two raster pixels, independent strong-core protections, track IDs, labels and motion cones.
- Original BoM Doppler winds, double-buffered frame presentation and source timestamps; 08/50/66 remain the only geographically calibrated footprint-wind analysis sites. All other nominally aligned wind displays are **not** calibrated for footprint analysis.
- **Brewarrina Doppler is NOT enabled in V9.17.0:** BoM publishes `IDR93I` but its separate Cloudflare preview Worker is not deployed/verified. It is whitelisted in source code only and explicitly gated (`dopplerIntegrated:false`). Moree and Grafton are reflectivity-only.
- Rolling source-backed radar history, independent source polling (~five minutes), timeline scrub, speed/loop choices and safe playback recovery.
- Street/imagery basemaps, terrain, official geography and town labels, current unplanned road closures and power outages, BoM flood signals and public QFD grouped rescue/assistance indicators (subject to source availability and each layer's existing filters).

## Read first

- [V9.17.0 end-user guide](docs/USER_GUIDE_V9.17.0.md)
- [Release notes and change log](docs/CHANGELOG_V9.17.0.md)
- [Production baseline and recovery](docs/PRODUCTION_BASELINE_V9.17.0.md)
- [Engineering / operational handover](docs/HANDOVER_V9.17.0.md)
- [Scientific integrity contract](docs/SCIENTIFIC_CONTRACT.md)
- [Historical operational release archive](docs/OPERATIONAL_RELEASE.md)

## Validation and scientific limits

`npm test` validates browser source/relay and meteorological display contracts (Node.js is used **only for development**, not the user runtime). Original BoM reflectivity alone determines reported 2-D intensity and measured-cell segmentation. Live 3-D is a **display-model inference**, not a direct vertical radar scan. Stronger low-level dBZ does **not prove** greater real cloud height. Doppler is radial velocity, not storm travel speed; exploratory severe/circulation features do not constitute warnings. Display-only interpolated radar frames cannot generate new measured tracks or measured 3-D claims.

## Deploy / rollback

The GitHub Pages workflow publishes an **exact pinned release commit**, never whatever happens to be newest on main. The public `/BUILD.txt` identifies that exact production source. An immutable `v9.17.0` tag and `restore/v9.17.0` branch are sealed only after live deployment checks. Historical `v9.16.15` remains available for rollback. No local hosting, paid data, backend meteorological processing or unrelated Cloudflare Worker changes are required.
