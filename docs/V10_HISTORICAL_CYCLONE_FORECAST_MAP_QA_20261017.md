# V10 historical issued cyclone map — original BoM GML (QA)

**17 October 2026 · QA, not live weather · Production remains V10.1.1 source-pinned.**

## Scope delivered

StormTracker's \`/preview/incremental-3d/\` includes the compact **Cyclone forecast · QA** button under Layers. It opens a map-side panel, leaving the operator sidebar at its approved compact height and radar playback collapsed by default. All layers start off until the operator selects a local file.

Select the **original** BoM \`*.gml\` track map on your device. The browser's XML parser checks the official \`tcData\` namespace, documented product ID, original source-issued issue/forecast times, expiry, source GDA94 \`EPSG:4283\` or geographic \`EPSG:4326\` (longitude/latitude), coordinate ranges, polygon closure and "Likely Tracks Area" source labels. Unsupported or malformed data is rejected without drawing.

The independent Cesium \`CustomDataSource\` plots only:
- Original BoM **observed track and fixes** (muted blue)
- Original BoM **forecast track** (white) and **issued centre positions** (+forecast hours, category where provided)
- Original **72-hour likely tracks polygon** (turquoise) and original **120-hour likely tracks polygon** (amber), **if present in the uploaded original**. The checkboxes hide/reveal the two independently and do not calculate anything.

Watch/warning areas and wind footprints are decoded and classified separately, but are deliberately **not drawn in this forecast uncertainty tool**, to prevent confusion with likely-centre positions. Polygon outer and inner rings are retained; no vertex simplification, inferred radii, smoothing, interpolated fixes or generated forecast uncertainty. One file is one issue: no claimed historical trend or forecast update sequence from a single issue.

**A permanent map label** identifies the loaded cyclone's source issue as **ARCHIVED BoM FORECAST · NOT LIVE**, even if its options panel is closed or the whole sidebar is hidden. **Clear forecast** removes every entity and that provenance label. The file stays in browser memory only. No persistent cache, API/Worker relay, BoM download/polling, cloud upload or warning redistribution is added.

## Fina verified example (original BoM files)

The authentic Fina issue verified earlier is at the official source directory, using an **FTP-capable client**:

\`\`\`
ftp://ftp.bom.gov.au/anon/sample/catalogue/Warnings/Tropical_Cyclone_Warning/IDD65401.gml
\`\`\`

To download on a desktop system with \`curl\`:

\`\`\`sh
curl --fail -L --max-time 30 -o IDD65401.gml \
 "ftp://ftp.bom.gov.au/anon/sample/catalogue/Warnings/Tropical_Cyclone_Warning/IDD65401.gml"
\`\`\`

The file was 265,470 bytes on **17 October 2026**. Open StormTracker's development preview, select **Layers → Cyclone forecast · QA → Original BoM GML**, choose **IDD65401.gml**, and the map focuses the source's forecast location around the Northern Territory. Switch either 72h or 120h area off to inspect their **original** boundaries. Return to Queensland with **Reset view** when finished.

Expected from **this original issue**:
- Fina / \`AU202526_02U\`
- base **20 November 2025 06:00 UTC**, issue **06:53:03 UTC** (16:53:03 AEST)
- **10** published forecast fixes (12–120 hours)
- **1** original forecast track, **13** historical observed positions
- **2** "Likely Tracks Area" polygons (72 h and 120 h), originally **422** and **728** vertices
- The storm's source-issued watch, warning and wind polygons are **not** substitutes for the two original uncertainty areas.

The companion authentic issued CXML \`IDD65441.xml\` was independently verified with the offline Python source decoder in \`scripts/decode-bom-issued-cyclone-gml.py\`, with eight matching published forecast fix times and coordinate precision consistent with CXML rounding. The **browser displays only the validated local original GML**, not a synthesized blend of CXML and GML.

## Permissions and live release gates

The Bureau's [anonymous FTP user guide](https://www.bom.gov.au/catalogue/Bureau_of_Meteorology_Anonymous_FTP_Service_user_guide.pdf) limits copying to personal/internal organisational use and prohibits supplying that content to other people under its default conditions. StormTracker **does not bundle or distribute Fina GML, cyclone imagery or a derived geometry dataset**. Each user who needs the local QA must retrieve the original under the conditions applicable to their use.

The original GML has not been added to the repo, GitHub Pages, a CDN, the relay or an artifact for public download. Real operational data still requires BoM-authorised live transport and separate fresh issue/expiry validation. The existing verified Python GML+CXML decoder and official cyclone track validation boundary remain the route to that milestone. **V10.1.1** is unaffected.

## QA validation

Run \`npm test\` for the browser parser and map lifecycle tests. The parser tests use **clearly synthetic fixtures**, not original/redistributed BoM warning geometry. The original Fina GML was previously decoded with the independent Python decoder; source-faithful browser DOM acceptance is checked with \`python3 scripts/test-bom-historical-cyclone-gml-browser.py\` if Chrome/Chromium and an FTP-capable network are available. The browser-integration test fetches the original only into an ephemeral temporary directory and deletes it. The on-demand test is not a new deployment dependency or recurring network poll.

**Visual acceptance outstanding:** operator checks screenshot/map of **72h/120h source polygons**, readable labels, mobile panel and full-map button before any future release promotion.

## Queensland test cases — Jasper (2023) and Alfred (2025)

These two cases can be selected directly in **Cyclones · history / forecast QA → Queensland historical reference cases**. This uses the already-validated and already-deployed **Queensland Government / BoM historical cyclone** files in `frontend/data/cyclone-history/jasper-2023.json` and `alfred-2025.json`. They are **observed archives, not snapshots of a BoM-issued forecast map**. Their original observation timestamps, archived observed track lines, past centre positions, categories and optional source-issued cyclone wind footprints remain attributed and separate from forecast uncertainty.

- **Jasper, December 2023:** 21 original archived observed/current fixes, one original observed track, 11 source wind features from 8 archived issue times in the QA subset. Appropriate Far North Queensland landfall context. [Queensland original archive](https://spatial-gis.information.qld.gov.au/arcgis/rest/services/EventsIncidents/CycloneHistorical/MapServer/23010) and [BoM event history](https://www.bom.gov.au/cyclone/history/jasper23.shtml).
- **Alfred, February–March 2025:** 24 original archived observed/current fixes, two original observed track segments, 16 source wind features from 8 archived issue times in the QA subset. Appropriate South East Queensland/northern NSW context. [Queensland original archive](https://spatial-gis.information.qld.gov.au/arcgis/rest/services/EventsIncidents/CycloneHistorical/MapServer/25010) and [BoM event history](https://www.bom.gov.au/cyclone/history/Alfred2025.shtml).

When selected, StormTracker displays the label **ARCHIVED QLD / BoM OBSERVED TRACK · NOT A FORECAST · NOT LIVE**. The time slider selects only actual archived observation/source wind issue times; source-issued wind areas are off by default. No positions, cone or uncertainty polygon is extrapolated from an observed track. The user may still select an *original BoM-issued GML* through the existing local forecast importer, if a genuinely archived Queensland issue is obtained. Import replaces the observed reference; Clear removes all cyclone context.

**Source retrieval outcome (17 October 2026):** The live Queensland historical ArcGIS service confirms Jasper's `23012` observed line and Alfred's `25011/25012` observed positions and tracks. Its service description explicitly says *observed* records only. The tested public Wayback index for historical Alfred `IDQ65248.gml` returned an empty match; Jasper's lookup timed out. Neither result establishes absence from all archives, but **no authenticated original Queensland-issued forecast uncertainty GML has been recovered for these two storms**. The Fina 2025 original GML remains the validated source geometry reference. Do not present the Queensland observed products as source-issued forecasts, and do not claim a 72h/120h area exists for either case.
