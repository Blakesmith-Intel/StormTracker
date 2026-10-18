# Source-published WMTS radar availability — all-site repair (2026-10-18)

## Root cause, confirmed live
The production `bom-wmts-loop-v2.js` guessed candidate source timestamps by rounding browser time to 5-minute boundaries and subtracting ten minutes. BoM's real **WMTS GetCapabilities** exposes a <Dimension><ows:Identifier>time</ows:Identifier><Value>…</Value></Dimension> for `atm_surf_air_precip_reflectivity_dbz`. A timestamp that is not listed can yield HTTP 400 with `failed to validate requested value for dimension (time)`. At another site, the old code repeated those guessed-time probes on station selection. The existing per-exact-URL 400 negative cache reduced repetitions but could not stop the *first* invalid request for each tile and region.

The existing Worker already forwards GetCapabilities using its approved `LAYER` whitelist, so **no new Worker, server, key, background process or subscription** is needed. One read-only 2026-10-18 source audit returned nine genuine timestamps from **05:15–05:55 UTC**, with a published `Default` of 05:55 UTC; the default is not used as a substitute for actual Value entries. Source XML was approx. **88 KB**.

## 12-region live geographic acceptance
A single actual published time, **05:50 UTC**, returned HTTP 200 `image/png` with GitHub Pages CORS through the existing relay for SEQ, Gympie 08, Cairns 19, Mackay 22, Marburg 50, Mt Stapylton 66, Mount Isa 75, Brewarrina 93, Moree 53, Grafton 28, Longreach 56, and Richmond 107. This checks one representative source tile at each location, NOT every tile, weather condition, or minute. Seven genuine Doppler history endpoints plus one historical image per site separately returned HTTP 200 for Cairns, Mackay, Marburg, Mt Stapylton, Mt Isa, Gympie and Brewarrina. Intermittent BoM HTTP 502 for a particular file can still happen (see PR #186, per-exact-file backoff).

## Minimal browser-only changes
- New `bom-wmts-published-times-v1.js` reads **only the precise reflectivity layer/time Value entries**, validates strict UTC, deduplicates/sorts and rejects malformed/empty/cross-layer metadata.
- Browser shares **one in-flight promise and a 120-second cached metadata result** across all radar regions and view changes. Instead of 4+9 speculative image probes on each site selection, no speculative image discovery requests are made.
- `findLatestBomReflectivityTime`, `discoverBoundedBomReflectivityHistory`, `discoverBomReflectivityHistory` and `findRecentBomReflectivityTimes` now take from those authenticated source-advertised timestamps; the existing 9-frame and 180-minute upper bounds remain.
- Region-specific tile footprints, original observed source images, calibrated Doppler, source-ID map controls, Cesium and 3-D are unchanged. The browser's genuine locally recorded 60/120/180-minute archive remains independent and is still required for longer time windows.
- If BoM GetCapabilities is unavailable, do **not** guess source times; the existing `resolveSourceDiscovery` path preserves the last verified displayed observation or returns genuine local archived imagery.
- `loadCompleteRadarTiles` now has `stopOnPermanent:true` in production, so an expired source time (400) or refused source (403/429) is not retried immediately for a tile. An incomplete scan is still rejected—never filled with fake data or transparent tiles.

## Remaining limits
- BoM may withdraw a time between capabilities discovery and tile access, or edge caches may lag. A *first* HTTP 400 may therefore still appear for a retired tile. The existing exact-URL negative cache prevents immediate re-requests; source time discovery itself no longer generates speculative 400 requests.
- One-site Doppler 502s are an independent BoM/historical PNG availability problem. The prior 75-second per-file cooldown applies identically to **all** Doppler radar products, including Cairns `IDR19I`, not just Mackay `IDR22I`. No source provider guarantees all historical PNGs are continuously readable.
- GetCapabilities is fetched over the existing relay; upstream platform/network denial may prevent new scans without erasing verified last images.
- Existing browser-only approach and 5-minute operational poll unchanged. The 88KB capabilities list is cached for 120 sec and reused, reducing rather than increasing outbound radar request counts.

## QA and release contract
- Frontend parser/time-cache/multi-region/WMTS permanent error tests; existing complete suite.
- Existing production V10.2.0 source and historical QA remain immutable. Overlay only `bom-wmts-loop-v2.js` and `bom-wmts-published-times-v1.js` and adjust the pinned importing module's cache key.
- Pages release dry-run + public-source check prove the new exact-time code is actually deployed. No recurring live audit job: `scripts/probe-multisite-wmts-20261018.mjs` remains a manual one-off reference only.
