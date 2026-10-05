import {
  CHRISTMAS_2023_GOLD_COAST_SCENARIO,
  runChristmas2023TrackingScenario
} from "./christmas-2023-derecho-scenario-v1.js";

import {
  createStormTrackerCameraController
} from "./stormtracker-camera-v1.js?v=camera-v1.1-wheel";

const $ =
  id =>
    document.getElementById(
      id
    );

const run =
  runChristmas2023TrackingScenario();

const viewer =
  new Cesium.Viewer(
    "cesiumContainer",
    {
      animation:false,
      timeline:false,
      geocoder:false,
      homeButton:false,
      sceneModePicker:false,
      baseLayerPicker:false,
      navigationHelpButton:false,
      fullscreenButton:false,
      infoBox:false,
      selectionIndicator:false,
      terrainProvider:
        new Cesium.EllipsoidTerrainProvider(),
      baseLayer:false,
      requestRenderMode:true,
      maximumRenderTimeChange:Infinity,
      useBrowserRecommendedResolution:true
    }
  );

const scene =
  viewer.scene;

scene.fog.enabled =
  false;

scene.globe.enableLighting =
  false;

scene.globe.maximumScreenSpaceError =
  4;

const mapCamera =
  createStormTrackerCameraController({
    viewer,

    container:
      $("cesiumContainer"),

    home: {
      longitude:
        153.02,

      latitude:
        -27.80,

      targetHeight:
        0,

      range:
        105000,

      heading:
        Cesium.Math.toRadians(
          350
        ),

      pitch:
        Cesium.Math.toRadians(
          -42
        )
    },

    onUnexpectedCorrection:
      count => {
        $("cameraCorrections")
          .textContent =
            String(
              count
            );
      }
  });

try {
  viewer.imageryLayers
    .addImageryProvider(
      new Cesium
        .OpenStreetMapImageryProvider({
          url:
            "https://tile.openstreetmap.org/"
        })
    );
} catch (error) {
  console.warn(
    "OSM imagery unavailable",
    error
  );
}

const dataSource =
  new Cesium
    .CustomDataSource(
      "christmas-2023-simulation"
    );

viewer.dataSources.add(
  dataSource
);

let frameIndex =
  0;

let playing =
  false;

function categoryColour(
  category
) {
  if (
    category >= 15
  ) {
    return Cesium.Color
      .fromCssColorString(
        "#d830ff"
      );
  }

  if (
    category >= 14
  ) {
    return Cesium.Color
      .fromCssColorString(
        "#ff4b25"
      );
  }

  if (
    category >= 12
  ) {
    return Cesium.Color
      .fromCssColorString(
        "#ffd21a"
      );
  }

  if (
    category >= 11
  ) {
    return Cesium.Color
      .fromCssColorString(
        "#00bf70"
      );
  }

  return Cesium.Color
    .fromCssColorString(
      "#2b82ff"
    );
}

function equivalentRadiusMetres(
  areaKm2
) {
  return (
    Math.sqrt(
      Number(
        areaKm2
      )
      / Math.PI
    )
    * 1000
  );
}

function fmt(
  value,
  digits =
    0
) {
  return Number(
    value
  )
    .toFixed(
      digits
    );
}

