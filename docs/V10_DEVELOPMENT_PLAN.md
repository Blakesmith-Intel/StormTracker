# StormTracker V10 — severe-weather candidate development

**Status:** experimental, not approved for production. Started 13 October 2026.

## Source and release controls

- Development branch: `feature/v10-severe-weather-candidates`, created directly from the **user-accepted** V9.18 diagnostic source `acfa0ebd3717a793369e3e887e2d1a54785620b7`.
- Sealed production: `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd`. Do not modify or auto-promote.
- Accepted QA: `restore/v9.18-accepted-diagnostic-20261013`. Do not modify.
- Historical full archive: `archive/pre-cleanup-20261013`. Preserve for recovery.
- Existing Pages deployment keeps only the two supported pinned browsers until a specifically approved, isolated V10 preview is added. Never re-enable legacy preview deployment matrices.

## V10 milestone 1 — observationally supported detection

Build and validate **candidates**, not official severe thunderstorm warnings:

1. **Yellow — possible damaging straight-line wind:** evaluate verified, time-stamped BoM Doppler radial-velocity magnitudes against the specified 90 km/h damaging-wind screening threshold, with explicit radial-versus-surface-wind caveats. Do not interpret radial velocity as storm translation speed.
2. **Orange — possible hook echo:** require source-grounded reflectivity morphology and spatial/temporal coherence. A reflectivity hook alone does not establish a tornado.
3. **Red — possible tornadic circulation:** require defensible opposing radial-velocity signatures with valid velocity product/georegistration and spatial association; identify as a *candidate*, never confirmation.
4. **Destructive-wind classification:** introduce only when the BoM definition, unit conversion, radar-product coverage, elevation and reliability are separately verified. Do not equate observed aloft radial velocity with surface gusts.
5. Restrict detection to supported native Doppler radar sites; explicitly exclude NSW sites without verified source/product handling and calibration. Missing/unreliable data produces **no assertion**, not a false clear.

## Acceptance plan

- Confirm precise velocity decoding/georeferencing, palette, time alignment and sign convention on actual supported products.
- Establish provenance for Gympie/Cooloola 24 November 2025 and Gold Coast/Christmas 2023 derecho events. Separate archival evidence from synthetic/regression scenarios; never use a demonstration fixture as proof of meteorological skill.
- Define deterministic candidate windows, suppression/de-duplication, expiry, confidence/explanation metadata, and rate limits before enabling interactive alarms.
- Add unit tests for each classifier, boundary cases, missing frames, outdated frames, rapid zoom/playback and CPU performance.
- Run `npm test` and `node --check relay/worker.js`; do not break known-good radar playback, multi-site volumes, map labels or optional contextual layers.
- Publish to a *new*, isolated V10 browser preview only after automated validation; obtain desktop and mobile visual acceptance before any production change.

## Operational constraint

StormTracker is a **situational-awareness viewer**. It is not an official BoM warning system and must not be presented as an emergency-management decision-making tool. Candidate classifications must visibly identify their source timestamp, unsupported/unavailable conditions and the experimental nature of the inference.
