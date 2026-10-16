# StormTracker historical cyclone overlay QA — Koji 2026 and Yasi 2011

**Environment:** `/preview/incremental-3d/live3d-operational-v9.html` ONLY. Production is pinned/sealed as `v9.20.2`; these archived tracks cannot appear in normal live operation.

## Historical cases and sources

| QA scenario | Source | Authentic geometry | Limitations |
| --- | --- | --- | --- |
| **TC Koji (January 2026)** | Queensland Government [CycloneHistorical/MapServer](https://spatial-gis.information.qld.gov.au/arcgis/rest/services/EventsIncidents/CycloneHistorical/MapServer) layers 26011 (Fix), 26012 (Track), 26013 (Wind areas), attributed to Bureau of Meteorology | Seven archived observed fix points, one exact archived observed track line, nine ORIGINAL archived issued wind polygons across six issue UTCs | Selected archived wind products are **incomplete** per service metadata; cyclone wind areas are not BoM severe-thunderstorm warning polygons. More than one cyclone named Koji appears in BoM history; explicit ID `AU202526_12U` prevents accidentally using Koji 2012. |
| **Severe TC Yasi (January–February 2011)** | Official BoM [Australian Tropical Cyclone Database](https://www.bom.gov.au/cyclone/tropical-cyclone-knowledge-centre/databases/) `IDCKMSTM0S.csv` | Fourteen original reanalysed cyclone centre coordinates/times and central pressures, source ID `AU201011_14U`; line connecting those recorded centres | Connected line is a historical visual join (not an archived forecast line). NO verified historical Yasi cyclone wind/warning polygons in this source; viewer displays none, never draws synthetic radii. |

**Historical source provenance:** `frontend/data/cyclone-history/koji-2026.json` and `yasi-2011.json` are generated from the two public source endpoints by `scripts/build-historical-koji-yasi-snapshots.mjs`. The build script uses exact source disturbance IDs, verifies Koji attribute identity and polygon GeoJSON types, retains **every original polygon vertex and ring**, and sorts true original observation/issue UTCs. The Koji wind-area time subset covers the six actual issue times in the public snapshot; no wind polygons are invented or modified.

**Visible distinctions:** A large, persistent historical-only warning appears in the sidebar. The track is a complete archived observation/reanalysis track, not a live or previously forecast trajectory. Only fix points through the selected archived time are displayed. Wind polygons appear ONLY on their EXACT archived issue UTC (no assumed persistence, extension or expiration). Optional wind polygon switch defaults on but disables for Yasi because no official polygons are present.

## How to visually test

1. Open the isolated <https://blakesmith-intel.github.io/StormTracker/preview/incremental-3d/live3d-operational-v9.html>.
2. Expand **Historical cyclones — QA only**, choose **TC Koji (Jan 2026)**, and tick **Display authentic archived track**. The genuine track and fixes will appear; click **Focus cyclone** to frame the source path.
3. Use the **Archived observation / issue time** slider to step through actual archived times. At times corresponding to an archived wind-area issue, original cyclone damaging/destructive wind polygons appear in translucent colour and disappear at other times. No interpolation.
4. Select **Severe TC Yasi (2011)** and leave the source track enabled. Click **Focus cyclone**; step through the 14 BoM fixes. Recorded central pressures remain inspectable through individual fix entity popups. The wind checkbox disables and NO Yasi warning polygon is generated.
5. Disable historical track. Confirm all source tracks, points and wind polygons are removed, no entities remain, radar imagery/3-D remains visible, and the live radar timeline/source UTC and memory diagnostics are not modified.
6. Validate full-screen and narrow-window layout and camera pan/zoom. The historical layer does no per-frame radar work or background network polling.

## Preparing the severe-thunderstorm warning blob layer

The actual polygon renderer `nestedHistoricalPolygonPositions` correctly handles GeoJSON polygon and MultiPolygon full source-ring geometry, including holes, with no boundary simplification. The next feature will reuse the same spatial drawing technique but MUST take **official BoM severe-thunderstorm warning** geometry from an authorized, accessible source and:
- maintain distinct regional vs detailed warning products, issue/expiry UTC, hazard classes and official bulletin links;
- show all QLD source warnings and only NSW warning areas intersecting genuine installed radar coverage;
- remove expired warnings, avoid stale caching, and show source unavailability without inventing warnings;
- never mislabel historical cyclone wind footprints as severe thunderstorm warning blobs or as current BoM warnings.

## Quality and release controls

Native BoM 2-D/Doppler source resolution and all primary/supplemental 3-D detail remains untouched; archived QA geometry is a separate switchable Cesium entity collection. Production `v9.20.2` is still immutable. Full npm test, static asset checks and visual confirmation are required before accepting new features. Historical QA can be installed in a preview without enabling any live cyclone warnings. Do not promote the actual live feature until real GML/CXML data and usage rights are validated.

**Attribution:** Queensland Government historical cyclone GIS (BoM source) and Bureau of Meteorology Australian Tropical Cyclone Database.
