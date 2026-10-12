# StormTracker V9.18.0 — Engineering handover

## Runtime architecture

- Browser-only Cesium app statically hosted on GitHub Pages; BoM Cloudflare relay only for existing source CORS. No local server or paid infrastructure.
- One Street layer, or satellite mode layered as: OpenStreetMap fallback → DEA regional GeoMAD `WebMapTileServiceImageryProvider` (always retained underneath) → official NSW detail `UrlTemplateImageryProvider` → official QLD detail (prioritised in rectangular overlap). 3-D terrain is a separate existing Cesium provider.
- `frontend/src/context-layers/basemap-manager-v1.js` manages zoom handover and camera postRender observer. Display-resolution thresholds 38m/px entering detail, 65m/px exiting. A staged ~0.5% alpha load of detailed tiles precedes foreground fade, and it waits for Cesium `globe.tilesLoaded` readiness. Basemap choice is persisted using the legacy `stormtracker.basemap.v1`/ `qld-imagery` IDs.
- `frontend/src/context-layers/qld-town-label-layer-v1.js` is the **only** foreground HTML label layout, covering QLD and NSW settlements. `qld-town-label-declutter-v1.js` supplies screen-space budget, deduplication and rural ranking. It follows the camera every frame and only re-runs costly layout when required. Do not create another NSW Cesium imagery-label layer.
- The NSW Spatial Services ArcGIS TopoBaseMap API **does not send browser CORS approval** even though its endpoints return HTTP 200 from GitHub Actions. `scripts/build-nsw-radar-places.py` fetches geolocated official city, town, and locality points at build time, restricts them to the southern radar coverage footprint, then emits a same-origin `frontend/data/nsw-radar-places-v1.json`. The app reads it via `src/context-layers/nsw-radar-place-catalogue-v1.js`. Its memoized fetch serves both the broad town list and viewport-bounded smaller localities. Earlier attempts to fetch NSW town data from the browser directly produced blank labels.
- Known NSW source gap: all village entries in that source had no point coordinates; the Grafton town point was not exposed. Do not manufacture coordinates. It remains possible to upgrade this dataset from another authoritative geocoded source later.
- The approved Doppler track lifecycle clear helper is `src/reflectivity-overlay-mode-v1.js`, and supplementary QLD/NSW original BoM frame replacement uses `src/multi-radar-display-v9.js` and the existing `radar-imagery-handover-v1.js`.

## Deployment and verification

The release workflow `.github/workflows/pages.yml` must check out an exact tested production release SHA. The source must pass `npm test`. It generates the NSW snapshot by executing `python scripts/build-nsw-radar-places.py --output frontend/data/nsw-radar-places-v1.json` in the pinned release checkout, validates >=500 points and known anchors, then copies the static site to the GitHub Pages payload.

After publishing verify `/BUILD.txt` references the exact production commit, `/data/nsw-radar-places-v1.json` is valid JSON with accessible named points and the correct MIME type, `/src/context-layers/nsw-radar-place-catalogue-v1.js` points to the local JSON URL, and the full application renders in browser. Then create immutable annotated Git tag `v9.18.0` and `restore/v9.18.0` branch pointing to the same tested release SHA. Keep `v9.17.0` pinned and untouched. If any check fails, restore `.github/workflows/pages.yml` to its sealed v9.17.0 configuration and rerun Pages.

## Technical regression checks

`npm test` includes basemap layering, zero artificial source-frame duplication, NSW station overlays, track cleanup, NSW same-origin name loader/cache, local zoom viewport gating, pan-locked labels, adaptive mobile/desktop budgets and user interface contracts. The release workflow verifies live DEA tiles with CORS as well as each original government detail source. Performance remains browser-dependent; no guarantees about imagery timeliness or absolute positional precision.
