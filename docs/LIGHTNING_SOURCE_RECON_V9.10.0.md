# V9.10.0 observed-lightning source reconnaissance

Status: **source selection in progress — no production provider accepted yet**.

The V9.10.0 user-facing requirement is genuine observed lightning events with
timestamps and coordinates. Forecast proxies, radar-only convective evidence and
scraped map graphics do not satisfy this requirement.

## Source contract

A production provider must provide:

- actual observed lightning events, not a forecast proxy;
- latitude/longitude and event time;
- sufficient Queensland/Australia coverage;
- latency and update cadence suitable for a live operational map;
- terms that permit StormTracker's intended use;
- a stable machine interface;
- a practical cost profile;
- a way to keep any required credential out of public client-side code.

The existing StormTracker radar/Doppler convective-lightning evidence score remains
separate and must never be presented as an observed strike feed.

## Sources assessed

### Bureau of Meteorology

**Status: not suitable as the primary live strike feed at present.**

Public Bureau material located during reconnaissance includes the Severe Storms
Archive and storm-confirmation products, but no public near-real-time API exposing
individual Australian lightning strike coordinates/timestamps was identified.

The Severe Storms Archive is useful as historical reference/validation material,
not as a live V9.10.0 source.

### Blitzortung / LightningMaps

**Status: rejected for production raw-strike ingestion.**

Although real-time WebSocket traffic is technically observable, current published
Blitzortung guidance does not make that stream a general-purpose third-party API.
Raw lightning data is restricted to participants or explicitly approved projects,
and the project specifically warns against use for warning/protection or
risk-analysis purposes.

A recent 2026 moderator response also states that Blitzortung is not a
general-purpose public lightning-data service and directs third-party applications
to providers whose purpose is supplying lightning data.

StormTracker therefore must not build production strike ingestion by reverse
engineering or directly consuming the undocumented Blitzortung/LightningMaps
WebSocket.

### Xweather / Vaisala

**Status: technically suitable; cost/credential model requires a decision.**

Xweather exposes genuine global lightning strike data sourced from Vaisala's
lightning network. It supports real-time and historical lightning data, machine
JSON/GeoJSON output and global coverage.

Current public pricing advertises 15,000 free API accesses per month, but lightning
endpoints carry a 10x access multiplier. A single statewide request every five
minutes would therefore consume approximately:

- 8,640 API calls in a 30-day month;
- about 86,400 billable access units after the 10x lightning multiplier.

That exceeds the free allowance substantially. Outside the US and Canada, scaling
beyond the free tier requires contacting Xweather rather than normal
pay-as-you-go.

The API also uses a client ID and secret. Those credentials must not be embedded in
the GitHub Pages frontend. If Xweather is selected, StormTracker's existing
Cloudflare transport layer would need a narrowly scoped authenticated relay route,
with the credentials held as worker secrets.

This is the strongest technically viable provider found so far, but it is not yet
accepted because the operational cadence is unlikely to remain free.

### The Weather Company

**Status: rejected on current cost/access fit.**

The Weather Company documents global recent-lightning endpoints with individual
strikes, recent windows and strike-type filtering. However, current pricing lists
lightning strikes as an additional enterprise option rather than part of the
standard low-cost package.

The data is technically suitable but does not fit the current browser-first,
low-cost StormTracker constraint.

### WarPulse Lightning API

**Status: rejected on geography.**

The service exposes simple near-real-time strike JSON and a free monthly call
allowance, but its published coverage is the Americas, Atlantic and Pacific
including Hawaii/Alaska. Australia is not listed as a supported region.

### Tomorrow.io lightning flash-rate density

**Status: rejected as non-observed.**

Tomorrow.io documents lightning flash-rate density as an NWP-derived proxy rather
than discrete observed lightning strikes. It therefore fails the V9.10.0 observed
strike contract.

## Current conclusion

There is no accepted zero-cost, public, near-real-time individual-strike API for
Australia identified in the first source pass.

Do **not** implement a production strike layer against an undocumented feed merely
because it is technically reachable.

The current preferred paths are:

1. continue searching for an Australian/open-data provider that satisfies the
   source contract; or
2. if no such provider exists, decide whether a credentialed Xweather/Vaisala
   integration is acceptable and what update cadence/budget is supportable.

Until that decision is made, V9.10.0 remains in source-discovery state and the
sealed V9.9.1 production product must remain unchanged.
