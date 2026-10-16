# StormTracker V9.20.2 — End User Guide

**Open StormTracker:** https://blakesmith-intel.github.io/StormTracker/

StormTracker is a browser-only situational-awareness viewer. Official BoM watches and warnings remain the authoritative warning source; StormTracker is **not** an official warning system or an emergency-response decision tool.

## Radar and weather

Choose a primary Queensland or selected northern NSW BoM radar with the radar selector. The optional **Radars** control can show up to three additional original 2-D reflectivity sites. Select a 30-minute rain loop or longer rain-only history; native BoM Doppler appears in the combined Doppler/rain product where available. **Actual source observation UTC and AEST are displayed separately.** Original reflectivity uses dBZ, not mm/hr.

Use the 3-D volume opacity control to show empirical rounded storm structures from original radar reflectivity ≥40 dBZ. These are **inferred visual vertical structures**, not actual measured 3-D BoM radar sweeps. Storm labels are off by default, and tracks/labels and optional +90 minute cone are based on the primary radar only. Do not treat an algorithmic cone as an official BoM warning.

## Basemap and satellites

Select **Satellite · DEA Regional + Local Detail** for a satellite view. Queensland official high-resolution imagery is displayed above historical DEA GeoMAD regional imagery; NSW official detail becomes visible at close zoom. A genuine global **satellite** fallback now fills previously blue/empty areas when a higher-priority service lacks tiles. Because different imagery sources may be captured on different days, a seam can remain at the edge of a missing official tile; the fallback is not a live cloud satellite image.

Switch to Street for OSM if desired. Keep 3-D terrain enabled for terrain perspective, or turn it off manually. Radar, Doppler and 3-D weather quality are not reduced to increase FPS.

## Context layers

Enable or disable unplanned QLD road closures, unplanned QLD outages, flood signals and selected official QFD rescue/assistance incidents. Always check the underlying agencies before acting. Different sources refresh at different intervals.

## On-demand Memory diagnostics

Expand **Memory diagnostics** in the controls and choose **Capture memory snapshot**. It opens a full-size, scrollable window that fits the browser viewport, including narrow desktop windows. Use **Refresh** for a current snapshot, **Copy JSON** for the complete report, and **Close** to return to the map. It does not poll in the background, and Chromium GPU process memory is shared across tabs.

The sidebar's playback **Actual fps** shows throughput for completed scan preparation and display, NOT WebGL screen redraw FPS. Playback still limits its visible speed according to selected 1×/2×/3× settings.

## Troubleshooting

If a satellite area goes blank, verify that Satellite is selected, wait for the underlying map layers to load, and note the approximate region, zoom, network status and browser. If primary/secondary 3-D is missing, capture the map and Memory diagnostics (which includes per-site supplemental 3-D glyph counts) and check that real ≥40 dBZ reflectivity exists in that area. For playback stalls, include selected radars, UTC window, and the snapshot's cache/staging timings.

Feature requests for official tropical cyclone tracks and official BoM severe-thunderstorm warning regions are planned next; **they are not present in this release**.
