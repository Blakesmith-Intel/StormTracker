# Operational incident — stale WMTS GetCapabilities causing 400 tile storms; IDR74 PNG 502 (18 Oct 2026)

## Reproduced exact source failure
One-off GitHub Actions, 18 Oct 2026 **07:19 UTC**:
- **Source GetCapabilities HTTP 200 advertised nine reflectivity timestamps 05:15–05:55 UTC** (one to two hours old).
- **Its latest advertised time 05:55 UTC returned HTTP 400** with the upstream error **`failed to validate requested value for dimension (time)`** on a valid real source tile col34/row15, matrix 8.
- 05:50 UTC in that one probe returned HTTP 200, while 06:00 UTC (not listed) returned HTTP 400. Availability varies by timestamp, upstream cache and request time; we **must not infer** that every advertised source time is presently accessible.
- The reported production app fired full 12-tile grids for each of 05:50, 05:55 and 06:00 UTC, across selected site 66 and later radar 74. The per-exact-URL HTTP 400 cache could only prevent *retries*, not first-request fanout.
- **IDR74I**'s live `/radar-history` request timed out after 11 seconds in the same diagnostic. User separately supplied individual `/radar-frame` HTTP 502 errors for 05:53, 06:08 and 06:13 UTC; no evidence establishes whether the PNGs are permanently missing, BoM rejected them, or a temporary gateway problem caused those 502s.

## Corrective changes
1. Treat BoM GetCapabilities as an *unverified metadata hint*. Source-new fetches only consider advertised times within the last **45 minutes** (not the prior three-hour speculative source window). The longer 60/120/180-minute history continues to use actual, previously collected browser frames.
2. Before full mosaic construction fetch **one genuine tile** for that time/site. On upstream HTTP 400 stop immediately, reject the entire timestamp, and cache that rejection for **five minutes across all radar sites**. This replaces a 12-tile burst with one unsuccessful source probe. A later fresh timestamp remains eligible. A frame is displayed only if **every actual source tile loads**.
3. Stop the optional source-history warming pass on the first HTTP 400 (as already done for gateway refusals), instead of continuing with every stale time. This is an emitted-site single-line guard update; the immutable V10.2.0 radar baseline is unchanged.
4. Keep the existing 75-second exact-Doppler-PNG negative cache across all sources; additionally pause **only one Doppler product** for 75 seconds after **three distinct source HTTP 429/502/503/504 frames** fail within 120 seconds. This limits a broad IDR74 outage without blocking IDR66, IDR19 etc. Automatically retry after the cooldown. Never invent a Doppler velocity frame.
5. Include a small inline-source `frontend/favicon.svg` and explicit favicon link on production app and launcher. No remote icon dependency.

## Verification and limitations
- Tests reproduce a stale 05:15–05:55 published list at 07:20, a single 400 rather than twelve, shared source-time rejection across sites, source cooldown expiry, source-74 3-filename 502 burst and site-66 unaffected good frame.
- Latest rain/wind automatically retains only authentic source observations. If a new source cannot be authenticated, the UI must preserve previously verified frames or display unavailable—not stale data as current.
- Some first WMTS 400s, timeouts, and Doppler 502s remain possible. The app must not generate cascading requests or treat metadata as proof of availability.
- No new server, polling service, subscriptions, Cesium layers, imagery interpolation, or scientific radar calculations.

One-time audit script: `scripts/oneoff-diagnose-wmts-400-idr74-20261018.mjs`; not run routinely in CI. Deployment verification requires the production build marker, new source modules and installed favicon. Scientific V10.2.0 baseline remains sealed and referenced by previous release tags.
