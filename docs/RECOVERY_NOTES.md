# Reconstruction notes

This repository is a reconstruction after the original Codespace/repository contents were lost.

Recovered design elements include:

- active radars 08 Gympie/Mt Kanigan, 50 Brisbane/Marburg and 66 Brisbane/Mt Stapylton;
- categorical reflectivity classes 1–15 and the >=40 dBZ segmentation threshold;
- default minimum storm footprint of 8 pixels with 8-neighbour connected components;
- cross-radar duplicate suppression based on time, centroid separation, sampled area and reflectivity class;
- persistent `STxxxx` track identifiers;
- a 140 km/h hard displacement-speed gate and 12-minute maximum association gap;
- motion derived from geodesic centroid displacement;
- public-only inferred lightning likelihood scoring;
- historical AURA data retained conceptually as the true-3-D validation path;
- Cesium-based browser presentation.

The old Python implementation is represented under `reference/python/` only as a specification/reference. It is not imported by the browser application.

Some source-specific details could not be recovered exactly, especially the final RGB lookup tables used for every Bureau reflectivity/Doppler palette variation. The browser source adapter therefore keeps palette calibration explicit and testable rather than silently guessing. Synthetic category frames work immediately and provide deterministic regression tests.
