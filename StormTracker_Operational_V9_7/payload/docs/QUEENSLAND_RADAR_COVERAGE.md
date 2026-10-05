# Queensland radar coverage — Operational V9.7

Verified against BoM's public radar-sites catalogue and product pages on
4 October 2026 (AEST). The 19 current public sites are included; decommissioned
Brisbane Airport and the replaced Townsville ID 73 are not added.

Source catalogue: BoM's radar_sites FeatureServer, reached from the public
[BoM radar map](https://www.bom.gov.au/weather-and-climate/rain-radar-and-weather-maps).
Wind availability and panel centres were checked against each linked product
loop page. All 14 live GIFs were downloaded and decoded with production browser
palette/panel functions: each is 524×564 with 19 accepted velocity swatches.

| ID | Site | Wind product | Track wind analysis |
| --- | --- | --- | --- |
| 24 | Bowen | Not provided | Not applicable |
| 50 | Brisbane (Marburg) | [IDR50I](https://www.bom.gov.au/products/IDR50I.loop.shtml) | Existing recovered calibration |
| 66 | Brisbane (Mt Stapylton) | [IDR66I](https://www.bom.gov.au/products/IDR66I.loop.shtml) | Existing recovered calibration |
| 19 | Cairns | [IDR19I](https://www.bom.gov.au/products/IDR19I.loop.shtml) | Display only; calibration pending |
| 72 | Emerald | [IDR72I](https://www.bom.gov.au/products/IDR72I.loop.shtml) | Display only; calibration pending |
| 23 | Gladstone | Not provided | Not applicable |
| 74 | Greenvale | [IDR74I](https://www.bom.gov.au/products/IDR74I.loop.shtml) | Display only; calibration pending |
| 08 | Gympie (Mount Kanigan) | [IDR08I](https://www.bom.gov.au/products/IDR08I.loop.shtml) | Existing recovered calibration |
| 56 | Longreach | Not provided | Not applicable |
| 22 | Mackay | [IDR22I](https://www.bom.gov.au/products/IDR22I.loop.shtml) | Display only; calibration pending |
| 36 | Mornington Island (Gulf of Carpentaria) | Not provided | Not applicable |
| 75 | Mount Isa | [IDR75I](https://www.bom.gov.au/products/IDR75I.loop.shtml) | Display only; calibration pending |
| 107 | Richmond | [IDR107I](https://www.bom.gov.au/products/IDR107I.loop.shtml) | Display only; calibration pending |
| 98 | Taroom | [IDR98I](https://www.bom.gov.au/products/IDR98I.loop.shtml) | Display only; calibration pending |
| 108 | Toowoomba | [IDR108I](https://www.bom.gov.au/products/IDR108I.loop.shtml) | Display only; calibration pending |
| 106 | Townsville | [IDR106I](https://www.bom.gov.au/products/IDR106I.loop.shtml) | Display only; calibration pending |
| 67 | Warrego | Not provided | Not applicable |
| 78 | Weipa | [IDR78I](https://www.bom.gov.au/products/IDR78I.loop.shtml) | Display only; calibration pending |
| 41 | Willis Island | [IDR41I](https://www.bom.gov.au/products/IDR41I.loop.shtml) | Display only; calibration pending |

## Registration and tracking boundaries

The displayed reflectivity is BoM's georeferenced national WMTS mosaic clipped
to tiles around the selected radar (at least a nominal 160-km ground radius,
including full edge tiles), using the existing matrix origin and EPSG:3857.
Selecting a radar chooses an area; it does not isolate its contribution to the
national mosaic. Existing south-east Queensland tiles are unchanged.

The existing three wind panels retain their previously recovered map bounds.
Added wind panels use BoM loop metadata for the panel origin and a nominal
±128000-m gnomonic plane across 512 pixels. Catalogue instrument coordinates
can differ from a legacy image's map origin, so the two are stored separately.
Nominal registration is suitable for a labelled contextual visual overlay, but
is not claimed as a recovered pixel calibration. These 11 feeds are excluded
from exact measured storm-footprint analysis until that calibration is established.
Strict colour decoding and time pairing alone cannot establish spatial accuracy.

Eight-minute pairing, genuine history limits, newest-only GIF eligibility,
30-minute Doppler windows, 30–180-minute reflectivity history and five-minute
polling retain their prior definitions. A standard site never requests Doppler;
a wind-capable site retries failures rather than silently switching its update
gate to unmatched reflectivity. Selecting another site explicitly starts a new
regional ST history. The camera centres on selection and Reset, while automatic
refresh, scrubbing and playback preserve user pan/orbit.

## Deployment

Install the supplied V9.7 payload, run `bash scripts/deploy-qld-relay.sh`, then
commit/push frontend, relay, scripts and documentation. GitHub Pages validates
all 32 regression suites before publication. The installer does not publish,
authenticate to Cloudflare or modify source configuration files.
