STORMTRACKER OPERATIONAL V9.7.2 — FINAL BASELINE

This final cleanup is based on committed main fc426949. It adds no science or source logic.

FINAL CHANGES
- Cesium/OpenStreetMap attribution is moved into a dedicated static credit container outside the frame crossfade, preventing the logo/credits flashing on each weather frame. Attribution remains visible.
- The camera-corrections diagnostic counter remains removed. Reset view remains because it is functional.
- The user-facing Test / Historical Validation mode, page and UI controller are removed from the published frontend.
- Christmas 2023 scenario/regression modules and Node suites remain internal engineering regression protection.
- A new production-shell regression contract checks these final boundaries.

ONE-COMMAND SEAL (from /workspaces/StormTracker)

python StormTracker_Operational_V9_7_2/finalise_v9_7_2.py --seal

That command installs and validates the payload, stages ONLY the named baseline paths, commits them, creates annotated tag v9.7.2, pushes main and the tag, verifies the remote main SHA, and writes FINAL_RESTORE_POINT.txt into this package directory. Existing unrelated untracked files are not staged.

RESTORE AFTER SEAL

git fetch origin --tags
git switch -c restore/v9.7.2 v9.7.2
npm test

The existing Queensland relay expansion is unchanged by V9.7.2. No additional relay deployment is needed if the V9.7 relay was already deployed. If it was not, deploy the V9.7 relay separately before expecting the added Doppler sites to work.
