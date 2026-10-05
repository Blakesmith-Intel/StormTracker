STORMTRACKER OPERATIONAL V9.7 — QUEENSLAND COVERAGE
Built against main commit 99fcec5 (V9.6).

Extract this ZIP into /workspaces/StormTracker and run from that repository root:

python StormTracker_Operational_V9_7/install_v9_7.py
bash scripts/deploy-qld-relay.sh
git add frontend relay/worker.js relay/doppler-history-v1.js scripts/check-frontend.mjs scripts/deploy-qld-relay.sh README.md docs/OPERATIONAL_RELEASE.md docs/QUEENSLAND_RADAR_COVERAGE.md
git commit -m "Add all Queensland radar sites and centre map on selection"
git push

The relay deployment is required once: its previous allowlist only accepted
08/50/66. Deploy before pushing the frontend so added wind sites can load.
The helper runs the test gate, uses your existing relay config if present,
preserves variables and uses your existing Wrangler Cloudflare authentication.
No configuration file, account identity or credential is bundled or replaced.
Only named relay source files are staged; relay cache/config files stay out.

The installer checks staged payloads and actual installed files, backs up
originals, rolls back failed validation and rejects unexpected target edits.
All 32 Node regression suites run before writes and after installation.
The existing Pages workflow also runs that same test gate before publishing.

COVERAGE
19 public Queensland sites plus the existing SEQ regional view. 14 sites have
Doppler; Bowen, Gladstone, Longreach, Mornington Island and Warrego are radar only.
Selecting a site loads national reflectivity mosaic tiles around that location,
centres the camera, clears old geographic caches and starts new regional ST
associations. Reset view returns to the selected radar. Pan/orbit remain free;
automatic refresh and playback retain your chosen camera view.

A single-site loop loads only its own Doppler, so an outage elsewhere does not
block it. Standard sites update on new radar images without requesting wind.
Wind-capable sites retain independent timestamp matching and paired updates.
Doppler selection remains a 30-minute loop; longer windows deselect it. Repeat
crossfade playback, opacity, AEST/UTC, request recovery, tracking continuity
within a site, five-minute polling and historical validation are preserved.

REGISTRATION BOUNDARY
The 11 added wind overlays use nominal 128-km / 512-pixel map registration with
each BoM product page's own origin. Their positions are approximate. They are
labelled display-only and excluded from precise storm-cell wind analysis until
independently calibrated. The original recovered 08/50/66 calibration and strict
analytical logic remain unchanged. Measured reflectivity tracking works at all
19 selected locations. See docs/QUEENSLAND_RADAR_COVERAGE.md for full inventory.

ACCEPTANCE
On the published page choose a northern, western and south-east site; the camera
should centre, the source region should reload, and the selected wind should
appear where available. Standard sites disable Doppler. Pan then allow an auto
update: it should preserve your view. Reset returns to the selected site.
A baseline tag remains held until this expanded deployed release is accepted.

PROJECT_CONTEXT.txt retains the entire original handoff and all continuations.
VERIFICATION/ contains Node, production-browser/source-image and installer logs.
