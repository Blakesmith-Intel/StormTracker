# StormTracker — Operational V9.5

A browser-based storm tracking and radar visualisation product using public Bureau
of Meteorology reflectivity and Doppler imagery. The agreed operational scope is
complete. V9.4 automatic Doppler recovery was confirmed working by the user;
V9.5 reduces scheduled polling to five minutes and adds a deployment test gate.

[Open StormTracker](https://blakesmith-intel.github.io/StormTracker/) ·
[Operational release record](docs/OPERATIONAL_RELEASE.md) ·
[Scientific contract](docs/SCIENTIFIC_CONTRACT.md)

## Product

- Measured 2-D reflectivity storm footprints, persistent `STxxxx` tracks and motion.
- Track-specific inferred 3-D structure, labelled with empirical support.
- Timestamp-matched Doppler radial velocity from radars 66, 50 and 08.
- Radar history options of 30/60/90/120/150/180 minutes. Selecting Doppler switches
  to a 30-minute shared loop; longer radar loops show the availability warning.
- Continuous replay, Play/Pause, speed, frame slider and jump to latest.
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
scans from previously available radars; it can wait longer for a lagging source.

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
`frontend/tests/` (30 at this release). GitHub Pages runs the same command on
Node 24 before publishing. A failure prevents deployment of that push.

Push changes to `main` to publish `frontend/` through
[the deployment workflow](.github/workflows/pages.yml). No local server or Python
runtime is needed to use the product. Node/Python are only development/installer
tools. The existing Cloudflare relay transports public source files and does no
storm modelling. This release requires no relay redeployment.

## Repository

- `frontend/`: the published application, models and browser regression suites.
- `scripts/check-frontend.mjs`: the complete frontend test entry point.
- `relay/`: source transport worker and timestamp/history parsers.
- `docs/`: release record, scientific constraints and recovery provenance.
- `reference/python/`: recovered algorithm/reference material outside live runtime.

The frontend uses CesiumJS 1.145.0, an ellipsoid globe and OpenStreetMap imagery;
it does not require a Cesium ion token. Public imagery availability, the relay,
and externally hosted browser assets remain operating dependencies.
