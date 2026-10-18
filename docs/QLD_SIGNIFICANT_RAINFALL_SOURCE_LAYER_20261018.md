# Queensland Significant Rainfall — source-verified layer (18 October 2026)

## Operational scope
A separate, **off-by-default** Cesium data layer showing only BoM rain-gauge observations **≥50.0 mm** in Queensland, with two operator-selectable filters:
- **Since 9 am AEST** — exact BoM regional map `Rainfalls Since 9am` station values, not rainfall forecast or a rolling 24-hour total
- **Last 1 hour** — BoM regional map `Last 1 Hour Rainfalls` station value, not an interpolation from another reporting period

Each period uses orange for **50.0–99.9 mm** and red for **≥100 mm**. Marker is a small raindrop. Click to see station name, source-given **station number**, total, period, source page's creation timestamp in AEST, and a direct BoM regional page link. No hidden rainfall estimates or inferred map colouring.

## Authentic source and live evidence
`https://www.bom.gov.au/qld/flood/` exposes these two specific products. The actual *regional map HTML* publishes exact station ID, latitude, longitude and rain amount via `PopupRain(name,stationId,lat,lon,rain,period,...)` in separately labelled `since` and `m1hr` imagemap groups. It is safer and more geographically complete than attempting to match ambiguous station names from the BoM's 1-hour/24-hour bulletin tables.

On **18 October 2026 at 08:16 UTC**, seven live BoM regional map pages were audited. Source example: **Sandy Plateau** station ID **533137**, **56.0 mm since 9 am**, location **-20.7664, 148.4650**. It appeared in more than one broad regional page. The layer deduplicates by the exact BoM station number and never sums overlapping records. All regional sources contained BoM-given observations; no 50mm+ last-hour station was observed in this particular sample.

## Statewide coverage
Seven broad Queensland source regions: `gulf`, `north`, `tvl2mck`, `widebay`, `seast`, `west`, `border` (actual BoM `.shtml` regional pages). Some regions overlap; the exact station ID prevents duplicates. If a regional report is stale, missing or denied, that region is marked incomplete, not labelled 0mm. BoM observation pages can contain automated data with limited quality control.

## Integration and performance
- The existing StormTracker Cloudflare Worker adds only one read-only consolidated endpoint: `/qld-significant-rainfall`. It fetches three BoM regional HTML files at a time with 12-second deadlines and 5-minute upstream caching, extracts *only ≥50mm qualifying observations*, and returns a small JSON response with source age and unavailable-region context. Never add another relay, back end or subscription.
- Browser issues **no requests while layer is off**. Once enabled, one consolidation fetch every **five minutes** (not Cesium frame-by-frame) and on manual refresh. Selecting 9am versus last hour **does not refetch** the source.
- Only qualifying station marker entities exist; no per-pixel GPU processing, cloud geometry, radar tiles or map-gesture handlers. No dependency on the sealed radar/3D science or threat cone.
- Source timestamps are from the actual BoM regional page; region older than 90 minutes fails freshness. A stale source is never displayed as a current rainfall total. The 9am filter respects the 09:00 AEST daily reset; prior-day totals are excluded.
- Partial-source status is visible under an optional, collapsed mini-legend, preserving the accepted one-screen sidebar. New icon/info panel styled alongside existing operator layers. An info panel links back to the source.

## Testing and release
- Test threshold boundary at 49.9/50/99.9/100 mm and numeric-only data; require correct ID, coordinates, map period, deduplication and stale 9am reset.
- One-time live source audit above was run through GitHub Actions and removed from recurring CI.
- Worker deploys through the **existing** `deploy-relay.yml` after source changes and checks response schema/CORS/source provenance. Production Pages build overlays only new rainfall control snippets, CSS and two new modules while retaining immutable V10.2.0 radar/cyclone/science baseline and existing flood gauge repairs.
- Both production dry-run and published-site deployment validate the actual emitted source/HTML rather than merely checking the branch.

**Interpretation caution:** A 50mm+ gauge reading describes rainfall *at that station* in the selected period; it does not directly establish flood depth, catchment-wide totals, observed flood severity or a BoM warning. Last-hour map values follow BoM's published period, not a fabricated per-minute rolling accumulation.
