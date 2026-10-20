# StormTracker — current development and operational handover

> **Frozen V10.2.5 production overlay (20 October 2026):** Adds automated, exact-cell authoritative BoM IFD lookup for qualifying ≥50 mm rainfall and replaces the rainfall popup's broad BoM publication-source region with coordinate-checked official BoM river basin catchments where available. The V10.2.0 radar/cyclone science pin remains unchanged. Do not alter this release while awaiting operator feedback. See [RELEASE_NOTES_V10.2.5.md](RELEASE_NOTES_V10.2.5.md).
**Baseline prepared:** 20 October 2026 (Australia/Brisbane)  
**Application:** https://blakesmith-intel.github.io/StormTracker/  
**Repository:** https://github.com/Blakesmith-Intel/StormTracker  
**For operators:** [OPERATOR_GUIDE_CURRENT.md](OPERATOR_GUIDE_CURRENT.md)  
**Status:** Documentation of the most recently validated **sealed V10.2.0 + maintenance overlay** production, **not** an instruction to rebuild from a moving source branch.

> **First rule:** Do not assume the latest code in main is the deployed application, and do not retag an older accepted release. The live application is assembled by an exact-source **pin**, a controlled maintenance overlay and a separately deployed public BoM data relay. Audit each independently.

## 1. Authoritative starting point and version identity

