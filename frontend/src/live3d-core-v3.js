import {
  loadLatestBomReflectivityMosaic,
  loadRecentBomReflectivityMosaics
} from "./bom-wmts-loop-v1.js?v=hybrid-v1";

import {
  RadarWorkerClient
} from "./worker-client.js?v=hybrid-v1";

import {
  SOURCE_PALETTES
} from "./palette.js?v=live3d-v1";

import {
  DEFAULT_OCCUPANCY_THRESHOLD,
  inferColumn,
  pixelCentreMercator,
  representativeDbzForCategory,
  webMercatorToDegrees
} from "./inferred-volume-v1.js?v=confidence-v1";

import {
  styleForInferredPoint
} from "./inferred-confidence-v1.js?v=confidence-v1";

import {
  buildMeasuredTrackVolume,
  highSupportTop40Trend
} from "./measured-track-volume-v1.js?v=track-volume-v1";

const MODEL_URL =
  "./3d-models/inferred_vertical_profile_model_v2.json";

const VALIDATION_URL =
  "./3d-models/leave_one_event_out_validation_v2.json";

const $ = id =>
  document.getElementById(id);

const viewer = new Cesium.Viewer(
  "cesiumContainer",
  {
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
    terrainProvider:
      new Cesium.EllipsoidTerrainProvider(),
    baseLayer: false,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    useBrowserRecommendedResolution: true
  }
);

const scene = viewer.scene;
const controller =
  scene.screenSpaceCameraController;

scene.fog.enabled = false;
scene.globe.enableLighting = false;
scene.globe.maximumScreenSpaceError = 4;

controller.inertiaSpin = 0;
controller.inertiaTranslate = 0;
controller.inertiaZoom = 0;
controller.bounceAnimationTime = 0;

try {
  viewer.imageryLayers.addImageryProvider(
    new Cesium.OpenStreetMapImageryProvider({
      url: "https://tile.openstreetmap.org/"
    })
  );
} catch (error) {
  console.warn("OSM imagery unavailable", error);
}

let model = null;
let validation = null;
let latestFrame = null;
let inferredCollection = null;
let surfaceLayer = null;
let navigationLocked = true;
let lockedCamera = null;
let restoringCamera = false;

const hybridWorker =
  new RadarWorkerClient();

const hybridSource =
  new Cesium.CustomDataSource(
    "hybrid-2d-tracks"
  );

viewer.dataSources.add(
  hybridSource
);

let hybridFrames = [];
let hybridResults = [];
let hybridFrameIndex = 0;
let hybridHistory = new Map();
let hybridPlaying = false;

let hybridTrackVolumes = [];
let hybridTrackVolumeCollection = null;

function setStatus(message, kind = "normal") {
  $("status").textContent = message;

  $("status").dataset.kind = kind;
}

function colourForDbzh(value) {
  if (value >= 60) {
    return Cesium.Color.fromCssColorString(
      "#bd2fff"
    );
  }

  if (value >= 55) {
    return Cesium.Color.fromCssColorString(
      "#ff5a22"
    );
  }

  if (value >= 50) {
    return Cesium.Color.fromCssColorString(
      "#ffd21a"
    );
  }

  if (value >= 40) {
    return Cesium.Color.fromCssColorString(
      "#00b96b"
    );
  }

  if (value >= 30) {
    return Cesium.Color.fromCssColorString(
      "#1e78ff"
    );
  }

  return Cesium.Color.fromCssColorString(
    "#6ab6ff"
  );
}

function displayAltitude(altitude) {
  const exaggeration =
    Number(
      $("verticalScale").value
    );

  return altitude * exaggeration;
}

function takeCameraSnapshot() {
  lockedCamera = {
    position:
      Cesium.Cartesian3.clone(
        viewer.camera.position
      ),

    heading:
      viewer.camera.heading,

    pitch:
      viewer.camera.pitch,

    roll:
      viewer.camera.roll
  };
}

