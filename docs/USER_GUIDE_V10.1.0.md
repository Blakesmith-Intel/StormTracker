# StormTracker V10.1.0 — Operator guide

Open **https://blakesmith-intel.github.io/StormTracker/**. The accepted compact sidebar includes Radar playback, Storm tracking and Layers, with incident overlays off on page load. BoM reflectivity uses **dBZ**, inferred 3-D volume begins at **40 dBZ**, and map scale/measure tools work on the main map.

## Multiple radar sites

Choose your primary BoM radar in the upper map selector. Click **Radars** to select up to **three additional sites**. The same selectors work in rain and Doppler modes.

In **Rain radar**, multiple sites prepare genuine source reflectivity and reveal together. In **Doppler — All available**, sites with Doppler products each load their own real radial-velocity images. The primary's observed UTC drives the playback. Each additional radar selects its nearest original BoM wind image within **8 minutes before or after** that timestamp. All available images prepare together and are revealed at the primary image boundary, so their display stays coordinated. A temporarily unavailable site's wind is omitted for that frame instead of appearing late or pretending to share the primary timestamp. The status within **Radars** lists each site's own observed time and offset.

**Brewarrina (93)** supports BoM Doppler (`IDR93I`) and rain. Its weather raster is display georeferenced by the BoM site and 128 km range; geospatial control-point QA is ongoing, so don't use Brewarrina's apparent radial velocities for precise circulation measurements. **Moree (53)** and **Grafton (28)** are **Rain only**.

Doppler radial wind is **not a ground-level wind gust**, and the viewer is situational awareness, not an official warning/decision-making tool. **Storm track labels and +90-minute threat cones are primary-radar only** and the cone is *not* an official cyclone forecast. Inferred 3-D reflects measured source dBZ but is not an observed three-dimensional BoM radar volume.

## Other layers

Select Street/Satellite and use Measure for horizontal ground distance. Road closures, unplanned power outages, flood levels and selected QFD incidents have separate optional controls. The LGA outage selector provides source-reported affected-customer counts and last-refresh timestamps; turn on only the layers you need.
