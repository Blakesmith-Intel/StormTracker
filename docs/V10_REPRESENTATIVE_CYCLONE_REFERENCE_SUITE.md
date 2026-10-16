# StormTracker V10 — Selected Cyclone Reference Cases (16 October 2026)

## Decision

**No more user-selected cyclone names are required for V10 development.** Choose actual publicly available source coverage and operational behaviours, not storm notoriety. Three cases comprise the primary reference suite, with two legacy tests:

| Priority / purpose | Cyclone | Genuine historical fixes / original track segments | Archived wind footprint coverage in public Queensland GIS | QA polygon subset | Scenarios proven |
| --- | --- | --- | --- | --- | --- |
| **P1 — standard / cross-border** | **Severe TC Alfred (2025)** | 24 / 2 | 158 original source wind features, **83 issued times**, damaging / destructive / very destructive | 16 original full-vertex polygons sampled from 8 genuine issue UTCs | Long-lived slow/erratic motion, sharp track changes, offshore→Moreton Bay, SE Queensland and northern NSW, multiple alert updates and degrading intensity |
| **P2 — severe / high-volume** | **Severe TC Narelle (2026)** | 21 / 1 in the Queensland *partial archive* | 244 wind features, 26 issue times, all 3 original wind severity bands | 67 original polygons sampled from 7 issue UTCs | Category 5 intensity, rapid intensification, Queensland landfall and later interstate movement; source complexity, large wind footprints, multi-time, map zoom and polygon GPU lifecycle |
| **P3 — northern coast** | **Severe TC Jasper (2023)** | 21 / 1 | 39 wind features, 28 issue times; damaging/destructive | 11 original polygons sampled from 8 genuine issue UTCs | Coral Sea intensity escalation/de-escalation, Far North Queensland coast crossing, Cape York decay; remote radar/map context |
| **P4 — quick smoke check** | **TC Koji (2026)** | 7 observed / 1 | 9 archived wind features, 6 issued times | All 9 original wind polygons | Small, fast-loading fixture for regression, QA control and timeline testing |
| **P5 — legacy historical intensity check** | **Severe TC Yasi (2011)** | 14 BoM reanalysed best-track fixes, linked in source order | **No verified archived wind-area product in that source** | No polygons; none may be synthesised | Historical high-intensity track/pressure plotting, missing-polygon fallbacks |

**Public archive:** [Queensland Government CycloneHistorical MapServer](https://spatial-gis.information.qld.gov.au/arcgis/rest/services/EventsIncidents/CycloneHistorical/MapServer), original Bureau of Meteorology-sourced features and attribution. Alfred layers 25011–25013, Narelle 26021–26023, Jasper 23011–23013, Koji 26011–26013. Database: [BoM Australian Tropical Cyclone Database](https://www.bom.gov.au/cyclone/tropical-cyclone-knowledge-centre/databases/) for Yasi. Authoritative source summaries: [Alfred](https://www.bom.gov.au/cyclone/history/Alfred2025.shtml), [Narelle](https://www.bom.gov.au/cyclone/history/Narelle2026.shtml), [Jasper](https://www.bom.gov.au/cyclone/history/jasper23.shtml).

## Why Alfred and Narelle are the most valuable

**Alfred** most closely represents StormTracker's immediate operational geography. BoM confirms long, slow/erratic motion and a changing storm with material consequences in the exact SE Queensland / northern NSW radar footprint. Its 83 archived wind issue times make it the best update/timestamp replay test, and the 158 genuine polygons cover three severity bands.

**Narelle** is the opposite stress case: a powerful cyclone, significant changes in intensity and multiple landfalls across northern Australia. With 244 genuine wind geometries over 26 issue times, it best exercises GPU geometry disposal, polygon fill/z-order, class colours and all-viewport rendering. The Queensland GIS archive is **partial**: it ends near 25 March while BoM reports Narelle continued to Western Australia through 28 March. Never claim it is a complete national best-track file, even if we display its full Queensland archive.

**Jasper** covers cyclone behaviour far from the SE Queensland corridor, including far-north Queensland coastline crossing, severe-to-weaker classification and later inland remnant. It is the third verification gate before claiming an Australian-ready cyclone overlay.

Koji and Yasi remain, but neither should be used as our only proof of live product equivalence.

## Actual offline source audit (no guessed values)

Run `scripts/audit-cyclone-case-coverage-20261016.mjs` to inspect original public ArcGIS feature counts, time-field diversity, source severity types and observed-vs-current fix/track roles without downloading their geometries. `scripts/build-representative-cyclone-archives.mjs` obtains original ArcGIS GeoJSON with `outSR=4326`, retains every original coordinate/ring, includes all source-observed fixes and tracks, and selects a compact, **explicitly incomplete** set of actual issue times for browser QA. The source counts in the table were obtained on 16 October 2026.

Test assets (development preview only):
- `frontend/data/cyclone-history/alfred-2025.json`
- `frontend/data/cyclone-history/narelle-2026.json`
- `frontend/data/cyclone-history/jasper-2023.json`
- existing `koji-2026.json` and `yasi-2011.json`

The historical QA panel defaults to Alfred with explicit main/stress/northern/smoke/legacy options. Historical wind polygons only appear at their **original archived issue UTC**; their `fix_time` and `fcast_time` are retained as source fields separately and never relabelled as a verified official forecast cone. All layers are off until chosen, are deleted when disabled, never poll as live weather, and display NOT LIVE / NOT A WARNING.

## Development acceptance gates — live-readiness

1. **Position fixes and observed path:** test source geometry and true source UTC for all three primary historical cases. Best-track paths and GIS archived tracks are **observed retrospective geometry**, never the predicted track at a past issuance.
2. **Intensities:** source category 0–5, type transitions, missing fields, changes and authentic recorded central pressure when available. Do not estimate missing source categories.
3. **Issued wind fields:** retain all source vertices, polygons, holes, damaging / destructive / very destructive colours, and separate issued and valid timestamps. Avoid stale fields displayed outside their original archived issuance.
4. **Actual forecast track and uncertainty:** **NOT YET VERIFIED.** Need a genuine publicly usable and permitted BoM GML/CXML forecast product with its original forecast fixes/track/uncertainty polygons before showing any cones or claiming forecast replay parity. Archived wind areas may be future-valid but are *not* an official track-position uncertainty envelope.
5. **Operational ingest:** live weather source no-data, changed issuance, updated geometry, cancellation of in-flight obsolete fetch, removal of expired products, bounded polling/cache and attribution. All need end-to-end source tests.
6. **Severity blob distinction:** archived cyclone wind footprints are NOT severe-thunderstorm warning polygons; those require a separate genuine BoM source, product type and expiry fields for Queensland and strictly radar-clipped northern NSW.
7. **Fidelity and stability:** no reductions of original BoM radar/Doppler pixel resolution, source UTC, secondary 3-D footprint, 40 dBZ threshold, or polygon vertex detail to hit an FPS number. Source geometry/polylines must remain terrain-compatible and not create unlimited Cesium entity churn.
8. **Release discipline:** these cases are for `/preview/incremental-3d/` only. Current sealed V9.20.2 remains unchanged. Require full CI plus operator visual acceptance before promoting any official live warning/cyclone feature.

This matrix is the standard cyclone regression suite going forward. Select additional cases only where they contribute a demonstrably missing product format or scenario—not because another dramatic storm exists.