function restoreLockedCamera() {
  if (
    !navigationLocked
    || !lockedCamera
    || restoringCamera
  ) {
    return;
  }

  const positionDistance =
    Cesium.Cartesian3.distance(
      viewer.camera.position,
      lockedCamera.position
    );

  const moved =
    positionDistance > 0.05
    || Math.abs(
      viewer.camera.heading
      - lockedCamera.heading
    ) > 1e-7
    || Math.abs(
      viewer.camera.pitch
      - lockedCamera.pitch
    ) > 1e-7
    || Math.abs(
      viewer.camera.roll
      - lockedCamera.roll
    ) > 1e-7;

  if (!moved) {
    return;
  }

  restoringCamera = true;

  try {
    viewer.camera.cancelFlight();

    viewer.camera.setView({
      destination:
        Cesium.Cartesian3.clone(
          lockedCamera.position
        ),

      orientation: {
        heading:
          lockedCamera.heading,

        pitch:
          lockedCamera.pitch,

        roll:
          lockedCamera.roll
      }
    });
  } finally {
    restoringCamera = false;
  }

  scene.requestRender();
}

function resetView() {
  viewer.camera.lookAt(
    Cesium.Cartesian3.fromDegrees(
      153.05,
      -27.25,
      5000
    ),

    new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(345),
      Cesium.Math.toRadians(-28),
      175000
    )
  );

  viewer.camera.lookAtTransform(
    Cesium.Matrix4.IDENTITY
  );

  takeCameraSnapshot();
  scene.requestRender();
}

function applyNavigationLock() {
  controller.enableInputs =
    !navigationLocked;

  $("lockButton").textContent =
    navigationLocked
      ? "Unlock 3-D view"
      : "Lock 3-D view";

  $("inputShield").style.display =
    navigationLocked
      ? "block"
      : "none";

  if (navigationLocked) {
    takeCameraSnapshot();
  }
}

viewer.camera.percentageChanged =
  0.000001;

viewer.camera.changed.addEventListener(
  restoreLockedCamera
);

scene.preRender.addEventListener(
  restoreLockedCamera
);

function displayRgb(category) {
  return (
    SOURCE_PALETTES
      .reflectivityRgb
      .find(
        item =>
          item.value === category
      )
      ?.rgb
    ?? null
  );
}

async function renderSurface(frame) {
  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    frame.width;

  canvas.height =
    frame.height;

  const context =
    canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Unable to create surface reflectivity canvas."
    );
  }

  const image =
    context.createImageData(
      frame.width,
      frame.height
    );

  for (
    let p = 0, i = 0;
    p < frame.categories.length;
    p++, i += 4
  ) {
    const category =
      frame.categories[p];

    if (!category) {
      image.data[i + 3] = 0;
      continue;
    }

    const rgb =
      displayRgb(category);

    if (!rgb) {
      image.data[i + 3] = 0;
      continue;
    }

    image.data[i] =
      rgb[0];

    image.data[i + 1] =
      rgb[1];

    image.data[i + 2] =
      rgb[2];

    image.data[i + 3] =
      175;
  }

  context.putImageData(
    image,
    0,
    0
  );

  const southWest =
    webMercatorToDegrees(
      frame.georef.minX,
      frame.georef.minY
    );

  const northEast =
    webMercatorToDegrees(
      frame.georef.maxX,
      frame.georef.maxY
    );

  const rectangle =
    Cesium.Rectangle.fromDegrees(
      southWest.longitude,
      southWest.latitude,
      northEast.longitude,
      northEast.latitude
    );

  const provider =
    await Cesium
      .SingleTileImageryProvider
      .fromUrl(
        canvas.toDataURL(
          "image/png"
        ),
        { rectangle }
      );

  if (surfaceLayer) {
    viewer.imageryLayers.remove(
      surfaceLayer,
      true
    );
  }

  surfaceLayer =
    new Cesium.ImageryLayer(
      provider
    );

  surfaceLayer.alpha =
    0.65;

  viewer.imageryLayers.add(
    surfaceLayer
  );
}

