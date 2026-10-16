# Official Queensland and NSW Thunderstorm Polygon Sources — 16 October 2026 Audit

## Real anonymous source-availability check

Performed by a one-off GitHub-hosted Node script `scripts/audit-official-thunderstorm-cap-polygon-feeds.mjs` against publicly advertised government/WMO endpoints. It logged HTTP metadata, XML element counts and coordinate-shape validity ONLY, never copied active alert messages into the repository.

| Source | Status | Observed schema | What this does and does NOT prove |
| --- | --- | --- | --- |
| Queensland Government public [current warnings CAP-AU feed](https://www.disaster.qld.gov.au/current-warnings) at `https://publiccontent-qld-alerts.s3.ap-southeast-2.amazonaws.com/content/Feeds/StormFloodCycloneWarnings/StormWarnings_capau.xml` | HTTP 200 | One EDXLDistribution, one CAP alert, one info/area, one non-empty, syntactically valid CAP lat/lon polygon and one circle at the sample time | Confirms an accessible, geometrically capable CAP source, but **does NOT establish that this particular alert was a BoM severe-thunderstorm warning**. Queensland’s AWS severe-weather messages may be issued by local governments or emergency agencies, separate from BoM meteorological warnings. |
| WMO global severe-weather CAP feed for Australia's BoM `https://severeweather.wmo.int/v2/cap-alerts/au-bom-en/rss.xml` | HTTP 200 | RSS index, ~455 items, **zero direct embedded CAP polygon/area elements** in sampled index | Individual linked alert CAP documents may carry actual warning polygons, but **RSS titles/index do not authorize reconstructing a warning area**. Investigate verified BoM severe-thunderstorm messages and inspect their original area geometry through allowed public feeds. |
| BoM GIS2Web operational WFS/WMS as documented in [warning products guide](https://www.bom.gov.au/catalogue/Bureau_of_Meteorology_warning_products_user_guide.pdf) | Not authenticated/verified in this audit | BoM documents regional and detailed severe thunderstorm warning polygons | Registered-user access and any appropriate public display/reuse rights require confirmation before live browser use. The permission-restricted `api.weather.bom.gov.au` JSON endpoint is **not** considered approved. |

The QLD CAP source says its warning map may be delayed by up to five minutes. Data availability is not permission to mislabel agency-issued evacuation/impact warnings as BoM detailed meteorological threat polygons.

## Implemented geometry safety contract (NOT yet live)

`frontend/src/official-thunderstorm-warning-geometry-v1.js` provides:
- CAP `latitude,longitude` polygon-pair decoding to GeoJSON `[longitude,latitude]`, preserving all source vertices/rings and closing only polygon topology.
- Mandatory verified Bureau of Meteorology issuer, event `Severe Thunderstorm Warning`, actual product subtype `regional` / `detailed`, BoM bulletin URL, issued and expiry UTC and genuinely supplied geographic polygon.
- Explicit rejection of historic cyclone wind footprints, non-thunderstorm QLD AWS alerts, expired/stale warnings and unverified product labels.
- **NSW is blocked entirely until the original polygon has been clipped by a tested true union of supported installed radar coverage**. Do not treat a bounding-box test as equivalent to true geographic clipping.
- Tests use explicitly synthetic geometry as parser fixtures ONLY. They are never loaded into the live map or preview as current warnings.

## Next integration gates

1. Validate an actual BoM severe-thunderstorm warning CAP or GIS polygon with product ID, country/state, issuer, source time, expiry, non-empty original geometry and public bulletin link.
2. Distinguish BoM *regional* broad warning areas from *detailed* cell-based polygons and immediate threat/forecast graphics. The user's term “warning blobs” refers to the actual BoM-issued area, not StormTracker's algorithmic storm IDs, a guessed buffer, or archived TC Koji wind extent.
3. For QLD show all verified active official BoM features. For NSW compute and persist actual installed radar coverage from Brewarrina, Moree, Grafton and QLD sites extending south; clip official source geometries accurately to that coverage.
4. Render source polygon fill, outline and time/expiry on an independent Cesium layer, using the same full-vertex, hole-aware geometry pathway proven with original archived **TC Koji** cyclone wind-area polygons. Keep TC Yasi as the historical observed-track-only regression. Colour by the official warning type/class and include a click-through source bulletin.
5. Handle no warnings, source failures, stale data and user-disabled overlay cleanly. This is an informational situational-awareness display, not an emergency decision-making product. Source quality and original BoM radar/3-D fidelity are non-negotiable.
6. Build isolated QA preview and run source-geometry unit tests, true NSW clip tests, mobile/desktop visual assessment, before seeking production promotion. Current sealed production remains `v9.20.2`.

This audit records a plausible feed pathway; **it does not claim the actual live BoM thunderstorm-warning blob map is ready.**
