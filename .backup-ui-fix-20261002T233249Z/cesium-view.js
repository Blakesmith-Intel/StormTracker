import { RADARS } from "./config.js";
import { directPoint } from "./geo.js";

function colourForTrack(trackId) {
  const number = Number(String(trackId).replace(/\D/g,"")) || 1;
  const hue = (number * 0.61803398875) % 1;
  return Cesium.Color.fromHsl(hue,0.78,0.58,1);
}

export function createCesiumView(containerId) {
  const viewer = new Cesium.Viewer(containerId, {
    animation: false,
    timeline: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    baseLayerPicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: true,
    selectionIndicator: true,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    baseLayer: false
  });

  try {
    viewer.imageryLayers.addImageryProvider(new Cesium.OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" }));
  } catch (error) {
    console.warn("OSM imagery unavailable; continuing with globe only", error);
  }

  const radarSource = new Cesium.CustomDataSource("radars");
  const stormSource = new Cesium.CustomDataSource("storms");
  viewer.dataSources.add(radarSource);
  viewer.dataSources.add(stormSource);

  for (const radar of Object.values(RADARS)) {
    radarSource.entities.add({
      id: `radar-${radar.id}`,
      name: `${radar.id} — ${radar.name}`,
      position: Cesium.Cartesian3.fromDegrees(radar.longitude,radar.latitude,0),
      point: { pixelSize: 8, color: Cesium.Color.WHITE, outlineColor: Cesium.Color.DEEPSKYBLUE, outlineWidth: 2 },
      label: { text: radar.id, font: "12px sans-serif", pixelOffset: new Cesium.Cartesian2(0,-16), fillColor: Cesium.Color.WHITE },
      ellipse: {
        semiMajorAxis: radar.halfSpanKm*1000,
        semiMinorAxis: radar.halfSpanKm*1000,
        material: Cesium.Color.CYAN.withAlpha(0.015),
        outline: true,
        outlineColor: Cesium.Color.CYAN.withAlpha(0.25),
        height: 0
      }
    });
  }

  viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(152.95,-27.15,650000), duration: 0 });

  function render(result) {
    stormSource.entities.removeAll();
    const active = new Set(result.active_track_ids ?? []);
    for (const track of result.tracks ?? []) {
      if (!track.latest) continue;
      const color = colourForTrack(track.track_id);
      const history = track.history ?? [];
      const positions = history.map(o => Cesium.Cartesian3.fromDegrees(o.centroid_longitude,o.centroid_latitude,0));
      if (positions.length >= 2) {
        stormSource.entities.add({
          id: `${track.track_id}-path`,
          polyline: { positions, width: 3, material: color.withAlpha(0.8), clampToGround: true }
        });
      }
      const o = track.latest;
      stormSource.entities.add({
        id: track.track_id,
        name: track.track_id,
        position: Cesium.Cartesian3.fromDegrees(o.centroid_longitude,o.centroid_latitude,0),
        point: { pixelSize: active.has(track.track_id)?13:8, color, outlineColor: Cesium.Color.WHITE, outlineWidth: 1 },
        label: {
          text: `${track.track_id}  ≥${Number(o.maximum_dbzh_lower_bound).toFixed(0)} dBZ`,
          font: "12px sans-serif",
          pixelOffset: new Cesium.Cartesian2(0,-20),
          fillColor: Cesium.Color.WHITE,
          showBackground: true,
          backgroundColor: Cesium.Color.BLACK.withAlpha(0.55)
        },
        rectangle: {
          coordinates: Cesium.Rectangle.fromDegrees(o.min_longitude,o.min_latitude,o.max_longitude,o.max_latitude),
          material: color.withAlpha(0.08),
          outline: true,
          outlineColor: color.withAlpha(0.7),
          height: 0
        },
        description: `<b>${track.track_id}</b><br>2-D-derived algorithmic storm track<br>Observations: ${track.observation_count}<br>Confidence: ${track.algorithmic_confidence}<br>Latest: ${o.observed_utc}`
      });

      if (track.motion) {
        const projection = directPoint(o.centroid_longitude,o.centroid_latitude,track.motion.heading_degrees,track.motion.speed_kmh/3.6*600);
        stormSource.entities.add({
          id: `${track.track_id}-projection`,
          polyline: {
            positions: [
              Cesium.Cartesian3.fromDegrees(o.centroid_longitude,o.centroid_latitude,0),
              Cesium.Cartesian3.fromDegrees(projection.longitude,projection.latitude,0)
            ],
            width: 2,
            material: new Cesium.PolylineDashMaterialProperty({ color: color.withAlpha(0.75), dashLength: 12 }),
            clampToGround: true
          }
        });
      }
    }
  }

  return { viewer, render };
}
