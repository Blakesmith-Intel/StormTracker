# StormTracker — AEP-normalised rainfall (2026-10-19 experimental)
Status: **QA branch only. Not statewide-ready. Do not deploy or seal.**

## Data and interpretation
- Source of rainfall observations: genuine BoM QLD Flood regional gauge maps; gauge **ID, position, observed total and UTC** retained.
- IFD reference: 2016 BoM design rainfall depth per 0.025° geographic grid cell, AEP 20/10/5/2/1%; use depth (mm), not rainfall intensity (mm/h).
- Compare last-hour totals to a 60-minute IFD. Compare since-9am totals to the elapsed reporting duration ending at BoM's **source creation UTC**, using fixed Queensland UTC+10 (AEST); interpolate between published standard durations only when necessary. A since-9am comparison can understate the rarity of a short intense burst.
- Grades: green at 20% AEP, yellow 10%, orange 5%, red 2%, purple 1%; highest exceeded threshold wins. Below the 20% design depth is not marked significant.
- **Rainfall rarity is not predicted flooding.** Local runoff depends on catchment, antecedent soil moisture, river levels, land use, drainage, geography and upstream rainfall. Retain existing separate river flood-severity readings.
- Source georeference is nearest official 0.025° IFD cell. There is no nation-wide grid installed.
- Missing verified IFD data = unclassified (neutral icon only when ≥50 mm); NEVER use climatology from another region, estimated design depths, or synthetic fixture numbers.
- Published sample dataset `frontend/data/ifd-2016-verified-points-v1.json` contains ONLY one genuine Gold Coast reference cell, not all Gold Coast and not Adavale. Adavale test values are synthetic and never appear in production datasets.

## Authoritative data acquisition
BoM confirms that official 2016 IFD Extent searches can download ASCII grids limited to 10,000 cells per extent:
https://www.bom.gov.au/water/designRainfalls/revised-ifd/?content=help

Import downloaded ZIPs by:
`python scripts/import-bom-ifd-extent-grids-v1.py --zip path/to/official-extent.zip --out frontend/data/ifd-2016-verified-points-v1.json`
Repeat `--zip` for different extents. Supply all required AEP files and durations (1 min–24 h) to prevent unclassified gaps. The importer checks the source filename convention, 0.025° coordinates, positivity, complete probability curves per duration and conflicting grid overlaps.

**Before public release**, verify BoM licensing for redistributing design rainfall IFD data. BoM default usage terms may permit only personal or internal organisational use.

## Current known blockers
1. Official statewide IFD extent grids have not been acquired; one verified point cannot represent Queensland.
2. Live FTP-to-HTTPS 2D path is not yet accepted: genuine BoM PNGs were rejected by strict browser colour validation (34.3% and 48.6% exact swatches reported), and BoM's HTTPS endpoint intermittently returns 403.
3. The FTP-first fallback has been corrected not to request FTP timestamps from WMTS unless they are independently published. No speculative time or pixel fabrication.
4. GitHub Pages public BoM radar imagery may require explicit licence/registration; do not equate anonymous FTP access with permission to republish.

## Acceptance before deployment
- Verify complete Queensland IFD grid coverage at each rainfall gauge location.
- Compare official Gold Coast and Adavale source values with independent published design-rainfall table output.
- Pass full frontend regressions, source freshness, AEST periods, browser marker placement and AEP popup colours for real station coordinates.
- Pass authentic FTP/WMTS browser playback, multi-site 2D/3D and operator UI, and confirm the permitted public data licence.
- Seal a fresh production baseline only when all tests pass; preserve V10.2.0 rollback.
