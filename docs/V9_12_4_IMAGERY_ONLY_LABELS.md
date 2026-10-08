# StormTracker V9.12.4 — Queensland imagery-only place names

## User-requested refinement

The OpenStreetMap Street basemap already has place names rasterised in the map tiles. A second StormTracker label layer made names overlap and could render duplicate towns during camera movements.

- **Street:** Never draw StormTracker's supplemental population-centre labels. The Cesium `LabelCollection.show` gate is disabled immediately on entering Street mode, and the layout budget returns zero even if another render is requested.
- **QLD imagery:** Continue to use WGS84-anchored Queensland population-centre labels with the tested screen-space collision detection, globe-horizon culling, sparse rural place priority, geographic footprint control and strict five-label phone budget.
- **Transitions:** Switching from imagery to Street immediately hides supplemental labels. Switching back to imagery restores the existing in-memory collection without another source fetch or a terrain/imagery reload. Road closures, power outages, radar/Doppler and river gauges are unaffected.
- **Browser cache:** Versioned entrypoint and module URLs advance to V9.12.4.

## Release gates

Full frontend regression and real mobile-width Chromium with StormTracker Street/QLD imagery, ArcGIS terrain, camera movement, both switch directions, and a hard zero-Street-label assertion must pass. The previously sealed V9.12.3 build remains available as a rollback.

## Scope of placement QA

This controls **only additional StormTracker labels**. Names already baked into OpenStreetMap Street raster tiles remain untouched, as requested.
