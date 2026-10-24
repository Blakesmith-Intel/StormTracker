# StormTracker — current operator guide
**Edition:** 22 October 2026 | **Applies to:** public V10.2.0 operational site with accepted maintenance overlays  
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

**Radar site selection.** Use the primary-site dropdown; select **Radars** to include up to **three additional sites**. Tap a radar-site map marker to choose it as primary. The operator interface notes that track labels and projected storm cones are based on the **primary radar**, not the combined radars. Some additional sites support Doppler; **Moree and Grafton are rain-only**. **Brewarrina Doppler** is for viewing only pending full geolocation verification for scientific wind/circulation analysis.

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
| **Green flood icon** | BoM minor flood classification |
| **Yellow flood icon** | BoM moderate flood classification |
| **Red flood icon** | BoM major flood classification |
| **Blue icon with upward arrow** | Below minor, but measured rapidly rising water according to StormTracker's screening |
| **Blue icon without upward arrow** | A station remains above its own verified pre-rise observation, **or** its fresh BoM height meets an exactly matched published bridge/causeway/crossing level; no official minor flood stage is implied |
| **Upward arrow on green/yellow/red** | A potential rapid-rise modifier **in addition to** the official flood classification |

**Crossing coverage:** StormTracker checks published crossing levels for all matching Queensland BoM river gauges, including data-only locations and stations whose bulletin tendency is steady or falling. The existing official station-page source checks run in bounded batches and results are cached for up to 24 hours. Opening the flood report completes the full list of available station-page checks rather than stopping after the first batch. Where BoM pages cannot be reached or no source link exists, the report identifies those unresolved stations instead of treating them as below crossing level. A gauge not yet checked for its station-page crossing is **not** evidence that the bridge is below water or safe; a confirmed crossing marker needs a fresh water-height reading and an exact-ID BoM crossing reference. Gauge levels continue refreshing every 10 minutes independently of the crossing lookup.

**The upward arrow is an inferred indicator, not an official BoM flash-flood warning.** A bridge/causeway reference is independently displayed from the exact same BoM station ID even when no minor flood category is published. The gauge panel shows the sourced crossing level and the amount by which the latest fresh water level exceeds it. A crossing level is not proof that a road is closed. Tidal screening is used to reduce false alerts from ordinary rising tides; it cannot rule out every tidal effect, storm surge or flooding mechanism. Classified gauges disappear after a fresh measured height falls below their verified station-specific minor level. Where BoM has not published a minor level, a rapid-rise gauge may remain as a blue **no-arrow** marker while the water stays above that gauge's observed pre-rise height. Two different current readings at least 15 minutes apart must return near that pre-rise reference before the marker disappears. This reference is **not** a published normal river height or flood threshold; stale measurements cannot prove recovery. The map and station panel may identify an old or unavailable source: do not treat missing or stale data as “no flood.”

### New: flood gauge report

Select **Flood gauge report · Moderate+ / crossings** in the same row as **Flood signals** and **Refresh**. It opens an on-screen, scrollable window that lists all **fresh** BoM gauges with current **moderate or major flooding**, even while their map layer is off, and also stations whose latest measured height has reached a **published bridge, causeway or crossing reference** even when no flood level is set or the reading is below minor.

The report groups gauges into **Major**, **Moderate**, and **Crossing level reached (other flood categories)**, showing the original station name and ID, current height, tendency and observation time. Where a crossing is reached, it shows the crossing name, the published reference height and the difference in metres. Each station appears only once, even when it meets both criteria. Use **↻ Refresh** to request the latest readings. The window updates automatically after normal 10-minute river-gauge updates and works on mobile.

**Source and safety:** Crossing references are obtained by **exact BoM station number** from its own [BoM river-height station table](https://www.bom.gov.au/fwo/IDQ65392/IDQ65392.535162.tbl.shtml) where published (including newer stations such as Theresa Creek Dam 535162, bridge **1.71 m**), or from [BoM Queensland Section 5 — Details of Crossings](https://www.bom.gov.au/qld/flood/networks/section5.shtml), dated **5 January 2022**, where no verified station-page reference is available. These are published reference heights, **not** confirmed road closures or proof that a road is passable. Cross-check [QLDTraffic](https://qldtraffic.qld.gov.au/) and local road authorities. If crossing reference data cannot be validated, the report still lists verified moderate/major gauges but explicitly warns that crossing-only results are unavailable. Stale or missing gauges are not shown as current, and are never assumed safe.

## Other information layers

| Layer/control | How to use it | Interpretation |
|---|---|---|
| **Unplanned road closures** | Enable the layer, tap a marker or highlighted road, or open **Road closures** by council | Official Queensland Traffic events; a closure is not necessarily due to flooding. Source geometry, updates and restrictions may vary. |
| **Unplanned power outages** | Enable the layer, tap mapped outage areas/markers, or open **Power outages** by council | Provider-published **unplanned** incidents; mapped areas and affected-customer numbers may change. |
| **QFD rescue & assistance** | Toggle this layer and inspect a job marker | Selected published rescue/assist classifications, not every QFD response. Locations may be approximate and are not a substitute for dispatch information. |
| **Basemap** | Choose **Street** or **Satellite** | Satellite imagery may be older than the current weather observation; it is a geographic background, not live cloud imagery. |
| **Measure** | Tap locations in sequence, then **Done** | Straight-line distance along Earth's surface, **not** road distance or terrain-adjusted travel distance. |
| **Cyclones** | Open the separate panel | Historical **Jasper 2023** and **Alfred 2025** reference tracks are observed history; an operator-loaded original BoM forecast GML file is **historical/QA**, not a live active cyclone warning. |

The **Cyclones** panel does **not** provide an independently verified continuously live Queensland cyclone forecast/warning feed. If source status cannot be verified, consult [BoM warnings](https://www.bom.gov.au/). Never interpret a missing cyclone drawing as an official all-clear.

## Understanding status and missing data

- **Times:** BoM can issue reflectivity, Doppler, rain gauges, river levels and incident feeds at **different times**. StormTracker displays UTC and/or **AEST** where appropriate. Check the specific product's timestamp rather than assuming everything refreshed together.
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
| Flood gauge doesn't match another website | Check exact BoM station ID, observation time, flood classification, datum and whether the page is showing an old cached reading. |
| Closure/outage boundary looks wrong | Read the source panel and timestamp; the issuing agency's geometry takes precedence. |

## Official references and further help

- [Bureau of Meteorology — Queensland rainfall and river conditions](https://www.bom.gov.au/qld/flood/)
- [BoM 2016 Design Rainfall](https://www.bom.gov.au/water/designRainfalls/revised-ifd/?multipoint)
- [Queensland Traffic](https://qldtraffic.qld.gov.au/)
- [BoM official warnings](https://www.bom.gov.au/)
- [Development and maintenance handover](DEVELOPMENT_HANDOVER_CURRENT.md)

**Version note:** This document describes the accepted production behaviour through **22 October 2026**, including the **24hrs to 9am** label and **small droplet / normal-sized rarity text**. The underlying application is sealed V10.2.0 with later source-verified maintenance overlays. See the development handover for exact pins, source files and audit trails.

## Which overlapping marker is displayed on top?

Higher severity markers are deliberately drawn in front of lower severity markers, including when flood and rainfall layers are both on. Flood icons progress **major, moderate, minor, rapid rise**; rainfall rarity icons progress **Exceptional, Very rare, Rare, Unusual, Notable**, then Less rare/Unrated. This is only a visual order; actual BoM measurements and flood stages are unchanged.
