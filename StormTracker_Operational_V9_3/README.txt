STORMTRACKER OPERATIONAL V9.3
Built against main commit 155d684 (Operational V9.2).

INSTALL
Extract this ZIP into /workspaces/StormTracker. From the repository root:

python StormTracker_Operational_V9_3/install_v9_3.py

The installer validates complete staged files and all 29 regression suites before
writing. It backs up replaced files, checks the installed files, and restores
originals if those checks fail. Unexpected target edits are protected. No runtime
server or new dependency is required; Node is used only for installation checks.

PUBLISH AFTER SUCCESSFUL INSTALL

git add frontend
git commit -m "Add radar and Doppler opacity controls and AEST timestamps"
git push

The existing GitHub Pages workflow publishes V9.3. Relay redeployment is not
needed. The live iframe, stylesheet and module URLs use the V9.3 cache version.

NEW CONTROLS
- Separate Radar opacity and Doppler opacity sliders appear in Layers.
- 0% is fully transparent; 100% is fully opaque. Percentages update immediately.
- Defaults are 45% radar and 80% Doppler, close to the previous visual appearance.
- Opacity applies only to the measured reflectivity surface and Doppler overlay.
  Inferred 3-D confidence/support styling is unchanged.
- Settings are retained through playback, scrubbing, reload, Doppler radar changes
  and automatic matched-product updates during the current page session.
- Changing opacity does not reprocess scans, change samples, scores or motion,
  or stop playback. Doppler opacity is adjustable while the overlay is off.

TIMESTAMPS
- The current frame, loop range, radar source, scene frame and Doppler source
  timestamps now display both AEST and UTC, with AEST first.
- Source/detail timestamps show dates in both zones, including date/year rollover.
  Compact loop ranges include dates when an endpoint crosses midnight.
- AEST is fixed UTC+10 and does not inherit the device timezone or daylight saving.
- Internal data, pairing, source age, tracking and scientific timestamps stay UTC.

PRESERVED V9.2 BEHAVIOUR
Long radar-only history up to 180 minutes; 30-minute selection when Doppler is
chosen; warning for longer radar loops; independent 8-minute source pairing;
60-second automatic checks that wait for new matching radar and Doppler scans;
persistent ST identities/history during automatic refresh; continuous replay;
shared camera, georegistration and frozen historical validation.
The existing six-scan definition for a requested 30-minute loop is unchanged.
A displayed five-frame loop can still result from the actual source overlap.

VALIDATION
All 29 regression suites pass, including AEST/UTC conversion, invalid values and
date/year rollover. Browser fixture testing uses production Cesium and worker,
real renderers/decoders, and deterministic source imagery. Checks include 0/100%
opacity, independent values, unchanged Doppler RGB and tracker processing count,
settings through replay/refresh, dual timestamps, source-gated update/retry,
persistent storm IDs, historical regression PASS and eight viewport sizes with
warning on/off. All controls and legends fit without sidebar scrolling.
Final installer is tested against a clean checkout and the actual installed files.
Live BoM imagery remains subject to confirmation in your deployed browser.

PROJECT_CONTEXT.txt retains all prior handoff and continuation material.
VERIFICATION/ contains regression, browser and clean installer logs.
