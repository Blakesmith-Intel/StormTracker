# StormTracker — browser-native reconstruction

This is the reconstructed StormTracker baseline after the original Codespace/repository was lost.

## What is preserved

The validated storm logic has been translated into dependency-free ES modules: categorical reflectivity segmentation, multi-radar duplicate suppression, persistent `STxxxx` tracking, the 140 km/h motion gate, Doppler context scoring, freshness handling and public-only lightning likelihood.

## What changed deliberately

The live runtime no longer depends on Python, FastAPI, SQLite, NumPy, rasterio, pyproj, GDAL or a modelling service. The application is static HTML/CSS/JavaScript and performs live analysis in the browser using Web Workers.

Historical AURA true-3-D processing is not part of the live runtime. It remains a validation/reference pathway only.

## Repository structure

- `frontend/` — deployable browser application
- `frontend/src/workers/` — browser analysis worker
- `frontend/tests/` — dependency-free regression tests
- `config/` — project/source policy
- `docs/` — scientific and recovery notes
- `reference/python/` — recovered algorithm specification/reference only
- `.github/workflows/pages.yml` — optional static GitHub Pages deployment

## Immediate test

No npm install is required.

If Node is available, the pure algorithm tests can be run with:

```bash
npm test
```

For the actual application, publish the repository as static files (for example GitHub Pages) and open `frontend/index.html`. The browser app includes a synthetic multi-frame Stapylton demo that exercises segmentation, tracking and lightning-likelihood logic without any external data source.

## Live Bureau imagery

The live image adapter accepts an HTTPS image URL or a user-selected image. Browser pixel access requires the remote server to permit CORS. If the Bureau endpoint does not permit readable cross-origin images, use a minimal static/serverless file mirror; do not move analysis into the relay.

The exact final RGB palette tables from the lost repository were not fully recoverable. `frontend/src/palette.js` is intentionally explicit about this: it contains the scientific dBZ class intervals and a configurable RGB decoder. Replace/calibrate the `reflectivityRgb` and `dopplerRgb` mappings using real source frames before claiming live operational parity.

## Cesium

The browser UI pins CesiumJS 1.145.0 from unpkg. CesiumJS remains a browser library only; it is not a modelling engine. The app uses an ellipsoid globe and OpenStreetMap imagery and does not require a Cesium ion token.
