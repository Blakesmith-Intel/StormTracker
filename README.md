# StormTracker — Operational V9.9.0

StormTracker is a browser-native Queensland radar and storm-tracking product built
from public Bureau of Meteorology imagery. The production application runs from
GitHub Pages, with a small Cloudflare relay used only where browser/CORS transport
requires it. Tracking, inference and product logic remain in the browser.

[Open StormTracker](https://blakesmith-intel.github.io/StormTracker/) ·
[Operational release record](docs/OPERATIONAL_RELEASE.md) ·
[Scientific contract](docs/SCIENTIFIC_CONTRACT.md) ·
[Production restore point](docs/BASELINE_RESTORE.md) ·
[Future development handover](docs/FUTURE_DEVELOPMENT_HANDOVER.md)

## Current production product

- All 19 public Queensland radar sites are selectable, plus the south-east
  Queensland regional view. Selecting a site centres the map on that radar.
- Measured 2-D reflectivity drives persistent `STxxxx` storm identities and
  horizontal motion.
- Track-specific 3-D structure is inferred from measured 2-D reflectivity and is
  explicitly labelled as inferred rather than measured volumetric radar.
- Doppler overlays are available at 14 sites. Footprint-restricted Doppler
  analysis remains calibrated only for 08 Gympie, 50 Marburg and 66 Mt Stapylton;
  the other wind panels are display-only until independently calibrated.
- A selected storm track can display labels, track-specific inferred structure
  and a +90-minute measured-motion cone. The cone is an operational extrapolation
  aid, not a warning polygon or forecast probability.
- Radar/Doppler opacity controls, AEST and UTC timestamps, continuous playback,
  Play/Pause, speed control, frame scrubbing and jump-to-latest are retained.
- Mobile uses compact controls with explicit one-finger pan, pinch zoom,
  two-finger rotation and pitch gestures.

## Basemap switching

V9.9.0 adds the first situational-awareness extension without changing the
protected radar/tracking core.

- **Street** retains the existing OpenStreetMap basemap.
- **GA satellite** uses Geoscience Australia's public cached
  **World Bathymetry, Imagery and Hillshade** service. That service includes
  Landsat-derived satellite imagery and is published as a Web Mercator tile cache.
  StormTracker consumes the cached tiles directly rather than relying on the DEA
  time-enabled WMS path that proved unreliable in browser acceptance testing.
- GA satellite mode adds a transparent **World Boundaries and Places** reference
  layer above the weather imagery so towns and place names remain readable.
- Optional **3-D terrain** uses the public ArcGIS WorldElevation3D/Terrain3D
  elevation service through Cesium's native ArcGIS terrain provider. If terrain
  fails, StormTracker falls back to the normal ellipsoid surface without affecting
  radar, tracks or playback.
- The selected basemap and terrain preference are stored in localStorage and
  restored on the next visit.
- Switching basemaps replaces only the bottom imagery layer. It does not reset the
  camera, selected radar, radar history, tracks, Doppler state, playback or motion
  cone.
- A basemap-source failure is reported independently and does not block weather
  layers or tracking.
- The playback frame slider is dynamically resynchronised to the complete loaded
  frame count whenever history grows, rather than retaining its original six-frame
  startup maximum.

The V9.8.4 recovery baseline remains available as `restore/v9.8.4` until V9.9.0
is live-accepted and separately sealed.

## Radar history and automatic updating

V9.8.4 uses source-aware history instead of assuming every fixed loop is always
available.

- The loop selector offers only 30/60/90/120/150/180-minute windows that the
  currently available observations can support, plus **All available**.
- Genuine reflectivity frames are persisted per radar view in browser IndexedDB.
  An actively viewed radar can accumulate a rolling history of up to three hours
  even when the Bureau WMTS endpoint exposes a shorter recent history.
- Once three hours is reached, playback becomes a rolling window: new genuine
  observations enter at the newest end and observations older than the
  180-minute display cutoff fall out of the loop.
- The browser cache keeps roughly four hours as a safety buffer before pruning.
- Missing five-minute display slots may be filled only between genuine bounding
  observations, for gaps no larger than 30 minutes. These frames are visibly
  marked **INFERRED** and are excluded from storm identity, Doppler analysis,
  convective scoring and measured-track-specific volumes.
- The normal live check remains every five minutes while the page is visible.
  Returning to a visible page triggers an immediate check.
- V9.8.4 restores automatic loop growth: when cache warming or later polling adds
  genuine historical observations behind the already-processed tracking point,
  StormTracker performs a chronological rebuild and expands the displayed loop
  without requiring a manual Refresh click.
- Doppler remains a genuine-source-only 30-minute shared-history product.
  Selecting Doppler switches to 30 minutes; selecting a longer or All available
  radar window deselects Doppler.

Manual **Refresh latest** remains available for an immediate check, but normal
history growth should not require it.

## Timing and recovery

Reflectivity discovery follows the established five-minute timestamp grid and
publication-delay allowance. The next scheduled check runs five minutes after the
previous check completes, so checks do not overlap.

If a source stalls or the newest frame cannot be loaded, StormTracker retains the
current loop and retries later. Rejected Doppler images do not poison future
retries. Site changes start a fresh tracking association for the selected
geographic view; ordinary automatic updates within that view preserve track
history unless newly recovered historical observations require an explicit
chronological rebuild.

## Scientific boundaries

- Tracking and motion use measured 2-D reflectivity.
- Live 3-D is inferred, not measured live volumetric radar.
- Doppler is radial velocity, not storm translation speed or a stand-alone
  diagnosis of rotation.
- Temporally interpolated radar frames are display-only.
- Convective/lightning assessment is ordinal radar/Doppler evidence, not detected
  lightning strikes or a calibrated probability.
- Historical AURA multi-elevation work remains reference/validation material and
  is not presented as the live source.

See [docs/SCIENTIFIC_CONTRACT.md](docs/SCIENTIFIC_CONTRACT.md) for the full
scientific contract.

## Validation and deployment

No production npm package installation is required. With Node.js available:

```bash
npm test
```

The repository currently contains 42 `frontend/tests/run-*-tests.mjs` regression
suites covering source timing, tracking, Doppler, georegistration, inferred
structure, Queensland sites, playback/history, temporal interpolation, mobile UI
and production-shell contracts. GitHub Pages runs the frontend validation gate
before publishing; a failed gate prevents deployment.

The accepted V9.8.4 runtime commit is:

```text
acbc6aa63829d0532e32c28c2b0a49030a29b276
```

Its Pages deployment completed successfully on 7 October 2026. The complete
sealed repository state is preserved by `restore/v9.8.4`; see
[docs/BASELINE_RESTORE.md](docs/BASELINE_RESTORE.md).

The user-facing product requires only a web browser. Node/Python are development
and test tools, not runtime requirements. The Cloudflare worker remains a
transport layer only and must not become the tracking or meteorological modelling
engine.

## Repository map

- `frontend/` — published application, models and browser regression suites.
- `frontend/src/live3d-operational-v9.js` — current operational controller.
- `frontend/src/radar-history-window-v1.js` — source-aware loop planning.
- `frontend/src/radar-temporal-interpolation-v1.js` — bounded display-only gap
  interpolation.
- `frontend/src/storage.js` — browser-local radar history persistence.
- `frontend/src/live-loop-refresh-v1.js` — five-minute refresh and chronology
  rebuild decisions.
- `scripts/check-frontend.mjs` — frontend validation entry point.
- `relay/` — public-source transport/CORS relay.
- `docs/` — release record, scientific boundaries, restore notes and handover.
- `reference/python/` — historical/recovered reference material outside the live
  browser runtime.

The current basemap remains OpenStreetMap. A switchable Geoscience Australia /
Digital Earth Australia satellite basemap and other situational-awareness layers
are planned as a separate future subsystem rather than being coupled into the
protected radar/tracking core.