function estimateCandidateColumns(frame) {
  let count = 0;

  for (
    let i = 0;
    i < frame.categories.length;
    i++
  ) {
    if (
      representativeDbzForCategory(
        frame.categories[i]
      ) != null
    ) {
      count++;
    }
  }

  return count;
}

function renderInferredVolume(frame) {
  if (!model) {
    throw new Error(
      "Inferred vertical-profile model is not loaded."
    );
  }

  if (inferredCollection) {
    scene.primitives.remove(
      inferredCollection
    );
  }

  inferredCollection =
    scene.primitives.add(
      new Cesium.PointPrimitiveCollection()
    );

  const occupancyThreshold =
    Number(
      $("occupancyThreshold").value
    );

  const minimumDbzh =
    Number(
      $("minimumDbzh").value
    );

  const pointSize =
    Number(
      $("pointSize").value
    );

  const candidateColumns =
    estimateCandidateColumns(
      frame
    );

  // Display decimation only. The vertical-profile inference remains
  // unchanged. This prevents a large active-weather frame from trying
  // to create millions of Cesium point primitives.
  const horizontalStride =
    candidateColumns > 40000
      ? 4
      : candidateColumns > 15000
        ? 3
        : candidateColumns > 6000
          ? 2
          : 1;

  let renderedPoints = 0;
  let renderedColumns = 0;

  let top40 = null;
  let top50 = null;

  let maxDbzh = null;
  let confidenceSum = 0;

  let highSupportPoints = 0;
  let mediumSupportPoints = 0;
  let lowSupportPoints = 0;

  let highSupportTop40 = null;
  let highSupportTop50 = null;

  for (
    let row = 0;
    row < frame.height;
    row += horizontalStride
  ) {
    for (
      let column = 0;
      column < frame.width;
      column += horizontalStride
    ) {
      const pixelIndex =
        row * frame.width
        + column;

      const category =
        frame.categories[
          pixelIndex
        ];

      const inputDbzh =
        representativeDbzForCategory(
          category
        );

      if (inputDbzh == null) {
        continue;
      }

      const inferred =
        inferColumn(
          model,
          inputDbzh,
          {
            occupancyThreshold,
            minimumOutputDbz:
              minimumDbzh
          }
        );

      if (!inferred.length) {
        continue;
      }

      const mercator =
        pixelCentreMercator(
          frame,
          column,
          row
        );

      const geographic =
        webMercatorToDegrees(
          mercator.x,
          mercator.y
        );

      renderedColumns++;

      for (const point of inferred) {
        const supportStyle =
          styleForInferredPoint(
            point,
            {
              displayThresholdDbz:
                minimumDbzh,

              basePointSize:
                pointSize
            }
          );

        const colour =
          colourForDbzh(
            point.dbzh
          ).withAlpha(
            supportStyle.alpha
          );

        inferredCollection.add({
          position:
            Cesium.Cartesian3
              .fromDegrees(
                geographic.longitude,
                geographic.latitude,
                displayAltitude(
                  point.altitude_m_amsl
                )
              ),

          color:
            colour,

          pixelSize:
            supportStyle.pixelSize,

          disableDepthTestDistance:
            0
        });

        renderedPoints++;
        confidenceSum +=
          point.confidence;

        if (
          supportStyle.band
          === "high"
        ) {
          highSupportPoints++;
        } else if (
          supportStyle.band
          === "medium"
        ) {
          mediumSupportPoints++;
        } else {
          lowSupportPoints++;
        }

        if (
          supportStyle.band
          === "high"
          && point.dbzh >= 40
          && (
            highSupportTop40 == null
            || point.altitude_m_amsl
              > highSupportTop40
          )
        ) {
          highSupportTop40 =
            point.altitude_m_amsl;
        }

        if (
          supportStyle.band
          === "high"
          && point.dbzh >= 50
          && (
            highSupportTop50 == null
            || point.altitude_m_amsl
              > highSupportTop50
          )
        ) {
          highSupportTop50 =
            point.altitude_m_amsl;
        }

        maxDbzh =
          maxDbzh == null
            ? point.dbzh
            : Math.max(
                maxDbzh,
                point.dbzh
              );

        if (
          point.dbzh >= 40
          && (
            top40 == null
            || point.altitude_m_amsl
              > top40
          )
        ) {
          top40 =
            point.altitude_m_amsl;
        }

        if (
          point.dbzh >= 50
          && (
            top50 == null
            || point.altitude_m_amsl
              > top50
          )
        ) {
          top50 =
            point.altitude_m_amsl;
        }
      }
    }
  }

  $("renderedColumns").textContent =
    renderedColumns.toLocaleString();

  $("renderedPoints").textContent =
    renderedPoints.toLocaleString();

  $("adaptiveStride").textContent =
    `${horizontalStride} px`;

  $("maxInferredDbzh").textContent =
    maxDbzh == null
      ? "none"
      : `${maxDbzh.toFixed(1)} dBZ`;

  $("inferredTop40").textContent =
    top40 == null
      ? "none"
      : `${(top40 / 1000).toFixed(1)} km`;

  $("inferredTop50").textContent =
    top50 == null
      ? "none"
      : `${(top50 / 1000).toFixed(1)} km`;

  $("meanConfidence").textContent =
    renderedPoints
      ? (
          confidenceSum
          / renderedPoints
        ).toFixed(2)
      : "—";

  $("highSupportPoints").textContent =
    highSupportPoints
      .toLocaleString();

  $("mediumSupportPoints").textContent =
    mediumSupportPoints
      .toLocaleString();

  $("lowSupportPoints").textContent =
    lowSupportPoints
      .toLocaleString();

  $("highSupportTop40").textContent =
    highSupportTop40 == null
      ? "none"
      : `${(
          highSupportTop40
          / 1000
        ).toFixed(1)} km`;

  $("highSupportTop50").textContent =
    highSupportTop50 == null
      ? "none"
      : `${(
          highSupportTop50
          / 1000
        ).toFixed(1)} km`;

  scene.requestRender();
}


