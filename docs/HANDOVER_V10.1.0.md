# StormTracker V10.1.0 — sealed production handover

**Source:** `11f0012170c4632bd5ef2448bf5671326fdd287e`
**Recovery:** `v10.1.0`, `restore/v10.1.0` after public Pages verification.
**Prior intact recovery:** `v10.0.0`, `restore/v10.0.0` → `e3f7f6d007f52e4ca48e103288bc5ffa77fac9b5`.

## Critical runtime contracts

- **Never substitute moving `main` for the accepted source pin.** Root build copies `checked/production-v10.1.0/frontend`; QA previews remain independent. Keep the Pages verify-before-tag order.
- `frontend/src/live3d-operational-v9.js` contains the sole browser playback clock. During native Doppler, `showDopplerOnlyFrame` begins `supplementalDopplerDisplay.prepare(source.observedUtc)` alongside primary decoding, uses the bounded secondary preparation wait, commits the primary image, then calls `supplementalDopplerDisplay.commit(source.observedUtc)`. Never regress to `showAt` driving asynchronous later frames during playback.
- `frontend/src/multi-doppler-display-v1.js` stages authentic per-site source/palette/history and reveals the ready layers together. It enforces ±8 minute genuine source matching, 350 ms optional wait, 120 ms display-only transition, source failure cooldown, stale render cancellation, rain-mode cleanup and signed UTC offset status. Don't invent an independent shared wind clock or relabel secondary time.
- `frontend/src/multi-radar-display-v9.js` remains the rain multi-site reference pattern. Original BoM reflectivity pixel categories and source grid; no fabricated scan times or hidden pixel manipulation.
- **Single production Cloudflare Worker:** `stormtracker-bom-relay`. Strict allowlist contains Brewarrina `IDR93I` plus approved Queensland wind products, not Moree/Grafton. No NSW preview worker or extra relay.
- Brewarrina `BOM_DOPPLER_MAPS["93"]` is nominal site-centred/128 km Gnomonic. The code still sets `analysisGeorefVerified=false` until authentic geospatial control points/meteorological structure agreement are validated. This must block precise circulation science in current and future extensions.
- Keep V10's simplified sidebar, terrain and regional satellite coverage, full-detail inferred 3-D ≥40 dBZ, primary-only tracks/cones, QFD/river/traffic/power controls and mobile memory safeguards unchanged.

## Validation and next milestone

CI `npm test` and exact source-package checks, immutable previous-version audit, public BUILD.txt verification and source-asset smoke checks occur before annotated tag creation. The next isolated milestone is real, time-valid official BoM cyclone track and **published uncertainty geometry**. Never interpret the ordinary StormTracker motion cone as an official probabilistic cyclone cone. Historical cyclone QA assets are not live warnings.
