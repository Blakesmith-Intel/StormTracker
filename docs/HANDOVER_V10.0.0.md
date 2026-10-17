# V10.0.0 handover — accepted operator UI and native multi-site Doppler

**Pinned source:** `e3f7f6d007f52e4ca48e103288bc5ffa77fac9b5` · `v10.0.0` and `restore/v10.0.0` after public verification. Older `v9.20.2` remains at `b8be458acbae942a3bb0b530a5c17618b6d03134`.

## Important runtime contracts
- `frontend/src/live3d-operational-v9.js` is the primary Cesium browser controller. Do not resurrect expanded/sidebar controls.
- `frontend/src/multi-doppler-display-v1.js` owns optional measured secondary wind, per-site palette/native source, eight-minute maximum observation offset, bounded three-frame provider cache, stale-source cancellation and cleanup on rain-only mode. It must not affect the primary radar's storm science, 3-D, track identity or playback clock.
- `frontend/src/multi-radar-display-v9.js` retains genuine source-time-matched rain, no time-fabricated source. The additional Doppler source is independent of reflectivity tile masking.
- BoM unverified or unavailable velocity products remain hidden, including NSW Brewarrina pending georegistration. The original measured data and alpha/palette are not modified.
- Existing QLD/NSW continuous satellite underlay, incident/layer handlers, sidebar LGA/modal functions, always-on terrain, memory diagnostics, map measurement and mobile map interaction remain preserved.

## Next isolated milestone
BoM official tropical cyclone forecast track geometry and published uncertainty/shaded polygons from primary BoM feeds. Validate issue time, product timestamp, validity period, status and provenance; distinguish official track/polygon from inferred storm-track threat cones. Never create a numeric probability by simply drawing a cone around a forecast line. Run the representative Koji, Yasi, Alfred, Narelle and Jasper reference cases as QA without showing historical products as current warnings. Continue to QLD/NSW thunderstorm polygons and AURA radial-wind research only after cyclone review.
