# StormTracker V10.2.32 — four BoM warning product menu options (30 October 2026)

## Operator-facing change
The existing **Layers → BoM severe warnings → Warning product** dropdown now individually exposes:
- **All warnings**
- **IDQ21035 — Detailed SEQ storms** (official BoM detailed severe-thunderstorm product; original `IDQ65650` threat area)
- **IDQ21033 — Regional QLD storms** (regional severe-thunderstorm product; original `IDQ65654` area)
- **IDQ21037 — Severe Weather 1** (first separate Queensland severe-weather product; original `IDQ65272` area)
- **IDQ21038 — Severe Weather 2** (second independent Queensland severe-weather product; original `IDQ65277` area)

Warnings 1 and 2 are independent product identifiers, **not severity rankings**. Each selection isolates only its own original issued polygons, shows its own **No current warnings** when its absence is confirmed by the current Queensland BoM index, and retains explicit distinction between a source outage and a verified all-clear.

The existing **LDMG/DDMG report** now presents one section **per product even with zero polygons**, rather than combining IDQ21037/38 under “Other” and hiding their verified clear states. **All warnings** continues to show all genuine active geometries.

## Cadence and safeguards
- **Shared refresh:** every **15 minutes while the warning layer is enabled**, existing ↻ manual refresh immediately available. No additional polling per menu choice.
- **Confirmed clear:** normal informational **No current warnings** for that IDQ number; no red error, placeholder geometry or stale polygon.
- **Current but original shape unavailable:** authentic current warning with spatial-publication delay remains **current / awaiting polygon**.
- **Source unavailable:** cannot be labelled an all-clear.
- Original latest-issue matching, cancellation, expiry, boundary accuracy and report intersection rules unchanged.
- Camera-guardian Locate, polygon tap report, radar/Doppler/3-D, rainfall IFD/AEP, flood gauges, outage and road layers entirely unaffected.

## Release acceptance
Full frontend regression suite including `frontend/tests/run-bom-four-product-warning-menu-v1-tests.mjs`; exact pinned production package and review checks; public Pages verification of four menu options, fresh warning-module cache and product-specific reporting. Previous sealed tags, particularly `v10.2.31`, stay unchanged. Release can be tagged `v10.2.32` and a new recovery branch created only after verified deployment.
