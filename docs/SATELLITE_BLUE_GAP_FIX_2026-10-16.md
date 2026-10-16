# StormTracker — QLD/NSW Blue Satellite Gap Fix (16 October 2026)

## Operator video evidence
Five-second desktop recording `CameraRecording-622E5115-4ABC-4A48-8D82-7319278237A2.mp4` shows a stable QLD satellite view over Cunnamulla, Thargomindah, St George and the state border, while the northern NSW region around Brewarrina, Bourke, Walgett and Nyngan intermittently disappears into a saturated blue Cesium globe. As the camera moves the blue/imagery boundary sweeps over the NSW view and the image sometimes returns.

This is not missing BoM reflectivity and not a 3-D volume defect. It occurs where the Queensland government imagery rectangle ends and DEA GeoMAD regional coverage or a DEA tile is absent, slow or temporarily returns no visible land imagery.

## Root cause
In `frontend/src/context-layers/basemap-manager-v1.js`, the `persistentSatelliteCoverage` path constructed an OpenStreetMap fallback at imagery index 0 and then explicitly set `streetLayer.show=false` to avoid revealing a Street basemap. DEA GeoMAD at index 1 and the state imagery at indices 2/3 were therefore the only sources, but DEA WMTS does not guarantee an opaque, successfully loaded image at every zoom and every tile. Outside the QLD imagery rectangle, no visible fallback existed and Cesium rendered its solid blue globe.

## Fix: continuous genuine satellite underneath, original imagery above
- In the accepted satellite mode, imagery layer 0 is a **real worldwide Web Mercator satellite provider**: Esri World Imagery, `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`.
- Layer 1 is the original **DEA 2025 GeoMAD Landsat 8/9 30m regional composite**, unchanged.
- Layers 2 and 3 remain **NSW official detailed imagery when zoomed** and **Queensland government high-resolution imagery**, unchanged, with their original 256-pixel tile dimensions, native service zoom limits and source credits.
- The global satellite underlay remains **opaque, always shown and retained as a single long-lived provider**, including during camera interactions and genuine radar playback. A missing regional tile reveals another actual satellite image instead of OSM streets or an empty globe. Only those uncovered gaps use fallback imagery; this does not resample or replace BoM meteorology or trade away primary 3-D detail.
- Explicit Street mode still uses OpenStreetMap only; archived street-only QA remains street-only, with no extra satellite provider instantiated.
- Source errors retain their warning messages without deleting fallback or recreating providers each frame.
- Provider attribution: Esri, Maxar, Earthstar Geographics and GIS user community, in Cesium credits, alongside QLD, DEA and NSW credits.

## Quality constraints
This patch does NOT change radar data, native source UTC, original reflectivity/Doppler dimensions, inferred 3-D model, 40 dBZ floor, high-resolution satellite selection, 1.0x vertical scale, volumetric GPU glyph geometry, weather colours or radar density. A fallback cannot make unavailable upstream DEA tiles magically load; at any seam where different source imagery is unavoidable, it shows genuine satellite coverage rather than blank blue.

## Validation
1. Existing basemap automated tests cover active worldwide provider beneath DEA and state tiles, source error survival, order across a long pan, detail hysteresis and clean Street mode.
2. Satellite/GPU gesture and full-fidelity tests must pass; original official preferred imagery must remain layer-above-fallback.
3. Visual preview: same region Cunnamulla–Brewarrina–Bourke–Walgett, with Satellite and 3-D terrain on. Pan and zoom repeatedly. The NSW blue cutout must not appear; QLD/DEA imagery should remain unchanged where available, with one continuous satellite baseline under any missing regional tiles.
4. Check additional radar reflectivity and inferred 3-D volumes still render; use the same selected sites and playback loop as prior tests.
5. Preserve sealed `v9.20.1` and `restore/v9.20.1` until user approval and an independent source-pinned release cutover.

## External verification
Esri World Imagery and its Web Mercator tiled MapServer are public service endpoints described in Esri/Cesium provider documentation. Individual imagery scenes can differ in vintage and colour, so a patchwork seam may be visible only where a previously unavailable source tile has been filled. **No guarantee of a pixel-for-pixel uniform mosaic where independent providers differ.**
