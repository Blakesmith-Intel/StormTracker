# StormTracker scientific contract

This reconstructed baseline preserves the scientific constraints established in the lost project.

## Live mode

Live/public operation uses 2-D radar reflectivity imagery, optional Doppler radial-velocity imagery, and optional public contextual sources. It may identify and track storm footprints, but it **must not** describe these as measured 3-D radar volumes.

Persistent identifiers such as `ST0001` are algorithmic associations between observations. They are not independently verified meteorological storm identities.

Motion is calculated from geodesic centroid displacement. Doppler velocity is not used as horizontal translation speed.

## Historical true-3-D mode

Historical AURA Level-1 multi-elevation data may be processed separately to verify true volumetric geometry, echo tops and browser rendering. That workflow is deliberately excluded from the live browser runtime.

## Lightning

The public-only lightning score is an **ordinal likelihood indicator** built from available meteorological evidence. It is not a direct lightning strike feed, not a strike detector and not a percentage probability.

## Browser architecture

The live runtime must not require Python, FastAPI, NumPy, rasterio, pyproj, GDAL, HDF5, a local server, localhost, or a user-managed modelling engine. Static file hosting is acceptable. Any future relay is restricted to transporting public source files and must not perform the meteorological modelling.
