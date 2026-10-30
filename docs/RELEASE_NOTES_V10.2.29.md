# StormTracker V10.2.29 — verified BoM warning navigation and report interaction (30 October 2026)

## Scope
This release completes the **official Queensland severe-warning polygon** wishlist item, including live source matching, actual raster visibility, operator navigation and affected-group report interaction. All other radar/science, gauges, rainfall IFD/AEP, roads, outages and cyclone layers remain unchanged.

## Verified behaviour
- **Original geometry:** BoM bulletin IDQ21033 is matched to the source-issued GIS2Web/Queensland emergency-management `IDQ65654` polygon by official product and original issue time. Polygon expiry is independent of bulletin expiry: the map never displays it past the earlier published validity.
- **Actual rendered visibility:** The earlier Cesium provider Promise bug and the hidden-beneath-satellite imagery index have been corrected. The warning sits above every satellite base and below the measured radar.
- **Locate:** No direct `viewer.camera.flyTo()`. The button calculates the complete source geometry envelope and issues a deterministic `cameraController.setView()` state (centroid, calculated viewport-dependent range, north-up downward pitch). The accepted StormTracker anti-drift guardian recognises and retains this new position. It never moves the camera during refresh/filter/cancellation.
- **Polygon tap/click:** Window-captured pointer tap (same method used by incident layers) respects mobile pointer capture, excludes drags, checks actual source polygon containment, and opens the **same existing LDMG/DDMG report dialog** as the sidebar button. Other incident markers retain selection priority. No synthetic geometries, guessed group intersections or duplicate reports.
- **Lifecycle:** 15-minute and manual checks, source-unavailable state, official issue replacements/cancellations, geometry expiry and selected-product filtering are unchanged.
- **Operator documentation:** Updated [operator guide](OPERATOR_GUIDE_CURRENT.md), [development handover](DEVELOPMENT_HANDOVER_CURRENT.md), [accepted baseline](CURRENT_ACCEPTED_BASELINE.md), and [wishlist](ACTIVE_WISHLIST.md).

## Acceptance checks
- Full `npm test`, including deterministic camera-state tests, actual-source bounds, mobile-capable captured pointer handler wiring, and report/click priority.
- Production Pages package dry-run and publishing checks.
- Public Pages source/DOM verification of published camera-controller and warning tap modules.
- Separate live-browser verification, where available, with no counterfeit warning in public production.
- Annotated `v10.2.29` and `restore/v10.2.29` must point at the identical approved production commit **only after website verification**. Preserve every prior sealed reference and the underlying V10.2.0 scientific pin.

## Restore
If this additive warning-only functionality fails, switch back to the immediately prior accepted tag/restore ref. This release must not move any older reference. Do not treat a missing polygon during source failure as a confirmed absence of warning.
