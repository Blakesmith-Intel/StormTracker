# StormTracker — Official Warning Geometry: Cyclones → Thunderstorms → V10

**Priority confirmed by operator on 16 October 2026.** These are NEW separate development milestones following the *sealed* V9.20.2 satellite/quality/performance baseline. Never include unfinished warning data in a stable release.

## 1. Tropical cyclone track map data (highest priority)

**Target:** Live BoM forecast track map with exact centre observations and forecast fixes, issued-time metadata, uncertainty/possible-centre-movement envelope, category and cyclone name, official Watch/Warning zones if those particular source geometries are supplied. Historical tracks can be a separate later toggle; **do not confuse historical QLD CycloneHistorical with live warning forecasts.** StormTracker is situational awareness, not a BoM warnings replacement.

Confirmed public references:
- BoM Tropical Cyclone Forecast Track Maps and official CXML and GML spatial products, including `IDQ65248`, `IDQ65249`, `IDQ65250` (Queensland regional tracks) and NSW product `IDQ65252`. BoM product guide: https://www.bom.gov.au/catalogue/Bureau_of_Meteorology_warning_products_user_guide.pdf
- BoM warnings/services: https://www.bom.gov.au/resources/learn-and-explore/tropical-cyclone-knowledge-centre/tropical-cyclone-warning-services
- Queensland government's publicly listed active-cyclone ArcGIS service `EventsIncidents/CycloneActive/MapServer` advertises track, fixes and wind areas sourced from BoM; verify its public stable (NOT UAT) endpoint, each sublayer schema, validity and access policy, and live refresh cadence. Metadata: https://uat-spatial-gis.information.qld.gov.au/arcgis/rest/services/EventsIncidents/CycloneActive/MapServer/info/iteminfo

**Gate:** Retrieve at least one authentic issued live or historical official product (never a mocked active storm), verify geometry CRS and feature types, coordinate order, timestamps, latest bulletin, expiry, name/category, official advisory URL, and status when NONE is active. Prefer an officially available geospatial URL over scraping rendered map tiles. Test no-CORS restrictions and current-season products before committing a live map. If source access unavailable, explicitly display unavailable and link official BoM; do NOT fabricate track or uncertainty polygons.

## 2. BoM severe thunderstorm warning areas (Queensland plus radar-covered NSW only)

These are **official warnings** separate from StormTracker algorithmic tracks. The BoM issues (a) **regional polygons** reflecting broad areas at risk for ~3 h and (b) **detailed** capital-city ellipse/forecast-area graphics where issued. Only show geometry provided by the official warning product, not a buffer drawn around tracked cells.

Official references:
- BoM documentation: https://www.bom.gov.au/resources/learn-and-explore/severe-weather-knowledge-centre/severe-weather-and-coastal-hazard-warning-services
- BoM warnings user guide confirms GIS2Web WMS/WFS includes severe thunderstorm warning layers: https://www.bom.gov.au/catalogue/Bureau_of_Meteorology_warning_products_user_guide.pdf

**Area:** All Queensland warnings regardless of primary radar. NSW warning features must spatially intersect coverage for the currently supported border sites (Brewarrina, Moree, Grafton, and any other QLD radar coverage extending south). Clip NSW geometry strictly to the geographical coverage union computed from the selected installed radar ranges; do not simply show all NSW state warning polygons when outside radar coverage. Keep original warning identification/geometry metadata intact and clearly identify clipped presentation.

**Gate:** Confirm *public*, lawful, reproducible GIS2Web WFS URL and actual namespace, layer ID, geometry, CRS, current issue/valid/expiry fields, unique key and official bulletin URL. A third-party ArcGIS layer labelled for emergency services or lacking access permission cannot be silently used. Never display expired warnings, cached old warnings as current, or a synthetic envelope. Distinct layer toggles and colour/legend; one visible feature per real warning. Poll conservatively, cancel stale fetches, prefer CORS-safe existing transport-only relay if needed.

## 3. V10: genuine radial wind and circulation R&D

After cyclone and warning overlays pass browser/preview tests, return to the authentic BoM AURA multi-sweep Doppler radial-velocity investigation. Test Gold Coast 2023 Christmas derecho and Gympie/Cooloola November 2025 events; require consecutive true HDF5 sweeps, correct de-aliasing, calibration and reproducible detections before any live tornado/possible-hook/straight-line damaging wind indicators. Yellow = damaging straight line, orange = hook candidate, red tornado/circulation candidate; these remain algorithmic and MUST NOT mimic BoM official warning polygons.

## Cross-feature guards

- Do not modify original full-resolution BoM 2-D reflectivity/Doppler or intensity dBZ, inferred 3-D structure/40 dBZ threshold, site count or authentic UTC.
- Source time, authoritative product link, lack-of-data/error indicators and a clean no-active-product map are compulsory.
- Scene overlays must be capped to actually-active geometry and deleted on disable/expiry/radar-site coverage changes without leaking Cesium primitives or triggering per-frame API work.
- All three milestones are browser-only on GitHub Pages (transport-only proxy allowed), start on isolated branches, pass full CI and require explicit visual acceptance before another source-pin/tag production promotion.