function renderFrame(
  index
) {
  frameIndex =
    Math.max(
      0,
      Math.min(
        run.results.length - 1,
        Number(
          index
        )
      )
    );

  const result =
    run.results[
      frameIndex
    ];

  const {
    frame,
    track,
    assessment,
    dopplerContext
  } =
    result;

  dataSource.entities
    .removeAll();

  const completed =
    run.results
      .slice(
        0,
        frameIndex + 1
      );

  const pathPositions =
    completed.map(
      item =>
        Cesium.Cartesian3
          .fromDegrees(
            item.track.latest
              .centroid_longitude,

            item.track.latest
              .centroid_latitude,

            500
          )
    );

  if (
    pathPositions.length >= 2
  ) {
    dataSource.entities.add({
      polyline: {
        positions:
          pathPositions,

        width:
          5,

        material:
          Cesium.Color.WHITE
            .withAlpha(
              0.82
            )
      }
    });
  }

  for (
    const item
    of completed
  ) {
    const obs =
      item.track.latest;

    const isCurrent =
      item.frame.index
      === frame.index;

    dataSource.entities.add({
      position:
        Cesium.Cartesian3
          .fromDegrees(
            obs.centroid_longitude,
            obs.centroid_latitude,
            800
          ),

      point: {
        pixelSize:
          isCurrent
            ? 12
            : 7,

        color:
          categoryColour(
            obs.maximum_category
          ),

        outlineColor:
          Cesium.Color.BLACK,

        outlineWidth:
          1,

        disableDepthTestDistance:
          Number.POSITIVE_INFINITY
      },

      label: {
        text:
          `${item.track.track_id} ${item.frame.local_time}`,

        font:
          "12px sans-serif",

        fillColor:
          Cesium.Color.WHITE,

        outlineColor:
          Cesium.Color.BLACK,

        outlineWidth:
          2,

        style:
          Cesium.LabelStyle
            .FILL_AND_OUTLINE,

        pixelOffset:
          new Cesium.Cartesian2(
            0,
            -18
          ),

        disableDepthTestDistance:
          Number.POSITIVE_INFINITY
      }
    });
  }

  const radius =
    equivalentRadiusMetres(
      track.latest
        .sampled_area_km2
    );

  dataSource.entities.add({
    position:
      Cesium.Cartesian3
        .fromDegrees(
          track.latest
            .centroid_longitude,

          track.latest
            .centroid_latitude
        ),

    ellipse: {
      semiMajorAxis:
        radius * 1.35,

      semiMinorAxis:
        radius * 0.72,

      rotation:
        Cesium.Math.toRadians(
          112
        ),

      material:
        categoryColour(
          track.latest
            .maximum_category
        )
          .withAlpha(
            0.22
          ),

      outline:
        true,

      outlineColor:
        categoryColour(
          track.latest
            .maximum_category
        )
    }
  });

  $("frameSlider")
    .value =
      String(
        frameIndex
      );

  $("frameNumber")
    .textContent =
      `${frameIndex + 1}/${run.results.length}`;

  $("localTime")
    .textContent =
      frame.local_time;

  $("corridor")
    .textContent =
      frame.corridor_label;

  $("trackId")
    .textContent =
      track.track_id;

  $("observations")
    .textContent =
      String(
        track.observation_count
      );

  $("confidence")
    .textContent =
      track.algorithmic_confidence;

  $("dbz")
    .textContent =
      `≥${fmt(frame.maximum_dbzh_lower_bound)} dBZ`;

  $("area")
    .textContent =
      `${fmt(track.latest.sampled_area_km2)} km²`;

  $("motion")
    .textContent =
      track.motion
        ? (
            `${fmt(track.motion.speed_kmh, 1)} km/h @ ` +
            `${fmt(track.motion.heading_degrees, 0)}°`
          )
        : "initial observation";

  $("assessment")
    .textContent =
      `${assessment.category} — ${assessment.score}/100`;

  $("assessmentConfidence")
    .textContent =
      `${assessment.confidence}; evidence ${assessment.evidence_coverage_percent}/100`;

  $("doppler")
    .textContent =
      `${assessment.doppler_component_score}/${assessment.doppler_component_maximum}`;

  $("dopplerValues")
    .textContent =
      `${dopplerContext.primary.strongest_toward_kmh} / +${dopplerContext.primary.strongest_away_kmh} km/h`;

  $("sampleCount")
    .textContent =
      String(
        dopplerContext.primary
          .sample_count
      );

  $("status")
    .textContent =
      track.track_id === "ST0001"
        ? "PASS — persistent ST0001 identity maintained"
        : `CHECK — current identity ${track.track_id}`;

  scene.requestRender();
}

async function playOnce() {
  if (playing) {
    return;
  }

  playing =
    true;

  $("playButton")
    .disabled =
      true;

  try {
    for (
      let index = 0;
      index < run.results.length;
      index++
    ) {
      renderFrame(
        index
      );

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            900
          )
      );
    }
  } finally {
    playing =
      false;

    $("playButton")
      .disabled =
        false;
  }
}

$("frameSlider")
  .max =
    String(
      run.results.length - 1
    );

$("frameSlider")
  .addEventListener(
    "input",
    event => {
      renderFrame(
        event.target.value
      );
    }
  );

$("playButton")
  .addEventListener(
    "click",
    playOnce
  );

$("resetButton")
  .addEventListener(
    "click",
    () =>
      mapCamera.reset()
  );

$("scenarioTitle")
  .textContent =
    CHRISTMAS_2023_GOLD_COAST_SCENARIO
      .title;

renderFrame(
  0
);
