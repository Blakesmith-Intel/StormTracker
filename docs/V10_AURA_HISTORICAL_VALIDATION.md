# V10 Historical Doppler source audit — 14 October 2026

## Source choice
Australian Unified Radar Archive (AURA) Level 1 ODIM HDF5 polar volumes are the preferred quantitative historical research source. These are not a verified real-time feed. Level 1b corrected/calibrated netCDF4 can support selected older cases, subject to event availability. Level 2 derived grids are supplementary. The existing BoM coloured Doppler web image has a 19-class -70 to +70 km/h legend and cannot validate 90 km/h radial speeds.

Source documentation: https://www.openradar.io/operational-radars/radar-products
Historical volume naming: https://climate-cms.wikis.unsw.edu.au/Australian_Operational_Weather_Radar_Archive
Data services: https://www.bom.gov.au/resources/data-services

## 24 November 2025: Gympie / Cooloola
Investigate radar 08 (Mt Kanigan), daily Level 1 volume naming pattern `08_20251124.pvol.zip`. This is an expected filename pattern, not a confirmed retrieved file. Archived BoM warnings covering Gympie exist: https://www.abc.net.au/emergency/warning/AUREMER-0c3b96b77a59d84a73fb3ed0272770cc

The repository's `frontend/historical-gympie-v1.html` references real Level 1 research data paths under `research-gympie/`, but the corresponding research files are absent from the current V10 branch. This page is not presently a reproducible measured-data test.

## 25 December 2023: Gold Coast / Scenic Rim
Investigate Mt Stapylton radar 66 and Marburg radar 50: expected archive patterns `66_20231225.pvol.zip` and `50_20231225.pvol.zip`. Neither has been retrieved or inspected here. Examine 10:00–12:00 UTC first (20:00–22:00 AEST). The Bureau confirms an evening tornado and a Gold Coast Seaway gust of 106 km/h: https://www.bom.gov.au/clim_data/IDCKGC1AR0/202312.summary.shtml

The repo's `christmas-2023-derecho-scenario-v1.js` explicitly states its radar frames and velocities are simulated. Passing regression tests does not establish meteorological detection performance.

## Required validation gates
1. Verify archived file presence, data access rights and licence.
2. Collect actual Level 1 sample volumes and record source link, SHA256, exact UTC, radar, elevation, sweep, ODIM quantities, Nyquist and quality metadata.
3. Convert quantitative samples using ODIM gain, offset, nodata, undetect and units. Verify azimuth, range, radar registration, velocity polarity and any aliasing.
4. Inspect consecutive observed velocity and reflectivity scans. Compare coherent inbound/outbound couplets against independently supported timing and location evidence.
5. Record positives, negatives, false flags and missed detections; distinguish event-level tornado reports from signatures at any given radar pixel.
6. Use reproducible offline scientific extraction to create bounded, licence-compliant browser fixtures. Keep the production browser on its existing architecture and transport-only relay.

## Validation status
| Item | Gympie 2025 | Gold Coast 2023 |
| --- | --- | --- |
| Archived severe weather corroborated | Yes, warnings | Yes, Bureau tornado report |
| Suitable archive product family identified | Yes | Yes |
| Event-specific archive files verified | No | No |
| Original quantitative Doppler samples retrieved | No | No |
| Rotation candidate compared with measured source | No | No |
| Historical sensitivity and specificity calculated | No | No |

**Outcome:** quantitative historic validation is not yet complete. V10 circulation and wind candidates stay research-only and fail-closed. No production promotion.

## 14 October 2026: retrieval tooling and execution limitations

Implemented `scripts/aura-v10-volume-audit.py` and manual `.github/workflows/v10-aura-evidence.yml` on `feature/v10-severe-weather-candidates`. The script attempts NCI THREDDS catalogue discovery, downloads a matching daily AURA ZIP, checks source checksums and extracts ODIM HDF5 velocity quantities, gains, offsets and missing-value sentinels for a limited number of volumes. Report JSON is preserved as a workflow artifact even when access fails.

**Not yet executed on genuine downloaded data:** NCI network access failed from the model's execution environment. GitHub's normal feature-branch regression CI has passed, but that does not mean the AURA retrieval job ran, nor does it establish meteorological performance.

**Workflow dispatch caveat:** GitHub may require workflow files to exist on the repository's default branch to display or accept manual dispatch. Do not merge experimental detector code or replace pinned Pages builds merely to enable this job. A narrowly scoped default-branch workflow registration or isolated GitHub CLI invocation can be separately reviewed.

**Candidate status:** no measured radial couplets or validated candidate locations yet. The offline scanner intentionally does not declare velocity-alias correction or classify tornadoes from raw arrays. Next: verify an actual archive download; select and inspect consecutive scans; implement azimuth/range-aware spatial reconstruction and validated velocity processing; then run the existing V10 research detector with genuine metadata and score findings against both event reports.

## 14 October — event-window audit improvements

The manual AURA audit now accepts `--target-utc HH:MM` and selects up to three source HDF5 volumes closest to the specified UTC time, recording selected filenames and their checksums. Defaults in the manual workflow are **04:00 UTC for Gympie 2025 (14:00 AEST)** and **10:30 UTC for Christmas 2023 (20:30 AEST)**, as research sampling starting points—not verified storm peak times. The site/date catalogue still needs to return a real archive before any processing claims can be made.

Execution blocker reproduced: NCI `dapds00.nci.org.au` DNS resolution fails in the current execution environment; web retrieval of both historical catalogues also failed. Connected GitHub access does not offer a workflow-dispatch write operation. Repository CI success checks Node regression/syntax, **not** successful AURA volume retrieval nor verified Python scientific results.

Manual execution once registered in GitHub Actions: navigate to `Actions → V10 AURA historical evidence audit (manual) → Run workflow`, choose `feature/v10-severe-weather-candidates` if offered, select an event, then obtain the `aura-<event>-audit` artifact. If GitHub does not show the dispatch control (workflow not registered on the default branch), do not merge experimental detector code simply to enable it; use a narrowly scoped workflow registration or execute the script in a permitted research environment.

**Caution:** the research script currently inventories raw velocity ranges, gains and missing-value sentinels. It does not yet perform polar-coordinate georegistration or scientifically justified velocity dealiasing, and must not emit measured tornado/circulation candidates until that stage is completed.