function trackColour(trackId) {
  const number =
    Number(
      String(trackId).replace(/\D/g, "")
    ) || 1;

  return Cesium.Color.fromHsl(
    (number * 0.61803398875) % 1,
    0.78,
    0.58,
    1
  );
}

function clearHybridTrackVolumeCollection() {
  if (
    hybridTrackVolumeCollection
  ) {
    scene.primitives.remove(
      hybridTrackVolumeCollection
    );

    hybridTrackVolumeCollection =
      null;
  }
}

function renderHybridTracks(index) {
  hybridSource.entities.suspendEvents();

  clearHybridTrackVolumeCollection();

  const showTrackVolumes =
    Boolean(
      $("showTrackVolumes")
        ?.checked
    );

  if (showTrackVolumes) {
    hybridTrackVolumeCollection =
      scene.primitives.add(
        new Cesium.PointPrimitiveCollection()
      );
  }

  try {
    hybridSource.entities.removeAll();

    const result =
      hybridResults[index];

    const volumeMap =
      hybridTrackVolumes[index];

    if (!result) {
      return;
    }

    const active =
      new Set(
        result.active_track_ids ?? []
      );

    const rows = [];

    for (const track of result.tracks ?? []) {
      const observation =
        track.history?.find(
          item =>
            item.observed_utc
            === hybridFrames[index].observedUtc
        );

      if (!observation) {
        continue;
      }

      const volumeRecord =
        volumeMap?.get(
          track.track_id
        )
        ?? null;

      const volume =
        volumeRecord?.volume
        ?? null;

      const trend =
        volumeRecord?.trend
        ?? null;

      const colour =
        trackColour(
          track.track_id
        );

      const altitude =
        volume
          ?.high_support_top_40_m_amsl
        ?? volume
          ?.inferred_top_40_m_amsl
        ?? 1200;

      const position =
        Cesium.Cartesian3.fromDegrees(
          observation.centroid_longitude,
          observation.centroid_latitude,
          displayAltitude(altitude)
        );

      hybridSource.entities.add({
        id:
          `hybrid-${index}-${track.track_id}`,

        position,

        point: {
          pixelSize:
            active.has(track.track_id)
              ? 12
              : 8,

          color:
            colour,

          outlineColor:
            Cesium.Color.WHITE,

          outlineWidth:
            1
        },

        label: {
          text:
            `${track.track_id}  ≥${Number(observation.maximum_dbzh_lower_bound).toFixed(0)} dBZ`,

          font:
            "12px sans-serif",

          pixelOffset:
            new Cesium.Cartesian2(
              0,
              -18
            ),

          fillColor:
            Cesium.Color.WHITE,

          showBackground:
            true,

          backgroundColor:
            Cesium.Color.BLACK
              .withAlpha(0.62)
        }
      });

      if (
        showTrackVolumes
        && volume
        && hybridTrackVolumeCollection
      ) {
        for (
          const point
          of volume.points
        ) {
          hybridTrackVolumeCollection.add({
            position:
              Cesium.Cartesian3
                .fromDegrees(
                  point.longitude,
                  point.latitude,
                  displayAltitude(
                    point.altitude_m_amsl
                  )
                ),

            color:
              colourForDbzh(
                point.dbzh
              ).withAlpha(
                point.alpha
              ),

            pixelSize:
              point.pixel_size,

            disableDepthTestDistance:
              0
          });
        }
      }

      if (!hybridHistory.has(track.track_id)) {
        hybridHistory.set(
          track.track_id,
          []
        );
      }

      const history =
        hybridHistory.get(
          track.track_id
        );

      if (
        !history.some(
          item =>
            item.frameIndex
            === index
        )
      ) {
        history.push({
          frameIndex:
            index,

          longitude:
            observation.centroid_longitude,

          latitude:
            observation.centroid_latitude,

          altitude
        });
      }

      const trail =
        history
          .filter(
            item =>
              item.frameIndex
              <= index
          )
          .sort(
            (a, b) =>
              a.frameIndex
              - b.frameIndex
          );

      if (trail.length >= 2) {
        hybridSource.entities.add({
          id:
            `hybrid-trail-${track.track_id}`,

          polyline: {
            positions:
              trail.map(
                item =>
                  Cesium.Cartesian3.fromDegrees(
                    item.longitude,
                    item.latitude,
                    displayAltitude(
                      item.altitude
                    )
                  )
              ),

            width:
              active.has(track.track_id)
                ? 3
                : 1.5,

            material:
              colour.withAlpha(
                active.has(track.track_id)
                  ? 0.9
                  : 0.35
              ),

            clampToGround:
              false
          }
        });
      }

      const top40Text =
        volume
          ?.high_support_top_40_m_amsl
        != null
          ? `${(
              volume
                .high_support_top_40_m_amsl
              / 1000
            ).toFixed(1)} km`
          : "—";

      const trendText =
        trend
          ? `${
              trend.metres_per_10_min
              >= 0
                ? "+"
                : ""
            }${(
              trend.metres_per_10_min
              / 1000
            ).toFixed(1)} km/10m`
          : "—";

      const supportText =
        volume
          ? `${volume.high_support_points}/${volume.inferred_point_count}`
          : "—";

      rows.push(
        `<div class="track-volume-row">
          <div>
            <strong>${track.track_id}</strong>
            <span>${track.observation_count} obs</span>
            <span>${
              track.motion
                ? `${track.motion.speed_kmh.toFixed(0)} km/h`
                : "motion —"
            }</span>
          </div>
          <div>
            <span>high-support 40 dBZ top ${top40Text}</span>
            <span>vertical trend ${trendText}</span>
            <span>support ${supportText}</span>
          </div>
        </div>`
      );
    }

    $("hybridTrackCount").textContent =
      String(rows.length);

    $("hybridPersistentCount").textContent =
      String(
        (result.tracks ?? [])
          .filter(
            track =>
              track.observation_count >= 3
          )
          .length
      );

    $("hybridRows").innerHTML =
      rows.length
        ? rows.join("")
        : '<div class="hybrid-muted">No measured ≥40 dBZ 2-D storm tracks in this frame.</div>';

  } finally {
    hybridSource.entities.resumeEvents();
  }

  scene.requestRender();
}
function updateHybridSourceMetrics(frame) {
  $("sourceTime").textContent =
    frame.observedUtc
      .replace("T", " ")
      .replace("Z", " UTC");

  $("decodedPixels").textContent =
    (
      frame.sourceMetadata
        ?.colouredPixelCount
      ?? 0
    ).toLocaleString();

  const category =
    frame.sourceMetadata
      ?.maxCategory
    ?? 0;

  const lower =
    frame.sourceMetadata
      ?.maxDbzLowerBound;

  $("sourceMaximum").textContent =
    category
      ? (
          lower == null
            ? `category ${category}`
            : `category ${category} (>=${lower} dBZ)`
        )
      : "none";
}

