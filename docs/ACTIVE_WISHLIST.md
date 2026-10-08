# StormTracker — active wishlist and defect-first release policy

Updated: 8 October 2026 (AEST). The deployed starting point is V9.13.4.
This file supersedes the older V9.9.1-era order in FUTURE_DEVELOPMENT_HANDOVER.md.

## Non-negotiable work order

1. **P0 — operational safety, data integrity, false/missing incident information,
   source failure or stale incident display.** Fix first and verify with tests.
2. **P1 — user-reported product defects**: crashes, missing interactions, boundaries,
   map label readability, broken polling, provider mismatches, performance regressions.
3. **P2 — accepted wishlist enhancements.** Begin only when P0/P1 issues identified
   during development have been addressed or isolated behind a safe rollback.
4. Do not promote or seal a release without automated regression checks and
   real browser/mobile acceptance. Keep the latest accepted production restore
   point untouched until the new release is accepted.

## Completed wishlist work (through V9.13.4)

- Queensland satellite/Street basemap, contextual labels and 3-D terrain.
- Queensland flood-road closures from QLDTraffic with interactive information.
- Queensland-only current unplanned power outages (Energex, Ergon, Essential
  Energy), including polygon and point-only incidents with source links.
- Exception-only BoM river-height/flood signals and interactive BoM gauge links.
- Follow-on repairs to official state-border overlay and minor rural names.

## Active next work

1. **V9.14.0 high-priority source freshness and failure protection** (in progress):
   expired road closures/outages must not masquerade as current; identify
   last successful source check, partial results and refresh failures. Keep
   radar and each provider independent. Do not replace real provider incidents
   with synthetic events.
2. **QFD swift-water and vertical rescue incidents** (new wishlist items):
   investigate whether the Queensland Fire Department officially publishes
   legitimate, machine-readable, reusable and sufficiently current public
   incident records for either rescue type. Keep **swift-water rescue** and
   **vertical rescue** as separately selectable, independently classified
   incident types, with clear incident status, official timestamps and
   clickable source panels if a lawful public feed becomes available.
   Use only officially released public records and permissible location
   precision. Never scrape restricted dispatch, CAD, pager, operational
   or internal emergency-services systems or reveal personal details.
   Verify the true source classification rather than inferring swift-water
   or vertical rescue from flood gauges, closures, rain, radar, terrain,
   social posts or generic "rescue" categories. Confirm duplicate handling,
   updates, stale/closed job removal, source links, polling limits and
   geographic coverage independently for each rescue category.
   **No verified public feed = that incident type remains blocked**.

## Permanently final wishlist item — observed lightning

**Always keep actual observed lightning last, behind every other eligible
wishlist feature and operational repair.** It may be revisited only when a
genuinely public **and free**, reliable Australian strike/event feed exists
with reuse rights, sufficient geographic coverage, real observed strike
locations, and polling suitable for an operational browser-first map.
No paid subscription, fragile scrape, inaccessible provider, guesswork
or radar-inferred "lightning strikes" is an acceptable substitute.
If these conditions are not met, retain its blocked status indefinitely.

## Delivery constraints

- Static GitHub Pages/browser runtime; existing Cloudflare CORS relay may
  relay permitted public sources, but cannot replace a browser-native model
  with a user-managed server.
- Keep the measured radar/tracking and Doppler contracts intact.
- Make every incident indicator clickable with accurate source links;
  disclose partial, stale and unavailable data.
