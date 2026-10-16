# StormTracker V9.20.2 — Accepted Satellite Continuity and Optimised Browser Baseline

**Operator accepted:** 16 October 2026, after visual verification of the blue satellite-map dropout correction along the QLD/NSW border. **Scope:** V9.20.1 + accepted incremental QA improvements; no unverified cyclone, thunderstorm polygon, or V10 threat detection feature is part of this release.

## Operator-confirmed correction

The Queensland imagery rectangle ended north of the NSW radar coverage area. The DEA 2025 GeoMAD regional composite could have no available tile at a location or moment, while the previous basemap explicitly hid the underlying street layer. Cesium displayed a solid blue ellipsoid over NSW, particularly near Brewarrina/Bourke/Walgett when panning and zooming.

In V9.20.2, the source order is one **long-lived authentic Esri World Imagery satellite fallback** at the bottom, original **DEA GeoMAD regional 2025** above it, detailed **NSW Spatial Services** imagery at appropriate close scales, and original **Queensland government** imagery above them. The fallback is used only where higher-priority imagery is absent/unavailable; all upstream resolutions, service names and credits are preserved. The app does NOT reveal OpenStreetMap in Satellite mode. The operator's exact video regression was reproduced in the basemap tests and the user confirmed the fix visually.

## Additional QA-accepted work integrated from development

- Full-width, scrollable on-demand Memory diagnostics dialog (Refresh, Copy JSON, Close) rather than clipped sidebar preformatted output.
- Optimised empirical inferred 3-D profile lookup once per genuine BoM dBZ category per frame; exact high-support display profile remains unchanged.
- Bounded previously-prepared supplemental imagery reuse and source-UTC cache, timing diagnostics, shared optional-source timeout budget and genuine-UTC retry on transient errors.
- Removed hidden 3-D storm-track trail geometry creation while labels are off; unchanged map projection does not repeatedly reflow locality labels.
- Source-faithful, stable in-place glyphs across original and display-only frames including up to **three additional selected radars**, plus correct disposal of deselected secondary-site GPU geometry.

## Mandatory quality and safety

Original full native BoM 2-D reflectivity/dBZ, original Doppler pixel feed, source UTC, 40 dBZ empirical inferred 3-D visibility minimum, correct Australian dBZ palette, and consistent volumetric storm appearance are compulsory. No renderer optimisation can trade away radar image resolution, 3-D quality, radar coverage, or 1× default height exaggeration. No user-facing official cyclone/thunderstorm hazard layer is added by this release; warnings still come directly from BoM.

## Recovery

Pinned source SHA, annotated `v9.20.2` tag and `restore/v9.20.2` must all match the reviewed, operator-accepted source. The Pages workflow verifies public `/BUILD.txt`, satellite underlay provider, the accepted 3-D/quality/diagnostic assets and historical V9.18 QA before sealing. Existing `v9.20.1`, `v9.20.0`, `v9.19.0` and `v9.18.0` refs must remain immutable.

See `docs/HANDOVER_V9.20.2.md`, `docs/USER_GUIDE_V9.20.2.md`, `docs/NON_NEGOTIABLE_VISUAL_FIDELITY.md`, and `docs/ACTIVE_WISHLIST.md`.
