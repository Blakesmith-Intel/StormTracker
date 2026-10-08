# StormTracker V9.13.3 — desktop Queensland satellite town names

User issue: Birdsville and other rural place names rendered too small on a desktop satellite view. Original fonts were 12px normal weight at all widths for small towns and 13px bold for large centres.

## Change
- **Desktop / wide view (canvas width >=700 CSS px):** 15px bold for small/remote settlements (including Birdsville), 16px bold for centres with population >=10,000.
- **Mobile / narrow view (canvas width <700 CSS px):** keep existing 12px rural and 13px bold major-centre typography.
- **QLD imagery only:** continue Cesium georeferenced WGS84 labels in Queensland satellite view. No supplemental labels in Street/OpenStreetMap.
- Recompute font when canvas width changes, without reloading the town feed or reconstructing label entities.
- Reuse shared font metrics in collision boxes, allowing an extra bold glyph width margin. Preserve rural priority, horizon culling, small mobile cap (five), and camera/zoom decluttering.

## QA
- Unit regression verifies Birdsville/Brisbane 15/16px desktop, original 12/13px mobile, and resizing mobile→desktop→mobile.
- Declutter tests verify that adjacent labels fitting on mobile do **not** overlap when larger desktop fonts are in use.
- Full mobile Cesium browser checks initial Street zero extra names, pan and basemap switching.
- Full desktop Cesium browser visits Birdsville satellite camera and asserts the actual Cesium label font equals **bold 15px sans-serif** and the town remains visible; verifies zero extra names after switching back to Street.
- Browser automation includes screenshot artifacts where WebGL readback supports them.

Architecture unchanged: static GitHub Pages with existing 3-D Cesium renderer; no local hosting or new server/relay. No changes to radar, Doppler, flood alerts, roads, power, border or terrain.

Rollback: V9.13.2 commit 5254aab473c16250aa34877ad097d04b214cdf78 (`restore/v9.13.2`).
