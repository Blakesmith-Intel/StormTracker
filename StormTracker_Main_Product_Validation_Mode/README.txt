StormTracker main-product Historical Validation mode

What this does
--------------
The normal StormTracker root becomes a thin browser-native mode shell.

LIVE WEATHER
  Loads the existing live3d-core-v8-3.html product unchanged.
  No live-weather code is duplicated or modified.

TEST / HISTORICAL VALIDATION
  Loads the existing Christmas Night 2023 validation page unchanged.
  A persistent warning identifies it as simulated/event-constrained and NOT LIVE.
  Entering the mode automatically runs the Christmas 2023 regression baseline.

Regression baseline v1
----------------------
The browser regression checks:
- scenario ID
- exactly six frames
- persistent ST0001 on all frames
- no fragmentation into extra tracks
- 50/66 cross-radar deduplication remains intact
- observed centroid motion remains approximately 122–123 km/h at 112.0–112.6 degrees
- score sequence stays 35 / 60 / 64 / 68 / 70 / 58
- category sequence stays MODERATE / HIGH / HIGH / VERY HIGH / VERY HIGH / HIGH
- Doppler contribution stays 7 / 9 / 11 / 13 / 15 / 13
- 20:40 AEST destructive-warning frame stays VERY HIGH 70/100 with Doppler 15/15

If a future tracking or scoring change alters those results, the main product will show
FAIL in Historical Validation mode until the change is reviewed and the baseline is
deliberately versioned.

Install
-------
Copy this whole folder into /workspaces/StormTracker, then:

  cd /workspaces/StormTracker
  python StormTracker_Main_Product_Validation_Mode/install.py

No relay redeployment is required.

The installer:
- backs up the previous frontend/index.html as frontend/index-live-loop-legacy.html
  if that backup does not already exist
- replaces only the root index with the mode shell
- adds the mode-controller/regression modules and tests
- confirms V8.3 live product, Christmas scenario and camera files are byte-for-byte unchanged
