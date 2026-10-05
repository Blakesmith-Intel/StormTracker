STORMTRACKER OPERATIONAL V9.4 — AUTOMATIC DOPPLER RECOVERY
Built against main commit 02806c8 (Operational V9.3).

INSTALL
Extract this ZIP into /workspaces/StormTracker. From the repository root:

python StormTracker_Operational_V9_4/install_v9_4.py

The installer validates checksums, syntax, UI element IDs and all 30 regression
suites against complete staged files before writing. It backs up targets and
checks the installed files again. Failures restore original target files;
unexpected target edits are protected.

PUBLISH AFTER SUCCESSFUL INSTALL

git add frontend
git commit -m "Recover automatic Doppler updates without page reload"
git push

The existing Pages workflow publishes V9.4. Only frontend files change; the relay
does not need redeployment. No additional runtime dependency is introduced.

PROBLEM AND CORRECTION
The user reported that automatic refresh could fail to obtain a new Doppler
image, while a manual reload recovered it. The exact original response/error
was not captured. Investigation reproduced a concrete recovery defect: a
successfully decoded image rejected for its source timestamp remained cached.
Later automatic checks reused the rejected record instead of fetching the
corrected source image. This is consistent with recovery after a page reload.

V9.4 removes rejected timestamped images from the decoded-image cache, so the
next scheduled check requests them again. Network/decode rejections already
remove their pending cache entry. Validated decoded images remain cached.

All Doppler history, latest-image and historical-PNG requests now use no-store
browser fetches. Successful decoded images still avoid repeated downloads in
the app cache. This does not disable the relay's existing upstream cache policy.

A 20-second deadline bounds the complete Doppler request, including body/image
consumption. A stalled request is aborted and rejected; later automatic checks
remain scheduled. Image decoding that has already entered synchronous work
cannot itself be interrupted, but its late result cannot publish a failed loop.

When a previously available radar's intake fails, the UI reports that radar and
retry state instead of only saying it is waiting for new products. Detailed
failure text is available on the automatic-status tooltip. A successful update
clears the old failure tooltip.

PRESERVED
The current paired loop is retained on failure and playback continues. Recovery
uses the existing independent 8-minute matching rule and real history bounds;
all previously available radars must still advance before automatic publication.
It appends only new radar observations, preserves ST identity/history, retains
Play/Pause state, camera, opacity settings and AEST + UTC display. Manual reload
is not needed for the reproduced recovery case. No scientific/scoring or
georegistration changes were introduced.

VALIDATION
30 Node regression suites pass. New request tests cover no-store for all three
actual loader paths, network/body stalls, abort, malformed/decode errors, HTTP
503, corrected retry and timer-driven recovery without a manual load.

Browser fixtures reproduce the rejected-timestamp cache defect against V9.3:
correcting the source without resetting the page still failed to advance.
Against V9.4 the same fixture automatically advances once after correction,
keeping the same ST identity and 37 unique chronological observations.
The browser checks also cover matching/outage gates, unchanged Doppler colours,
0/100% opacity, AEST + UTC, continuous replay, historical regression PASS, and
all controls/legends fitting without sidebar scrolling at eight viewport sizes.

After deploying, leave the live product running across at least two source
updates and confirm recovery without reloading. The original live incident
requires that deployed confirmation; fixture recovery is already verified.

PROJECT_CONTEXT.txt preserves all prior handoff and continuation material.
VERIFICATION/ includes the failing V9.3 reproduction and passing V9.4 checks.
