> **V9.17.0 clarification:** Production's original BoM dBZ reflectivity scale is used universally. Rounded 3-D sprites and their stronger-cell-taller *display geometry* remain inference from the measured 2-D source, not actual weather-radar volume scans or measured cloud-top altitude. Each tracked column uses the actual **corresponding source pixel's** low-level dBZ for the 1.0–1.4× visual-height mapping (manual scale defaults to 1.0×), not the strongest pixel elsewhere in its storm. The original ≥40 dBZ 16-observed-connected-pixel tracking threshold and independent 2-D footprint are unchanged. Brewarrina Doppler remains disabled until separate relay and calibration verification.

# StormTracker scientific contract

This reconstructed baseline preserves the scientific constraints established in the lost project.

## Live mode

Live/public operation uses 2-D radar reflectivity imagery, optional Doppler radial-velocity imagery, and optional public contextual sources. It may identify and track storm footprints, but it **must not** describe these as measured 3-D radar volumes.

Persistent identifiers such as `ST0001` are algorithmic associations between observations. They are not independently verified meteorological storm identities.

Motion is calculated from geodesic centroid displacement. Doppler velocity is not used as horizontal translation speed.

## Pixel-based 40 dBZ grouping and operational display

The StormTracker live cell segmentation threshold is **40 dBZ** (reflectivity category 7). A detected cell must consist of at least **16 observed above-threshold pixels**, including when nearby components are joined over no more than **two raster pixels** of below-threshold separation. Gap pixels are not assigned reflectivity, counted as part of the storm, or included in measured footprints. A distinct connected 16-pixel core containing ≥50 dBZ reflectivity is protected from joining another independent strong core.

Storm detection eligibility, storm-core separation, map label significance and display priority are based on **actual measured connected pixels, not estimated physical area**. Ordinary storm IDs become visible after two measured observations, while new ≥55 dBZ peaks or ≥50 dBZ cells containing at least 80 connected above-threshold pixels may be labelled immediately. These are internal display rules, not official Bureau severe thunderstorm warning criteria.

Georeferenced sampled area (km²) can still be reported for descriptive diagnostics and inherited track-motion modelling, but **must not become a minimum-size criterion** for newly implemented storm identification and classification logic without an explicit future design decision. Existing geographic distance and movement calculations are separate from raster-connected-pixel thresholds.

These parameter values are initial operational heuristics; compare them against historical Gympie, Cooloola and Christmas 2023 Gold Coast storms before production acceptance.

## Historical true-3-D mode

Historical AURA Level-1 multi-elevation data may be processed separately to verify true volumetric geometry, echo tops and browser rendering. That workflow is deliberately excluded from the live browser runtime.

## Lightning

The public-only lightning score is an **ordinal likelihood indicator** built from available meteorological evidence. It is not a direct lightning strike feed, not a strike detector and not a percentage probability.

## Browser architecture

The live runtime must not require Python, FastAPI, NumPy, rasterio, pyproj, GDAL, HDF5, a local server, localhost, or a user-managed modelling engine. Static file hosting is acceptable. Any future relay is restricted to transporting public source files and must not perform the meteorological modelling.
