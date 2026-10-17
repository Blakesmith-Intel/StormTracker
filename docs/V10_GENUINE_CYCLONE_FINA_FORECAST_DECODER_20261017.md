# Decoding an authentic issued BoM cyclone forecast — Fina, 20 November 2025

**Stage:** Successful offline source decoding and companion-bulletin verification. **NOT an active cyclone overlay; V10.1.1 production remains sealed.**

## Authentic archived BoM source (no data fabrication)

The Bureau's official [Warning Products User Guide](https://www.bom.gov.au/catalogue/Bureau_of_Meteorology_warning_products_user_guide.pdf) provides the public sample directory
`ftp://ftp.bom.gov.au/anon/sample/catalogue/Warnings/Tropical_Cyclone_Warning/`. The exact original files retrieved in GitHub-hosted QA are:

- **`IDD65401.gml`**, 265,470 bytes, `tcData` GML, actual Tropical Cyclone Fina (`AU202526_02U`). Forecast base **2025-11-20 06:00 UTC**, issue **06:53:03 UTC**, expiry **8 hours**.
- **`IDD65441.xml`**, 17,048 bytes, actual BoM Darwin TCWC CXML bulletin for Fina. Same base **06:00 UTC**, creation **07:03:51 UTC**.

The named event and dates are corroborated by the Bureau's [Fina 2025 post-event report](https://www.bom.gov.au/cyclone/history/Fina2025.shtml). The sample directory preserves a real cyclone and a real contemporaneous issue, **not a current warning and not a complete time series of every bulletin**. The file is in the NT warning group because Fina affected the NT; format and roles apply to the documented Queensland `IDQ65248-50` and cross-border `IDQ65252` products.

## Reproduced real source decode

`scripts/decode-bom-issued-cyclone-gml.py` decodes original BoM `tcData` objects, source `EPSG:4283` GDA94 longitude/latitude vertices, explicit roles, original UTC, forecast lead times and storm ID. Separate companion CXML verification confirms source positions rather than interpolating any coordinates.

| Issued geometry/observation | Original source features | Important distinction |
| --- | ---: | --- |
| Observed fixes | 13 | Already occurred by issue UTC |
| Forecast fixes | **10** | Source lead times **12–120 h**, original BoM published coordinates |
| Observed track | 1 | Not a prediction |
| Forecast track | **1** | Original geometry, not line joining synthetic fixes |
| `tcForecastArea`, `Likely Tracks Area`, up to **72 h** | **1 polygon, 422 original vertices** | True BoM-issued shorter-range uncertainty |
| `tcForecastArea`, `Likely Tracks Area`, up to **120 h** | **1 polygon, 728 original vertices** | True BoM-issued extended uncertainty |
| Watch area | 1 | Watch geography; **not** uncertainty |
| Warning area | 1 | Warning geography; **not** uncertainty |
| Cyclone wind areas | 12 | Forecast damaging/destructive footprint; **not** uncertainty |

The 72 h original area source bounding coordinates are lon **127.645912–133.689148**, lat **−14.294780 to −9.506755**. Extended 120 h area spans lon **123.391983–133.689148**, lat **−16.987785 to −9.506755**. These bounding boxes are *diagnostic summaries*, NOT replacements for the original polygon or computed substitutes.

Some real issued **forecast fixes** `[longitude,latitude]`:

| Valid UTC | BoM original longitude | BoM original latitude | Category |
| --- | ---: | ---: | ---: |
| 2025-11-20 18:00 (+12 h) | 133.01487 | −10.28930 | 2 |
| 2025-11-21 06:00 (+24 h) | 132.58216 | −10.90779 | 2 |
| 2025-11-22 06:00 (+48 h) | 131.05669 | −11.94280 | 2 |
| 2025-11-23 06:00 (+72 h) | 129.18669 | −12.63761 | 2 |
| 2025-11-25 06:00 (+120 h) | 126.27685 | −13.44687 | 2 |

These are forecasts **as issued**, *not* later observed best-track locations. The companion CXML contains its own original lead 0, 6, 12, 18, 24 … 120 h positions rounded to two decimals; no interpolated GML points or computed uncertainty polygons are admitted. **Eight matching forecast fix times** were checked against both original files; the largest lon/lat component difference was **0.00487°**, consistent with the CXML's two-decimal rounding. The other fix timestamps are not fabricated to force a one-to-one match.

## Reproduce strictly as a development audit

Run on a network that permits BoM anonymous FTP; do not publish the raw sample files on StormTracker Pages or GitHub. Use local temporary files:

```bash
mkdir -p /tmp/stormtracker-cyclone-qa
curl --fail -L --max-time 30 -o /tmp/stormtracker-cyclone-qa/IDD65401.gml ftp://ftp.bom.gov.au/anon/sample/catalogue/Warnings/Tropical_Cyclone_Warning/IDD65401.gml
curl --fail -L --max-time 30 -o /tmp/stormtracker-cyclone-qa/IDD65441.xml ftp://ftp.bom.gov.au/anon/sample/catalogue/Warnings/Tropical_Cyclone_Warning/IDD65441.xml
python3 scripts/decode-bom-issued-cyclone-gml.py --gml /tmp/stormtracker-cyclone-qa/IDD65401.gml --cxml /tmp/stormtracker-cyclone-qa/IDD65441.xml
```

The decoder prints **metadata, actual forecast coordinates and polygon feature vertex counts/bounds**. Full vertices are kept only in memory unless the `--output` flag is deliberately used for a local private development file. The source permissions are not equivalent to permission to republish raw BoM products to every public website visitor. The Bureau's anonymous FTP default terms allow personal/organisational use, **not supply to others**; permission/registered-user data arrangements are needed for a public live StormTracker redistribution workflow.

## Strict science and release gates

- No rounding/original-vertex simplification, no line-buffer-based “cone”, no confusion between wind footprints and *centre movement uncertainty*, no swapping GDA94 longitude/latitude, no fake current source issued time.
- All 72/120 h uncertainty and 10 forecast fixes were **actually present in the original Fina product**. If a real future issue omits an uncertainty area, no polygon is drawn.
- The isolated parser only accepts documented GML product IDs and `tcForecastArea` explicitly labelled `Likely Tracks Area` with the two verified source extent types. Unknown product/CRS/field/geometry fails closed.
- **Next dependency:** approved and accessible *current* `IDQ65248/49/50/52` data transport and the live browser parser/geometry loader. The successful 2025 NT sample is proof of correct decoding, **not** proof that a current Queensland product is now available. Existing `official-cyclone-track-contract-v1.js` continues to refuse live display without official bulletin URL, freshness, expiry and verified source ownership.
- **V10.1.1 production** remains at `711d65a72a483b319e80711a09cfeabe2f69bbcd`; no production weather visual changes.
