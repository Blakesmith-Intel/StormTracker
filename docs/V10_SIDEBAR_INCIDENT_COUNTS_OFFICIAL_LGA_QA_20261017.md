# StormTracker V10 QA: stacked live incident counters and LGA boundary fallback
Date: 17 October 2026. Cyclones remain paused. Immutable production V9.20.2 remains unmodified.

## Operator request
- Stack **Power outages** and **Road closures** as full-width buttons in the left sidebar, instead of narrow horizontal chips; keep More options accessible without overlap.
- Show on **Power outages** the number of unique unplanned outage events and the sum of their provider-reported affected customers.
- Show on **Road closures** the number of distinct unplanned all-traffic closures. QLDTraffic does not provide impacted electricity customers; the road button does not invent that field.
- All counts derive from existing live map-layer `onUpdate(features)` events (no extra fetching or artificial fixtures in production). Deduplicate provider-qualified outage IDs across multiple suburbs; deduplicate road closure IDs across localities; expiry changes counters to Unavailable rather than implying zero.
- Retain original power outage polygons, closure markers, their info panels and managed map navigation.

## Comparison with Ergon Energy text outage finder
Source: https://www.ergon.com.au/network/outages/outage-finder/outage-finder-text-view

Ergon publishes council headings for outage events; this is a useful independent QA reference, and proves an event affecting many suburbs can be displayed as one outage:
- Event 26FN10147 (Boobah Creek, Boogan, Goondi, Japoonvale, etc) was listed under **Cassowary Coast Regional Council**.
- Event 26NQ12505 (Cloncurry and Kajabbi) under **Cloncurry Shire Council**.
- Giru event 26NQ12522 under **Burdekin Shire Council**.

Counts and incidents can change every 15 minutes. This reference is used for source comparison, not scraped as an untested browser feed. Do not mix planned incidents from Ergon's text view into StormTracker's unplanned-only totals.

## Improved authoritative LGA resolver
1. Primary: Queensland Government official AdministrativeBoundaries locality layer 2 query using `UPPER(locality)` to match the mixed-case government records.
2. Fallback: for locality entries missing or ambiguous in layer 2, query Queensland Government's *Local government* polygon layer **1** using the existing published outage geographic location (`geometryType=esriGeometryPoint`, `inSR=4326`, `spatialRel=esriSpatialRelIntersects`, `outFields=lga`, no geometry downloaded).
3. For shared multi-suburb incidents, a single outage centroid cannot prove the LGA for each suburb. Only accept the geographic fallback if other localities in the SAME event already independently resolve to the same council and the spatial LGA matches it. A multi-suburb event with no verified locality remains *LGA not verified* to prevent false certainty.
4. For an event with one named suburb, its own published mapped location can validate its council. If spatial polygon contains no match, has multiple matches, or the service fails, retain *LGA not verified*.
5. Limited to three concurrent spatial requests with per-lookup cache; no new weather frames or Cesium entities; missing information never synthesized. Errors are non-fatal to existing outage data. Missing attributes beyond the official 38-character locality field are eligible for geographic fallback.

## Real-source diagnostic
One-off GitHub Actions test with Origin `https://blakesmith-intel.github.io` returned **HTTP 200, CORS permitted**, and official LGA polygon matches for:
- Gold Coast → Gold Coast City
- Giru → Burdekin Shire
- Cloncurry → Cloncurry Shire
- Boogan → Cassowary Coast Regional

Reproduce in a network-capable Node environment with `node scripts/probe-outage-spatial-lga.mjs`. The temporary network-dependent CI step has been removed after successful verification.

## QA gates
- [ ] iPhone and desktop vertical buttons fully visible/scrollable, customer totals legible and no header overlap.
- [ ] Compare button counts to header/status and unique event IDs; multi-suburb outage counted once; no false customers totals.
- [ ] Verify an unplanned 0-event snapshot yields 0, an expired snapshot reads Unavailable.
- [ ] On sample current Ergon incidents, confirm valid LGAs using primary locality lookup and spatial fallback; unresolved data explicitly declared.
- [ ] Confirm suburb and incident link-to-map, road closure click panels, power polygon interactivity and map focus unaffected.
- [ ] Original rain and Doppler legends/pan/zoom remain stable.
- [ ] Full npm regression, PR review CI and dry-run published package pass before merging to development.
- [ ] Obtain operator screenshot acceptance before any production promotion.