async function showHybridFrame(index) {
  hybridFrameIndex =
    Math.max(
      0,
      Math.min(
        hybridFrames.length - 1,
        Number(index)
      )
    );

  const frame =
    hybridFrames[
      hybridFrameIndex
    ];

  latestFrame =
    frame;

  $("hybridFrameSlider").value =
    String(
      hybridFrameIndex
    );

  $("hybridFrameLabel").textContent =
    `${hybridFrameIndex + 1}/${hybridFrames.length}`;

  await renderSurface(frame);

  renderInferredVolume(frame);

  if (
    inferredCollection
    && hybridResults.length
  ) {
    inferredCollection.show =
      !Boolean(
        $("showTrackVolumes")
          ?.checked
      );
  }

  renderHybridTracks(hybridFrameIndex);
  updateHybridSourceMetrics(frame);

  setStatus(
    `HYBRID frame ${hybridFrameIndex + 1}/${hybridFrames.length}: ` +
    `${frame.observedUtc}; ST identities and horizontal motion are measured-2D-derived; ` +
    `vertical intensity is multi-event inferred.`,
    "ok"
  );
}

function hybridDelay(ms) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}

async function playHybridOnce() {
  if (
    hybridPlaying
    || !hybridFrames.length
  ) {
    return;
  }

  hybridPlaying = true;
  $("hybridPlayButton").disabled = true;

  try {
    for (
      let index = 0;
      index < hybridFrames.length;
      index++
    ) {
      await showHybridFrame(index);
      await hybridDelay(650);
    }
  } finally {
    hybridPlaying = false;
    $("hybridPlayButton").disabled = false;
  }
}

