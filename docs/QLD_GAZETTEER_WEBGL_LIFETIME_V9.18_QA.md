# StormTracker — Queensland gazetteer and WebGL deleted-texture investigation
**13 October 2026 · isolated QA only · browser-only GitHub Pages**

## User evidence
- Rapid scrolling/panning still crashes in Street and Street/flat-terrain, irrespective of radar loop playback.
- Browser console near stalling reports `Nearby QLD localities unavailable: Gazetteer locality search exceeded bounded query limit` from `normaliseQldLocalities` and `fetchQldNearbyLocalities`.
- Chrome/WebGL reports many `INVALID_OPERATION: bindTexture: attempt to use a deleted object` errors (reported 256).
- Neither message alone establishes root-cause correlation. The first is a definite application error. The second is an invalid GPU texture lifecycle, potentially Cesium internals or imagery handover.

## Definite Queensland gazetteer defect and fix
- The ArcGIS query returns up to 1,800 gazetted localities for a viewport. Original code threw away all data if exactly 1,800 records or `exceededTransferLimit`. During panning, it could request newly visible oversized bounds repeatedly, rethrowing a costly exception.
- Adaptive spatial subdivision: split only *over-limit* official query envelopes, binary along their longer axis, at most depth 3 and 15 total requests, all sequential and viewport-bounded. A still-overflowing lowest-level region fails explicitly; partial results are not passed off as complete.
- A failing request preserves last known good labels, records a 60-second retry suppression and logs at most one concise warning per minute.
- During actual desktop or touch navigation, continue accurate screen-space label position following but **skip collision-list recomputation and all new QLD/NSW nearby locality requests**. Request a final re-layout after settling and existing 2.5-second fetch interval.
- Does not affect authoritative larger QLD/NSW settlement catalogues, map source accuracy, location labels above 3-D storms or official NSW locality snapshot.

## WebGL imagery lifetime *hypothesis* and experiment
Source investigation finds three outgoing weather-layer code paths calling Cesium `imageryLayers.remove(layer,true)` immediately during radar and Doppler transitions. Cesium documents `destroy=true` as removing and destroying the imagery layer. On some drivers, texture reuse while the globe's draw queue is changing might provoke the observed deleted-object messages; this is **not yet proven**.

- Only under `/preview/label-gpu-guard/`, retired weather imagery is removed from active imagery order with `remove(layer,false)`, then explicitly destroyed **after >=2 completed scene render boundaries AND >=500 ms**, including primary radar, extra radar sites and Doppler.
- Retirement cleanup is bounded in time while the scene keeps rendering, and all pending retired layers are destroyed on page unload. No permanent leaks by design; verify with diagnostics and manual testing.
- The same original decoded BoM source images, Doppler handover and correct observation timestamps remain. No synthetic frames or drop-in replacement basemaps.
- Preserve the WMTS pressure guard from `/preview/network-guard/`: exact-URL negative caching, concurrency limit, cooldown on access/service errors.
- Read-only map-frame DevTools function `window.__stormtrackerGraphicsDiagnostics()` shows `webglLost`, `webglRestored`, `renderErrors`, active imagery-layer count, and retired/pending GPU layer counts. It cannot read Chrome's INVALID_OPERATION warning count; collect that from DevTools Console separately.

## How to test
**After GitHub Pages deployment succeeds:** `https://blakesmith-intel.github.io/StormTracker/preview/label-gpu-guard/`

Compare against unchanged `/preview/network-guard/`:
1. Open both in fresh tabs separately, with the same selected radar, Street or Satellite basemap, and same zoom. Leave radar playback paused.
2. Drag/zoom aggressively for 60+ seconds. Observe if locality errors or deleted-texture warnings recur; note time before stalls.
3. Repeat with radar playback enabled, then Doppler/extra radar sites.
4. In Chrome/Edge DevTools select the map iframe and run graphics diagnostics; compare counts after testing and check for unbounded retired-layer growth.
5. If GPU errors persist despite deferred layer destruction, inspect source imagery provider reuse, Cesium globe tile lifecycle, driver context loss, browser GPU resources and any Cesium-specific regressions. Avoid assuming that every warning causes a hard GPU crash.

## QA and release safety
- New automated tests exercise oversized official query splitting, saturated-depth cap and deferred requests during navigation, plus retirement only after two renders and 500 ms.
- Existing regression tests check original imagery handover/retained last authentic source frames and Doppler transition.
- No local host or paid service. New URL is isolated; root remains exact sealed V9.18.0 source commit `66d3da447ef7a4df53e7df49aa1ac06f86cb5afd`.
- **No production promotion without operator physical browser confirmation.**
