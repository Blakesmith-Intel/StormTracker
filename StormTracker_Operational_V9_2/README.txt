STORMTRACKER OPERATIONAL V9.2
Built against main commit bc05c92 (installed Operational V9.1).

INSTALL
Extract this ZIP into /workspaces/StormTracker. From that repository root:

python StormTracker_Operational_V9_2/install_v9_2.py

The installer verifies checksums and complete staged files, runs all 28 regression
suites, backs up replaced files, then checks the installed files again. It refuses
to overwrite unexpected changes and rolls back if installed validation fails.
Node is required only for installation checks. Browser operation remains static.

PUBLISH
After a successful install, review git diff, then:

git add frontend
git commit -m "Restore long radar history and auto refresh matched Doppler loops"
git push

The existing GitHub Pages workflow publishes the product. Relay redeployment
is unnecessary. Reload the Pages product after deployment (V9.2 cache version).

BEHAVIOUR
- Retains the 30/60/90/120/150/180-minute selector for radar storm tracking.
  Longer radar-only loops retain older reflectivity rather than being clipped
  to Doppler history. Selecting a duration loads the requested history directly.
- Any duration longer than 30 minutes shows the Doppler availability warning.
  Selecting Doppler switches the selector to 30 minutes and reloads a shared
  radar/Doppler loop. Trying a longer duration while Doppler is on also returns
  to 30 minutes. Uncheck Doppler before choosing a longer radar history.
- Older radar frames outside the genuine shared interval have no Doppler context.
  They never inherit current or stale wind imagery. Tracking stays reflectivity
  based. Radars remain 66, 50 and 08 with the independent 8-minute pairing rule.
- Startup loads and replays a loop. Every 60 seconds while the page is visible,
  the app checks for newly published products; returning to the page also checks.
- Automatic publication requires a newer radar frame and independently newer
  paired Doppler timestamps for every previously available radar. A lagging or
  missing radar, unchanged scans or an unreadable newest image keep the existing
  loop. Failed fetches retry automatically. A newly added radar must pair too.
- The actual latest GIF remains eligible only at the original newest radar scan.
  Timestamp tolerance never extends the genuine shared history bounds.
- The old loop plays during discovery and downloads. Publication briefly pauses
  rendering; previous Play/Pause state and the selected timestamp are retained
  when it is still in the rolling window. Playback repeats continuously.
- Cached scans are not submitted to the tracker again on automatic updates.
  Storm IDs and observation histories persist. Only new chronological scans are
  appended; missing older scans do not reset automatic tracking. Requesting older
  uncached radar history manually rebuilds the sequence chronologically.
- Radar imagery/results are bounded to the most recent 36 scans; decoded Doppler
  images are trimmed to discovered/current sequence history. Camera is retained.
- Source mode, actual span, frame count, source outages and automatic update state
  are visible. Six scans at five-minute cadence span 25 minutes within the
  requested 30-minute window; this existing count definition is unchanged.

PRESERVED
Tracking/scoring algorithms, strict analytical and broader visual Doppler
sampling, inferred volume science, shared camera, map registration, deterministic
Christmas 2023 historical validation, and regression baselines.

VALIDATION
28 Node regression suites, syntax and dashboard element checks. Browser fixture
integration uses the production Cesium, actual worker, decoders, renderers and
historical validation, with deterministic source imagery substituted. Covers
36 scans / 36 storm observations, source arrival ordering, failed newest PNG,
retry, same ST identity / 37 unique observations after update, paused/playing
state retention, warning and Doppler selection, looping and eight viewport sizes.
Live BoM behaviour remains subject to confirmation on your deployed product.

PROJECT_CONTEXT.txt retains the complete prior handoff and continuation.
VERIFICATION/ contains regression, browser and installer validation logs.
