# V9.13.2 — flood event persistence and clickable map sources

## Behaviour

**Flood signal lifecycle**
- BoM moderate/major classified floods remain mapped as long as the most recent dated (<=90 min old) official bulletin still reports that class. Major automatically changes to moderate on BoM downgrading; below moderate the classification marker is removed unless a separate currently supported rapid-rise signal exists.
- An inferred **rapid non-tidal rise** or **unusual tidal rise** does **not** disappear simply because the next reading rises more slowly.
- Screening events are latched in browser `localStorage` and automatically rechecked on 15-minute BoM refreshes and public historical-reading bootstrap. The same observation timestamp cannot count twice.
- Two **new, independent readings**, at least 15 minutes apart, must show steady/falling tendency, no further meaningful increase in observed height and a measured recent rate <=0.05 m/hour before an inferred event clears. An ongoing rise, unknown tendency or insufficient data cannot be treated as clearance. The marker explicitly says the event remains under monitoring, with 0/2 or 1/2 recovery observations.
- **Fail closed:** if the latest BoM reading is older than 90 minutes, the map no longer displays it as a current warning. There are no perpetual red markers after a connectivity failure.
- This is a StormTracker **screening/monitoring lifecycle**, not a confirmed flash-flood warning or a replacement for BoM advice. River levels can still pose danger after a rapid-rise phase ends.

**Live popups**
- Keep the selected BoM gauge popup up to date when its current height, timestamp, class, rate or monitored event state changes; if it no longer qualifies, close its panel.
- Add an explicit **BoM gauge** HTTPS link to the corresponding BoM `.plt.shtml` recent-height plot where the current BoM bulletin provides a trustworthy matching station link. Otherwise link to the official Queensland river height data page.
- The **Source** row in each interactive panel is now a real HTML link:
  - BoM river heights: `https://www.bom.gov.au/qld/flood/rain_river.shtml`
  - QLDTraffic road closures: `https://qldtraffic.qld.gov.au/`, or a verified official event link.
  - Energex: official Energex outage map.
  - Ergon Energy: official Ergon outage map.
  - Essential Energy: official outage tracker.
- All links use explicit official HTTPS host validation, safe `target="_blank"` / `rel="noopener noreferrer"`, visible underlining and keyboard focus styles. Never fabricate incident-specific provider URLs.

## Constraints

Same GitHub Pages static browser application and the existing Cloudflare Worker relay, **no localhost, separate backend, paid API, new hosting, or user-managed services**. No changes to radar, Doppler, state borders, QLD imagery, road geometry, or outage data.

## Release checks

- Unit tests for persistent monitoring, recovery observation spacing, duplicate timestamps, BoM moderate/major precedence, and expiry.
- HTML source-link tests validating official providers, BoM station URL path and DOM safety.
- Full app-code contract verifying links are wired to the real operational panels and the selected gauge popup refreshes automatically.
- Full frontend suite and iPhone-width Chromium running StormTracker with live BoM feeds, including interactive link styling.
- Rollback: V9.13.1 `d3e1d090c15fa09cc1f390aa99e732bf1dda4cc8` (`restore/v9.13.1`).
