# StormTracker — measured storm exit of +90-minute threat cone

**Status:** isolated implementation for regression and browser review. No production promotion.

## Behaviour

- On every **genuine newly observed** storm-track point, compare the measured centroid with the **previously issued, displayed cone polygon**, not a loose infinite wedge or a projection made from future observations.
- If the point is outside the drawn cone by more than **0.5 km**, immediately issue a new cone anchored to that actual radar-observed centroid (`observed-outside`).
- A verified departure can steer the replacement cone using the latest measured heading **only when** movement is at least 1.25 km at 12 km/h; otherwise the existing smoothing protection remains. Motion exceeding the builder's credible maximum still produces no cone.
- Internal settings: `reissueOnObservedExit: true`, `observedExitMarginKm: 0.5`. They are deliberately shared by ordinary frame rendering and the held-prior-measured-frame fallback.
- Maintain the existing measured-position follow, heading/steering changes, projected-envelope departure, storm translation and 30-minute rollover. The fixed +90-minute horizon and 30/60/90-minute markers are unchanged.
- The update must be deterministic from source-time observation history, independent of operator playback, pause and scrub order.
- A boundary crossing on inferred/interpolated imagery **cannot** issue a new meteorological observation, nor can a storm without valid measured motion generate a speculative cone.

## Verification

Run `npm test`. The added adaptive cone tests cover actual drawn front/back boundary, 500m tolerance, optional trigger disabling, reliable direction reassessment and weak-motion restraint. A real browser visual pass on the accepted diagnostic baseline remains required before release.

This is an **uncertainty envelope derived from StormTracker storm tracking**, not an official BoM projected impact area or severe-weather warning.