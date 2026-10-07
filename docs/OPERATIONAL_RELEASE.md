# StormTracker Operational V9.9.0

Release date: 8 October 2026 (AEST). Status: V9.9.0 full production release sealed and deployed; wishlist item 1 complete.

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
| Deployment | Active-module syntax and the current 45 frontend regression suites must pass before Pages upload/deployment. |

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

The Queensland relay expansion and frontend are deployed. V9.8.x radar-history
changes are browser/frontend changes and do not require a new relay deployment
unless a transport route itself changes.

## Delivered scope

The main live product combines measured reflectivity, algorithmic persistent
storm identities and motion, and track-specific inferred vertical structure.
Doppler track analysis retains calibrated radars 66/50/08. Wind overlays now
cover all 14 Doppler-capable Queensland sites and retain independent
nearest-scan pairing within eight minutes. Matching tolerance never extends the
actual shared history. Latest GIF eligibility remains restricted to the original
newest radar time. Historical wind is never borrowed from current imagery.

Radar-only history is source-aware. The UI exposes only supported
30/60/90/120/150/180-minute windows plus All available. Genuine reflectivity
frames are persisted per viewed radar in browser IndexedDB and can accumulate to
a rolling three-hour display history. The browser retains roughly four hours as a
storage buffer before pruning. As new observations arrive beyond three hours, the
oldest displayed observations fall outside the 180-minute window and the newest
ones enter.

Missing five-minute display slots may be interpolated only between genuine
bounding observations, for gaps no larger than 30 minutes. Those frames are
explicitly labelled INFERRED and excluded from tracking, Doppler analysis and
scoring. Doppler selection remains constrained to genuine shared 30-minute
history; selecting a longer or All available radar window deselects Doppler.

