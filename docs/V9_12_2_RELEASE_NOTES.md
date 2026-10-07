# StormTracker V9.12.2 — camera-stable Queensland town labels

## Cause

The rasterised Queensland Globe Population Centres map export was drawn in Cesium's imagery collection. While moving or pitching the camera, imagery tile selection and 3-D terrain re-projection changed which scale-specific label images were visible. Text could disappear or appear in a shifted screen position despite a nearly unchanged camera view.

## Change

- Reads real, authoritative `name`, `objectid`, `population`, `upper_scale` and point coordinates from the official Queensland Globe Population Centres layer 20 query endpoint.
- Loads the complete 758-centre dataset with bounded, ordered, browser-CORS-accessible GeoJSON queries.
- Draws labels as a single Cesium `LabelCollection` attached to fixed WGS84 coordinates rather than loading text from geographic image tiles.
- Reuses one set of labels between Street and QLD imagery basemap selections and throughout terrain mesh refinements and camera gestures.
- Uses stable population-sensitive visibility ranges that keep outback settlements visible while exploring wide map views.
- Does not change the basemap imagery footprint, radar/Doppler animation, storm tracking, flood roads, power outages, BoM gauge overlays or picking mechanics.
- Browser HTML, CSS and app module URL versions bumped to 9.12.2 so iOS Safari does not retain the previous imagery-label logic.

## Testing

- Regression covers deterministic query URL paging, Queensland bounds, stable geodetic positions (Birdsville test), independent camera/basemap reloads and Cesium label state.
- Live GitHub Actions smoke verifies official layer attributes, actual Queensland GeoJSON and browser-origin CORS. Successful development-branch smoke found 758 named centres; Birdsville (-25.9018, 139.3500).
- Require passing GitHub Actions frontend tests and Pages deployment before production release.

## Important limitations

- Street OpenStreetMap tiles include some town text of their own. Queensland vector labels can therefore overlap text embedded in that map; the two different providers do not share a collision engine.
- World-anchored names move *on screen* when the user physically pans, zooms or rotates the map, as they should, but no longer detach from their coordinates as imagery tiles change.
- This release is validated by automated browser-independent checks and the live government service; final in-browser mobile visual acceptance still needs field confirmation.

## Rollback

V9.12.1 production: `69f5671b937f25345173380baad9a4e1e66beddd`, branch `restore/v9.12.1`.
