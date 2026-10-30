# StormTracker V10.2.34 — Situational Awareness Data disclosure (30 October 2026)

## Requested change
Make the existing top-level **Situational Awareness Data** section **collapsible**, matching the already approved **Severe Weather** Show/Hide disclosure.

## Production behaviour
- The existing Situational Awareness Data card is now a native `<details id="situationalAwarenessDetails">` with **Show/Hide** heading and closed-by-default state.
- It continues to contain the exact same **Basemap**, **Significant rainfall / AEP**, **Unplanned road closures**, **Unplanned power outages** and **QFD rescue & assistance** controls, legends, reporting links and refresh options.
- **All existing input IDs and direct-child CSS structure remain unchanged**, so no event handlers, enabled/disabled choices or saved layer state are modified. Hiding a section does **not** switch off any layer.
- **Severe Weather** and its flood/BoM/cyclone controls remain independently collapsible and unchanged.
- The deployed production website uses the existing pinned build script and adds a minimal updated sidebar CSS override and browser cache suffix. No new service, meteorological calculation, polling, or map-science change.

## Verification and rollback
- Full frontend regression and a focused original-control structure regression.
- Exact pinned production build and independent review checks.
- Public Pages plus browser-mobile testing of two independent disclosures, off-by-default layer states and non-destructive collapse.
- Update operator guide and technical baseline.
- After successful publication only, seal **new** annotated `v10.2.34` and `restore/v10.2.34`. The frozen `v10.2.33` and all earlier tags stay unchanged.
