# StormTracker V10.2.26 — final documentation and operator freeze

**Edition:** 27 October 2026, Queensland AEST.  
**Change type:** Documentation-only, no new weather-data ingestion, functional code, site controls, radar/science, incident map styling or refresh logic.  
**Production code preserved:** Verified V10.2.25 severe thunderstorm/severe weather polygons; all V10.2.24 previously accepted maintenance fixes; original immutable V10.2.0 native radar/3-D science.  
**Source of truth:** [operator guide](OPERATOR_GUIDE_CURRENT.md) · [development handover](DEVELOPMENT_HANDOVER_CURRENT.md) · [baseline](CURRENT_ACCEPTED_BASELINE.md) · [restore](BASELINE_RESTORE.md) · [wishlist](ACTIVE_WISHLIST.md).

## What is sealed

The production application retains the V10.2.25 feature release exactly:

- **Official BoM polygon overlay**: original source-supplied severe thunderstorm/severe weather polygons as opt-in Cesium imagery below the existing radar, never extrapolated from a BoM bulletin's descriptive area. Off by default.
- **Product identity**: `IDQ21035` detailed southeast Queensland thunderstorms and `IDQ21033` regional Queensland thunderstorm warnings are distinct filter options (plus All). BoM warning name, issue/expiry, description, safety advice and source link appear in the interactive polygon panel.
- **All affected disaster-management areas**: exact `esriSpatialRelIntersects` queries of genuine polygons against Queensland official LGA and disaster-district boundaries. Reports list every LDMG (identified by its LGA) and DDMG whose area intersects, regardless of how tiny the overlap is. No buffer, centroid, area-percentage threshold or assumed BoM district mapping.
- **Warning lifecycle**: automatic checking every **15 minutes** while enabled, immediate manual refresh, superseded issue replacement, source-confirmed cancellation and expiry removal, and independent states for active / verified empty / cancelled / geometry unavailable / source unavailable.
- **Other accepted layers untouched**: native high-resolution BoM radar, multiradar/Doppler, dBZ-based inferred 3-D, flood stage and crossing markers, rate observations, official BoM AEP/IFD significant rainfall, QLDTraffic roads and road-type report, Energex/Ergon outage polygons, QFD incidents and original page/mobile layout.

## Important truthful limitation

The public WMO-listed BoM CAP feed was reachable and returned authentic CAP messages in release checks, but **no genuinely active issue containing a verified severe-weather/thunderstorm original polygon was observed end-to-end during release testing**. Thus the genuine live warning shape and its corresponding council/disaster-district intersections remain to be demonstrated on a future actual issued product. The live UI must not suggest an absent polygon means all hazards are absent. A complete positive-source no-active check can legitimately show zero; incomplete, truncated or timeout-affected inputs must say unavailable. NSW source polygons are withheld until precise coverage-union clipping is verified. **Cyclone live forecast mapping is deferred until a real cyclone is present by operator choice.**

## Deployment acceptance and freeze requirements

- V10.2.25 functional release was successfully deployed to [GitHub Pages](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/40513984885) and [the single existing Cloudflare Worker](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/40513984589), both with success.
- The original release is sealed at `d9620f6cbc411bfee029d9fa9d170752aa7c34f2`, with an annotated `v10.2.25` tag and `restore/v10.2.25` branch resolving to that **same** SHA. Do not move them.
- The V10.2.26 documentation-only update must pass frontend/source and production-package validations, publish to the official Pages origin, and verify public warning UI, module code, published operator-guide link and the existing relay warning endpoint before sealing the **new** annotated `v10.2.26` tag and `restore/v10.2.26` branch at the same documentation commit.
- Historical annotated tags/restore branches remain immutable; Cloudflare Worker is deployed separately and **not** frozen or restored by a GitHub Pages tag.
- No further development/refinements are authorized by this documentation freeze. Future modifications require specific operator feedback, isolated QA and a new version.
