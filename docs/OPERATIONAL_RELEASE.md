# StormTracker Operational V9.7.4

Release date: 4 October 2026 (AEST). Status: Queensland expansion prepared for installation;
relay/frontend publication and deployed acceptance remain pending.

The user confirmed V9.3 presentation controls and AEST display, and confirmed
V9.4 automatic Doppler recovery works. Automated regression, installer and browser
fixture checks supplement that deployed confirmation. V9.5 five-minute cadence was also confirmed on the deployed page. The user accepted V9.6 display refinements, then requested all remaining
Queensland sites and a map snap to the selected radar. V9.7 adds that coverage;
new nominally registered Doppler panels remain display-only pending calibration. The v9.5.0 tag was not created.

## Release changes

| Area | Operational behaviour |
| --- | --- |
| Polling | Five minutes after the previous check completes, while visible; immediate visibility-return check and manual refresh retained. |
| Workload | About 12 scheduled checks per hour instead of 60 (80% fewer), excluding request duration, manual actions and visibility-return checks. |
| Discovery delay | Existing ten-minute reflectivity discovery offset retained; polling can add up to five minutes, plus loading time and source-pair waiting. |
| Publication | New chronological reflectivity and independently newer matched Doppler timestamps for previously available radars. |
| Recovery | Twenty-second Doppler request deadline, fresh browser requests, rejected decoded-image eviction and scheduled retry. |
| Deployment | Active-module syntax and all 33 regression suites must pass before Pages upload/deployment. |

## Queensland expansion

All 19 public Queensland sites are selectable, plus the original regional view.
The camera centres on a selected site and Reset view returns there. Automatic
refresh preserves free pan/orbit. Site-specific WMTS windows cover the radar and
surrounding storm approaches; they remain national reflectivity mosaic data,
not isolated raw scans from the selected instrument.

The 14 wind products are accepted by the updated transport relay, including
106/107/108. A single-site view gates publication on its own matching wind only.
The five standard sites use radar-only histories and update without wind.
Changing site clears prior geographic image/result caches and starts new ST
associations; polling within that region preserves associations and observations.

The three existing recovered Doppler map calibrations are unchanged. The 11
added wind panels use their own BoM loop-page origins and the nominal 128-km,
512-pixel map plane. Their position is approximate and their samples are excluded
from footprint-restricted storm analysis until independently calibrated. This
boundary is visible beside the loop information and recorded in the site registry.
See [coverage inventory](QUEENSLAND_RADAR_COVERAGE.md).

Deploy the updated relay once with `bash scripts/deploy-qld-relay.sh`, then publish
the frontend through the existing Pages workflow. Neither has been deployed by
the installer itself. Tagging remains held until the expanded deployed product is
accepted.

## Delivered scope

The main live product combines measured reflectivity, algorithmic persistent
storm identities and motion, and track-specific inferred vertical structure.
Doppler track analysis retains calibrated radars 66/50/08. Wind overlays now
cover all 14 Doppler-capable Queensland sites and retain independent
nearest-scan pairing within eight minutes. Matching tolerance never extends the
actual shared history. Latest GIF eligibility remains restricted to the original
newest radar time. Historical wind is never borrowed from current imagery.

Radar-only history supports the requested 30–180-minute windows. Doppler selection
switches to 30 minutes. Changing from 30 minutes to a longer window automatically
deselects Doppler and loads the longer radar history, while retaining the
availability warning. A requested
30-minute loop retains the accepted six-scan definition (six five-minute scans
span 25 minutes before source clipping). The BoM Doppler page may list seven
images; actual shared history, pairing and availability can reduce displayed
frames to five or fewer. The GUI shows actual frame count and span.

Playback repeats and supports pause, speed, scrubbing and latest-frame selection.
Automatic updates retain storm IDs/history, Play/Pause state, selected timestamp
when retained, camera and layer opacity settings. Opacity spans 0–100% for each
layer, with radar/Doppler defaults of 45%/80%. Source timestamps show AEST (fixed
UTC+10) and UTC; internal scientific comparisons remain UTC.

Playback now crossfades snapshots of the complete rendered scene for up to
200 milliseconds, scaled for playback speed. This smooths radar, Doppler,
inferred structure and track display together without generating synthetic
radar scans, interpolated Doppler velocities or new track observations. The
snapshot is captured inside Cesium's post-render event and faded by the browser
compositor; point clouds are not recoloured each animation tick. Camera gestures,
manual controls, pause, resizing and visibility changes cancel the fade. Reduced
motion and stalled/unsupported capture paths use immediate real-frame display.

The dashboard keeps routine controls and legends visible without sidebar
scrolling. Advanced science, source information and track details use a dialog.
The Christmas 2023 scenario/regression contracts remain internal engineering tests only. Their user-facing historical-validation page and production mode switch are removed from the published product.

## Validation evidence

- Thirty-three existing/new regression suites cover tracking, source palettes,
  georegistration, strict analytical versus broader visual Doppler sampling,
  footprint-based assessment, camera, inferred geometry and historical regression.
- Browser fixtures use production Cesium, worker, decoders and rendering with
  deterministic source imagery. They cover longer radar history, continuous
  playback, paired-source arrival order, outages, failure/retry, rejected source
  timestamps, persistent storm IDs, opacity and AEST/UTC.
