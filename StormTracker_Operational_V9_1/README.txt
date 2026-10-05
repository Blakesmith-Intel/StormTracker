STORMTRACKER OPERATIONAL V9.1
Built against main commit b5fb310 (Operational V9).

INSTALL
Extract this ZIP into /workspaces/StormTracker. From that repository root:

python StormTracker_Operational_V9_1/install_v9_1.py

The installer validates prebuilt payload files and all 27 regression suites
before writing. It backs up replaced files and rolls back if installed checks
fail. It refuses to overwrite target files that differ from the inspected V9
source. No user-facing local server or new runtime dependency is introduced.

PUBLISH THROUGH EXISTING GITHUB PAGES
After a successful install, review git diff, then:

git add frontend
git commit -m "Align radar and Doppler history, repeat playback and compact dashboard"
git push

The existing Pages workflow publishes the product. The Cloudflare relay needs
no redeployment. The live iframe URL has a V9.1 cache-busting version.

BEHAVIOUR
- The requested 30/60/90/120/150/180 minute window is capped to the longest
  shared timestamp interval across reflectivity and available Doppler radars.
- Real source bounds define that interval. The eight-minute nearest-scan
  tolerance cannot extend it. Every retained frame has a readable paired
  Doppler frame for every available radar.
- Outages are labelled explicitly; unavailable radars are excluded from the
  shared interval. With no paired history, the loop refuses to show mismatched
  products and latest reflectivity refresh remains available.
- Failed image downloads are omitted from both timelines before tracking.
- The latest GIF remains eligible only for the original newest reflectivity
  time. It is never promoted to an older frame after trimming the sequence.
- Playback automatically repeats. Play/Pause, speed, slider and Latest remain
  available. Scrubbing and Latest pause playback. Reload stops the old player.
- The actual shared start/end, frame count and span are displayed separately
  from the requested duration. At five-minute cadence, six frames span 25
  minutes; this is shown honestly rather than calling it a 30-minute span.
- Controls and legends use a compact desktop/mobile dashboard. Inference
  controls, model metrics, track assessments and source details use a tabbed
  dialog. Detailed data may scroll; everyday controls and legends are fixed.
- The Doppler palette remains visible even with the overlay turned off.
- Latest-only refresh clears old storm labels and Doppler overlays.

PRESERVED
Tracking/scoring, strict analytical Doppler vs broader visual Doppler, shared
camera, georegistration, historical scenario and regression baselines.

VALIDATION
All 27 regression suites pass, including shared timeline and continuous-playback
checks. JavaScript syntax and dashboard IDs pass. Installer tested end-to-end
on a clean source copy, with the actual installed files tested again.
User confirmation of live BoM behaviour remains outstanding.

BROWSER CHECK AFTER PUBLISHING
Open the normal product URL and select a longer loop. Check that the actual
shared window is capped by Doppler availability, with paired wind data through
all displayed frames. Observe two full repeats, pause, scrub and jump to Latest.
Confirm the controls/legends fit your screen and Live -> Validation -> Live still
preserves the live state. Treat the update as visually validated only once
those checks pass on your browser.

PROJECT_CONTEXT.txt includes the full original handoff plus this continuation.
INSTALL_VERIFICATION.txt contains the completed clean-install test output.

Browser fixture checks passed at 1366x768, 1280x720, 1024x600, 768x1024,
390x844, 375x667, 320x568 and 844x390. Screen bounds confirm that the
controls and legends fit with zero sidebar scrolling. On the smallest phone,
the secondary operational summary is omitted to preserve map space; source
details remain available in the Sources tab.
