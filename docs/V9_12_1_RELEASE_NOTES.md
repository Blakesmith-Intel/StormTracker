# StormTracker V9.12.1 — unplanned outages and Queensland town labels

## Scope

This maintenance release builds on the V9.12.0 production baseline (BoM river/tide gauges).
It does not change radar, Doppler, tracking, road closures, river gauges, or terrain.

## Electrical outages

- The operational data pipeline accepts **only explicitly UNPLANNED** outage incidents, regardless of whether a planned outage is currently in progress.
- Scheduled, cancelled, completed, future, expired, and unclassified events are excluded from the live overlay.
- The rule is applied to all three providers: Energex, Ergon and Essential Energy.
- Essential Energy incidents are still spatially filtered to Queensland, retaining Goondiwindi-area coverage without NSW incidents.
- Unrecognised Essential Energy KML styles are no longer assumed to be unplanned.
- The power-outage map cards continue to be clickable; the summary counts unplanned incidents only.
- Refresh remains 15 minutes; partial-source failure still leaves healthy provider feeds on screen.

## Map place labels

- Removes the overlapping global ArcGIS reference-label imagery layer.
- Queensland Globe places now renders **population centres only** (service layer 20); unrelated cemetery, airport, beach, landmark and recreation labels have been omitted.
- The official population-centre overlay is kept on top of both Street and QLD imagery, with the global OpenStreetMap fallback still covering gaps in QLD imagery.
- The overlay remains a non-pickable imagery layer, preserving pointer interactions with road closures, power outages and river gauges.
- QLD overlay construction uses generation guards to prevent outdated asynchronous label loads from reappearing after basemap switches.

## Deployment and verification

- Browser entry point, stylesheet and module imports are cache-busted to V9.12.1.
- New regression fixtures include **active planned incidents** from Energex, Ergon and Essential Energy; they must not appear in the combined operational output.
- Map tests verify only QLD population centres are requested and duplicate global labels are not loaded by the active application.
- The GitHub Actions `Validate StormTracker feature branches` workflow runs the complete frontend regression suite; require a green result before merging into main.

## Known limitation

Population-centre labels from QLD Globe may still overlap place-name text built into the OpenStreetMap Street basemap, particularly in urban areas. They are an independent browser-rendered raster overlay rather than a shared text-collision engine. This release eliminates the much larger overlap from stacked reference and non-town layers; **visual acceptance on mobile and desktop remains necessary**.

## Rollback

V9.12.0 base commit: `d842d8464915cd5ba3ca904fafbccca0de5c35e2`.
