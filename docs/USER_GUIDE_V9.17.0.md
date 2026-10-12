# StormTracker V9.17.0 — end-user guide

**Open:** https://blakesmith-intel.github.io/StormTracker/ (desktop or mobile browser; no installation or local server).

## Radar selection and movement

Use the **primary radar dropdown** in the map's top controls. It starts at **Brisbane (Mt Stapylton)** and includes the 19 Queensland sites plus Brewarrina, Moree and Grafton (NSW). The map centres on the site when you change it; **Reset view** returns to the primary radar. Alternatively, **tap/click the small cyan radar-dish icon on the map**. Icons have no permanent site name or border; hover for the name on desktop, or consult the primary radar dropdown on mobile. The currently selected station has a slightly brighter marker.

Select **Radars** to add up to **three additional 2-D radar coverage windows**. Primary controls all storm tracks, volumetric inference and available wind; additions provide extra map coverage only. BoM's national reflectivity mosaic means overlapping coverage does not imply independent simultaneous observations.

Pan/pinch/rotate/pitch the Cesium map as supported by device. Place names and external operational context stay above weather overlays. When performance is constrained, reduce extra radar windows/terrain and pause playback.

## Reflectivity and colour scale

2-D and 3-D use the **original BoM reflectivity intensity in dBZ**, not mm/h rainfall rates. Consult the 15-band colour legend for actual intensity categories. The bands relevant to 3-D begin at **40–43 dBZ dark teal**, then yellow/amber/orange and red/dark red, with **≥64 dBZ nearly black**. Red or near-black can indicate intense echoes, possibly hail; dBZ does not uniquely reveal rainfall at the ground.

The optional **rounded 3-D volume** appears over measured reflectivity when source dBZ is ≥40. It is an **empirically inferred 3-D presentation** from 2-D, not an observed multi-elevation scan. The icon size and altitude change in response to each source pixel's dBZ; stronger returns typically appear taller in this visualisation. **Manual vertical exaggeration defaults to 1.0×** (under inference controls). Never use pictured height as an observed storm top, or use the display as an official severe-weather warning.

The measured 2-D BoM footprint remains distinct from the inferred 3-D and track label. Volume opacity does not alter measured dBZ.

## Playback / Doppler

Choose an available radar window and speed, **Load**, then **Play/Pause**, move the frame slider or press **Latest**. Radar frames retain source observation times (AEST in the UI). Data and labels can be displayed while paused. **Refresh latest** is available; visible tabs automatically check for new measured observations approximately every five minutes.

If a site has verified Doppler wind data, the combined playback shows original-source radial-velocity imagery and keeps the source times independently identifiable. Wind is **towards/away from the radar**, not general storm motion. Only 08 Gympie, 50 Marburg and 66 Mt Stapylton are calibrated for the existing footprint-based wind analysis. **Brewarrina Doppler is not enabled** pending deployment and calibration of an isolated source relay; Moree/Grafton have no integrated Doppler. A radar-only selected site must not imply absent wind or severe storms.

## Other map layers

Switch street/satellite base layers and 3-D terrain in the sidebar. Road closures, unplanned power outages, significant flood signals and grouped QFD rescue/assistance indicators use their own public sources, refresh buttons and interactive source information. A missing provider response is **not** a declaration of no incidents.

## Quick troubleshooting

- **Map labels/icons not responding:** reload the page; use the primary dropdown as the accessible fallback.
- **Old giant radar emoji:** close and reopen the site to bypass old iOS cached assets.
- **Few or no 3-D volumes:** reflectivity may be below 40 dBZ, or display controls may be hidden/transparent.
- **Rain visible, no Doppler:** normal on non-Doppler sites, unsupported sources, or when valid wind frames cannot be matched. Do not invent timestamps.
- **High CPU / stutter:** reduce additional radar sites, pause playback, try Street basemap and disable terrain.
- **Safety:** check current BoM warnings and emergency-service advice independently. StormTracker does not issue official BoM forecasts, warnings or evacuation instructions.
