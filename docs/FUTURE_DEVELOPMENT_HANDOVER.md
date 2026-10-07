# StormTracker future development handover

**Starting production baseline:** V9.9.0  
**Accepted runtime commit:** `de724bdeb1d92d4dd4cb2e7f99492f548dd418f4`  
**Recovery reference:** `restore/v9.9.0`  
**Prepared:** 8 October 2026

## 1. Executive handover

StormTracker V9.9.0 is the protected production starting point for the next
development workflow. Wishlist item 1 — GA satellite context, place names and
optional 3-D terrain — is complete and sealed. The radar/tracking product is considered operationally
complete unless a specific defect is demonstrated. Future work should add
situational-awareness layers around it rather than casually reopening validated
tracking, Doppler or inferred-volume science.

Remaining context capabilities are:

1. Road closures from authoritative Queensland/NSW sources.
2. Electricity outage areas from Energex, Ergon Energy and Essential Energy.
3. Bureau of Meteorology flood/river gauges with tidal-aware abnormal-rise logic.
4. Observed lightning tracker, only from a legally reusable machine feed.

The preferred implementation order is now road closures, power outages, flood
gauges, then observed lightning unless source discovery materially changes the
order.

## 2. Non-negotiable production contract

- Browser-first static product. No localhost, user-managed server or local runtime
  is required by the deployed application.
- GitHub Pages frontend plus Cloudflare relay only where transport/CORS handling is
  needed.
- The relay is transport only; it must not become the meteorological modelling or
  tracking engine.
- Measured 2-D reflectivity drives storm identity and horizontal motion.
- `STxxxx` identifiers are algorithmic persistent associations.
- Live 3-D remains inferred, not measured volumetric radar.
- Doppler remains radial velocity and is not storm translation speed.
- Calibrated Doppler analysis remains limited to 08/50/66; other Doppler panels are
  display-only until independently calibrated.
- The +90-minute motion cone remains a measured-motion extrapolation aid, not a
  forecast probability or warning polygon.
- Five-minute live polling, Queensland radar coverage, mobile controls, track
  selection and source-recovery behaviour are protected baseline behaviour.

## 3. V9.8.2–V9.9.0 changes that must be preserved

### Source-aware history

The application no longer assumes that every nominal 30–180-minute loop is
available from the Bureau. It discovers real history and offers only supported
standard windows plus **All available**.

### Three-hour rolling browser history

Genuine reflectivity frames are persisted per radar view in IndexedDB. The Bureau
WMTS source was observed to expose a much shorter rolling window than three hours,
so StormTracker accumulates additional history prospectively in the browser.

At the three-hour display limit the window rolls forward: newest genuine
observations enter and observations older than the 180-minute display cutoff fall
out. The browser keeps roughly four hours as a storage safety buffer before
pruning.

### Bounded temporal gap fill

Missing five-minute display slots may be interpolated only between two genuine
bounding observations and only across gaps of 30 minutes or less. These frames are
explicitly labelled **INFERRED** and are display-only. They must never be fed into
track identity, Doppler analysis, convective scoring or measured-track-specific
volume calculations.

### Automatic history growth

V9.8.4 fixes the regression where historical cache growth only appeared after a
manual Refresh. The normal five-minute refresh remains lightweight and checks the
newest source frame. If genuine cached observations appear at/before the tracking
point already processed, StormTracker detects a historical backfill, rebuilds the
worker chronologically and expands the displayed loop automatically. Cache warming
also requests one immediate normal refresh after it adds previously uncached
observations.

Do not reintroduce the V9.8.3 behaviour where manual refresh was required for
historical loop growth.

### V9.9.0 situational context and interaction performance

V9.9.0 adds the accepted GA satellite basemap, place-name/boundary overlay and
optional 3-D terrain without changing the weather-science contract. Radar-only
automatic refresh at Doppler-capable sites is explicitly independent of Doppler
unless the user enables the Doppler overlay. Frame-slider bounds follow the full
dynamic loop length.

Camera interaction has a protected performance behaviour: terrain detail may be
temporarily relaxed only while the camera is moving, then returns to normal after
the gesture settles. Multi-touch pinch/rotate/pitch and high-delta wheel zoom are
batched to avoid redundant camera renders.

## 4. Architecture for future situational layers

Do not bolt each new feed directly into `live3d-operational-v9.js`. Create a
modular context-layer subsystem so source failures cannot affect radar/tracking.

Recommended structure:

```text
frontend/src/context-layers/
  layer-manager-v1.js
  source-status-v1.js
  context-feature-v1.js
  providers/
    dea-basemap-v1.js
    qldtraffic-v1.js
    livetraffic-nsw-v1.js
    energex-outages-v1.js
    ergon-outages-v1.js
    essential-outages-v1.js
    bom-water-gauges-v1.js
    lightning-provider-v1.js
```

Each source should expose loading/available/stale/failed state, source update time,
attribution and any source-specific legend. A contextual-source failure must never
block radar publication, playback, tracking or Doppler.

## 5. Recommended release train

| Release | Work package | Priority |
| --- | --- | --- |
| V9.9.0 | GA satellite + place labels + optional 3-D terrain — COMPLETE / SEALED | 1 |
| V9.10.0 | Road closures | 2 |
| V9.11.0 | Power outages | 3 |
| V9.12.0 | Flood gauges | 4 |
| V9.13.0 | Observed lightning | 5 |

Perform source-discovery work for outages and lightning early. If a clean,
authorised machine feed becomes available, the order can change.

## 6. Feature guardrails

### GA satellite basemap and terrain

Use the accepted Geoscience Australia cached imagery service unless a future
replacement is live-tested in the browser first. GA mode includes a transparent
place-name/boundary reference overlay raised above weather imagery. Optional 3-D
terrain uses ArcGIS WorldElevation3D/Terrain3D and must fall back cleanly to the
ellipsoid if unavailable. Basemap or terrain switching must not reset radar
history, camera, selected site, tracks, playback or the motion cone.

### Observed lightning

Do not relabel the existing ordinal convective/lightning assessment as observed
lightning. A direct layer requires an actual strike/event feed with reuse rights.
If only proprietary/scrape-only trackers are available, leave the feature blocked.

### Electricity outages

Use source-provided geometry only. Never invent outage polygons from points or
suburb names. Each distributor must fail independently.

### Flood/river gauges

Use official Bureau data and respect source rate limits. Tide-influenced gauges
need station-specific normal tidal baselines; do not use one arbitrary statewide
rise threshold.

### Road closures

Prefer official QLDTraffic and Transport for NSW machine feeds. Preserve source
geometry and official advice. Do not infer detours in the first release.

## 7. Testing and release discipline

Every contextual provider should have deterministic fixtures, parser and geometry
tests, timestamp/freshness tests, empty/malformed-source tests, timeout/failure
tests, cache/idempotence tests and an integration assertion that the provider
cannot block radar.

For every accepted release:

1. Branch from the current sealed baseline.
2. Write/confirm the external source contract before implementation.
3. Add provider + fixtures + tests.
4. Add UI and isolated failure handling.
5. Run the complete `npm test` suite.
6. Push through the normal GitHub Pages validation gate.
7. Perform live desktop/mobile acceptance.
8. Create the next immutable recovery reference only after acceptance.

The repository currently contains 44 frontend regression suites.

## 8. Current important files

- `frontend/index.html` — public entry shell.
- `frontend/live3d-operational-v9.html` — live operational UI.
- `frontend/src/live3d-operational-v9.js` — main live controller.
- `frontend/src/bom-wmts-loop-v2.js` — Bureau reflectivity discovery/loading.
- `frontend/src/radar-history-window-v1.js` — available-window and playback plans.
- `frontend/src/radar-temporal-interpolation-v1.js` — display-only temporal gap fill.
- `frontend/src/storage.js` — IndexedDB radar history.
- `frontend/src/live-loop-refresh-v1.js` — auto-refresh and chronology rebuild logic.
- `frontend/src/tracking.js` and worker path — measured 2-D tracking.
- `frontend/src/track-threat-cone-v1.js` — +90-minute motion cone.
- `relay/worker.js` — transport relay only.
- `scripts/check-frontend.mjs` — complete frontend validation entry point.
- `docs/BASELINE_RESTORE.md` — authoritative recovery procedure.
- `docs/OPERATIONAL_RELEASE.md` — cumulative operational release record.

## 9. Next workflow kickoff

```bash
git fetch origin
git switch -c feature/road-closures-v9.10.0 origin/restore/v9.9.0
npm test
```

Start with authoritative road-closure source discovery and keep the provider
inside the context-layer subsystem. Do not reopen tracking/science merely because
a situational layer is being added.

## 10. Optional harmless easter egg

A completely fictional, client-side-only joke effect such as **DEPLOY TACTICAL
EMU** remains acceptable only as a visual easter egg. It must have no real-world
device control, targeting, communications or external actuation.

That remains firmly a post-road-closures problem.
