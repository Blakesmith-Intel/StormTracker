STORMTRACKER OPERATIONAL V9.7.4 — CONSOLIDATED MOBILE + TRACK DISPLAY BUG FIX

BASELINE
Directly applicable to sealed v9.7.2 / commit aef6cc4f790774b018f02f5677481b5a2bcdaa04.
V9.7.4 supersedes the V9.7.3 candidate: DO NOT install V9.7.3 first.

INSTALL
Extract into /workspaces/StormTracker and run from the repository root:

python StormTracker_Operational_V9_7_4/install_v9_7_4.py

Then, after live acceptance:

git add frontend scripts/check-frontend.mjs docs/OPERATIONAL_RELEASE.md
git commit -m "Fix mobile controls, touch camera and storm-track visibility"
git push

ONE PATCH INCLUDES
- Compact map-first mobile interface.
- Radar/Doppler defaults rebalanced to 65% / 45%.
- Doppler display samples reduced to 2 px.
- Inferred-volume point-size default reduced to 2 px (adjustable to 1 px).
- One-finger pan, pinch zoom, two-finger twist rotation and two-finger pitch.
- Full existing Reset-view behaviour retained.
- Storm track markers/labels restored to the original fixed 1.2 km tracking plane.
- Track markers/labels remain visible above the 3-D point cloud and track trails
  receive a matching depth-fail material.

HISTORY FINDING
The track-display regression was introduced at commit
719ca13020ac209f81855dd7f7c2e6a54ae77fbd (3 Oct 2026), when track-specific
inferred volumes began anchoring the marker altitude to inferred echo top. The
worker still calculated tracks; their map overlay could be depth-occluded.
V9.7.4 changes display only and does not alter tracking/science algorithms.

VALIDATION
The installer stages the complete consolidated payload and runs the repository's
full frontend regression gate plus dedicated mobile/touch and track-visibility
contracts before writing files. All sealed scientific/tracking modules remain
protected. V9.7.2 remains the restore baseline until live V9.7.4 acceptance.