| Item | Accepted as of this handover |
|---|---|
| Public entry point | https://blakesmith-intel.github.io/StormTracker/ |
| Maintenance repository | Blakesmith-Intel/StormTracker |
| **Last source-changing accepted maintenance commit** | **da41da6811875eecbb2fcc4f746c3b5a25de319f** — restore rarity-text size while keeping rain droplets at two-thirds and retaining 24hrs-to-9am wording |
| **Verified deployment of that commit** | [GitHub Actions run 39305321286](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/39305321286) — success, including public-site checks and release-reference sealing |
| Separate release-gate validation | [Run 39305321512](https://github.com/Blakesmith-Intel/StormTracker/actions/runs/39305321512) — success |
| **Immutable V10.2.0 product source pin** | **047b3bd1c66b0ed5f070d2298202f46d0cd8dae2** |
| Existing historical V10.2.0 source references | v10.2.0 and restore/v10.2.0 (preserve; do not repoint) |
| Data-only branch | **radar-ftp-feed**; among other data, stores **ifd.json** |
| Browser-side render engine | **Cesium 1.145.0**, pinned by the operator HTML |
| Transport | One existing **Cloudflare Worker** (stormtracker-bom-relay) |
| Hosting/build | **GitHub Pages** from a deterministic pipeline; GitHub Actions |
| Data-service policy | Public/official sources first; **no mandatory paid feeds** |

**Important naming:** “V10.2.0” is the underlying immutable UI/runtime pin, **not** the last date on which operator-visible code changed. The newest delivered rainfall, flood/road/outage, radar-source and UI maintenance is overlaid during production compilation. The legacy files **CURRENT_ACCEPTED_BASELINE.md**, **HANDOVER_V10.1.1.md**, and similar numbered guides document earlier pins and decisions, not the complete latest composite. This document is the **current overlay-aware handover**; retain all older documents for provenance.

**How to verify the next source state:** compare the newest successful deployment job's head SHA, the source pin in **.github/workflows/pages.yml**, the published **/BUILD.txt** and the source strings in the actual served JavaScript. A green repository build alone does not prove a publicly delivered asset is current.

## 2. Product boundaries and non-negotiable behaviour

1. **Browser-only production:** no Python, local server, container, HDF5 reader, paid subscription, or remote scientific model required of an end user. Python source collectors and offline historical QA are permitted in GitHub Actions/development only.
2. **Source fidelity:** original BoM reflectivity values and genuine source issue times are authoritative. Use **dBZ**, never rebrand reflectivity as mm/h. No invented five-minute radar frames, fake scan timestamps, arbitrary upscaling, substituted low-resolution images or misleading temporal fills.
3. **Radial wind is not a gust:** native Doppler is radial velocity relative to its radar; do not infer surface wind or a tornado diagnosis solely from displayed velocity colours.
4. **3-D is inferred:** original source 2-D reflectivity defines the estimated coloured volume. The display threshold is **≥40 dBZ**, nominal vertical exaggeration **1.0×**, using source pixel intensity; never describe it as a measured volumetric/AURA live scan.
5. **Storm tracks and illustrative cones are not BoM warnings:** numeric track IDs, estimated motion and +90-minute cones have no independent official warning status. Primary radar alone governs the accepted ST track/labels.
6. **Cautious official overlays:** road closures, unplanned outages, flood levels, QFD jobs and historical cyclone products must preserve original classifications, IDs, geometry and issued timestamps. Failures must not become “all clear”.
7. **Presentation quality:** original radar colour scale, source-resolved pixels, good satellite continuity, rapid camera gestures, map-fit compact sidebar and no whole-volume flicker. New features must not silently weaken accepted visual quality.
8. **Change isolation:** use an isolated feature branch or QA preview when altering meteorological science, feeds, source registries, camera/render loops or warning geometry. Require browser review before promoting.
9. **No new duplicate infrastructure:** use the single established relay and existing workflows where possible. Minimise needless scheduled jobs, paid data and cache layers.
10. **Maintain recovery:** source pins, annotated tags, sealed restore branches and historical preview builds must remain recoverable and immutable.

Reference contracts: [SCIENTIFIC_CONTRACT.md](SCIENTIFIC_CONTRACT.md), [NON_NEGOTIABLE_VISUAL_FIDELITY.md](NON_NEGOTIABLE_VISUAL_FIDELITY.md), [BASELINE_RESTORE.md](BASELINE_RESTORE.md).

## 3. Live system architecture

~~~text
Official BoM radar / Doppler / rainfall / flood / cyclone references
QLDTraffic, official power providers, QFD published incidents
                        |
                        v
       Existing Cloudflare Worker (CORS / source transport)
                        |
                        v
           Browser JavaScript + Cesium 1.145
       radar/doppler  |  3-D/tracks  |  GIS overlays
                        |
                        v
             GitHub Pages public operator app

Official BoM IFD 2016 point pages
          | hourly GitHub Actions verified collector
          v
   radar-ftp-feed/ifd.json  ----> browser local AEP comparison
~~~

The relay's role is to **transport or normalise public source data** and expose bounded, cached public JSON or approved source imagery. Meteorological interpretation, Cesium layers, screen controls, inferred motion/volume and AEP comparison are implemented client-side.

### Paths worth knowing

| Function | Main files |
|---|---|
| Public application entry | frontend/index.html; frontend/live3d-operational-v9.html |
| Current operational entry/runtime | frontend/src/live3d-operational-v9.js, pinned V10.2.0 version plus build overlays |
| Release assembly | scripts/build-current-site.sh; scripts/apply-ftp-aep-release-v10.py |
| Production + previews | .github/workflows/pages.yml |
| QA/release gate | .github/workflows/qa-ftp-aep-combined-release-v1.yml |
| Frontend tests | frontend/tests/; npm test executes scripts/check-frontend.mjs |
| Existing network relay | relay/worker.js; relay/wrangler.jsonc; .github/workflows/deploy-relay.yml |
| Native high-resolution BoM reflectivity | frontend/src/bom-wmts-loop-v2.js; bom-wmts-published-times-v1.js; hires-radar-loop-policy-v1.js |
| History and radar selection | frontend/src/operational-window-choices-v1.js; multi-radar-display-v9.js; independent-doppler-loop-v1.js |
| Doppler | frontend/src/bom-doppler-intake-v3.js; multi-doppler-display-v1.js; bom-doppler-georef-v1.js |
| Inferred 3-D and tracking | incremental-volume-renderer-v1.js; inferred-volume-v1.js; live3d-tracks-v1.js; tracking.js; track-threat-cone-v1.js |
| Satellite/street, labels, camera | context-layers/basemap-manager-v1.js; qld-town-label-layer-v1.js; stormtracker-camera-v1.js |
| Flood observations and icon semantics | context-layers/river-gauges-v1.js; river-gauge-layer-v1.js; river-gauge-observations-v1.js; river-flood-signals-v1.js; river-official-flood-persistence-v1.js |
| Significant rainfall source/panel | context-layers/significant-rainfall-source-v1.js; significant-rainfall-operational-v1.js |
| Location-specific rainfall rarity | context-layers/rainfall-ifd-aep-v1.js |
| Permanent IFD catalogue generator | scripts/build-native-bom-ifd-point-cells-v1.py |
| Permanent IFD collector schedule | .github/workflows/publish-verified-queensland-ifd.yml |
| Road closures / outage layers | context-layers/flood-road-closures-v1.js; flood-road-closures-operational-v1.js; power-outages-v1.js; power-outages-operational-v1.js |
| Council/suburb incident exploration | context-layers/road-closure-lga-explorer-v1.js; power-outage-suburb-explorer-v1.js; related model modules |
| QFD selected public incidents | context-layers/qfd-technical-rescues-v1.js; qfd-technical-rescues-operational-v1.js |
| Cyclones (historical/QA) | historical-cyclone-forecast-map-v1.js; official-cyclone-track-contract-v1.js; internal-cyclone-live-qa-v1.js; frontend/data/cyclone-history/ |
| Historical AURA verification (not browser live) | scripts/build_aura_3d_tracks_v1.py; frontend/3d-data/; specialised AURA audit scripts |

**Caution:** Files in main include retained development adapters and legacy implementations. A filename's existence **does not prove the module is shipped or active**. Verify the built **_site/** output and imported source graph. The old individual-site FTP raster adapter is intentionally excluded from the latest high-resolution production build.

## 4. Radar, Doppler and imagery contract

**Radar:** The operational source policy prefers **genuine native high-resolution BoM national WMTS reflectivity** (original-published times and original high-resolution data) with separately verified original FTP archive/fallback logic. The application avoids fabricated imagery or legacy low-resolution playback when original high-resolution frames are unavailable. Never generate a synthetic scan just to fill an incomplete timeline.

**Time windows:** Five-minute genuine reflectivity observations. Accepted rain-only choices are **30/60/90/120/180 minutes**, requiring respectively **6/12/18/24/36 genuine observed frames**. Extended playback windows only enable when the browser has retained complete qualifying history. **Doppler — All available** has a separate source history; no numeric fps setting is presented. Playback speeds **1×, 2×, 3×**.

**Multiple radars:** The operator can choose a primary and up to three additional radars. Default primary is **Brisbane (Mt Stapylton), radar 66**. QLD and relevant NSW border radar options are exposed by the operational site catalogue. Source time is per published observation; supplementary imagery must not block the primary. For multi-Doppler, the **primary radar is master UTC**; each additional supported radar uses its nearest authentic published scan within **±8 minutes**, with bounded staging and together-at-frame-edge display. Moree/Grafton are reflectivity-only. Brewarrina **IDR93I** is supported for display but **analysisGeorefVerified=false** until separately verified; exclude it from validated severe-wind/tornado science.

**Renderer:** The measured 2-D reflectivity and inferred 3-D graphics use BoM-aligned dBZ classes. Internal track segmentation uses connected **observed ≥40 dBZ pixels** with the documented 16-pixel/core rules. Changing inferred blob geometry, texture handling, cache eviction, opacity or town-label layering requires the existing mobile/desktop/WebGL regression suite. Distinct layers must be retired when toggled off; hidden closure lines, stale polygons, flickering Doppler and camera reset jumps are regression failures.

**Basemap:** QLD detail + regional NSW DEA imagery with global satellite fallback; separate street style, state border and place names. Avoid exposing blue unloaded map regions or placing labels underneath 3-D or radar imagery.

**Validation refs:** [WMTS_ALL_RADARS_SOURCE_PUBLISHED_TIMES_20261018.md](WMTS_ALL_RADARS_SOURCE_PUBLISHED_TIMES_20261018.md), [QUEENSLAND_RADAR_COVERAGE.md](QUEENSLAND_RADAR_COVERAGE.md), [PLAYBACK_PERFORMANCE_AND_STABILITY_AUDIT_2026-10-16.md](PLAYBACK_PERFORMANCE_AND_STABILITY_AUDIT_2026-10-16.md).

## 5. Significant rainfall — accepted current contract

**Observed totals source:** BoM [Queensland Rainfall and River Conditions](https://www.bom.gov.au/qld/flood/), seven regional original rainfall HTML maps: **gulf, north, tvl2mck, widebay, seast, west, border**. The existing Worker route **/qld-significant-rainfall** parses original BoM map popup values by **station ID**, coordinates, mm total, period and published UTC source time. Duplicate station IDs are deduplicated; a regional failure is recorded explicitly, not converted to 0 mm. Operator map shows **≥50 mm** stations even if no rarity data is available.

**Three UI choices and backend period keys:**

| Operator text (20 Oct acceptance) | Stable internal key | Authoritative reading |
|---|---|---|
| **Since 9 am** | since9am | Original BoM cumulative measurement since 09:00 AEST *reporting-day start* (overnight when before next 09:00) |
| **Last hour** | lastHour | Original BoM latest 1-hour map value |
| **24hrs to 9am** | last24Hours | Original BoM completed 24-hour rainfall-map value for the preceding 09:00-to-09:00 period |

**9 am rollover regression:** Valid “Since 9 am” readings published after **midnight** and before **09:00 AEST** belong to the previous day's reporting start, *even though the source page's calendar date is today*. Never reject those readings merely because page-day differs from rainfall-start-day. Covered by Mountain Creek **540220**, **101.0 mm at approximately 04:00 AEST**, a **19-hour** since-9am window in deterministic tests. Source freshness still applies. Exact observation totals must come from BoM; that value is a test case/operator-supplied example, **not a frozen current live observation**. The 24-hour product is independently published: do not sum or subtract other periods to derive it.

**Appearance:** Orange measured-rainfall droplet **50–99.9 mm**, red **≥100 mm**. SVG droplet path itself is scaled to **two-thirds**; the **rarity text and its rectangular background remain full original size**. Latest accepted asset uses a **98×40** billboard and full-size label. The droplet contains **no amount text**. Popup retains exact mm, period, BoM station ID, timestamp, reference and AEP details. Dropdown, popup and status all use **24hrs to 9am**, while internal API key stays **last24Hours**.

**Freshness/refresh:** Browser rainfall fetch every **300,000 ms (5 min)** while visible; manual refresh supported. Existing relay caches upstream regional pages for around **300 s** and rejects outdated source pages beyond **90 min**. Client 9am snapshots additionally require matching report-day start. **IFD catalogue is downloaded separately** and reconsidered after **15 min** during enabled rainfall fetches; browser page reload reads a remote persisted reference, **not** a rebuild.

### Rarity computation (not flooding severity)

- Separate official rainfall design reference: [BoM 2016 Design Rainfall](https://www.bom.gov.au/water/designRainfalls/revised-ifd/?multipoint). Recorded mm is **never** replaced with design depth.
- Lookup: geographic **0.025° keyed cell** in permanent **ifd.json**. The exact same keying algorithm is in Python builder and JavaScript IFD comparer; assess validity before changing cell resolution or reference geolocation. **Do not silently assign nearest-town references.**
- Durations: **60 to 1440 minutes** in official verified point tables. 1h = 60, completed day = 1440, since-9am = true current accumulation duration. Duration between reference rows uses documented **logarithmic interpolation**, not invented spatial data.
- Order: **20, 10, 5, 2, 1% AEP** (respectively **Notable/Unusual/Rare/Very rare/Exceptional**). Muted **Less rare** means below the 20% local threshold; **Unrated** means missing/invalid verified comparison. Neither is a safe/hazard-free status.
- Annual chance is a rainfall frequency statistic **not** flood impact, river classification or guaranteed recurrence interval.

### Reference-catalogue persistence and future updates

**State is permanent in GitHub** on **radar-ftp-feed/ifd.json**; not rebuilt when the browser refreshes. The publishing workflow runs at approximately **10 minutes past each hour UTC** and also runs for changes to the collector, regression test or workflow. It:

1. Reads previously published **ifd.json** from the **data branch**; **refuses to proceed if prior catalogue absent**.
2. Optionally gets current station IDs/coordinates from the existing rainfall relay, including ordinary/dry stations.
3. Retrieves up to **30** missing, replacement or due-for-reverification BoM first-party point tables per run, with bounded concurrency.
4. Validates duration and probability monotonicity; retains previously verified data on missing source, parse failure or transient BoM failure.
5. Performs an **append-only key-set check** before publication; successfully revalidated entries may update depths and verification metadata while their reference cell stays in place.
6. Marks newer first-party entries with source/coordinate reference and **verifiedUtc**; checks existing first-party cells again after **30 days**, at bounded rate while missing records are being filled.
7. Publishes the merged verified catalogue back to **radar-ftp-feed** without overwriting unrelated FTP archives on concurrent branch advancement.

**Observed catalogue snapshot:** **163 stored geographic cells** after successful 20 October release validation; approximately **59 directly first-party BoM IFD cells** and **104 earlier verified ARR-derived references**, retained pending first-party replacement. **This is NOT a complete statewide IFD grid or complete lifetime inventory of all gauge locations.** Count is time-sensitive; read the current JSON rather than assuming 163 forever. The collector discovers stations from current published observation pages and cannot guarantee reference data for future gauges that never appear. The user explicitly requires that the eventual complete *collected* catalogue **persist** and that revised official values be incorporated where verified. Do not claim statewide completeness without a genuine geographic coverage audit.

**Risks to review before expanding:**
- source site may rate-limit and page format may change; official page includes non-depth rows such as **winter factors** that must be discarded;
- a reference cell is a geographic bin keyed at 0.025°, not proof an entire broad locality is identical to one measured point;
- hourly collection is **bounded** and revision rechecks cannot promise instant update on the date BoM revises an official table;
- retained older ARR-derived values must preserve source attribution until replaced with a genuinely retrieved BoM value;
- no arbitrary default AEP, neighbouring grid extrapolation or fabricated all-green result for failed sources.

**Regression entry points:** **scripts/test_bom_ifd_point_cells_20261020.py** and **frontend/tests/run-significant-rainfall-source-v1-tests.mjs**. Test failed fetch retention, published checksum/key preservation, official-only parsing, 09:00 rollover across midnight, 1h vs since9am vs 24hrs-to9am, 50/100 mm boundaries, and the **small droplet/full-size rarity label** separately.

## 6. Flood gauges, road closures, outages and QFD

### Flood signals

The current BoM gauge poll interval is **10 minutes**, and a manual **Refresh** control exists. Station readings, BoM flood classifications/levels and any recent-history assessment must join by **exact BoM/AWRC source station ID**, not station names or nearest locality. Gauge thresholds/datum must correspond to each **actual source observation's datum**; never compare incompatible metres without a documented transformation.

**Operator symbology:** minor **green**, moderate **yellow**, major **red**. Independently measured rapid-rise potential **blue up-arrow below minor**, optional up-arrow modifier on flood-level icons. Above-minor classified sites persist when valid/current even if the trend is steady or falling; do not remove until authoritative classification/verified observation changes or the source is too stale. Rapid rise is not an official flash flood warning. Screening for tidal influences is essential and may err conservatively; genuine official flood classification takes priority. River recent-history requests may return typed optional **not_published** or upstream **502/source_response_too_large**: preserve genuine current bulletins and don't invent a hydrograph.

Useful refs: [FLOOD_GAUGE_ID_AND_ICONS_20261018.md](FLOOD_GAUGE_ID_AND_ICONS_20261018.md), [WALKERSTON_533142_MINOR_GAUGE_DISAPPEARANCE_20261018.md](WALKERSTON_533142_MINOR_GAUGE_DISAPPEARANCE_20261018.md), docs/BOM_2026_FLOOD_CLASSIFICATION_AUDIT.json, docs/BOM_2026_GAUGE_COVERAGE_AUDIT.json.

### Road closures and power outages

Use published **QLDTraffic** events for all-traffic unplanned closures, not simply events containing a flooding keyword. Preserve both **point icons and mapped road geometries**. Turning a layer off must remove **lines and markers**, not leave invisible or orphaned geometry. The power layers include QLD outage provider polygons with shading (including any supported Essential Energy areas in scope), not points only; keep council-level outage counts/customer estimates tied to genuine source records. Planned outages do not belong in the **unplanned** layer. Source refresh timestamps should be visible independently of whether markers are enabled. Only trust provider-published polygons; geometry fallback decisions must be validated.

### QFD assistance / rescue

The sidebar exposes selected public QFD **RESCUE TECHNICAL**, **RESCUE ROAD CRASH** and **ASSIST PUBLIC** categories. The QFD public GroupedType may be coarse and incident locations approximate. Do not interpret excluded classes as zero current jobs, or treat QFD public GIS as dispatch data.

## 7. Cyclones, forecasts and other science status

**Production:** The **Cyclones** panel provides preserved historical reference cases (e.g. Jasper 2023 and Alfred 2025 **observed tracks**) and local import/QA of genuinely **issued** BoM forecast GML. Original BoM 72-hour/120-hour likely-track uncertainty areas are displayed **only if present** in the supplied official product. Do not manufacture uncertainty polygons, combine observed historical fixes into a pretend original forecast, treat warning/watch footprints as a forecast cone or label historical overlays “live”.

**Current limitation:** a fully validated, automatically updating public live BoM cyclone GML source bridge is **not delivered**. Network failure must say **unable to verify warnings**, never “no warnings”. A verified empty current source is required for that latter status. The original Fina sample's forecast positions and areas were decoded for QA, but historical decode success does **not** prove Queensland live ingestion.

**Other future work:** Genuine official Queensland severe-thunderstorm warning polygons (and NSW portions within radar coverage), clearly distinguished from inferred StormTracker detections; authenticated consecutive **AURA HDF5** sweeps and aliasing/georeferencing for historical damaging-wind/hook/tornado candidate science; optional public-data lightning likelihood only if accurately represented as **not a strike feed**. Keep current production unaffected until scientifically validated and operator approved.

See [V10_CYCLONE_LIVE_SOURCE_MAPPING_20261017.md](V10_CYCLONE_LIVE_SOURCE_MAPPING_20261017.md), [V10_GENUINE_CYCLONE_FINA_FORECAST_DECODER_20261017.md](V10_GENUINE_CYCLONE_FINA_FORECAST_DECODER_20261017.md), [ACTIVE_WISHLIST.md](ACTIVE_WISHLIST.md).

## 8. Routine operations and monitoring

| Data/process | Expected cadence / trigger | Source of truth and action on fault |
|---|---|---|
| Rainfall observations | Every **5 minutes** while layer on and page visible; manual refresh | BoM regional issue time; report partial/stale source, never a 0-mm invented reading |
| Reference catalogue client check | At most approximately every **15 minutes** during rainfall fetch | Persisted **radar-ftp-feed/ifd.json**, retain previously verified reference while temporary fetch fails |
| IFD catalogue expansion/reverification | Hourly GitHub workflow, **30** bounded attempts, month-old first-party rechecks | Data branch file + workflow logs; don't erase prior catalogue; incomplete coverage permitted |
| BoM flood gauge observations | Approximately every **10 minutes**, plus manual refresh | Source station ID, published observation/classification and datum; optional history must not suppress valid current bulletin |
| Native radar times | Actual BoM source-published times; reflectivity nominal **5-minute frames** | WMTS capabilities and verified tile; no invented timestamp; 400 may mean stale/unpublished time |
| Multi-site Doppler | Genuine published scans, bounded primary-clock matching | Per-site BoM source clock. A missing scan is a gap, not a licence to substitute another observation |
| Outages / road closures | Source/provider schedules; the UI displays last check time | Compare source published update, boundary/line and active-status details; avoid guessing fixed cross-provider cadence |
| QFD public incidents | Source update/age as shown in panel | Public grouped categories, approximate locations |
| Main static deployment | On accepted main push via **pages.yml**, subject to full validations | Successful Pages deploy **and** public BUILD/source QA |
| Existing Worker deployment | On configured **deploy-relay.yml** source-path changes or manual invocation | Worker job success, CORS/source route smoke |
 
**Common observed upstream faults:** WMTS time-dimension **HTTP 400**, intermittent radar/Doppler **403/502**, limited BoM optional gauge-history **502**, partial rainfall region failures, provider stale geometries. They are diagnostic/source faults, **not** proof that the hazard has stopped. Use bounded retries/cooldowns already implemented rather than increasing request pressure.

## 9. Safe developer workflow (start here)

**Before editing:**

1. Read **this handover**, **OPERATOR_GUIDE_CURRENT.md**, **CURRENT_ACCEPTED_BASELINE.md**, **SCIENTIFIC_CONTRACT.md**, **NON_NEGOTIABLE_VISUAL_FIDELITY.md** and the most relevant module's regression tests.
2. Confirm the latest **successful** public Pages run, **/BUILD.txt** source pin, current main SHA, Worker deployed version and if relevant the data-branch version of **ifd.json**.
3. Identify whether the proposed change belongs to (a) immutable pinned V10.2.0 source (**do not edit in place**), (b) main maintenance overlay, (c) existing Cloudflare relay, (d) scheduled data publisher, or (e) isolated historical/experimental QA.
4. Make a **small, isolated, reviewable** change; do not launch parallel redundant deployments or touch unrelated layers. Do not bypass true source validation by using synthetic data in production.
5. Update the **specific regression** to lock the behaviour and verify the final built artifact, not only the source in main.

**Local/CI checks (where environment supports them):**

~~~bash
npm test
node --check relay/worker.js
node --check frontend/src/context-layers/significant-rainfall-operational-v1.js
node frontend/tests/run-significant-rainfall-source-v1-tests.mjs
python3 scripts/test_bom_ifd_point_cells_20261020.py
~~~

For production-equivalent validation, use the existing workflow and script sequence already declared in **pages.yml** and **qa-ftp-aep-combined-release-v1.yml**. The former checks out immutable historical and V10.2.0 source revisions, runs regression suites, builds **_site/**, applies the authorised overlay and verifies the served Pages marker and source. The release gate also performs browser-based and public BoM source tests. Live BoM probes are sometimes unavailable because of the **upstream**, so distinguish a true contract regression from a transient external source failure; don't label a failed test success.

**Acceptance matrix:**

| Area changed | Must prove before production |
|---|---|
| Rainfall UI | Exact 9am/1h/24hrs-to9am wording; icon/drop-only 2/3; full-size rarity tag; click/popup and mobile |
| Rainfall data | Exact BoM station IDs and totals, source timestamp, 9am reset, 90-minute stale cutoff, 50/100 bands, region failures explicit |
| IFD catalogue | Existing cells retained; official provenance for replacement; 0.025° key; no fabricated depths; revalidation test; public JSON loads |
| Radar/Doppler | Authentic PNG/source times, no 400 cascade, no low-res frame leakage, correct selected loop counts; multiradar sync and boundaries |
| 3-D/render/camera | Eligible ≥40 dBZ echoes present, no flicker/black map/WebGL crash, no satellite gaps, desktop & mobile pan/zoom |
| Flood gauges | Exact station ID, source datum, minor/moderate/major persistence, rising arrow lifecycle and tide exclusions, manual + interval |
| Roads/outages | Official geometry and icons show, polygons shaded, toggling off removes both points and line/polygon graphics |
| Cyclone/warnings | Issued/valid source times, original geometry only, empty-feed vs error semantics, separate historical label |
| Whole site | Short/long viewport sidebar; hide/show controls; actual released assets/cache keys; baseline recovery points preserved |

**Publishing:** Main pushes currently trigger production Pages workflow; use an isolated branch/preview for science or broad UI changes. Review Actions job status for **deploy** and post-deployment **seal**, inspect the public site on mobile/desktop, verify matching source and incident markers, then record **exact successful run ID, commit and changed files** in this handover. Do not claim delivered production based only on a Git commit or passing unit tests.

## 10. Release history, rollback and recovery

The sealed original source is at **047b3bd1c66b0ed5f070d2298202f46d0cd8dae2**, with annotated **v10.2.0** and **restore/v10.2.0** preserving it. Current maintenance additions are built **on top**, and they require their own exact commit and Pages run record (see section 1).

Older tested anchors are maintained as recorded in [BASELINE_RESTORE.md](BASELINE_RESTORE.md), including:
- V10.1.1: **711d65a72a483b319e80711a09cfeabe2f69bbcd**
- V10.1.0: **11f0012170c4632bd5ef2448bf5671326fdd287e**
- V10.0.0: **e3f7f6d007f52e4ca48e103288bc5ffa77fac9b5**
- V9.20.2: **b8be458acbae942a3bb0b530a5c17618b6d03134**
- V9.18 diagnostic source: **acfa0ebd3717a793369e3e887e2d1a54785620b7**

**Rollback procedure:** Identify the last accepted **full composite** (immutable base + overlay + Worker/data branch dependencies); choose an earlier tested source/pin; create a reviewed **new release** through standard QA and deployment; verify live site and source behaviour. **Never move/reuse an old tag or force-push a historical restore branch.** Do not restore frontend UI blindly while leaving incompatible new relay or reference schema live. A GitHub Pages rollback does **not** roll back the independent Cloudflare Worker or data-only branch: check those separately.

### Preserve these working invariants

- Main can contain experimental/maintenance code; the build retains its immutable application pin.
- Pages contains retained historic previews under their own paths; do not overwrite accepted diagnostic previews.
- CSS/module assets are cache-busted when shipping UI changes, but an unrelated global cache purge is not a substitute for correct paths.
- Browser stores bounded genuine historical radar frames; application/source caches must avoid exhausting WebGL memory.
- Each missing source needs a visible status and trustworthy fallback or explicit **unavailable**, never “zero”.
- Do not overwrite **radar-ftp-feed/ifd.json** with empty/outdated data or prune old verified cells.
- Shared public source terms/attribution and permitted redistribution are separate from technical ability to fetch: investigate before publishing live BoM-issued warning GML publicly.

## 11. Outstanding work and known limitations (20 October 2026)

| Priority | Status and required next step |
|---|---|
| **Permanent rainfall IFD catalogue** | **Active expansion, incomplete.** Verify the final gauge registry and geographic coverage, especially **Unrated** stations; continue official source-verified collection/revalidation without destructive rebuild or town-level guess. |
| **Live Queensland cyclone forecast ingestion** | **Not complete.** Implement a permitted, reliably transportable official current issued product; honour actual forecast fixes/uncertainty geometry and source validity; isolate QA from production. |
| **Official thunderstorm warning overlays** | Future phase: original BoM QLD warning polygon sources plus NSW regions within mapped radar coverage; no synthetic warnings. |
| **Genuine Doppler severe-wind candidate research** | Historical consecutive AURA measurements, validated geographic registration, velocity-alias checking, event-based performance assessment before any operational classifier. Brewarrina candidate science remains excluded while georegistration is provisional. |
| **Upstream source resilience** | Continue contract-based mitigation for BoM 400/403/502, river history 502, provider geometry and data freshness. Any new caching must retain original source time. |
| **Operational performance** | Test prolonged desktop/mobile pan/zoom/playback, texture retirement, GPU memory, overlay disable/re-enable, secondary Doppler flicker and full-screen controls before widening scope. |

Do not claim the IFD catalogue is geographically **complete** merely because the collector has caught up with current live rainfall observations. Full spatial completeness needs an independent BoM coverage audit; a station that hasn't recently reported rainfall may not yet be in the input registry.

## 12. Handover checklist for the next developer

- [ ] Read the operator guide and the non-negotiable science/visual fidelity contracts.
- [ ] Confirm successful **Pages run**, maintenance commit, actual public build marker and source asset revisions.
- [ ] Verify the source pin and historical annotated tags/restore branches unchanged.
- [ ] Check relay health separately; do not infer it from the static Pages status.
- [ ] If rainfall is touched, inspect **BoM source vs station ID/period/timestamp**, and **ifd.json** preservation separately.
- [ ] If flooding is touched, ensure gauge observation datum and flood threshold reference are genuinely compatible, especially stations with tidal characteristics.
- [ ] Validate **radar** genuine frame counts, **Doppler** source clock, **3-D** original dBZ and no map/texture regression.
- [ ] Run relevant frontend Python/Node tests, production-equivalent browser QA and a live mobile/desktop smoke test.
- [ ] Publish through the existing workflows; check both **deploy and seal** jobs, then document the successful commit, run and operator acceptance.
- [ ] Keep pending milestones and limitations explicit. Historical samples and algorithmic candidates are **never live official warnings**.

**Document maintenance rule:** For each operator-approved production change, update this current handover and (where user-visible) [OPERATOR_GUIDE_CURRENT.md](OPERATOR_GUIDE_CURRENT.md). Keep old numbered handovers **historical**; do not erase provenance. The handover's last source-changing SHA is a **snapshot as of 20 October 2026**, not a claim that future main/deployments will forever have that SHA.

## Final severity overlay priority — accepted 20 October 2026

Overlapping BoM flood icons and significant rainfall rarity icons now use separate Cesium CustomDataSource draw tiers ordered across **both layers** through `context-layers/severity-marker-layer-v1.js` and `dataSources.raiseToTop`. Flood priority: unverified, rapid rise, minor, moderate, major. Rainfall priority: Unrated, Less rare, Notable, Unusual, Rare, Very rare, Exceptional. Within matching rainfall rarity, larger measured totals are added later. This corrects actual Cesium billboard overlap without unsupported z-index or changes to station data, thresholds, marker geometry, controls or refresh. Covered by `run-severity-marker-layer-v1-tests.mjs` and revised flood integration suite. Freeze recovery ref: `restore/production-severity-2026-10-20` after CI verification.
