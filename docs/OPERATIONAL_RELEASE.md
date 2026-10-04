# StormTracker Operational V9.5

Release date: 4 October 2026 (AEST). Status: agreed operational scope complete;
V9.5 is ready for installation and publication through the existing Pages workflow.

The user confirmed V9.3 presentation controls and AEST display, and confirmed
V9.4 automatic Doppler recovery works. Automated regression, installer and browser
fixture checks supplement that deployed confirmation. V9.5 changes only scheduled
polling cadence and release/deployment documentation and validation wiring.

## Release changes

| Area | Operational behaviour |
| --- | --- |
| Polling | Five minutes after the previous check completes, while visible; immediate visibility-return check and manual refresh retained. |
| Workload | About 12 scheduled checks per hour instead of 60 (80% fewer), excluding request duration, manual actions and visibility-return checks. |
| Discovery delay | Existing ten-minute reflectivity discovery offset retained; polling can add up to five minutes, plus loading time and source-pair waiting. |
| Publication | New chronological reflectivity and independently newer matched Doppler timestamps for previously available radars. |
| Recovery | Twenty-second Doppler request deadline, fresh browser requests, rejected decoded-image eviction and scheduled retry. |
| Deployment | Active-module syntax and all 30 regression suites must pass before Pages upload/deployment. |

## Delivered scope

The main live product combines measured reflectivity, algorithmic persistent
storm identities and motion, and track-specific inferred vertical structure.
Doppler context and visual overlay use only radars 66/50/08 and retain independent
nearest-scan pairing within eight minutes. Matching tolerance never extends the
actual shared history. Latest GIF eligibility remains restricted to the original
newest radar time. Historical wind is never borrowed from current imagery.

Radar-only history supports the requested 30–180-minute windows. Doppler selection
switches to 30 minutes and longer radar selections show a warning. A requested
30-minute loop retains the accepted six-scan definition (six five-minute scans
span 25 minutes before source clipping). The BoM Doppler page may list seven
images; actual shared history, pairing and availability can reduce displayed
frames to five or fewer. The GUI shows actual frame count and span.

Playback repeats and supports pause, speed, scrubbing and latest-frame selection.
Automatic updates retain storm IDs/history, Play/Pause state, selected timestamp
when retained, camera and layer opacity settings. Opacity spans 0–100% for each
layer, with radar/Doppler defaults of 45%/80%. Source timestamps show AEST (fixed
UTC+10) and UTC; internal scientific comparisons remain UTC.

The dashboard keeps routine controls and legends visible without sidebar
scrolling. Advanced science, source information and track details use a dialog.
Frozen Christmas 2023 historical validation remains separate and explicitly
historical; switching modes preserves the loaded live product state.

## Validation evidence

- Thirty existing/new regression suites cover tracking, source palettes,
  georegistration, strict analytical versus broader visual Doppler sampling,
  footprint-based assessment, camera, inferred geometry and historical regression.
- Browser fixtures use production Cesium, worker, decoders and rendering with
  deterministic source imagery. They cover longer radar history, continuous
  playback, paired-source arrival order, outages, failure/retry, rejected source
  timestamps, persistent storm IDs, opacity and AEST/UTC.
- Browser layout checks cover 1366×768, 1280×720, 1024×600, 768×1024, 390×844,
  375×667, 320×568 and 844×390, with the longer-loop warning visible and hidden.
- Installer validation uses complete staged files, checksum checks, backups,
  rollback and checks of actual installed files. Protected algorithms are unchanged.
- User deployed confirmation: V9.4 recovery works without manual reload.
- V9.5 validation logs accompanying the installer record the final cadence,
  deployment-gate and browser checks; they do not claim an unattended live soak test.

## Completion boundaries

The [scientific contract](SCIENTIFIC_CONTRACT.md) remains authoritative. Live 3-D
structure is inferred, ST identities are algorithmic associations, Doppler is
radial velocity, and convective/lightning evidence scores are ordinal. Public
imagery, relay availability and third-party map/browser assets remain dependencies.
Broader radar coverage, true live multi-elevation volumes and calibrated lightning
probabilities are future scope, not unfinished requirements of this release.

After publishing, confirm the page reports five-minute checks and observe an
update without reloading. If upstream publication or a radar source stalls, the
current loop is retained, its timestamps/source age remain visible, and automatic
retry continues. Use manual refresh for an immediate additional check.
