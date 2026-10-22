# StormTracker V10.2.8 — AEP lookup performance production freeze

**Date:** 22 October 2026 (AEST)  
**Production:** https://blakesmith-intel.github.io/StormTracker/  
**Immutable tag:** `v10.2.8`  
**Recovery branch:** `restore/v10.2.8`  
**Underlying radar/cyclone baseline:** V10.2.0, unchanged.

## Accepted changes

- First, display all real BoM rainfall measurements of **50 mm or more** using their original station ID, precise coordinates, valid reporting period and source issue time. Previously verified IFD values in the same browser load immediately; the persistent shared catalogue refreshes separately.
- **Only official, verified, exact 0.025° station cells** may receive AEP classifications. Save successful on-demand official BoM IFD point responses across browser sessions in localStorage when available. Never guess from the nearest town or catchment.
- Prioritise qualifying missing locations by descending measured rainfall amount; immediately re-prioritise not-started work when the user changes rainfall periods. The in-browser request pipe is six concurrent lookups, increased from three.
- Preserve the bounded 22-second browser timeout and five-minute temporary error cooldown. Keep unknown/unverified sites visibly Unrated instead of silently fabricating a rarity.
- Coalesce Cesium redraws at a quarter-second interval rather than rebuilding every gauge on each returned lookup. The rainfall marker and attached label remain at the original location.
- Expand the existing hourly persistent BoM IFD catalogue collector from 30 to 48 bounded attempts, increasing its worker pool from four to six.
- The **24hrs to 9am** product continues comparing original BoM 24-hour totals against the matching 1,440-minute official IFD design rainfall thresholds, without reconstructing from hourly observations.

## Release gate and verification

The repository's frontend regression suite includes tests for exact-cell persistence, source-validation, matching 24-hour duration, graceful failure of browser storage, priority and coalesced redraws. The production Pages workflow checks served JS module contents, new version query identifiers, runtime controls and retained historical regression gates **before** it creates either the annotated `v10.2.8` tag or immutable `restore/v10.2.8` branch. Existing recovery refs must not be repointed.

This release does not claim a Bureau of Meteorology rate-limit allowance; if live HTTP 429/503 responses increase, lower concurrency based on actual source evidence rather than overwhelming public services.

**Change policy:** Freeze upon successful production deployment and published-source checks. Any later improvements must use a separate new version and recovery ref.
