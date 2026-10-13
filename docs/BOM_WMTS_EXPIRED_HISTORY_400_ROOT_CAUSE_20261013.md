# BoM WMTS expired-history 400 storm — source-verified correction (13 Oct 2026)

## Actual field evidence
The user's October 13 05:20 UTC startup DevTools log from `/preview/label-gpu-guard/` contains **35 distinct HTTP 400 WMTS tile requests** spanning observed `2026-10-13T01:10:00Z` through `2026-10-13T04:25:00Z`, all for reflectivity layer `atm_surf_air_precip_reflectivity_dbz`, native matrix 8, tile row 15, tile column 34. There are also two separate river-history 502s. The uploaded capture does not include WebGL deleted-texture or gazetteer exceptions, but it is not a complete navigation stress trace.

## Independent live BoM verification
One bounded (5-call) GitHub Actions diagnostic, run at `2026-10-13T05:23:29Z`, tested the same layer, source, tile matrix and relay:
- `2026-10-13T05:05:00Z` tile at z0 and z8 returned **HTTP 200 image/png both upstream and via the Cloudflare relay**.
- The current BoM GetCapabilities request returned HTTP 200, BUT its reflectivity time dimension reported **nine old timestamps from 2026-06-18T22:25:00Z through 23:05:00Z** — clearly stale metadata relative to the live successful October tiles.
- Older timestamps in the operator's log returned HTTP 400. This shows the service and tile coordinates are valid for recent data; broad historical probing against expired timestamps is the confirmed source of most HTTP 400s.

Actual diagnostic workflow: GitHub Actions run `38351128409` (completed successfully). The temporary probing workflow and script were deliberately removed before merging; do not add an extra permanent scheduled diagnostic.

## Root cause
`discoverBomReflectivityHistory(now,180,...)` previously executed `candidateBomReflectivityTimes(now,Math.ceil((180+60)/5))` — **48 five-minute candidate requests**, most older than the source's brief current observation set. A WMTS image request with a rejected time yields HTTP 400; each failure generates DevTools noise regardless of whether its rejection is caught in JavaScript.

The previous request-pressure guard throttled/consolidated queries but could not correct the underlying invalid time schedule.

## Isolated correction, not a change to production
The existing `/preview/label-gpu-guard/` route now invokes a `discoverBoundedBomReflectivityHistory`:
1. At most four initial candidates to locate a verified current BoM tile; on 403/429/502/503/504, stop immediately instead of retrying.
2. From that verified observation, step backwards in five-minute increments for at most **nine published observations** (eight earlier observations); halt after two successive missing timestamps or a service refusal.
3. Reject any timestamp which cannot be verified. Never invent or extrapolate BoM observations.
4. Keep `/preview/network-guard/` and the other review variants unchanged for A/B verification. All source tile decoding, Doppler integration and 40 dBZ volumetric model remain unchanged.

The app's 60/120/180-minute windows remain selectable and can be progressively populated from **genuine IndexedDB-cached prior radar frames**. They are not guaranteed to be complete on a fresh browser session, and the UI must describe partial history rather than implying unavailable observations exist.

## Regression / CI acceptance
- Unit tests enforce: no more than 10 startup probes when some genuine history is published; a 4-request ceiling when all recent timestamps fail; one-request fail-fast on a 403 refusal; no extra probes after two consecutive genuine missing timestamps; verified 30-minute horizon.
- Existing original-source mosaic tests still require complete real BoM pixels.
- Pages CI verifies the exact bounded-history implementation is physically served under `/preview/label-gpu-guard/` and tests the sealed V9.18.0 production root separately.

## Remaining uncertainties
This correction addresses the 35-HTTP-400 history-probe storm; it does **not** establish that WebGL deleted-texture errors or camera stalls are fully fixed. Both require renewed physical browser navigation testing. The two river-gauge 502 errors originate in a separate optional BoM recent-table endpoint and are not silently hidden.

**No promotion to sealed V9.18.0 until visual validation.**
