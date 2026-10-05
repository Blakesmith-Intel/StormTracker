STORMTRACKER OPERATIONAL V9.6 — FINAL DISPLAY REFINEMENTS
Built against main commit f4a9925 (deployed/confirmed V9.5).

INSTALL
Extract this ZIP into /workspaces/StormTracker. From the repository root:

python StormTracker_Operational_V9_6/install_v9_6.py

The installer validates complete staged payloads, target hashes, UI element IDs,
active-module syntax and all 31 regression suites before writing. It backs up
original files, checks the actual installed product, and restores originals if
validation fails. It protects unexpected local target edits.

COMMIT AND PUBLISH
After successful installation, from the repository root:

git add frontend README.md docs/OPERATIONAL_RELEASE.md scripts/check-frontend.mjs
git commit -m "Deselect Doppler for longer loops and smooth frame playback"
git push

The existing Pages test gate runs all 31 suites before deployment. No relay
redeployment or application runtime dependency is added. The V9.5 release tag
was deliberately not created: the user added these final features before lock.
After confirming V9.6 on the deployed page, the final baseline can be tagged:

git tag -a v9.6.0 -m "StormTracker Operational V9.6 locked baseline"
git push origin v9.6.0

WINDOW SELECTION
Changing from a 30-minute shared loop to any longer window (60/90/120/150/180)
automatically unchecks Doppler, clears its visual overlay, and loads that longer
radar-only history. The selected duration is preserved. Selecting Doppler again
still returns to a 30-minute shared loop. The availability warning remains.
Analytical Doppler context is not fabricated for older radar-only frames.

SMOOTH PLAYBACK
Recorded frames crossfade the complete rendered map scene for up to 200ms,
scaled for playback speed. This smooths radar, Doppler, inferred volumes and ST
labels together. No radar scan, wind value, storm location, track observation or
score is interpolated; the effect blends display pixels only.

A reusable canvas snapshot is captured inside Cesium postRender while the WebGL
drawing buffer is valid. The new scene is allowed to render, then the browser
compositor fades the old snapshot. Point clouds are not recoloured on each tick.
Two new-scene render events allow imagery/point GPU updates to settle first.

Camera/pointer gestures, keyboard/manual controls, opacity changes, scrubbing,
pause, resize and page hiding cancel the visual fade. Pointer events pass through
the snapshot, so camera control remains free. Reduced-motion preferences and
unsupported/stalled snapshot paths show the actual frame immediately. The
compositor transition is awaited by the existing serial player, preventing
frame-render overlap. Provider attribution remains above the snapshot.

PRESERVED
Five-minute polling (about 12 scheduled checks/hour versus 60 at the original
one-minute interval, before request duration), ten-minute radar discovery offset,
eight-minute independent pairing, actual source-history bounds, timestamped
historical imagery, rejected-image recovery and 20-second Doppler request deadline.
ST identities/history, analysis/scoring, camera controller, opacity, AEST/UTC,
CI publication gate and frozen historical validation are retained.

VALIDATION
All 31 regression suites pass, including crossfade snapshot timing, animation,
cancellation/cleanup, reduced motion and stalled-render fallback. Browser fixtures
exercise all five longer selections with Doppler on, return-to-30 selection,
nonblank production Cesium snapshots, real compositor opacity between 0 and 1,
pointer cancellation, repeat playback, auto recovery, unchanged tracking,
opacity/AEST display, historical regression PASS and eight viewport layouts.
The installer checks a clean source copy and the actual installed files.

BEFORE LOCKING
On the deployed page, turn Doppler on then select a longer window: it should
uncheck automatically and load the selected history. Check smooth playback and
immediate camera response. The final tag remains on hold until this added display
behaviour is accepted; no v9.5.0 tag was created.

PROJECT_CONTEXT.txt retains the complete original handoff and all continuations.
VERIFICATION/ contains regression, browser and clean installation logs.
