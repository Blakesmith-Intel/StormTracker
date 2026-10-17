# StormTracker — Queensland live cyclone source mapping (17 October 2026)

**Status: source catalogue verified; end-to-end live ingestion NOT VERIFIED or deployed.** Development reference only. Sealed V10.1.1 production remains untouched.

## Public official operator reference
- BoM tropical cyclone landing/map/warning page: https://www.bom.gov.au/weather-and-climate/specialised-forecasts-and-observations/tropical-cyclone
- BoM warnings summary: https://www.bom.gov.au/weather-and-climate/warnings-and-alerts
- Warning products user guide, v2.8, 30 July 2026: https://www.bom.gov.au/catalogue/Bureau_of_Meteorology_warning_products_user_guide.pdf
- BoM tropical cyclone warning services: https://www.bom.gov.au/resources/learn-and-explore/tropical-cyclone-knowledge-centre/tropical-cyclone-warning-services

The operator identified the above cyclone page and IDQ20023 as a matching warning bulletin. The page is an **operator reference and source-product discovery path, not a verified browser-consumable real-time map API**. Do not scrape its internal services or infer that an exposed web map implies a redistribution licence. As checked 17 October 2026, publicly rendered page text said “Tropical cyclone warnings and bulletins — Currently unavailable”; that is **not proof of an absence of active cyclones**.

## Product ID mapping (QLD)
| Role | BoM product identifiers | Formats / interpretation |
| --- | --- | --- |
| Tropical Cyclone Advice 1–3 | `IDQ20023`, `IDQ20026`, `IDQ20029` | txt, wrap.html, xml; operator-facing issued warning/advice text, **not forecast confidence polygons** |
| Tropical Cyclone Advice CAP 1–3 | `IDQ24500`, `IDQ24510`, `IDQ24520` | CAP: threat-area polygon / warning metadata; **not forecast likely-tracks areas** |
| Forecast track GML 1–3 | `IDQ65248`, `IDQ65249`, `IDQ65250` | gml (also shapefile zip); actual issued tracks, forecast fixes, 72h/120h likely tracks areas where present |
| Cross-border forecast map GML | `IDQ65252` (NSW), `IDQ65251` (NT) | GML; avoid duplicating the same cyclone under overlapping regional issuers |
| Technical CXML 1–3 | `IDQ65255`, `IDQ65256`, `IDQ65257` | Technical bulletin CXML: observations, forecast metadata/cyclone ID; corroboration, not a substitute for issued uncertainty geometry |
| Information bulletin 1–3 | `IDQ20065`, `IDQ20066`, `IDQ20067` | For active systems outside advice/watch/warning criteria |

BoM warning-products guide tables 15–20, pages 45–51 (PDF pagination). Issued GML products are updated at the same time as relevant forecasts/advices; do **not** confuse advice product IDs, system/cyclone identifiers or incrementing advice issue numbers. The same product ID is reused for subsequent updates; latest issue identity requires source timestamps and unique event identity.

## Candidate upstream access (not yet validated for public deployment)
- Official BoM documented anonymous FTP warning directory: `ftp://ftp.bom.gov.au/anon/gen/fwo/`. Warning products only exist while issued and may expire/delete; browser GitHub Pages cannot fetch FTP directly. This path is **not permission for StormTracker to redistribute data**.
- Official BoM GIS2Web WFS/WMS cyclone layer is documented, but neither public endpoint access/rights nor operational authentication, CRS, expiry metadata and cross-origin transport are verified.
- Queensland Government publicly links a current **CAP AU Severe Weather/Flood/Cyclone warning feed**: https://www.disaster.qld.gov.au/current-warnings ; linked XML endpoint `https://publiccontent-qld-alerts.s3.ap-southeast-2.amazonaws.com/content/Feeds/StormFloodCycloneWarnings/StormWarnings_capau.xml`. Separate independent candidate for warning **not** for forecast track geometry. Audit schema, provenance, use conditions, coverage, freshness and duplicates before coding any consumer.
- BoM public copyright notice: https://www.bom.gov.au/copyright . By default, personal/within-organisation use is allowed, but supply to other people and publication require permission unless a specific licence states otherwise. No scraping public website/undocumented APIs. For a public GitHub Pages app, secure distribution rights or independently verified specific licensing before enabling automatic cyclone feed/redistributing source content.

## Development architecture / acceptance gate
1. Keep `IDQ20023/26/29` advice identification and *full unmodified source bulletin text* logically separate from forecast-map spatial payloads and CAP threat polygons.
2. From an authorised source, fetch candidate live GML 1–3, CXML 1–3, CAP 1–3 and advice 1–3 as **different product streams**; record retrieval status, original BoM product ID, raw issue/base/valid/expiry UTC, cyclone event ID, source link and source licence. Do not invent endpoints or assume products exist between cyclones.
3. Validate actual original GML namespace, geographic CRS, point/line/area roles, 72/120h original uncertainty polygons and the existing `official-cyclone-track-contract-v1.js` invariants. Reuse historical importer/source-true renderer; no geometric buffering, extrapolated cyclone paths or guessed warnings.
4. Correlate products primarily with genuine event/cyclone identifier where present and source issue UTC, not merely same product slot or name. Advice TXT/XML may omit event ID; associate conservatively, do not auto-merge ambiguous records.
5. Keep source issue snapshots atomically per cyclone. Latest only by default; optional historic bulletin selector from **actually retained** snapshots, not fabricated prior advice. Each new valid issue replaces only that event's active source, not other cyclones.
6. Require freshness/expiry; missing current products must clear active overlays and show **No verified live cyclone forecast data** with link to official BoM, never display stale historical as current. No software-generated likely-track areas. Validate correction/cancel/reissue and time zone handling.
7. Historical Jasper/Alfred **observed** archives stay labelled “not forecast / not live”. A source-authentic Fina GML import remains local QA. Keep all live work isolated from production until authentic live event + authorisation + end-to-end browser preview and operator acceptance. No collision with radar playback controls or map-camera watchdog.
8. Regression gates: advice-only, map-only, missing 72h/120h polygon, two simultaneous cyclones, duplicate regional products, expiring warning, correction of same bulletin, malformed GML, blocked FTP/CORS and no active cyclone.

**Conclusion:** user-supplied BoM page + IDQ20023 is a correct public reference and valid bulletin source *identifier*, but it is **not a complete feed URL, not a forecast polygon product, and not evidence that live ingestion is running**.
