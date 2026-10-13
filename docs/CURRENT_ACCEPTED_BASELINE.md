# Accepted StormTracker V9.18 diagnostic — 13 October 2026

**Functional acceptance:** user confirmed the browser performance, radar frame synchronisation, satellite persistence, secondary radar inferred volumes, and optional river-history backoff were working sufficiently to continue development.

| Reference | Commit | Purpose |
| --- | --- | --- |
| Sealed production V9.18.0 | `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd` | Public application root, unchanged |
| Accepted diagnostic | `acfa0ebd3717a793369e3e887e2d1a54785620b7` | Next development base, `/preview/radar-history-fix/` |
| Recovery branch | `restore/v9.18-accepted-diagnostic-20261013` | Immutable working recovery point |
| Pre-cleanup state | `archive/pre-cleanup-20261013` | Access to historic experiments and installers |

## Accepted behaviour

- Reliable mobile/desktop Cesium navigation and weather playback; no recurring deleted-texture errors observed in final acceptance logs.
- Primary and up to three additional BoM radar windows use the **same actual observed UTC** and a staged, atomic handover to prevent flashes or mixed-time imagery.
- Same regional satellite background and official QLD/NSW detail remain visible through camera movement.
- Empirical inferred 3-D for primary and additional non-overlapping radar footprints, >=40 dBZ, limited glyph budgets and stable Cesium collection reuse.
- Existing primary-only storm tracks, Doppler calibration constraints, selected +90-minute cone, labels and paused-frame trail toggle remain unchanged.
- River-history station tables are optional: failure is serialised and stops further requests for a 15-minute cooldown; BoM public bulletin classifications remain authoritative.

## Known non-blockers

- Microsoft Edge third-party storage/tracking warnings for Cesium assets served from unpkg.
- Cesium warns when an unsupported geometry outline is clamped to terrain. No confirmed functional impact.
- One genuine upstream BoM recent river station-history request may still return HTTP 502; later requests do not burst following rejection.

## Development and release rules

Create each new feature from the accepted diagnostic source. Never change either pinned accepted or production source SHA. Run all frontend and relay tests, publish a new isolated preview as needed, review native BoM source-time integrity and scientific claims, and obtain browser/mobile approval before production promotion.

Current V10 priorities: damaging/destructive straight-line winds and hook-echo/tornadic circulation candidates using historical Queensland storm cases. See `ACTIVE_WISHLIST.md`, `HANDOVER_V9.18.0.md` and `SCIENTIFIC_CONTRACT.md` for current architecture and constraints.
