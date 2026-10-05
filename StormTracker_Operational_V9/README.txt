StormTracker Operational V9

Scope
-----
Product consolidation / operational UI only.

No changes to:
- tracking or association algorithms
- storm scoring / lightning assessment
- Doppler analytical rules
- inferred-volume science
- shared camera controller
- Christmas 2023 historical validation scenario

Adds:
- 30 / 60 / 90 / 120 / 150 / 180 minute live loops
- 5-minute source cadence: 6 to 36 reflectivity frames
- 0.5x / 1x / 2x playback
- Jump to latest
- compact operational overview
- advanced science/validation cards hidden by default
- main Live mode now opens Operational V9

Reflectivity transport
----------------------
bom-wmts-loop-v2.js is derived from the existing v1 module. The only
transport-level change is that recent timestamp probing expands with the
requested frame count instead of being fixed at 14 candidates.

Doppler
-------
Existing time-matching rules remain unchanged. Longer reflectivity loops do
not permit stale Doppler reuse; frames without a valid Doppler match continue
to show NO MATCH.

Install
-------
Copy this whole folder into /workspaces/StormTracker and run:

  cd /workspaces/StormTracker
  python StormTracker_Operational_V9/install_v9.py

No Cloudflare relay deployment is required.
