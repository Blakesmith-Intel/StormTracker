# StormTracker — V9.18.0 production / accepted V9.18 diagnostic

StormTracker is a **browser-only, Queensland and southern-border weather situational-awareness viewer**. It is not an official warning service or an emergency-management decision-making system. BoM reflectivity is retained in **dBZ**; Doppler radial velocity is not storm movement speed; inferred 3-D volumes are modelled visualisations, not observed radar echo-top measurements.

## The two supported browser builds

| Build | URL | Immutable source |
| --- | --- | --- |
| Sealed production V9.18.0 | https://blakesmith-intel.github.io/StormTracker/ | `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd` |
| **User-accepted diagnostic V9.18** (future development base) | https://blakesmith-intel.github.io/StormTracker/preview/radar-history-fix/ | `acfa0ebd3717a793369e3e887e2d1a54785620b7` |

The accepted recovery branch is `restore/v9.18-accepted-diagnostic-20261013`. Production stays sealed until an explicit release decision. The archived pre-cleanup repository state is `archive/pre-cleanup-20261013`. Build sources are pinned; neither is derived implicitly from `main`.

## Current accepted diagnostic behaviour

- National BoM WMTS reflectivity display: Queensland sites and Brewarrina, Moree and Grafton (22 radar coverage windows), with one primary and at most three supplementary sites.
- Genuine BoM reflectivity frames synchronised to a primary observed UTC; decoded supplementary radar imagery transitions atomically and cannot fabricate intermediate frames.
- Inferred 3-D for the primary **and selected supplementary radar footprints**, using the existing profile model, same BoM dBZ palette, ≥40 dBZ threshold, 1.0× baseline vertical exaggeration and bounded Cesium primitives.
- Original supported Doppler history, primary-only storm tracking, labels and optional +90-minute motion cones.
- Retained regional DEA satellite under official Queensland / NSW detail, three-dimensional terrain and same-origin geographic place names.
- Queensland traffic closures, current unplanned outages, exception-only BoM flood signals and QFD incident context; upstream failures do not fabricate events or block the radar viewer.
- Browser-responsive navigation with the accepted Cesium hover-pick and GPU-resource guards.

Known **non-blocking** console messages at acceptance: Edge third-party CDN storage prevention; unsupported clamped terrain outlines; isolated optional BoM river station-history HTTP 502 subject to serial fallback/cooldown.

## Repository structure

- `frontend/` — operational browser source, official data model, scientific research fixtures and regression tests.
- `relay/` — the existing Cloudflare CORS/transport Worker (never meteorological modelling).
- `scripts/` — scientific validation, source auditing, NSW same-origin place-name builder and frontend regression runner.
- `docs/` — current release/user guide, scientific contract, accepted handover, rollback procedure and V10 priorities.
- `.github/workflows/pages.yml` — only the pinned production and accepted QA preview are published.
- `.github/workflows/deploy-relay.yml` — **manual only** Worker deployment after full tests.
- `.github/workflows/review-validation.yml` and `validate-feature-branches.yml` — browser and relay regression gates.

Run `npm test` to validate the frontend and `node --check relay/worker.js` to validate the relay. GitHub Pages requires no separate local server.

## Release discipline

1. Work on a new feature/fix branch based on the **accepted diagnostic source**. Do not edit an accepted recovery ref or existing tag.
2. Run all regressions; publish to an isolated preview and obtain a real browser/mobile functional pass before promotion.
3. Pin the accepted source SHA in the Pages workflow, verify `BUILD.txt`, and keep an immutable restore ref.
4. Never replace genuine BoM source observations with extrapolated frames or other fabricated weather data.
5. V10 wind/hook-echo threat candidates remain experimental until validated; see `docs/ACTIVE_WISHLIST.md`.

The previous experimental installers, version-specific preview deployments and historical release notes remain recoverable through Git history and the protected pre-cleanup branch, rather than cluttering the current working tree and Pages deployment.
