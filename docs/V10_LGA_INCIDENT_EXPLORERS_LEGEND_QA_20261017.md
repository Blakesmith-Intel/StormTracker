# V10 QA — LGA incident explorers, responsive sidebar and always-visible weather legend

## Scope and source ownership (17 Oct 2026)
Cyclones remain paused. Production root remains frozen at `v9.20.2` (`b8be458acbae942a3bb0b530a5c17618b6d03134`). This change updates only mutable QA preview source.

1. **Power outages**: existing filtered unplanned Energex/Ergon and Queensland-filtered Essential Energy layer supplies incident data. Existing map polygon picking/interactivity is unmodified. New hierarchy: **LGA → locality/suburb → incident**, incident tap to map. Shared multi-suburb events are listed under each relevant suburb but counted once within a council, without implying that customers belong to individual suburbs.
2. **LGA attribution for outages**: use Queensland Government's published 2026 *AdministrativeBoundaries/MapServer/2* Locality field `locality` and official parent field `lga` (URL in `incident-lga-model-v1.js`). Fetch only locality attributes in small query batches. Missing/ambiguous/cross-service failures are explicitly `LGA not verified`, never assigned from an inferred mapping. No secondary outage source.
3. **Road closures**: existing *unplanned all-traffic* QLDTraffic feed provides `road_summary.local_government_area` and `road_summary.locality`, so hierarchy is **LGA → locality → published closure** without a separate geocoder. Each road entry navigates the map to the existing published marker coordinate, with optional Details and official QLDTraffic source. Existing map closure selection/markers untouched.
4. **Responsive sidebar**: StormTracker heading occupies its own row. Outages, Roads, More options are an independent 3-column shortcut row with no overlap. Basic radar controls unchanged; Advanced remains scrollable. Existing map selector/pitch/zoom and measuring controls remain the same.
5. **Legend**: the original `legendDock` with original BoM reflectivity dBZ scale and original runtime BoM velocity RGB scale now resides inside mapPanel, pinned bottom-right for **all** simple/advanced/mobile/desktop views. Selection `doppler-available` switches to velocity in km/h; any rain window displays measured reflectivity dBZ. No colour palette conversions or synthesized Doppler. In the absence of a valid Doppler palette, the original unavailable text remains visible rather than fabricated colours.

## Visual acceptance and regression
- [ ] Mobile (iPhone): opening/closing Outages and Roads remains in viewport; no clipped header, scroll independent of Cesium.
- [ ] Desktop at 1280×720 or smaller: logo separated from shortcuts, map and controls not overlapping.
- [ ] Search council name, suburb, street and incident for both explorers; expandable details; tap event flies to actual published marker/geometry; map remains normal afterwards.
- [ ] Road closure polygon/marker click opens unchanged original information panel; power outage polygons remain unchanged.
- [ ] Original reflectivity legend always visible when Rain is selected. Doppler selected shows authentic velocity swatches in km/h and switches back instantly on Rain selection. Verify on actual BoM products.
- [ ] Missing locality lookup shows explicit unverified category; live feed expiry never falsely reports stale incidents as current.
- [ ] Complete frontend regression, worker syntax check, pinned production QA build dry-run, operator approval before any production promotion.

## Official Queensland LGA data
Queensland Government 2026 *Administrative Boundaries* service: https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Boundaries/AdministrativeBoundaries/MapServer/2

User experience remains situational awareness only, not an authoritative incident dispatch/decision product.
