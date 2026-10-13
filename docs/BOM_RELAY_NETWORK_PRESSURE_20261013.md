# StormTracker BoM relay and DevTools errors — 13 October 2026

## User-provided evidence
The captured 428-line initial-load DevTools console log from `street-flat` includes:
- **32 HTTP 400 WMTS GetTile entries**, mainly radar timestamp probes at five-minute intervals;
- **8 HTTP 403 WMTS GetTile entries**, including repeated mosaic-tile fetches during `warmRadarHistoryCache`;
- **2 HTTP 502 recent river gauge history entries**, stations 529020 and 527004;
- a Cesium warning that terrain-clamped entity outlines are unsupported.

These are **counted network GET error entries**, not unique failed timestamps or proof of browser crash causation. The repeated JavaScript stacks account for much of the visible console length. The user's tests show that removing satellite basemaps and separately removing 3-D terrain did not prevent instability, and playback paused did not prevent the issue.

## Source-level mechanism
`discoverBomReflectivityHistory` probes a full three-hour horizon plus 60 minutes' slack in parallel batches of six, by guessing five-minute timestamps; unsuccessful guesses can yield HTTP 400, an ordinary missing source/time response from the relay. After the interactive load, `warmRadarHistoryCache` separately fetches complete 12-tile mosaics for older times, and the mosaic loader previously retried all failures once including 403. The 403 may be an upstream denial or service-policy issue, not proven to be rate limiting.

The relay `/river-recent-history` handler maps failure to reach the BoM table, non-OK upstream status, or missing usable recent samples to HTTP 502. These two 502s reflect unavailable upstream station data; they are distinct from the WMTS relay issues. The river gauge layer already limits recent requests to four concurrent and caps stations per session.

## Isolated browser experiment
**URL after Pages deployment:** `https://blakesmith-intel.github.io/StormTracker/preview/network-guard/`

Only for this path (not production or other previews):
1. `radar-source.js` runs real BoM WMTS image requests through a maximum-three-active queue; concurrent identical URLs share one promise, avoiding duplicate fetch/decode. It records 400 responses for the same URL for five minutes; newly published times or other tile positions are not suppressed. Queue is bounded.
2. An HTTP 403/429 opens a 30-second request cooldown; 502/503/504 opens a 15-second cooldown. Pending requests fail fast without additional network requests. The cooldown expires automatically.
3. `radar-tile-retry-v1.js` can stop retries immediately on permanent 400/403/429 for the QA route. A valid mosaic is **still required to contain every real BoM tile**; no blank or artificial frames are introduced.
4. Optional `warmRadarHistoryCache` stops when the relay refuses a request (403/429/502–504) instead of trying the rest of the historical source list; interactive observation rendering and auto-update remain distinct.
5. The developer console within the map iframe exposes a read-only `window.__stormtrackerRelayPressureDiagnostics()`, returning the counts of requests started, joined duplicates, negative-cache hits, cooldown rejections, queued and in-flight requests.

This is a **controlled request-pressure experiment**, not a confirmed solution to rendering crashes. A browser still logs the first genuinely failed HTTP request; eliminating all red DevTools lines would require knowing authoritative available timestamps (rather than guessing) and resolving upstream access/data publication. Do not simply hide or suppress genuine source errors.

## Validation
- Full `npm test`, including deterministic queue capacity, duplicate in-flight join, 400 TTL, 403 cooldown and recovery; mosaic 403 failure without fabricated pixels.
- GitHub Pages must serve the candidate at the isolated route and verify the online guard module and its original V9.18.0 production source pin.

## Manual QA
Compare `/preview/network-guard/` with `/preview/street-flat/` on the same device and same selected map mode. Open DevTools Network (filter `wmts` and `river-recent-history`) and Console, observe the startup and 60-second rapid pan, and check that real radar frames remain accurate/complete. Record whether the browser freezes, the peak concurrent requests, and counts from the diagnostic function.

**Production remains V9.18.0 sealed**, pinned in Pages workflow to source `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd`, pending user visual confirmation. Do not promote without verifying both stability and actual BoM imagery availability.