async function loadHybridSequence() {
  setStatus(
    "Loading six BOM frames for measured-2D tracking + inferred-3D volume…"
  );

  await hybridWorker.reset();

  hybridFrames =
    await loadRecentBomReflectivityMosaics(
      Date.now(),
      6,
      progress => {
        if (
          progress.stage
          === "loading"
        ) {
          setStatus(
            `Loading BOM frame ${progress.index + 1}/${progress.total}: ${progress.observedUtc}`
          );
        }
      }
    );

  hybridResults = [];
  hybridHistory = new Map();
  hybridTrackVolumes = [];

  for (
    let index = 0;
    index < hybridFrames.length;
    index++
  ) {
    const frame =
      hybridFrames[index];

    const result =
      await hybridWorker.processFrameBucket({
        frames: [frame],
        referenceTime:
          frame.observedUtc,

        includeSegmentationLabels:
          true
      });

    hybridResults.push(
      result
    );
  }

  const previousByTrack =
    new Map();

  for (
    let frameIndex = 0;
    frameIndex < hybridFrames.length;
    frameIndex++
  ) {
    const frame =
      hybridFrames[
        frameIndex
      ];

    const result =
      hybridResults[
        frameIndex
      ];

    const segmentation =
      result
        ?.segmentations
        ?.[0];

    const volumeMap =
      new Map();

    for (
      const track
      of result?.tracks ?? []
    ) {
      const observation =
        track.history?.find(
          item =>
            item.observed_utc
            === frame.observedUtc
        );

      if (!observation) {
        continue;
      }

      const volume =
        buildMeasuredTrackVolume(
          frame,
          segmentation,
          observation,
          model,
          {
            occupancyThreshold:
              Number(
                $("occupancyThreshold").value
              ),

            minimumOutputDbz:
              20,

            displayThresholdDbz:
              Number(
                $("minimumDbzh").value
              ),

            basePointSize:
              Number(
                $("pointSize").value
              )
          }
        );

      if (!volume) {
        continue;
      }

      const previous =
        previousByTrack.get(
          track.track_id
        );

      const trend =
        previous
          ? highSupportTop40Trend(
              previous.volume,
              previous.observedUtc,
              volume,
              frame.observedUtc
            )
          : null;

      const record = {
        volume,
        trend,
        observedUtc:
          frame.observedUtc
      };

      volumeMap.set(
        track.track_id,
        record
      );

      previousByTrack.set(
        track.track_id,
        record
      );
    }

    hybridTrackVolumes.push(
      volumeMap
    );
  }

  $("hybridFrameSlider").max =
    String(
      hybridFrames.length - 1
    );

  $("hybridFrameSlider").disabled =
    false;

  $("hybridPlayButton").disabled =
    false;

  await playHybridOnce();

  const finalResult =
    hybridResults.at(-1);

  setStatus(
    `HYBRID CORE COMPLETE: ${hybridFrames.length} frames; ` +
    `${finalResult?.active_track_ids?.length ?? 0} active measured-2D ST tracks; ` +
    `${(finalResult?.tracks ?? []).length} total ST identities. ` +
    `Vertical intensity uses the five-event model; inferred geometry does not create track identity.`,
    "ok"
  );
}