- Queensland checks cover all 19 site changes, camera centring, cache/history
  resets, single-source update gating, standard-site updates and all 14 real BoM
  GIF palette/layout decodes.
- Browser layout checks cover 1366×768, 1280×720, 1024×600, 768×1024, 390×844,
  375×667, 320×568 and 844×390, with the longer-loop warning visible and hidden.
- Installer validation uses complete staged files, checksum checks, backups,
  rollback and checks of actual installed files. Protected algorithms are unchanged.
- User deployed confirmation: V9.4 recovery works without manual reload; V9.5
  correctly displays five-minute checks.
- V9.7.2 validation logs accompanying the installer record the final cadence,
  deployment-gate and browser checks; they do not claim an unattended live soak test.

## Completion boundaries

The [scientific contract](SCIENTIFIC_CONTRACT.md) remains authoritative. Live 3-D
structure is inferred, ST identities are algorithmic associations, Doppler is
radial velocity, and convective/lightning evidence scores are ordinal. Public
imagery, relay availability and third-party map/browser assets remain dependencies.
True live multi-elevation volumes and calibrated lightning
probabilities are future scope, not unfinished requirements of this release.

After publishing, confirm automatic Doppler deselection at longer windows, smooth
playback and an update without reloading. Use the final annotated `v9.7.2` tag as the restore point after sealing this release. Five-minute checks remain unchanged. If upstream publication or a radar source stalls, the
current loop is retained, its timestamps/source age remain visible, and automatic
retry continues. Use manual refresh for an immediate additional check.

## V9.7.1 interface cleanup

Removed the diagnostic camera-corrections counter from the map toolbar and its
display callback. Reset view remains functional: it returns to the selected
radar after user pan/orbit, or to the original regional home for SEQ. Camera
control and site selection are unchanged. This frontend-only update requires
no additional relay deployment.

## V9.7.2 final production cleanup

The public entry point is now live-weather only. The historical validation page,
its page controller and the production mode switch are removed from the published
frontend. The Christmas 2023 scenario/regression modules and Node tests remain
internal regression protection.

Cesium attribution is hosted in a dedicated DOM credit container above and outside
the weather-frame crossfade. The Cesium logo/provider credits therefore remain
static while frames change. Attribution is not hidden or removed.

The camera-corrections counter remains removed. Reset view remains because it
returns to the selected radar (or SEQ home) after manual pan/orbit.

The final restore point is the annotated tag `v9.7.2` and its exact commit SHA;
see `docs/BASELINE_RESTORE.md`. No scientific, source-pairing, tracking, scoring,
radar-site, polling or relay logic changes are made in this cleanup.


## V9.7.4 mobile bug fix

V9.7.2 remains the sealed recovery baseline while this patch is verified on an
actual mobile browser. The patch is display/input only; tracking, source timing,
Doppler matching, inferred-volume science and Queensland source definitions are
unchanged.

Mobile controls now occupy approximately 40–42% of the dynamic viewport rather
than expanding around the full overview and legends. The detailed overview,
legend dock and inference toggle are suppressed only on narrow screens; the map
remains the dominant panel and the compact control area can scroll if an unusually
short viewport cannot fit all essential controls. Full desktop/tablet layout is
unchanged.

Radar is now visually primary by default (65% reflectivity / 45% Doppler). Doppler
display primitives are reduced from 4 px to 2 px, lowered from 180 m to 90 m above
the ellipsoid, and no longer disable depth testing. Track-specific inferred points
default to 2 px and may be reduced to 1 px in inference controls. These are visual
changes only; decoded pixels/samples and analytical inputs are unchanged.

Touch camera input is now explicitly multi-touch because the shared desktop camera
controller intentionally disables Cesium native gestures. One finger pans. Pinch
zooms continuously. Two-finger twist rotates heading, and two-finger vertical drag
changes pitch. Touch events are intercepted before the legacy single-pointer
handler so pinch/twist cannot be swallowed as pan. Mouse behaviour and Reset view
are unchanged.

Do not move or replace tag `v9.7.2`. After live iPhone verification, commit V9.7.4
as a normal bug-fix release and tag it separately only if accepted.


## V9.7.4 consolidated mobile + track-overlay bug fix

V9.7.4 supersedes the uninstalled V9.7.3 candidate and is installed directly on
the sealed V9.7.2 baseline. It contains all V9.7.3 mobile layout, touch-camera,
layer-balance and point-size corrections plus the track-rendering correction below.
Only V9.7.4 needs to be installed.

Project-history review identified the track-visibility regression at commit
`719ca13020ac209f81855dd7f7c2e6a54ae77fbd` (3 October 2026),
“Anchor inferred 3-D storm volumes to measured 2-D track masks”. Before that
change, measured track markers and trails used a fixed 1.2 km display plane. The
change moved track markers to the inferred echo-top while also introducing a dense
track-specific point volume. Normal depth testing could therefore hide otherwise
valid ST markers, labels and trails even though the worker continued producing
tracks.

V9.7.4 restores only the display contract: track marker/label/history altitude is
again the fixed 1.2 km tracking plane; markers and labels disable depth testing;
trails use the same colour as a depth-fail material. Tracking identity, segmentation,
motion, confidence, Doppler context, inferred volumes and scoring are untouched.
