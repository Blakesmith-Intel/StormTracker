# StormTracker — current operator guide
**Edition:** 28 October 2026 | **Applies to:** V10.2.27 live BoM CAP warning-source correction on the V10.2.26 documentation-only freeze of the V10.2.25 warning feature and V10.2.24 maintenance composite (sealed V10.2.0 radar/science foundation + verified maintenance overlays)  
**Open:** https://blakesmith-intel.github.io/StormTracker/  
**Technical handover:** [DEVELOPMENT_HANDOVER_CURRENT.md](DEVELOPMENT_HANDOVER_CURRENT.md)

> **Purpose and safety:** StormTracker brings together official source observations and selected public incident information for situational awareness. It is **not** a Bureau of Meteorology (BoM) warning service, an incident dispatch system, or a replacement for agency procedures. For warnings, evacuation advice and operational decisions, consult the original issuing authority. Some displays (3-D clouds, storm tracks, projected cones and rapid-rise arrows) are estimates and **not official warnings**.

**Finding this guide from the map:** select the small **Operator guide ↗** text link in the existing StormTracker sidebar heading. It opens this up-to-date guide in a separate browser tab and leaves the active weather map, controls and information panels unchanged.

## At a glance

1. Open the [StormTracker map](https://blakesmith-intel.github.io/StormTracker/) in a current desktop or mobile browser.
2. Choose a radar from the selector at the top of the map. **Brisbane (Mt Stapylton)** is the initial site.
3. Open **Radar playback** to load or play available observations.
4. Enable only the additional **Layers** you need; incident overlays are normally off when the page opens.
5. Select a marker to open its details, source information and timestamps.
6. Use **Hide controls** for a larger map; **Show controls** restores the sidebar.

If something is missing or looks wrong, check the time shown for that **specific data source** before assuming the absence of a hazard.

## Radar, Doppler and storm tracking

| What you see | What it means | Important caution |
|---|---|---|
| **Rain radar / reflectivity (dBZ)** | Original BoM radar-derived reflectivity intensity, with a consistent colour scale | dBZ is **not** rainfall in mm/h and does not directly measure hail size |
| **Doppler radial velocity** | Movement of precipitation **towards or away from the radar** | Not a measured ground-level wind gust or storm translation speed |
| **3-D coloured echoes** | An inferred visual volume built from measured 2-D radar echoes; visible threshold starts at **40 dBZ** | Not a measured echo-top or true three-dimensional radar volume |
| **ST0001 etc.** | StormTracker's algorithmic tracked storm identifier | Not an official storm name, identification or BoM warning |
| **+90m cone** | Illustration of the selected tracked storm's possible continued movement | Not a probability cone, warning polygon or guaranteed track |

**Radar site selection.** Use the primary-site dropdown; select **Radars** to include up to **three additional sites**. Tap a radar-site map marker to choose it as primary. The operator interface notes that track labels and projected storm cones are based on the **primary radar**, not the combined radars. Some additional sites support Doppler; **Moree and Grafton are rain-only**. **Brewarrina Doppler** is georeferenced for viewing; research-only circulation and damaging-wind candidates remain unverified and are **not** operational BoM warning alerts.

**Playback.** Expand **Radar playback**. Select an available time window, choose **Load selected window**, then use **Play**, **Latest**, the timeline slider or **Refresh latest**. Speeds are **1×, 2× and 3×**. Available rain-radar windows are **30, 60, 90, 120 and 180 minutes**, but longer options require genuine accumulated browser history; they may be disabled after a fresh page load. The 30-minute window contains six genuine five-minute frames when complete. Missing observation times are **not** represented by invented frames.

**Doppler — All available** uses its separate available scan history. In multi-site Doppler playback, the primary radar is the reference clock; supported additional radars display the closest authentic scan within the accepted matching window (up to ±8 minutes). Different sites can have different real observation times.

**Display settings.** Use **Radar opacity** and **3-D volume opacity** to improve map readability. Changing opacity does not change the original radar intensity. Turn on **Storm labels** to see primary-radar track IDs; select a specific storm before enabling its **+90m cone**. Use **Details** for additional storm context.

## Significant rainfall: amount and how unusual it is

Enable **Significant rain** in **Layers**. The map shows BoM stations reporting **50 mm or more** for the selected observation period. Tap a rain marker for the **exact total in millimetres**, station name and BoM station number, reporting period, source issue time and official source link.

### Choose the right rainfall period

| Filter | Period represented |
|---|---|
| **Since 9 am** | Accumulation since the last 9 am reporting-period start in Queensland (AEST). **Before 9 am**, this can still include rainfall recorded after 9 am *yesterday*. |
| **Last hour** | BoM's separately published latest one-hour rainfall observation |
| **24hrs to 9am** | The completed 24-hour observation period **ending at the most recent 9 am**, not a rolling 24 hours ending now |

**Example:** At 4 am Tuesday, **Since 9 am** covers 9 am Monday through 4 am Tuesday (approximately **19 hours**). At the same time, **24hrs to 9am** describes the completed period ending at 9 am Monday. The filters must not be added together or mistaken for the same clock period.

**What the two parts of the rain marker mean:**
- **Small orange raindrop:** 50–99.9 mm **measured**. **Small red raindrop:** 100 mm or more **measured**. The droplet carries **no numerical text**; open the marker for the amount.
- **Attached full-size coloured text label:** How unusual that amount is *locally*, relative to official BoM 2016 design rainfall for the same duration. The label's colour is **not** the measured rainfall colour.

| Rarity label | Colour | Design rainfall benchmark | Everyday interpretation |
|---|---|---|---|
| **Notable** | Green | 20% annual exceedance probability (AEP) | Around 1-in-5 annual chance |
| **Unusual** | Ochre/yellow | 10% AEP | Around 1-in-10 annual chance |
| **Rare** | Orange/brown | 5% AEP | Around 1-in-20 annual chance |
| **Very rare** | Red | 2% AEP | Around 1-in-50 annual chance |
| **Exceptional** | Purple | 1% AEP | Around 1-in-100 annual chance |
| **Less rare** | Muted blue/grey | Below the 20% benchmark | Significant mm total, but below the local “Notable” threshold |
| **Unrated** | Grey | No verified local reference available | **Unknown**, not zero, normal or safe |

**AEP explained:** “1 in 100” means approximately a **1% chance in any given year** of rainfall of at least that design depth for that location and duration. It does **not** mean such rainfall occurs only once every 100 years. **AEP describes rainfall rarity, not flood severity.**

**Source integrity.** Observed totals come directly from the [BoM Queensland Rainfall and River Conditions maps](https://www.bom.gov.au/qld/flood/). Local rarity benchmarks come separately from the [BoM 2016 Design Rainfall system](https://www.bom.gov.au/water/designRainfalls/revised-ifd/?multipoint). The reference catalogue is progressively populated, so some legitimate gauges may temporarily show **Unrated**. StormTracker never substitutes a design rainfall amount for a measured rainfall amount.

**AEP speed:** Previously verified local design-rainfall references are reused automatically when you reopen StormTracker on the same device. Missing locations are checked in the background, starting with the highest recorded rainfall amounts, and their labels update as the Bureau's official reference becomes available. A grey **Checking** label means a lookup is pending; **Unrated** means no verified match is currently available. The exact station location is never changed to make a match. The shared reference catalogue is also updated regularly for other users.\n\n**Refresh:** while the rainfall layer is on and the tab is visible, StormTracker checks observations every **5 minutes**. You may also press the rainfall **↻** button. The original BoM page may itself update less frequently; always compare source issue times. Station rainfall measurements are automated and may receive limited quality checking.

### New: on-screen rainfall reports

The two side-by-side report buttons list **all qualifying BoM stations**, not just the labels that are easy to see at the current map zoom. They use the **same verified station IDs, coordinates, observation totals and local IFD ratings** as the map; they do not relocate, merge or suppress gauges. Each report follows the observation-period selector (**Since 9 am**, **Last hour**, or **24hrs to 9am**).

1. **Rainfall totals report:** Select **Rainfall totals report** directly beneath the **Significant rain** controls. It sits immediately beside **AEP Notable+ report**. A scrollable report lists **100 mm or more** first, then **50–99.9 mm**. Each section gives a station count and every source-qualified station's name, exact measured total, BoM number, rarity, issue time and verified catchment where available. **Less rare** and **Unrated** stations are included in their measured-amount group.
2. **Notable+ locations report:** Select **AEP Notable+ report**, immediately beside **Rainfall totals report** beneath the main rainfall controls. The rarity legend remains expandable separately. Stations are grouped **Exceptional (1% AEP), Very rare (2%), Rare (5%), Unusual (10%), Notable (20%)**, in descending rarity. The report includes every station at or above the **Notable** local benchmark **among those currently reporting at least 50 mm**. **Less rare**, **Unrated** and pending IFD assessments are not misrepresented as Notable; the report indicates how many remain unrated/checking.
3. Use **↻ Refresh** inside the report to check the current BoM source; select **Close** or press Escape to return to the map. The report may be opened when the rainfall map layer is off: doing so requests observations without turning on markers. BoM publication may lag the refresh request.

The report window is **read-only**: selecting a category or reviewing a row **does not move the map**, change any station's geographic position, detach the AEP label from its droplet, or alter the original reported totals. Its station counts are based on the chosen period and valid observations, **not the visible map viewport**.

## Flood signals

Turn on **Flood signals** under **Layers** and use **↻ Refresh** to request available updated observations. The application normally polls flood data at approximately **10-minute intervals**.

| Icon | Meaning |
|---|---|
| **Green flood icon** | Measured water level meets the BoM's station-specific **minor flood** threshold |
| **Yellow flood icon** | Measured water level meets the BoM's **moderate flood** threshold |
| **Red flood icon** | Measured water level meets the BoM's **major flood** threshold |
| **Amber bridge/water icon** | Latest **fresh** measured water level has reached an exactly matched published bridge/causeway/crossing/road approaches height **below the first official flood stage**; this is **not** confirmation that the road is closed |
| **Blue icon with upward arrow** | Water is **rapidly rising below minor** on a gauge without a higher-priority official flood-stage/crossing marker |
| **Blue icon without upward arrow** | An unclassified, non-tidal station remains above its verified measured pre-rise reference after the rapid rise has slowed (temporary post-rise monitoring, **not** an official flood level) |
| **Blue upward-arrow modifier on green/yellow/red or amber** | Verified measured rapid rise **in addition to** the existing severity or crossing status; original colour and same-size icon stay unchanged |

**Crossing coverage:** StormTracker checks published crossing levels for all matching Queensland BoM river gauges, including data-only locations and stations whose bulletin tendency is steady or falling. The existing official station-page source checks run in batches of up to 64 gauges, with four concurrent BoM requests and immediate continuation when another batch is ready. Results are cached for up to 24 hours; a verified BoM rate limit pauses requests safely. Opening the flood report completes the full list of available station-page checks rather than stopping after the first batch. Where BoM pages cannot be reached or no source link exists, the report identifies those unresolved stations instead of treating them as below crossing level. A gauge not yet checked for its station-page crossing is **not** evidence that the bridge is below water or safe; a confirmed crossing marker needs a fresh water-height reading and an exact-ID BoM crossing reference. Gauge levels continue refreshing every 10 minutes independently of the crossing lookup.

**Stage priority and crossing heights.** Published **minor, moderate and major flood stages always take precedence** over crossing-height icons. A crossing reference may produce an **amber** icon below minor **only when the crossing threshold is lower than the station's first published flood threshold**. For example, if a bridge is overtopped before minor flood, amber is shown in that interval; once minor is met, green takes priority, and the crossing measurement is still listed in the popup. A bridge above minor or moderate never hides the official severity marker. The marker itself cannot establish whether any road is closed; check the road authority.

**Measured rise and fall.** The information panel displays the measured **positive or negative** change in metres per hour and its **actual elapsed observation interval**, when genuine same-station readings exist. This is a separate measurement from BoM's published **Rising / Falling / Steady tendency**, which remains visible for reference and **does not control the blue-arrow decision**. Rapid-rise calculations use authentic pairs of observations separated by **30–120 minutes**; they divide the water-height difference by elapsed time. A current blue arrow also needs the newest eligible observation to be at most **90 minutes old**. A historical measured slope may still be displayed when the latest observation is too old to support a live arrow.

**Tidal screening, statewide.** All gauges within the conservative **125 km coastal screening buffer** are checked independently using their **exact BoM station ID**, available source tidal/non-tidal metadata, and genuine same-station tidal-pattern evidence. The coastal buffer is **not proof a gauge is tidal**. A verified **non-tidal** gauge uses the original **0.30 m/hour** rapid-rise screening threshold, including near the coast. A verified **tidal** gauge suppresses ordinary tidal rise-rate alerts. A coastal station whose tidal status has **not yet been verified** retains the cautious **1.40 m/hour** screening threshold; no tidal/non-tidal status is invented. The same station-specific screening applies to blue arrows on green, yellow and red flood icons, not merely below-minor gauges. The blue arrow is **StormTracker screening, not an official BoM flash-flood warning**.

**Freshness, recovery and false readings.** Flood data is checked about every **10 minutes**, with manual refresh available. A recent observed flood stage may remain visible with an explicit **stale** indication while its last authenticated observation is still within the maximum **24-hour** age; an older unsupported marker is removed (this does **not** prove the water has receded). Conflicting station IDs, or cached heights disproved by current exact-station BoM information, must **not** keep displaying a false flood stage. No fresh rapid-rise arrow survives an expired observation or a measured slowing/fall. A station with designated flood stages normally clears its flood icon following a genuine fresh below-minor observation, **unless** it still qualifies for an amber crossing marker below minor. Where official flood stages are absent, any post-rise monitoring icon clears after a new authentic reading returns to that station's earlier observed normal/pre-rise range or below its published crossing; it must not remain on the map indefinitely. One qualifying fresh return reading is sufficient. Manual/event-only gauges can stop reporting, so stale data expires rather than being treated as proof of continued flooding or an all-clear.

**What the popup tells you.** Select any flood marker to see its BoM station number, last reported height and timestamp, signed measured rise/fall rate if available, actual comparison interval, published flood-stage heights with a verified datum where possible, BoM tendency, source links and bridge/crossing/approaches reference where available. A valid **stale** approaches/bridge/crossing reading still shows the measured difference at its **actual BoM observation time**, clearly marked stale—not a confirmed live road condition. For example, Condamine River at Centenary Bridge (041472) last measured **6.74 m at 14:43 on 27/10/2026 AEST**, which was **0.49 m above** the published 6.25 m approaches reference at that time. The map remains geographically faithful to the identified station, and icon sizes do **not** change with severity.

### New: flood gauge report

Select **Flood gauge report · Moderate+ / crossings** in the same row as **Flood signals** and **Refresh**. It opens an on-screen, scrollable window that lists all **fresh** BoM gauges with current **moderate or major flooding**, even while their map layer is off, and stations with an exact-ID verified water level at or above a **published bridge, causeway, crossing or approaches reference** (whether below or above an official flood stage). Where an above-crossing reading is **older than the live freshness window**, the report may retain it only as an explicitly **last-confirmed, stale** reading — **never** as a current crossing exceedance.

The report groups fresh gauges into **Major**, **Moderate**, and **Crossing level reached (other flood categories)**, with separately flagged stale last-confirmed crossing cases where available; it shows the exact original station name and ID, water height, BoM tendency and observation time. Where a crossing is reached, it shows the crossing name, the published reference height and the difference in metres. Each station appears only once, even when it meets both criteria. Use **↻ Refresh** to request the latest readings. The window updates automatically after normal 10-minute river-gauge updates and works on mobile.

**Source and safety:** Crossing references are obtained by **exact BoM station number** from its own [BoM river-height station table](https://www.bom.gov.au/fwo/IDQ65392/IDQ65392.535162.tbl.shtml) where published (including newer stations such as Theresa Creek Dam 535162, bridge **1.71 m**), or from [BoM Queensland Section 5 — Details of Crossings](https://www.bom.gov.au/qld/flood/networks/section5.shtml), dated **5 January 2022**, where no verified station-page reference is available. These are published reference heights, **not** confirmed road closures or proof that a road is passable. Cross-check [QLDTraffic](https://qldtraffic.qld.gov.au/) and local road authorities. If crossing reference data cannot be validated, the report still lists verified moderate/major gauges but explicitly warns that crossing-only results are unavailable. Stale or missing gauges are not shown as current, and are never assumed safe.

### Road closures report — state-controlled versus local roads

1. Select **Road closures** in the incident shortcuts to open the existing **Road closures by LGA** explorer. The map layer does **not** need to be enabled.
2. Select **Road types report** beside **Refresh**. Its scrollable report separates **State-controlled roads, highways & motorways**, **Local government roads**, and **Classification unverified**. Each section displays a closure count and expands by **council**.
3. Use **Find council, locality or road** to search; expand a council and select a **road name** to focus its original QLDTraffic map location. Open **Details** for the closure type, cause, timestamp and source link. Select **Council report** to return to the original view or **Close** to return to the map.
4. Select **Refresh** to update both live QLDTraffic closure events and the management classification references. Counts include **distinct active unplanned closures to all traffic**, not planned works or partial restrictions. The report never changes road map lines, markers or existing event classifications.

**Classification source and limits.** StormTracker joins the event's **exact QLDTraffic ID** to the official [Operational Status of Queensland Road Network report](https://data.qldtraffic.qld.gov.au/htmlreports/operationalstatus.html), specifically its **Affects state-controlled road** field, and to the [State Controlled Highways and Motorways report](https://data.qldtraffic.qld.gov.au/htmlreports/statehighways.html). A highway/motorway confirmed by the second report belongs to the state-controlled group. **Local government roads** have an explicit **No** to affecting a state-controlled road and are not independently confirmed by the highways report. A road's *name* or the *council* in which it lies never establishes which authority manages it. An unmatched event ID, conflicting official rows or unavailable source is placed in **Classification unverified**, not guessed as local. A single incident may affect several road segments; the categories describe the **reported incident**, not necessarily the legal ownership of each segment.

**Safety:** This is situational awareness, not a traffic-direction or road-safety clearance. An event classified as local/state-controlled can still be **closed to all traffic**. Verify the source incident and road conditions with QLDTraffic or the relevant authority. Failure to retrieve the supplemental road-classification reports does **not** remove otherwise valid closure markers.

> **Live warning feed correction — 28 October 2026 (V10.2.27):** The public WMO-delivered BoM severe thunderstorm warning `IDQ21033` genuinely uses the CAP event name `Thunderstorm` (with a verified severe-thunderstorm headline and BoM issuer), and the original CAP does **not** contain an area polygon. StormTracker now recognises this real active warning and carries the original warning headline, issue/expiry, description, safety advice and authoritative product bulletin URL into the LDMG/DDMG report. When the warning is live but its genuine polygon is missing, the layer says **ACTIVE BoM warning — original polygon unavailable** and does *not* falsely display an empty/clear warning report or guess council/disaster districts. This limitation does **not** mean BoM has no active warning. **The authorised Queensland emergency-management BoM GIS2Web/WFS-derived layer is now connected.** For a source-matched current IDQ21033 warning, original `IDQ65654` polygon geometry is mapped beneath radar and used to calculate **all** LDMG/DDMG intersections without a minimum overlap. If that approved government geometry source fails, the warning remains listed with a clearly marked unavailable-geometry state, not an invented boundary. See [V10.2.27 source-fix notes](RELEASE_NOTES_V10.2.27.md).

## BoM severe thunderstorm and severe weather warning polygons

**Current sealed documentation:** [V10.2.26 final freeze](RELEASE_NOTES_V10.2.26.md) and [V10.2.25 warning functionality](RELEASE_NOTES_V10.2.25.md). The feature works independently of the cyclone QA panel and does not alter native measured radar or other map layers. The operator has directed that cyclone map validation be deferred until a live cyclone exists.



**This is an optional additional layer, off by default.** Open **Layers → BoM severe warnings** to request original-source Bureau warning polygons. Its warning-area fill appears on the terrain map **under** the measured radar imagery, so radar reflectivity remains visible as before. Select a warning polygon to read the official heading, hazard details, issue/expiry times and original BoM bulletin link.

**Filter by BoM product:** choose **All warnings**, **21035 — Detailed SEQ** (BoM `IDQ21035`) or **21033 — Regional QLD** (BoM `IDQ21033`). Detailed and regional are *independent original BoM product types*, not StormTracker classifications inferred from the polygon's area. The **LDMG/DDMG report** lists only the local and district disaster-management areas touched by the selected live warning product. **Any genuine intersection counts even if only a tiny sliver of an LGA or district is inside the polygon**; there is no minimum-percent threshold. LDMGs are identified by the corresponding official Queensland council area (LGA); if boundary verification fails, the report clearly says so.

**Negative reporting is normal:** After a successfully confirmed absence or cancellation, the layer displays **No current warnings** (or **No current thunderstorm warnings** when other warning types remain unverified). If only one thunderstorm product is active, it names the specific **IDQ21033** or **IDQ21035** product; a filtered cancelled product shows **No current warnings — [product]**. An interrupted mobile-data check is instead shown as **Unable to confirm current BoM warnings** with a retry option, never as a verified all-clear. Transient mobile network failures are automatically retried once. The source remains BoM, and the normal 15-minute refresh interval is unchanged.

**Updates and cancellations:** With the warning layer enabled, StormTracker checks automatically every **15 minutes**, or immediately when you tap **↻ Refresh**. A confirmed newer BoM warning polygon replaces its old issue. A confirmed cancellation removes the affected product's polygon at the next successful check. Source expiry also clears old polygons. This does not change refresh frequencies for radar, gauges, rainfall, roads, power or any other layer.

**Understanding zero polygons:** An actual, completed check can show **0 current polygons** if an original BoM warning is cancelled or there is no active issued polygon. A source timeout or broken/unverified polygon is displayed as **unavailable**, not zero warnings or all-clear. Access to the authentic active BoM warning geospatial products has not yet been end-to-end demonstrated during a live warning; never assume a blank map means BoM has issued no warning. [BoM IDQ21035 detailed bulletin](https://www.bom.gov.au/warning/severe-thunderstorm-warning/IDQ21035) and [BoM IDQ21033 regional bulletin](https://www.bom.gov.au/warning/severe-thunderstorm-warning/IDQ21033) remain authoritative.

**Coverage:** Queensland warning polygons only in this release. NSW warnings remain withheld until verified source-exact clipping against the supported radar coverage union is available. See [release notes V10.2.25](RELEASE_NOTES_V10.2.25.md).

## Other information layers

| Layer/control | How to use it | Interpretation |
|---|---|---|
| **Unplanned road closures** | Enable the layer, tap a marker or highlighted road, or open **Road closures** by council; select **Road types report** for state/local/unverified sections | Official QLDTraffic unplanned all-traffic closures; category may be unverified and is independent of council area. A closure is not necessarily caused by flooding. |
| **Unplanned power outages** | Enable the layer, tap mapped outage areas/markers, or open **Power outages** by council | Provider-published **unplanned** incidents; mapped areas and affected-customer numbers may change. |
| **QFD rescue & assistance** | Toggle this layer and inspect a job marker | Selected published rescue/assist classifications, not every QFD response. Locations may be approximate and are not a substitute for dispatch information. |
| **Basemap** | Choose **Street** or **Satellite** | Satellite imagery may be older than the current weather observation; it is a geographic background, not live cloud imagery. |
| **Measure** | Tap locations in sequence, then **Done** | Straight-line distance along Earth's surface, **not** road distance or terrain-adjusted travel distance. |
| **Cyclones** | Open the separate panel | Production displays source-backed **current** cyclone warning/forecast information when genuinely available. Historical cyclone tracks and test fixtures are **not loaded into the production map**. An unavailable or unverified feed must not be interpreted as 'no cyclone warning'. |

The **Cyclones** panel does **not** independently guarantee a continuously available live BoM forecast feed. A source-confirmed absence of current warnings must be distinguished from **unable to verify**; never interpret a blank drawing or stale source as an official all-clear. Consult [BoM warnings](https://www.bom.gov.au/) for current authoritative advice.

## Understanding status and missing data

- **Times:** Radar, Doppler and other hazard feeds update independently. Information panels follow the **source agency's published time style**: BoM gauges use 24-hour AEST station-table times, Energex/Ergon follow their am/pm outage-finder times, Essential Energy retains applicable NSW AEST/AEDT, and QLDTraffic uses its road-report convention. Stale readings show their **actual observation timestamp**; a successful page refresh does not imply the observations are current.
- **Stale / unavailable / Unrated:** These describe a **data-quality or reference-coverage limit**. They are not declarations that there is no weather or hazard.
- **Map markers:** Tap/click once to open information. On mobile, avoid dragging while trying to select a gauge. If multiple layers overlap, temporarily turn another layer off.
- **Browser history:** Longer radar loops depend on actual frames retained in that browser; a fresh visit need not have a complete extended loop immediately.
- **Visual performance:** For sluggish mobile or older desktop devices, reduce simultaneous overlays or selected radar sites. Hiding controls only changes screen layout; it does not improve the underlying BoM data.

## Quick troubleshooting

| Symptom | What to check |
|---|---|
| Rain total differs from BoM | Same **station number**, same **9 am / one-hour / 24-hour-to-9-am** period, and same **source timestamp**. Use the panel's original BoM link. |
| Rain gauge has **Unrated** label | The verified local design-rainfall reference may not yet be in the saved catalogue. The **mm total can still be valid**. |
| No rainfall markers | Layer on? Filter selected? No stations currently ≥50 mm? BoM region unavailable or stale? |
| Extended radar window is unavailable | Insufficient authentic observations saved in this browser; use an available shorter window. |
| Doppler missing at one site | Site may not publish Doppler, may have no time-matched genuine scan, or BoM source may be unavailable. |
| Flood gauge doesn't match another website | Check the exact BoM station ID, observation timestamp, verified stage datum, published crossing and whether the other source is showing an older cached reading. A signed historical rise may remain informational after the **live** rapid-rise arrow has correctly expired. |
| Closure/outage boundary looks wrong | Read the source panel and timestamp; the issuing agency's geometry takes precedence. |

## Official references and further help

- [Bureau of Meteorology — Queensland rainfall and river conditions](https://www.bom.gov.au/qld/flood/)
- [BoM 2016 Design Rainfall](https://www.bom.gov.au/water/designRainfalls/revised-ifd/?multipoint)
- [Queensland Traffic](https://qldtraffic.qld.gov.au/)
- [BoM official warnings](https://www.bom.gov.au/)
- [Development and maintenance handover](DEVELOPMENT_HANDOVER_CURRENT.md)

**Version note:** Updated **26 October 2026** for the **operator-accepted V10.2.23 composite production freeze**, including 24-hour expiry of unsupported river alerts, exact-ID contradiction checks, measured-rate/tendency separation, signed measured rise/fall, flood-stage-over-crossing priority with amber-below-minor exceptions, statewide coastal tidal screening, uniform flood marker dimensions and the existing AEP/rainfall and flood reports. The foundational radar-science pin remains sealed **V10.2.0**, with approved maintenance overlays. The release freeze tag/restore point is created only following successful production validation; see the versioned release notes and handover for verification.

## Which overlapping marker is displayed on top?

Higher severity markers are deliberately drawn in front of lower severity markers, including when flood and rainfall layers are both on. Flood icons progress **major, moderate, minor, rapid rise**; rainfall rarity icons progress **Exceptional, Very rare, Rare, Unusual, Notable**, then Less rare/Unrated. This is only a visual order; actual BoM measurements and flood stages are unchanged.
