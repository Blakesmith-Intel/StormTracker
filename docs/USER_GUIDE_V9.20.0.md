# StormTracker V9.20.0 — User Guide Update
The regular app URL remains **https://blakesmith-intel.github.io/StormTracker/**.

The 3-D inferred radar display now retains unchanged storm structure between genuine BoM observations, updating changed 40 dBZ-and-above rainfall intensity cells without blinking the whole cloud. This is a visual rendering improvement; it does **not** turn inferred vertical imagery into measured radar altitude. The original BoM reflectivity and Doppler imagery are still displayed according to actual source times.

Radar settings, playback loop choices, up to three additional radar sites, map controls, labels, storm tracks and motion cones work as before. Labels default off; the Labels function applies to tracks from the primary radar only. Storm-trend cones are illustrative forecasts, not an official BoM warning.

### Memory diagnostics
Expand the sidebar's **Memory diagnostics** section and select **Capture memory snapshot**. This records a point-in-time estimate of JavaScript heap (if available), frame cache occupancy and live 3-D primitives. GPU process memory shown by browser Task Manager is not always attributable to one tab. The diagnostics do not poll in the background.

### If you notice a regression
Note the selected radar, playback window, whether Doppler is active, selected secondary radars, browser/device and approximate memory growth after several loops. Use the sealed V9.19.0 recovery source when a rollback is required; never silently replace the accepted production release without verification.
