# StormTracker V9.18.0 — Release notes

**Status:** Approved by visual browser testing of the isolated PR #73, #76 and #77 previews. Production release to be tagged only after successful public Pages verification.

## Changes since sealed V9.17.0

- **Doppler transition:** Clear stale 2-D reflectivity tracks, historical trails, selected tracks, threat cones and DOM label overlays immediately on switching to native Doppler. Existing tracks are reconstructed only on a reflectivity return.
- **Radar station symbols:** High-contrast recognisable radar dishes with minimal map clutter, designed for satellite and Street modes.
- **NSW / supplemental radar playback:** Per-station image handover keeps the prior valid frame visible until the next official BoM frame is render-ready. No artificial observed weather frames or storm-track motion.
- **Satellite mode:** At regional zoom show Geoscience Australia's publicly accessible 2025 Landsat 8/9 DEA GeoMAD RGB Web Mercator WMTS, draped over the existing independent 3-D terrain. At local zoom, stage and fade in the existing Queensland and NSW government detailed aerial imagery. Enter detail at approximately 38 metres/display pixel; return to DEA past 65 metres/display pixel to suppress rapid zoom flicker. Satellite imagery is contextual, not live meteorology.
- **NSW names across southern radar footprints:** Use a snapshot of geolocated *official* NSW City/Town/Locality features assembled during static Pages build. The NSW source omits browser CORS headers; the snapshot is served from the exact StormTracker Pages origin. The builder returned 791 places (~100 KB) across Brewarrina, Moree, Grafton, south-east Queensland cross-border radar coverage. Names share Queensland's collision checks, screen-space distribution, geographic pan lock and zoom-scale rules. Village features without official point geometry are excluded (not guessed). The Grafton station icon retains its independently verified radar coordinates even though the point settlement feed does not contain a separate Grafton town record.
- **Operational safety:** BoM radar/dBZ, native Doppler, inference, tracks and thresholds are unchanged except the approved rendering/lifecycle repairs. StormTracker remains a browser-only situational-awareness aid, not an emergency management decision-making tool.

## Public sources and licenses

- BoM original native reflectivity/Doppler products (no fabricated frames).
- DEA WMTS `https://ows.dea.ga.gov.au/`, `ga_ls8cls9c_gm_cyear_3`, `simple_rgb`, `WholeWorld_WebMercator`, Time `2025-01-01`; Geoscience Australia attribution, CC BY 4.0.
- Official Queensland Latest State Program imagery and NSW Spatial Services imagery (each credited).
- NSW Spatial Services TopoBaseMap `https://spatial.industry.nsw.gov.au/arcgis/rest/services/PUBLIC/TopoBaseMap/MapServer`; authoritative named coordinates. Static source snapshot publicly accessible under `/data/nsw-radar-places-v1.json`, rebuilt on Pages deployment; new record count is checked before publish.

## Acceptance and rollback

Pre-release visual acceptance: PR #73 (Doppler, radar symbols and supplementary imagery), PR #76 (DEA regional/detail switching), PR #77 (NSW place-name coverage). V9.18.0 production deployment must verify `BUILD.txt`, code assets and JSON source under the normal site root, then tag release `v9.18.0` and pin the recovery branch `restore/v9.18.0` to the exact tested immutable release code commit. Previous `v9.17.0` and `restore/v9.17.0` are never moved.

**Operational caution:** Satellite/DEA basemap is not current storm imagery; always use the time-stamped BoM radar and Doppler layers for current precipitation and wind context.
