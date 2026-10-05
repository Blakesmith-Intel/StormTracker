STORMTRACKER OPERATIONAL V9.5 — OPERATIONAL RELEASE
Built against main commit fd5564b (working V9.4 automatic recovery).

INSTALL
Extract this ZIP into /workspaces/StormTracker. From the repository root:

python StormTracker_Operational_V9_5/install_v9_5.py

The installer validates actual prebuilt payloads and all 30 regression suites
before writing. It backs up originals, validates installed files and restores
original target files if checks fail. It protects unexpected local target edits.
No runtime server or additional application dependency is introduced.

COMMIT AND PUBLISH THE COMPLETE RELEASE
After a successful installation, from the repository root:

git add frontend README.md docs/OPERATIONAL_RELEASE.md scripts/check-frontend.mjs package.json .github/workflows/pages.yml
git commit -m "Release operational StormTracker with five-minute polling and gated deployment"
git push

This update includes repository documents and deployment wiring in addition to
frontend files, so the full git add command above is required. GitHub Pages runs
npm test (all 30 suites and active-module syntax) before upload and deployment.
Failing tests prevent publication. No relay redeployment is required.

CHANGES
- Automatic checks now run five minutes after the previous check finishes.
  Scheduled checks drop from approximately 60/hour to 12/hour while visible
  (80% fewer, before allowing for request duration).
  Manual refresh and immediate checks on visibility return remain available.
- The trade-off is up to five additional minutes to discover an available new
  pair, plus request/load time or waiting for a source to publish. The existing
  ten-minute reflectivity discovery offset is unchanged.
- GUI status reports five-minute checks. Cache-busting URLs are updated to V9.5.
- README.md now documents the current operational product, timing, recovery,
  scientific scope, tests and publication. docs/OPERATIONAL_RELEASE.md records
  the delivered scope, user acceptance, operating limits and release evidence.
- npm test now executes scripts/check-frontend.mjs, which checks active module
  syntax and every frontend regression suite. Pages runs it on Node 24 before
  publishing. A deliberate failing fixture verified nonzero test/gate behaviour.

COMPLETION
The user confirmed V9.4 recovery works. The agreed product scope is operationally
complete; this V9.5 package is ready to install and publish. No additional core
algorithm rewrite is required within that scope. All prior tracking, matching,
recovery, camera, opacity, AEST/UTC and historical validation behaviour is retained.
Scientific labels/limits remain explicit: live 3-D is inferred, Doppler is radial
velocity and convective/lightning assessment is ordinal, not a measured strike
feed or calibrated probability.

VERIFICATION
All 30 suites pass. Browser fixtures verify that the production scheduler arms
300000ms initially and after a completed check, and the status says five minutes.
Recovery, persistent ST history, matching gates, opacity, AEST/UTC, historical
regression and eight viewport layouts still pass. A failing suite is rejected by
the same release test command, and workflow order places validation before Pages
upload/deployment. Installer checks actual installed files and protected sources.

AFTER PUBLICATION
Confirm the live page reports five-minute checks and observe an update without
reloading. The agreed functionality is complete; this is the final deployed
smoke check for the reduced cadence, not additional core development.

PROJECT_CONTEXT.txt preserves the complete earlier handoff and continuation.
VERIFICATION/ contains regression, browser, publication-gate and installer logs.