async function loadLatest() {
  setStatus(
    "Loading latest BOM reflectivity and building inferred vertical volume…"
  );

  const frame =
    await loadLatestBomReflectivityMosaic();

  latestFrame = frame;

  await renderSurface(
    frame
  );

  renderInferredVolume(
    frame
  );

  $("sourceTime").textContent =
    frame.observedUtc
      .replace("T", " ")
      .replace("Z", " UTC");

  $("decodedPixels").textContent =
    (
      frame.sourceMetadata
        ?.colouredPixelCount
      ?? 0
    ).toLocaleString();

  const maximumCategory =
    frame.sourceMetadata
      ?.maxCategory
    ?? 0;

  const maxLower =
    frame.sourceMetadata
      ?.maxDbzLowerBound;

  $("sourceMaximum").textContent =
    maximumCategory
      ? (
          maxLower == null
            ? `category ${maximumCategory}`
            : `category ${maximumCategory} (>=${maxLower} dBZ)`
        )
      : "none";

  setStatus(
    `INFERRED LIVE 3-D built from public BOM 2-D reflectivity at ${frame.observedUtc}. ` +
    `Vertical structure is empirical and uncertainty-qualified; it is not measured volumetric radar.`,
    "ok"
  );
}

async function initialise() {
  const [
    modelResponse,
    validationResponse
  ] = await Promise.all([
    fetch(
      MODEL_URL,
      { cache: "no-store" }
    ),
    fetch(
      VALIDATION_URL,
      { cache: "no-store" }
    )
  ]);

  if (!modelResponse.ok) {
    throw new Error(
      `Inferred model request failed: ${modelResponse.status}`
    );
  }

  if (!validationResponse.ok) {
    throw new Error(
      `Validation report request failed: ${validationResponse.status}`
    );
  }

  model =
    await modelResponse.json();

  validation =
    await validationResponse.json();

  if (
    model.format
    !== "StormTrackerEmpiricalVerticalReflectivityModelV2"
  ) {
    throw new Error(
      "Unexpected multi-event inferred model format."
    );
  }

  const aggregate =
    validation.overall;

  $("validationMae").textContent =
    `${aggregate.mean_event_intensity_mae_dbz.toFixed(2)} dBZ`;

  $("validationIou40").textContent =
    aggregate.thresholds["40"]
      .mean_iou
      .toFixed(3);

  $("validationTop40").textContent =
    `${(
      aggregate.thresholds["40"]
        .median_event_echo_top_absolute_error_m
      / 1000
    ).toFixed(2)} km`;

  $("occupancyThreshold").value =
    String(
      DEFAULT_OCCUPANCY_THRESHOLD
    );

  $("occupancyValue").textContent =
    DEFAULT_OCCUPANCY_THRESHOLD
      .toFixed(2);

  resetView();

  navigationLocked = true;
  applyNavigationLock();

  setStatus(
    "Prototype model loaded. Press “Load latest inferred 3-D”."
  );
}


