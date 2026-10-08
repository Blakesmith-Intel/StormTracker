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
2. **V9.15.0 public QFD incidents:** display only the three
   ArcGIS `GroupedType` values `RESCUE TECHNICAL`, `RESCUE ROAD CRASH`
   and `ASSIST PUBLIC`, in separate categories on the interactive map.
   No unrelated fire or other group events. The server filter and browser
   parser must both enforce the allowlist; incident cards show the actual
   official public classification, response time, status and source.
   QFD's map reports general-area locations, not precise rescue sites.
   QFD-authored icon symbology is preferred; do not falsely label
   provisional symbols as official. The public ESCAD layer does not
   presently expose its dashboard renderer or picture-marker files,
   so provider-artwork verification is an outstanding acceptance gate.
   Continue to require functioning browser CORS, expiry safeguards,
   current-only incident lifecycle and real mobile click validation.
3. **Future detailed QFD rescue classes (blocked):** only when a legitimately
   public source publishes the exact job type, consider separate water,
   vertical, mountain, RTC large-multi and extreme-weather assistance types.
   Never use internal-only CAD data, or infer precise subtypes from
   `GroupedType` or environment/road reports. Road crash jobs are not
   confirmed road closures without an authoritative traffic record.

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