Playback repeats and supports pause, speed, scrubbing and latest-frame selection.
Automatic updates retain storm IDs/history, Play/Pause state, selected timestamp
when retained, camera and layer opacity settings. Opacity spans 0–100% for each
layer, with radar/Doppler defaults of 65%/45%. Source timestamps show AEST (fixed
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

- Forty-five frontend regression suites cover tracking, source palettes,
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
playback, forward live updates and automatic history growth without a manual
refresh. Five-minute checks remain unchanged. If upstream publication or a radar
source stalls, the current loop is retained, its timestamps/source age remain
visible, and automatic retry continues. The current production recovery reference
is `restore/v9.9.0`; manual Refresh remains available for an immediate check.

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


## V9.8.0 track focus, motion cone and display layering

V9.8.0 builds on accepted V9.7.5 track timestamp matching. Track labels can be hidden without hiding measured ST points/trails. A track selector can focus the display on one current ST identity while the underlying tracker continues processing the complete scene.

For one selected track, an optional +90-minute motion cone is drawn from the current measured track motion. Its centreline is constant-speed/constant-heading extrapolation; width starts with the current measured >=40 dBZ footprint radius and widens using recent track-heading variability, bounded to a display heuristic. The cone is an operational extrapolation aid only: it is not a forecast probability, warning polygon, lightning forecast or modelled storm evolution.

The inferred-volume point-size default is 3 px. The Doppler wind display is now a transparent georeferenced imagery layer below the reflectivity imagery, making radar visually primary by deterministic Cesium layer order. Doppler analysis inputs, calibration boundaries and source matching are unchanged.

V9.8.0 is a production-baseline candidate until live desktop/mobile acceptance and a dedicated v9.8.0 tag are completed. The v9.7.2 tag remains immutable historical recovery.


## V9.8.1 threat-cone visibility and turn response

V9.8.1 is a display/prediction-aid refinement on the accepted V9.8.0 feature set.
The selected-track +90-minute motion cone now uses a 12-degree direction-change
tolerance. Small frame-to-frame heading changes are smoothed from recent measured
motion segments; a turn of 12 degrees or more relative to the recent heading
baseline reorients the cone immediately on the next displayed radar frame.

The cone is more prominent on the map: fill opacity is increased, a distinct
track-coloured boundary is drawn, the dashed centreline is thicker, and the
+30/+60/+90 minute markers are larger with stronger outlines. The cone remains
a measured-motion extrapolation aid only. It is not a forecast probability,
warning polygon, or replacement for Bureau warnings.

No segmentation, ST identity association, Doppler analysis, inferred-volume model,
convective/lightning scoring, source timing, polling or radar-site logic changes
are made in this release.


## V9.8.2 source-aware radar history windows

V9.8.2 removes the fixed assumption that every 30–180-minute radar loop is
currently available from the Bureau WMTS history. StormTracker now discovers up
to the existing 180-minute radar-history horizon first, measures the real
timestamp span/cadence, and offers only standard loop windows that the currently
readable source frames can support.

The selector also exposes **All available**, labelled with the actual discovered
minutes and frame count. This option uses the complete readable history without
inventing scans or claiming an unsupported nominal window. The loop information
now reports the available source span, frame count and AEST/UTC range as well as
the loaded subset.

Doppler retains its 30-minute shared-history contract. Selecting Doppler switches
to 30 minutes only when a valid 30-minute radar window is available; otherwise
Doppler is deselected and the source limitation is reported. Changing to a
longer or All available radar-only window still deselects Doppler.

No segmentation, ST identity association, inferred-volume science, Doppler
decoding, motion-cone logic, polling cadence or radar-site definitions are
changed by this source-history correction.


## V9.8.3 three-hour radar playback

V9.8.3 extends reflectivity-history discovery across the complete three-hour
window for every selectable Queensland view. Discovery no longer stops at the
first missing timestamp; it probes the full horizon and retains older readable
observations when they exist.

Radar-only playback may fill missing five-minute display slots by temporal
interpolation between two genuine Bureau reflectivity observations. Interpolation
is bounded to gaps of 30 minutes or less and never extrapolates before the oldest
real observation or after the newest one. Each generated frame is visibly marked
as **INFERRED**, records its two bounding observation times, and is display-only.

Temporally inferred frames are excluded from storm-track association, Doppler
matching/analysis, convective-lightning scoring and measured-track-specific
volumes. The existing vertical-profile renderer may display inferred 3-D structure
from an inferred 2-D gap frame, but the interface labels the complete frame as
temporally inferred/display-only.

The history selector continues to expose only windows supported by the discovered
observed-plus-bounded-interpolation timeline, up to 180 minutes, plus **All
available**. The status line reports observed and inferred display-frame counts.
Doppler remains a real-source-only 30-minute shared-history product and does not
use inferred reflectivity frames.

This change does not invent weather before the oldest readable Bureau observation.
Live source frames are persisted in IndexedDB by radar view and retained as a
rolling browser-local history, so an actively used radar view can accumulate up
to three hours even when the upstream WMTS service exposes a shorter rolling
window. A three-hour option appears only when real observations plus bounded
interpolation provide coverage across that window (with individual gaps no larger
than the interpolation limit). Closing or not using a radar before its local cache
has accumulated that history cannot reconstruct earlier weather that the Bureau
no longer serves.

Live source diagnostics on 7 October 2026 found the production WMTS endpoint
exposing a variable recent window of roughly 40–65 minutes of scan span during
the checks. The automatic five-minute refresh therefore probes only for the
newest source image and adds it to the local history; full-horizon discovery is
reserved for initial/manual/site-change loads. After a successful full discovery,
StormTracker warms the browser cache with the remaining readable source frames
while the interface is idle, rather than preserving only the currently selected
display window. This lets a newly viewed site begin with the maximum history still
available upstream before the rolling local archive continues accumulating toward
three hours.


## V9.8.3 production seal

V9.8.3 was the accepted predecessor to V9.8.4. It introduced source-aware
three-hour radar history, browser-local persistence and cache warming. V9.8.4
supersedes it because automatic incorporation of newly recovered historical cache
frames required the chronology-rebuild correction documented below.


## V9.8.4 automatic history growth

V9.8.4 restores automatic expansion of the displayed radar loop as genuine
historical frames are added to the browser-local cache. The five-minute polling
cadence remains unchanged and still uses the cheap newest-frame source check.

When cached observations appear at or before the timestamp already processed by
the tracker, automatic refresh now recognises that the tracker must be rebuilt in
chronological order. The current selected radar window is then rebuilt from the
available genuine observations, bounded display-only interpolation is regenerated,
and the displayed loop grows without requiring the user to press Refresh.

The source-history cache warmer also requests one immediate normal auto-refresh
after it successfully adds previously uncached observations. This lets newly
recovered Bureau history appear as soon as cache warming finishes rather than
waiting for the next five-minute scheduled check.

The chronology guard remains in place for ordinary forward-only refreshes. It is
bypassed only when a real historical backfill is detected. Doppler remains limited
to genuine shared 30-minute history and does not use temporally inferred frames.


## V9.8.4 production seal

V9.8.4 is the current accepted full production release.

Accepted runtime commit:

```text
acbc6aa63829d0532e32c28c2b0a49030a29b276
```

The GitHub Pages deployment for that runtime completed successfully on
7 October 2026. The complete sealed repository state is preserved by
`restore/v9.8.4`.

The release keeps the five-minute lightweight newest-frame poll while restoring
automatic growth of the displayed loop when genuine older observations are added
to IndexedDB. Historical backfill is detected explicitly, the chronology guard is
relaxed only for that case, and the tracking worker is rebuilt from the available
observations in chronological order. Cache warm-up requests one immediate normal
refresh after it adds frames.

At the three-hour display limit the history behaves as a rolling window: new
observations enter, observations older than the 180-minute display cutoff leave,
and the persistent browser cache retains roughly four hours as a safety buffer
before pruning.

No V9.8.4 change converts inferred temporal frames into measurements. They remain
display-only and excluded from track identity, Doppler analysis and scoring.


## V9.9.0 GA / DEA basemap

V9.9.0 begins the situational-awareness layer programme with a basemap-only
extension. The existing OpenStreetMap basemap remains available as **Street** and
a new **GA satellite** option uses the official Digital Earth Australia OGC WMS
service.

The accepted candidate source is Geoscience Australia's public
`World_Bathymetry_Imagery` cached MapServer. The service contains satellite
imagery derived in part from Landsat, uses Web Mercator cached tiles, and is
consumed directly as a browser imagery layer. It is stable geographic context,
not current weather satellite imagery.

Basemap state is isolated in `frontend/src/context-layers/basemap-manager-v1.js`.
Switching replaces the bottom imagery provider only and must not reset or reload
radar history, storm tracks, Doppler state, playback, camera position or the
selected motion cone. The preference is persisted in browser localStorage.
GA imagery adds a transparent World Boundaries and Places reference layer that is
raised above radar/Doppler imagery so place names remain readable.

V9.9.0 also adds an independent optional terrain subsystem in
`frontend/src/context-layers/terrain-manager-v1.js`. It uses Cesium's native
`ArcGISTiledElevationTerrainProvider` against the public ArcGIS
WorldElevation3D/Terrain3D ImageServer. Terrain defaults on, persists its user
preference, and falls back to the normal ellipsoid surface if the elevation source
cannot be loaded. Terrain failure must never block radar, tracking or playback.

Basemap/label/terrain source failures report independently and do not block the
weather product.

V9.8.4 remains the sealed recovery baseline until this candidate receives live
desktop/mobile acceptance.


### V9.9.0 acceptance fixes

Live acceptance exposed two candidate defects before V9.9.0 was sealed.

1. The initial GA/DEA WMS candidate failed live browser tile acceptance. A second
   attempt that removed the fixed TIME still failed in the production browser.
   V9.9.0 therefore moved the basemap to Geoscience Australia's browser-safe
   cached `World_Bathymetry_Imagery` MapServer tiles, while retaining the same
   isolated basemap-switching architecture.
2. The HTML playback slider inherited a six-frame startup maximum. Although the
   frame label could continue advancing as longer histories loaded, the range
   thumb could remain clamped to that original limit. Slider min/max/value are now
   synchronised from the complete current frame array whenever frames load, grow,
   reset or render.
3. Live acceptance also showed that satellite imagery without a reference overlay
   was operationally poor for place recognition. GA mode now adds a transparent
   place-name/boundary overlay above the weather layers. An optional 3-D terrain
   control was added at the same time using ArcGIS WorldElevation3D/Terrain3D with
   automatic flat-terrain fallback.

These are display/source-integration fixes only; radar tracking, Doppler science,
three-hour history accumulation and temporal inference contracts are unchanged.


### V9.9.0 camera performance pass

Before sealing wishlist item 1, the live map received a low-risk interaction
performance pass. While the user is actively panning, zooming, rotating or
pitching, Cesium terrain mesh detail is temporarily relaxed by increasing globe
screen-space error from 4 to 8. The normal detail level is restored 160 ms after
the last interaction.

Two-finger touch handling now combines pinch range, rotation and pitch into one
camera view update per pointer event instead of up to three sequential Cesium
camera updates. High-delta mouse-wheel input similarly computes the complete zoom
step before rendering once.

These changes affect rendering workload only. Radar imagery, tracking, terrain
source, Doppler, source timing, three-hour history and inferred-volume science are
unchanged.


## V9.9.0 production seal

V9.9.0 is the current accepted full production release and completes wishlist
item 1.

Accepted runtime commit:

```text
de724bdeb1d92d4dd4cb2e7f99492f548dd418f4
```

The normal GitHub Pages validation/deployment workflow passed for that runtime on
8 October 2026 (AEST). The complete repository state is preserved by
`restore/v9.9.0`.

The sealed feature set adds switchable GA satellite context, transparent
place-name/boundary reference labels and optional 3-D terrain with flat fallback.
It also includes the live-acceptance corrections made during the V9.9.0 candidate:
dynamic playback-slider bounds, radar-only automatic refresh independent of
Doppler unless Doppler is enabled, and browser-safe cached GA imagery.

The final interaction-performance pass temporarily relaxes terrain mesh detail
only while the camera is actively moving, restores normal detail after 160 ms,
batches two-finger touch transforms into one camera update and avoids repeated
renders for high-delta mouse-wheel zoom.

No V9.9.0 change alters measured-reflectivity tracking, persistent ST identity,
Doppler science, temporal inference rules, three-hour history limits or the
scientific contract. `restore/v9.8.4` remains an immutable historical fallback.


## V9.9.1 Doppler playback smoothing candidate

V9.9.1 addresses the visible Doppler flicker observed during live loop playback.
The defect was in display-layer lifecycle rather than in Doppler data: the old
Cesium imagery layer was removed synchronously before the next
`SingleTileImageryProvider` had finished preparing, which exposed a blank interval
between otherwise valid frames.

The candidate now double-buffers Doppler imagery. The current genuine Doppler
frame remains visible until the next genuine matched frame is ready, then the two
layers crossfade using complementary alpha for approximately 100–180 ms depending
on playback speed. Repeated use of the same source frame is reused without a
rebuild. If a radar frame has no valid matched Doppler observation, the old wind
layer fades out over 120 ms rather than being held or temporally invented.

This is a presentation-only change. Doppler decoding, radial velocities,
georegistration, matching tolerance, 30-minute source-history boundary, analytical
samples, radar tracking and inferred-volume science are unchanged.

V9.9.0 remains the sealed recovery baseline pending live acceptance of this patch.
