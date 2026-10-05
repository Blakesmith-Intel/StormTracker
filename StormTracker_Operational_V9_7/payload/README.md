# StormTracker — Operational V9.7

A browser-based storm tracking and radar visualisation product using public Bureau
of Meteorology reflectivity and Doppler imagery. The existing operational core is retained. V9.4 automatic Doppler recovery was confirmed working by the user;
V9.5 reduced scheduled polling to five minutes and added a deployment test gate.
V9.7 extends coverage to all 19 public Queensland radar sites, with site-centred maps.

[Open StormTracker](https://blakesmith-intel.github.io/StormTracker/) ·
[Operational release record](docs/OPERATIONAL_RELEASE.md) ·
[Scientific contract](docs/SCIENTIFIC_CONTRACT.md)

## Product

- Measured 2-D reflectivity storm footprints, persistent `STxxxx` tracks and motion.
- Track-specific inferred 3-D structure, labelled with empirical support.
- All 19 Queensland sites selectable, plus the original south-east Queensland mosaic.
- Site selection centres the camera and loads the surrounding reflectivity tiles.
- Timestamp-matched Doppler overlays at 14 sites; five sites provide radar only.
- Existing calibrated Doppler analysis at 66/50/08; new wind overlays are display-only
  with nominal panel registration until independently calibrated.
- Radar history options of 30/60/90/120/150/180 minutes. Selecting Doppler switches
  to a 30-minute shared loop; choosing a longer window deselects Doppler and loads
  the longer radar history. Longer radar loops show the availability warning.
- Continuous replay with short whole-scene crossfades, Play/Pause, speed, frame
  slider and jump to latest. Camera gestures and manual controls cancel a fade;
  reduced-motion preferences are respected.
- Independent radar/Doppler opacity controls and AEST alongside UTC timestamps.
- Automatic matched-product updates every five minutes while the page is visible,
  plus a check when the page becomes visible. Manual refresh remains available.
- A separate, frozen Christmas 2023 historical tracking validation mode.

## Timing and recovery

Reflectivity discovery starts ten minutes behind wall-clock time, on a five-minute
scan grid. This is a deliberate discovery offset, not a guarantee of upstream
latency. Five-minute polling can add up to five minutes before a newly available
matching pair is discovered, plus request/loading time. Source age and actual
frame times are displayed. Publication waits for new matching radar and Doppler
scans from previously available radars in the selected region; it can wait longer
for a lagging source. Radar-only sites publish new reflectivity without a wind
request. A single-site view requests only that site's wind; an outage elsewhere
does not block it. Site changes start a new regional tracking history and clear
image/result caches; automatic refresh within a site preserves that history.
The camera snaps only on site selection or Reset view, and remains free otherwise.

The nominal scheduled rate drops from 60 to 12 checks per hour (80% fewer),
before allowing for request duration. Checks do not overlap. The next scheduled
check runs five minutes after the
previous check finishes. Hidden pages skip scheduled source requests; returning
to the page triggers a check. A failed Doppler request has a 20-second deadline,
rejected images are evicted from the decoded cache, and later checks retry while
retaining the current loop. Successful refreshes preserve tracking history,
playback state, opacity settings and camera.

## Scientific scope

Tracking and motion use measured 2-D reflectivity. The vertical structure is
inferred, not measured live 3-D radar. Doppler is radial velocity, not storm
translation speed. Convective/lightning assessments are ordinal evidence scores,
not direct strike observations or calibrated probabilities. Historical AURA
multi-elevation data remain a separate reference/validation pathway.

## Validation and deployment

No npm dependencies need installing. With Node.js available, run:

```bash
npm test
```

This validates active-module syntax and runs every `run-*-tests.mjs` suite in
`frontend/tests/` (32 at this release). GitHub Pages runs the same command on
Node 24 before publishing. A failure prevents deployment of that push.

Push changes to `main` to publish `frontend/` through
[the deployment workflow](.github/workflows/pages.yml). No local server or Python
runtime is needed to use the product. Node/Python are only development/installer
tools. The existing Cloudflare relay transports public source files and does no
storm modelling. This release requires one relay redeployment to permit the added wind products.
Run `bash scripts/deploy-qld-relay.sh` before publishing the frontend.
The helper runs the full test gate, uses the existing relay configuration when
available, and keeps its variables. Cloudflare authentication uses your existing
Wrangler setup. [Queensland coverage and registration](docs/QUEENSLAND_RADAR_COVERAGE.md).

## Repository

- `frontend/`: the published application, models and browser regression suites.
- `scripts/check-frontend.mjs`: the complete frontend test entry point.
- `relay/`: source transport worker and timestamp/history parsers.
- `docs/`: release record, scientific constraints and recovery provenance.
- `reference/python/`: recovered algorithm/reference material outside live runtime.

The frontend uses CesiumJS 1.145.0, an ellipsoid globe and OpenStreetMap imagery;
it does not require a Cesium ion token. Public imagery availability, the relay,
and externally hosted browser assets remain operating dependencies.
