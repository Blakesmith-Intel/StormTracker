> **Status update 27 October 2026:** This is a historical 16 October planning reference, NOT the active implementation order. Operator explicitly deferred live cyclone forecast mapping until a real cyclone is present. Opt-in BoM severe thunderstorm and severe weather polygon overlay, `IDQ21035` and `IDQ21033` product filtering and the exact-intersection LDMG/DDMG report were shipped in V10.2.25; V10.2.26 freezes documentation without code changes. Live-source active-warning polygon verification remains outstanding. Use the [current wishlist](ACTIVE_WISHLIST.md), [V10.2.25 release notes](RELEASE_NOTES_V10.2.25.md) and [final handover](DEVELOPMENT_HANDOVER_CURRENT.md) for current truth. The following plan is retained as historical design evidence.

# StormTracker — Official Warning Geometry: Cyclones → Thunderstorms → V10

**Priority confirmed by operator on 16 October 2026.** These are NEW separate development milestones following the *sealed* V9.20.2 satellite/quality/performance baseline. Never include unfinished warning data in a stable release.

## 1. Tropical cyclone track map data (highest priority)

**Standard historical regression suite:** Use **TC Alfred 2025** (primary cross-border operational case), **Severe TC Narelle 2026** (high-volume three-category wind-area stress case), and **Severe TC Jasper 2023** (Far North Queensland coastal landfall). Retain **Koji 2026** as a fast small-source smoke check and **Yasi 2011** as reanalysed track-only/missing-warning coverage. Original issue counts and exact QA fixtures are documented in `docs/V10_REPRESENTATIVE_CYCLONE_REFERENCE_SUITE.md`. The user has delegated future cyclone test-case selection to this source-coverage standard.



**Implementation progress:** `frontend/src/official-cyclone-track-contract-v1.js` and `frontend/tests/run-official-cyclone-track-contract-v1-tests.mjs` provide a new *pure validation boundary* for decoded, authentic BoM cyclone GML geometry. They enforce official product identity, issue UTC, valid centre/line/uncertainty polygon types, source bulletin URL, forecast horizon, category 0–5 and stale/expired removal. The tests use clearly-labelled synthetic fixtures ONLY to verify the code; NO synthetic cyclone is ever rendered in the browser.

**Audited access/format evidence — 16 October 2026 (GitHub-hosted HTTP reachability, not legal authorization):**
- `https://api.weather.bom.gov.au/v1/warnings` responded 200 and a national list of 7 warning summary records, **with no GeoJSON/polygon fields in the summary**. However the publicly visible unofficial API documentation reproduces BoM's explicit **permission-required** use/copy/share notice. This endpoint is NOT approved as a StormTracker source. Removed it from the ongoing audit script. An HTTP 200 response is not reuse permission.
- Candidate anonymous public GML URL `https://www.bom.gov.au/fwo/IDQ65248.xml` returned **404**: no live GML sample or endpoint format has been validated there. It MUST NOT be treated as evidence that cyclone tracks don't exist (products issue seasonally and filenames vary).
- Public Queensland `EventsIncidents/CycloneActive/MapServer?f=pjson` returned an ArcGIS `error` document despite HTTP 200; this is not an operational public service. Public `EventsIncidents/CycloneHistorical/MapServer` returned actual ArcGIS JSON but is **historical only**.
- Source audit logs deliberately contained response status, content type and field-name metadata only, not active weather warning messages or private tokens. BoM GIS2Web documentation refers to Registered User credentials for the operational service; do not assume open browser rights.
**Result: No live cyclone track feed authorized, fully decoded and source-time validated yet. Feature overlay is not live and must not be promoted as complete.**

**Unresolved LIVE source dependency:** Public BoM CXML/GML product identifiers are documented but seasonal issuance means genuine current files may be absent outside cyclone events. Operational GIS2Web documentation also describes registered-user credentials, and the Queensland government's PUBLIC production service currently lists historical cyclones but not its UAT active-cyclone service. Do not use UAT or QFES/QDMA-restricted source as the real-time public product. Verify a public, lawful, reproducible actual GML source file, sample geometry CRS/schema and the deployment's anonymous relay transport before wiring any active overlay. The new contract is deliberately **not connected to live radar UI** until this source validation succeeds.

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

## Cyclone development UI consolidation (17 October 2026)

The operator requested **Memory diagnostics removed from the sidebar** and **Radar playback hidden/collapsible by default**, so StormTracker can accommodate a later Cyclone track layer without expanding or resurrecting the removed “More options” UI. The V10 development preview replaces the playback section with semantic closed `details#radarPlaybackDetails`; existing source-frame time, slider, load, play, speed and opacity controls retain their bound element IDs and live updates while collapsed. Toggling visibility does not control playback state. The former memory panel is no longer mounted; manual QA `window.__stormtrackerMemoryDiagnostics()` remains available in the research preview without background sampling. The accepted compact layers, QFD, incident controls and full-map Hide controls remain available, and short/phone viewports may still scroll as a safety fallback rather than clipping access. Do not claim exact no-scroll height without browser visual confirmation. Production V10.1.1 stays source-pinned until visual acceptance.

