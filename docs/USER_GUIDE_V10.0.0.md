# StormTracker V10.0.0 — Operator guide

Open https://blakesmith-intel.github.io/StormTracker/. One compact sidebar contains the radar replay controls and Layers (including QFD rescue assistance, flood signals, unplanned road closures and power outages). All incident and storm-label layers start off. Terrain is automatic; Street/Satellite is selectable. The radar frame slider, playback speed and one frame/UTC/AEST readout are together under Radar playback.

## Multiple radars and Doppler
Select a primary radar, then open **Radars** on the map. Add up to 3 sites; supported Doppler-capable stations display a label in the chooser. In rain playback, extra sites render BoM measured reflectivity. Select the **Doppler / all available** playback window to render the primary's genuine native Doppler and secondary supported stations' own native BoM Doppler within 8 minutes of the primary scan timestamp. Each secondary has its independent source UTC; a missing scan is not filled with fabricated wind. Doppler is radial velocity, not ground wind or a cyclone probability estimate. Source/timing state appears inside the radar chooser. NSW stations without integrated, validated Doppler continue as rain-only.

Storm points/labels and +90m indicative motion cone represent the **primary radar only**; the cone is not an official BoM cyclone forecast. All displayed 3-D vertical structure is inferred, not an observed radar volume.

## Other tools
Select **Measure** for surface-horizontal straight-line geodesic distance; Done returns map pan. Map scale is approximate and updates with camera motion. Power and road buttons open searchable LGA explorers with source-reported refresh clock; customer totals in outages reflect the provider event counts, not invented council allocation. Layers are turned off on page load.
