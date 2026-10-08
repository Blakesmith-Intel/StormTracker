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
2. **QFD emergency response incident categories** (V9.15.0 draft):
   include independently classified official **water rescue**, **vertical rescue**,
   **mountain rescue**, **major multi-vehicle road crash rescue**, and
   **extreme-weather assistance** records, with the distinct QFD labels:
   `RESCUE WATER ALL TYPES`, `XE RESCUE WATER`, `RESCUE VERTICAL`,
   `RESCUE MOUNTAIN RESCUE`, `RESCUE RTC LARGE MULTI`, and
   `ASSIST EXTREME WEATHER`.
   The water labels do not automatically mean *swift-water* conditions.
   Mountain rescue is within SES situational-awareness scope but does not
   prove SES attendance. Major road crashes can disrupt traffic but must not
   be represented as confirmed closures without a linked authoritative road
   closure record. Extreme-weather assistance is in scope regardless of
   whether the job itself is labelled a rescue.
   Exact labels from an internal QFD system may serve as reference vocabulary,
   but data must come from a legitimately **public QFD incident record or
   official publicly released incident title**, with matched incident ID,
   publication rules and suitable location generalisation.
   The existing public ESCAD `GroupedType` is too broad to distinguish the
   requested jobs. The optional generic `RESCUE TECHNICAL` layer is separately
   marked **subtype unspecified**, not a substitute for exact classifications.
   Never access restricted CAD/dispatch systems, invent incidents, infer
   subtype from rain/radar/gauges, or expose personal incident details.
   Validate source coverage, classification, deduplication, expiry,
   official links, polling and browser-only CORS before enabling live
   specific-type indicators. Missing verified public classification keeps
   the relevant indicator blocked.

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
