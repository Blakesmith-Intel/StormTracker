# V10 Gold Coast Christmas 2023 — measured-source and independent damage reference

**Date:** 25 December 2023 AEST. This is a separate historical storm event from the 24 November 2025 Gympie/Cooloola replay. No simulation may be presented as an authentic radar observation.

## Original radar archive — verified accessible by GitHub Actions HEAD
- **BoM Mt Stapylton / AURA 66, original ODIM Level 1:** https://dapds00.nci.org.au/thredds/fileServer/rq0/66/2023/vol/66_20231225.pvol.zip
  - HTTP 200; 2,152,911,614 bytes; Last-Modified 26 December 2023, verified via [source probe](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/37980228837).
- **BoM Marburg / AURA 50, original ODIM Level 1:** https://dapds00.nci.org.au/thredds/fileServer/rq0/50/2023/vol/50_20231225.pvol.zip
  - HTTP 200; 2,618,888,132 bytes; Last-Modified 26 December 2023.
- AURA level-1 open licence CC BY 4.0; Soderholm et al. (2019), DOI 10.25914/508X-9A12. Research historical extraction uses real measured reflectivity and same-elevation Doppler gates. Data subject to instrument/beam elevation, quality control and velocity folding/aliasing.

## Contemporary BoM warning/observation benchmarks (AEST / UTC)
| Source event | AEST | UTC |
| --- | --- | --- |
| Gold Coast detailed thunderstorm warning | 19:49 | 09:49 |
| Very dangerous thunderstorm warning | 19:56 | 09:56 |
| Warning escalated to include destructive gusts | 20:40 | 10:40 |
| Gold Coast Seaway BoM-observed maximum gust 106 km/h | 21:12 | 11:12 |

Sources: [BoM release](https://media.bom.gov.au/releases/1216/update-from-the-bureau-of-meteorology/), [BoM monthly summary](https://www.bom.gov.au/climate/current/month/qld/archive/202312.summary.shtml), [BoM 2023-24 annual report](https://beta.bom.gov.au/sites/default/files/2024-10/bureau-of-meteorology-annual-report-2023-24.pdf). The Bureau describes a 3–4 km wide and 30–50 km long damaging/locally destructive swath across Gold Coast and Scenic Rim. BoM confirms a tornado occurred somewhere in the storm region; this does not demonstrate that all Coomera/Helensvale damage was caused by tornadic rather than straight-line winds.

Other reported gusts, including around 150 km/h at Mount Tamborine, require station provenance and are *not* interchangeable with the Gold Coast Seaway BoM station observation.

## Independent damage-location ground reference

Queensland Department of Transport and Main Roads, **Coomera Connector Stage 1 EPBC 2020/8646 compliance report**, Appendix A, original 17 March 2023–17 March 2024 reporting period:
https://www.dcceew.gov.au/sites/default/files/documents/77481.pdf

Appendix A, PDF page 24 onward, documents December 25 vegetation damage in the Coomera Connector corridor from Ormeau to Molendinar:
- North package: damage **south of Helensvale Road**, within and outside the motorway corridor; pre- and post-event aerial photos
- Central package: damage **north of Gold Coast Highway** and around Ridgevale Drive, with post-event imagery captured 28 December
- The document describes damage to trees/vegetation and built infrastructure, not a surveyed EF-rating / tornado vortex track. Construction-related clearing and pre-existing vegetation patterns remain possible confounders when interpreting scars.

The study screening polygons in the measured replay are intentionally *broad approximate regional boxes*, **not** georeferenced surveyed scarring polygons.

## Existing StormTracker deterministic Christmas test is not a historical radar replay
File `frontend/src/christmas-2023-derecho-scenario-v1.js` uses hand-authored synthetic cells, speeds and Doppler samples to test association/assessment software. Six simulated 20:20–20:45 AEST frames do **not** represent real 2023 archived radar grids. All V10 research results must derive separately from the original AURA measured HDF5 source.

## Proposed V10 acceptance checks
1. Produce genuine measured 2-D category grids and matching radial samples from both independently timestamped radars for 09:30–12:00 UTC, retaining exact source timestamps.
2. Replay tracked cells with source-time matching. Never mix Mt Stapylton and Marburg pixel geometries or create fabricated scans.
3. Distinguish bowing reflectivity, concentrated radial wind, low-level paired rotation and possible hook echoes. A radar candidate cannot be deemed an actual surface gust or tornado without separate ground evidence.
4. Compare candidate times/locations to BoM warnings, Gold Coast Seaway gust and documented Helensvale/Gold Coast Highway vegetation damage. Explicitly report misses, apparent false positives and source blind spots.
5. No V10 production or severe-weather alert activation from retrospective replay alone.