## Authentic original BoM cyclone issue decoded — 17 October 2026
The 20 November 2025 **TC Fina** original Darwin-issued GML `IDD65401.gml` and companion `IDD65441.xml` were retrieved via BoM's documented anonymous FTP **sample** directory and decoded *successfully* using a Python standard-library source-only tool, retaining exact BoM original coordinates. The GML genuinely contains a `forecast_track`, **10 forecast_fix** positions from 12–120h, and **two distinct** `tcForecastArea` polygons labelled `Likely Tracks Area` (72h = 422 vertices; 120h = 728 vertices), plus independent watch, warning and wind areas. GDA94 EPSG:4283 coordinate order is lon,lat. Fina is a real system (BoM historical report), with the GML issue UTC and companion CXML base time verified. See `docs/V10_GENUINE_CYCLONE_FINA_FORECAST_DECODER_20261017.md` for reproducible evidence. This resolves **authentic schema and sample** availability, not the live Queensland source distribution/copyright requirements: no public cyclone overlay/redistribution yet.

## Browser historical issued forecast map UI, development QA · 17 October 2026

See `docs/V10_HISTORICAL_CYCLONE_FORECAST_MAP_QA_20261017.md`. A small `Cyclone forecast · QA` Layers control opens a floating map panel, keeping the sidebar compact and all original radar controls intact. The original Fina (or another original BoM `*.gml`) file is selected **locally by the operator** and parsed with a browser-only, namespace/CRS/source role/issue-valid-time validated decoder. The Cesium data source plots genuine observed and forecast positions/tracks and the BoM's **72h and 120h Likely Tracks Area source polygons** as independently switchable overlays; no synthetic data, no BoM data redistribution, no polling or production warning claims. The map always labels a loaded file **ARCHIVED · NOT LIVE** even after the panel is hidden. Production V10.1.1 remains pinned.

## Queensland Jasper and Alfred reference overlays — 17 October 2026

Integrated both into the existing floating cyclone QA panel (not an expanded sidebar): quick-load authentic Queensland / BoM archive observations, original categories, observed positions and track, optional actual issue-specific wind footprints, with historical time selector. Reused existing `historical-cyclone-overlay-v1.js` / source snapshots and tightened to only the two chosen cases. Status and map provenance say **OBSERVED · NOT A FORECAST · NOT LIVE**. Original BoM GML importer remains the only pathway to *published 72h/120h forecast uncertainty*. Follow source distinction and retrieval result in `docs/V10_HISTORICAL_CYCLONE_FORECAST_MAP_QA_20261017.md`.


## Operator-identified current cyclone map / product-source mapping — 17 October 2026

The operator supplied BoM's official tropical cyclone page and identified `IDQ20023`. Verification against BoM's warning-products user guide v2.8 confirms `IDQ20023` is **Tropical Cyclone Advice 1 (QLD)** (text/XML), **not GML forecast geometry**. Match QLD Advice 1–3 (`IDQ20023`, `IDQ20026`, `IDQ20029`) to GML map 1–3 (`IDQ65248`, `IDQ65249`, `IDQ65250`), technical CXML (`IDQ65255`, `IDQ65256`, `IDQ65257`) and independent CAP advice threat areas (`IDQ24500`, `IDQ24510`, `IDQ24520`). Details, source links, additional NSW/NT products, rights/transport gate and QA cases: **[V10 cyclone live source mapping](V10_CYCLONE_LIVE_SOURCE_MAPPING_20261017.md)**. This is product-code mapping only; **no live fetch/polling/redistribution is enabled** and V10.1.1 production stays pinned.


## Private-use licensing and deployment clarification — 17 October 2026

The operator has clarified that StormTracker is **not intended to be publicly available** and that CC BY 4.0 applies to data they intend to use. Do not stall **private, non-commercial personal/within-organisation ingestion** on a public redistribution approval. BoM's current copyright terms expressly permit personal/within-organisation use of content unless more specific terms override: https://www.bom.gov.au/copyright ; the Anonymous FTP Service user guide confirms this for default warning products: https://www.bom.gov.au/catalogue/Bureau_of_Meteorology_Anonymous_FTP_Service_user_guide.pdf . Where the **particular dataset** is expressly CC BY 4.0, retain attribution and licence notice. The Creative Commons attribution on BoM's new tropical cyclone map webpage expressly describes **Geoscience Australia mapping data**; it does not itself prove QLD cyclone GML or advice is CC BY. Do not misstate all BoM cyclone data as CC BY.

**Private operation versus hosting:** GitHub Pages static previews may be accessible to unauthenticated visitors despite operator intent. Private-use cyclone data should not be packaged into public Pages bundles or cached in a publicly accessible relay. Validate private access controls or use user-local ingestion while implementing the automatic documented BoM FTP/product pipeline. BoM explicitly disallows unauthorised scraping of website content, so use documented feeds, not reverse-engineered site endpoints. This corrects the earlier unnecessary blanket public-redistribution gate. **Remaining actual technical blockers:** establish repeatable permitted live GML/CXML retrieval, a browser-compatible private transport path, issue-time/event matching, expiry handling and end-to-end QA. Nothing live is connected yet; preserve sealed production.
