# StormTracker v10.2.10 — Notable flood gauge report

**Date:** 24 October 2026 (AEST)  
**Live site:** https://blakesmith-intel.github.io/StormTracker/  
**New frozen tag:** `v10.2.10`  
**Recovery branch:** `restore/v10.2.10`  
**Radar/cyclone scientific baseline:** V10.2.0 unchanged; no changes to previously frozen tags.

## New operator report

A compact **Flood gauge report · Moderate+ / crossings** button below the flood controls opens a mobile-compatible read-only modal showing ALL current measured river-gauge stations satisfying at least one of:

1. Current BoM moderate or major flood classification, preferring verified station-native stage calculations when available.
2. Current gauge height at/above the directly published BoM bridge, causeway or road-crossing level (`B`, `C`, `X`), independent of flood class and including below-minor gauges.

Rows are grouped into Major, Moderate and Crossing-level reached outside these categories; an event meeting two criteria appears only once. Rows include station ID, latest gauge height, trend, timestamp, and where applicable the named crossing, published height and metres above reference. Source: BoM [Queensland Flood Warning River Height Stations — Details of Crossings, Section 5](https://www.bom.gov.au/qld/flood/networks/section5.shtml), published 5 January 2022. **Crossing height reached is not a verified road closure.** Check QLDTraffic and relevant road authorities. Gauge/crossing reference datum changes since source publication are possible; treat as a screening report, not a traffic decision.

## Safety and accuracy invariants

All crossings joined by exact `bom:` station ID only; no name, nearby, catchment or coordinate substitution. Excludes roads, approaches, tidal planes, dams and spillways from the crossing-specific rule. A current observation within the existing 90-minute source freshness limit is required; stale or missing data is NOT considered below threshold. A broken/unavailable crossing feed produces a clear **crossing checks unavailable** indication, while validated moderate/major reports still display. The browser fetches one fixed BoM source register through the existing Cloudflare relay with a bounded 24-hour upstream cache. No per-station crossing requests. Existing 10-minute flood polling and manual refresh continue; no map marker moves or layer default changes.

## QA / rollback

Tests cover literal official table parsing for B/C/X, no cross-station matching, negative/zero crossing heights, reported and verified moderate/major stage filters, equal-to-crossing levels, source freshness and unavailable feeds. QA pipeline includes a live BoM Section 5 source validation and published Pages/Worker route verification. Only after deployment and both live checks pass is `v10.2.10` tagged and `restore/v10.2.10` frozen at exactly the same commit. Future changes require a new version.
