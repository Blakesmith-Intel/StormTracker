import { RADARS } from "./config.js";
import { directPoint } from "./geo.js";

function colourForTrack(trackId) {
  const number = Number(String(trackId).replace(/\D/g, "")) || 1;
  const hue = (number * 0.61803398875) % 1;

  return Cesium.Color.fromHsl(
    hue,
    0.78,
    0.58,
    1
  );
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

    infoBox: false,
    selectionIndicator: false,

    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    baseLayer: false,

    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,

    useBrowserRecommendedResolution: true
  });

  const scene = viewer.scene;

  // Render only when the camera or StormTracker data actually changes.
  scene.requestRenderMode = true;
  scene.maximumRenderTimeChange = Infinity;

  // Disable effects that are unnecessary for the current live 2-D product.
  scene.fog.enabled = false;
  scene.globe.enableLighting = false;

  // Use slightly less globe detail to reduce browser/GPU work.
  scene.globe.maximumScreenSpaceError = 4;

  const controller = scene.screenSpaceCameraController;

  // Stop the globe continuing to move after the user releases it.
  controller.inertiaSpin = 0;
  controller.inertiaTranslate = 0;
  controller.inertiaZoom = 0;
  controller.bounceAnimationTime = 0;

  controller.minimumZoomDistance = 500;
  controller.maximumZoomDistance = 5_000_000;

  try {
    viewer.imageryLayers.addImageryProvider(
      new Cesium.OpenStreetMapImageryProvider({
        url: "https://tile.openstreetmap.org/"
      })
    );
  } catch (error) {
    console.warn(
      "OSM imagery unavailable; continuing with globe only",
      error
    );
  }

  const radarSource = new Cesium.CustomDataSource("radars");
  const stormSource = new Cesium.CustomDataSource("storms");

  viewer.dataSources.add(radarSource);
  viewer.dataSources.add(stormSource);

  for (const radar of Object.values(RADARS)) {
    radarSource.entities.add({
      id: `radar-${radar.id}`,
      name: `${radar.id} — ${radar.name}`,

      position: Cesium.Cartesian3.fromDegrees(
        radar.longitude,
        radar.latitude,
        0
      ),

      point: {
        pixelSize: 8,
        color: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.DEEPSKYBLUE,
        outlineWidth: 2
      },

      label: {
        text: radar.id,
        font: "12px sans-serif",
        pixelOffset: new Cesium.Cartesian2(0, -16),
        fillColor: Cesium.Color.WHITE
      },

      ellipse: {
        semiMajorAxis: radar.halfSpanKm * 1000,
        semiMinorAxis: radar.halfSpanKm * 1000,
        material: Cesium.Color.CYAN.withAlpha(0.015),
        outline: true,
        outlineColor: Cesium.Color.CYAN.withAlpha(0.25),
        height: 0
      }
    });
  }

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(
      152.95,
      -27.15,
      650000
    )
  });

  scene.requestRender();

  function render(result) {
    stormSource.entities.suspendEvents();

    try {
      stormSource.entities.removeAll();

      const active = new Set(
        result.active_track_ids ?? []
      );

      for (const track of result.tracks ?? []) {
        if (!track.latest) {
          continue;
        }

        const color = colourForTrack(
          track.track_id
        );

        const history = track.history ?? [];

        const positions = history.map(
          observation =>
            Cesium.Cartesian3.fromDegrees(
              observation.centroid_longitude,
              observation.centroid_latitude,
              0
            )
        );

        if (positions.length >= 2) {
          stormSource.entities.add({
            id: `${track.track_id}-path`,

            polyline: {
              positions,
              width: 3,
              material: color.withAlpha(0.8),
              clampToGround: false
            }
          });
        }

        const observation = track.latest;

        stormSource.entities.add({
          id: track.track_id,
          name: track.track_id,

          position: Cesium.Cartesian3.fromDegrees(
            observation.centroid_longitude,
            observation.centroid_latitude,
            0
          ),

          point: {
            pixelSize:
              active.has(track.track_id)
                ? 13
                : 8,

            color,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1
          },

          label: {
            text:
              `${track.track_id}  ≥`
              + `${Number(
                observation.maximum_dbzh_lower_bound
              ).toFixed(0)} dBZ`,

            font: "12px sans-serif",

            pixelOffset:
              new Cesium.Cartesian2(
                0,
                -20
              ),

            fillColor: Cesium.Color.WHITE,
            showBackground: true,

            backgroundColor:
              Cesium.Color.BLACK.withAlpha(
                0.55
              )
          },

          rectangle: {
            coordinates:
              Cesium.Rectangle.fromDegrees(
                observation.min_longitude,
                observation.min_latitude,
                observation.max_longitude,
                observation.max_latitude
              ),

            material:
              color.withAlpha(0.08),

            outline: true,

            outlineColor:
              color.withAlpha(0.7),

            height: 0
          }
        });

        if (track.motion) {
          const projection = directPoint(
            observation.centroid_longitude,
            observation.centroid_latitude,
            track.motion.heading_degrees,
            track.motion.speed_kmh / 3.6 * 600
          );

          stormSource.entities.add({
            id:
              `${track.track_id}-projection`,

            polyline: {
              positions: [
                Cesium.Cartesian3.fromDegrees(
                  observation.centroid_longitude,
                  observation.centroid_latitude,
                  0
                ),

                Cesium.Cartesian3.fromDegrees(
                  projection.longitude,
                  projection.latitude,
                  0
                )
              ],

              width: 2,

              material:
                new Cesium.PolylineDashMaterialProperty({
                  color:
                    color.withAlpha(0.75),

                  dashLength: 12
                }),

              clampToGround: false
            }
          });
        }
      }
    } finally {
      stormSource.entities.resumeEvents();
    }

    scene.requestRender();
  }

  return {
    viewer,
    render
  };
}
