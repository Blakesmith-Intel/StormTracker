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

## 14 October 2026 source-validation implementation

Source inspection found the existing `bom-doppler-decoder-v1.js` reads a **19-swatch, -70 to +70 km/h colour-image palette**. This does not provide independently verified radial measurements above ±70 km/h, even though actual radar hardware may have a higher Nyquist velocity. A wind-warning threshold cannot be inferred by extending that scale.

New isolated, fail-closed research modules:

- `frontend/src/doppler-source-validation-v10.js`: verifies allowed radar site, source observation timestamp, optional freshness, geographic/sign/aliasing verification flags and whether claimed range exceeds the colour image's measurable palette. Detectability of >=90 and >=125 km/h radial thresholds is separately reported. A favourable verification flag is **not** a claim that the current upstream feed has been calibrated.
- `frontend/src/circulation-candidates-v10.js`: research-only spatially coherent inbound/outbound radial-velocity couplets, supported **only** for separately validated quantitative velocity sources. It does not diagnose rotation, identify tornadoes or show alerts.
- `frontend/tests/run-doppler-v10-validation-tests.mjs`: negative/positive test vectors, source mismatch, stale timestamps, unsupported radars, aliasing status, palette range and required sample clusters. Automatically included by existing npm-test discovery.

**Live integration is intentionally withheld:** the current public BoM image cannot satisfy the quantitative-source gate and does not establish reliable high-wind or rotation thresholds. Before a browser detection preview, obtain and verify a lawful machine-readable quantitative Doppler velocity source including scan origin, azimuth/elevation, Nyquist/dealiasing, geographic registration, provenance and coverage by radar site. Correlate against historical measured observations. No fake high-speed measurements or automated destructive/tornado warnings.

Authoritative background: https://www.bom.gov.au/resources/learn-and-explore/radar-and-equipment-knowledge-centre/weather-radars and https://www.bom.gov.au/resources/learn-and-explore/severe-weather-knowledge-centre/severe-weather-and-coastal-hazard-warning-services .