$("loadHybridButton").addEventListener(
  "click",
  () =>
    loadHybridSequence()
      .catch(
        error => {
          console.error(error);

          setStatus(
            error.message,
            "error"
          );
        }
      )
);

$("hybridFrameSlider").addEventListener(
  "input",
  event =>
    showHybridFrame(
      Number(
        event.target.value
      )
    ).catch(
      error =>
        setStatus(
          error.message,
          "error"
        )
    )
);

$("hybridPlayButton").addEventListener(
  "click",
  () =>
    playHybridOnce()
      .catch(
        error =>
          setStatus(
            error.message,
            "error"
          )
      )
);

$("showTrackVolumes").addEventListener(
  "change",
  () => {
    if (
      inferredCollection
      && hybridResults.length
    ) {
      inferredCollection.show =
        !Boolean(
          $("showTrackVolumes")
            .checked
        );
    }

    renderHybridTracks(
      hybridFrameIndex
    );
  }
);

$("loadButton").addEventListener(
  "click",
  () =>
    loadLatest().catch(
      error => {
        console.error(error);

        setStatus(
          error.message,
          "error"
        );
      }
    )
);

$("minimumDbzh").addEventListener(
  "input",
  event => {
    $("minimumDbzhValue")
      .textContent =
        event.target.value;

    if (latestFrame) {
      renderInferredVolume(
        latestFrame
      );
    }
  }
);

$("occupancyThreshold").addEventListener(
  "input",
  event => {
    $("occupancyValue")
      .textContent =
        Number(
          event.target.value
        ).toFixed(2);

    if (latestFrame) {
      renderInferredVolume(
        latestFrame
      );
    }
  }
);

$("verticalScale").addEventListener(
  "input",
  event => {
    $("verticalScaleValue")
      .textContent =
        Number(
          event.target.value
        ).toFixed(1);

    if (latestFrame) {
      renderInferredVolume(
        latestFrame
      );
    }
  }
);

$("pointSize").addEventListener(
  "input",
  event => {
    $("pointSizeValue")
      .textContent =
        event.target.value;

    if (latestFrame) {
      renderInferredVolume(
        latestFrame
      );
    }
  }
);

$("lockButton").addEventListener(
  "click",
  () => {
    navigationLocked =
      !navigationLocked;

    applyNavigationLock();
  }
);

$("resetButton").addEventListener(
  "click",
  () => {
    resetView();

    navigationLocked = true;

    applyNavigationLock();
  }
);

initialise().catch(
  error => {
    console.error(error);

    setStatus(
      error.message,
      "error"
    );
  }
);
