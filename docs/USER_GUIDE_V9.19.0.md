# StormTracker V9.19.0 — User guide

**Public site:** https://blakesmith-intel.github.io/StormTracker/

This is a **situational-awareness display**, not an emergency management decision-making tool or an official warning service. Check BoM warnings and local agency directions independently.

## Basic controls

Select the **primary BoM radar** using the location selector or by clicking a radar-dish icon on the map. The **Radars** control lets you add up to **three** supplemental radar coverage sites, which display original BoM reflectivity imagery. Radar images are time-stamped; supplemental images may temporarily hold their **last genuine observation** during an inferred primary display frame (maximum 15 minutes). Holding a source observation is not a new scan.

Choose an available **30/60/120/180-minute rain-radar window** (options depend on current source and browser version) or the combined BoM-supported Doppler choice when available. **Play/Pause**, **Latest** and speed controls work independently of map navigation. Inferred playback steps are for smooth visual presentation only; the side panel identifies them. The measurement clock is based on the real BoM source.

Use **Hide controls** at the top of the map to expand the view; **Show controls** restores the sidebar without clearing radar selection or playback.

## Storm labels, cones and 3-D

**Labels are OFF by default.** Toggle **Labels** to show/hide storm ID dots and labels. The app analyses **primary-radar** observed connected pixels at >=40 dBZ; extra radar windows display imagery and inferred 3-D only. The interface deliberately includes the note: “Storm IDs, tracks and labels currently use the primary radar only. Additional radars provide imagery without storm labels.”

Select a storm ID and enable **+90m cone** to see measured-centroid motion extrapolation. The **0m** point should be anchored to the current observed storm; +30m/+60m/+90m markers show an uncertain future envelope. A cone may disappear when consecutive measured source scans do not support a trustworthy movement estimate; the sidebar explains this as a **withheld** projection. This is intentional. Inferred display frames never generate new observed motion or new forecasts. A large storm's brightest reflectivity core need not be at the calculated connected-pixel centroid.

The rounded 3-D storm volumes are **inferred**, with minimum displayed observed-source reflectivity >=40 dBZ; dBZ is not mm/hr. Doppler radial velocity is not storm-centroid translation speed.

## Mapping and context

Satellite uses state imagery for Queensland regional coverage, DEA regional imagery across NSW and NSW government detailed imagery when zoomed closer; terrain can be toggled independently. Mapping imagery is not live weather.

Context layer toggles include **unplanned road closures**, **unplanned power outages**, **flood signals**, and selected **QFD rescue/assistance** incidents. Flood marker legend: green qualifying rapid rise above minor, yellow moderate flood level, red major flood level, cyan unusual tidal rise (screening only). Moderate/major classifications remain relevant even if the observed river is steady or falling. Click icons for available source details.

Upstream temporary HTTP errors or network interruptions may affect optional context without stopping the main map. Use official BoM/agency products for decisions; this interface makes no independent warning determination.
