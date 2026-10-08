# StormTracker V9.13.1 — BoM recent-history cold start

## Goal and architecture contract

When StormTracker is opened on a new phone or after clearing local storage, V9.13.0 previously had to collect successive BoM heights for 30–120 minutes before calculating a rapid rise. V9.13.1 bootstraps selected gauges from BoM's public **recent river-height tables** linked in the existing Queensland flood bulletin, using the already-deployed **stormtracker-bom-relay** Cloudflare Worker.

All UI, history merge, flood-signal classification, and 3-D marker rendering run in the browser on the existing static GitHub Pages site. **No new server, account, paid data service, hosting instance, local runtime, database, or scheduled process is created.**

## Data discovery and provenance

- Each flood-bulletin observation contains a link such as `/fwo/IDQ65388/IDQ65388.540576.plt.shtml`. Its public tabular counterpart is `/fwo/IDQ65388/IDQ65388.540576.tbl.shtml`.
- Direct probe on 8 October 2026 confirmed multiple current Queensland BoM per-station HTML tables. The Moreton Bay Couran Point table includes real AEST date/time and metres of water level; tables can contain duplicate readings or different reporting intervals.
- The existing Worker adds `GET /river-recent-history?product=IDQ65388&station=540576` with strict Queensland IDQ65388–IDQ65399 and numerical station allow-list. The Worker fetches **only official bom.gov.au**, parses rows to JSON, bounds to the last 48 hours and 225 observations, caches upstream for 5 minutes and preserves the existing GitHub Pages CORS restriction.
- Invalid or conflicting same-timestamp heights are discarded. Missing/future/invalid dates, stale readings, non-numeric heights and arbitrary host/path requests are rejected.

## Targeted browser sampling

- Current BoM bulletin is still retrieved and processed immediately (moderate/major flood classifications display without historical waiting).
- Only currently *rising* gauges that may qualify are considered for history retrieval: **minor class non-tidal** and **tidal** gauges.
- No history lookup for ordinary non-tidal rising, falling, steady or below-minor gauges.
- Check whether enough recent history already exists. Prior valid local browser history avoids redundant requests.
- Fetch in batches of **at most 24 historical stations per bulletin cycle**, **at most 48 per browser session**, **at most 4 simultaneous requests**. A 10-second timeout bounds each request. A closed/hidden browser cannot perform always-on monitoring.
- Merge valid history with current heights by station ID and observation timestamp; do not overwrite current bulletin readings with historic duplicates. Apply existing V9.13 flood-signal thresholds and station-specific tidal rise-rate baseline unchanged.
- Source outage, missing histories and expired observations fail to an unknown/absent rapid-rise screen, not a fabricated flash-flood indicator. Visible BoM moderate/major classifications still work.
- The history loading stage can take seconds after the current view appears, so a first render with no rate indicators does not establish no flood risk. Current BoM warnings remain authoritative.

## Verification and release gate

1. HTML parser and strict target allow-list unit tests.
2. Existing Worker mocked route tests for CORS, allow-list, response format, HEAD and sanitisation.
3. Integration fixture proves that a cold browser session triggers the rapid-rise signal from genuine-style historical heights without waiting for another 15-minute update.
4. Existing full frontend regression suite.
5. **Live deployed existing Worker smoke** tested a Moreton Bay tide station with 225 timestamped observations, latest reading within 36 hours, strict invalid-station rejection and GitHub Pages CORS.
6. Full mobile Chromium against the actual StormTracker Cesium UI with real BoM data and preview-only CORS interception.

Rollback: `restore/v9.13.0`, commit `f3bdfff9f982ce6ba19e3096d877cbdd95e5b7d6`. Worker extension is additive/backward compatible and has no effect on the live V9.13.0 front end until a new static bundle is deployed.
