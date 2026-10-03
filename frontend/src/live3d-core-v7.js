import {
  loadLatestBomReflectivityMosaic,
  loadRecentBomReflectivityMosaics
} from "./bom-wmts-loop-v1.js?v=hybrid-v1";

import {
  RadarWorkerClient
} from "./worker-client.js?v=core-v6";

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

import {
  reprojectWebMercatorRgbaToGeographic
} from "./webmercator-raster-reproject-v1.js?v=mercator-fix-v1";

import {
  createStormTrackerCameraController
} from "./stormtracker-camera-v1.js?v=camera-v1.1-wheel";

import {
  loadDopplerDiagnostic
} from "./bom-doppler-intake-v2.js?v=product-time-v1";

import {
  decodeGeoreferencedDoppler,
  geolocatedDopplerSamples
} from "./bom-doppler-spatial-v1.js?v=track-context-v1";

import {
  buildTrackDopplerContexts
} from "./track-doppler-context-v1.js?v=track-context-v1";

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

scene.fog.enabled = false;
scene.globe.enableLighting = false;
scene.globe.maximumScreenSpaceError = 4;

const CORE_HOME =
  Object.freeze({
    longitude:
      153.05,

    latitude:
      -27.25,

    targetHeight:
      5000,

    range:
      175000,

    heading:
      Cesium.Math.toRadians(
        345
      ),

    pitch:
      Cesium.Math.toRadians(
        -28
      )
  });

const mapCamera =
  createStormTrackerCameraController({
    viewer,

    container:
      document.getElementById(
        "cesiumContainer"
      ),

    home:
      CORE_HOME,

    onUnexpectedCorrection:
      count => {
        const output =
          document.getElementById(
            "cameraCorrections"
          );

        if (output) {
          output.textContent =
            String(
              count
            );
        }
      }
  });

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

let hybridDopplerContext =
  null;

let hybridDopplerLoadedForFrame =
  null;

let latestDopplerRecords =
  [];

let dopplerOverlayCollection =
  null;

// Prevent an older asynchronous radar-image load from replacing a newer
// frame after rapid scrubbing/playback.
let hybridSceneRenderToken = 0;

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

function resetView() {
  mapCamera.reset();
}

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

async function renderSurface(
  frame,
  renderToken = null
) {
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

  const geographicRgba =
    reprojectWebMercatorRgbaToGeographic(
      frame,
      image.data
    );

  const geographicImage =
    context.createImageData(
      frame.width,
      frame.height
    );

  geographicImage.data.set(
    geographicRgba
  );

  context.putImageData(
    geographicImage,
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

  if (
    renderToken != null
    && renderToken !== hybridSceneRenderToken
  ) {
    return false;
  }

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

  scene.requestRender();

  return true;
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

function hasTrackSpecificVolume(
  index
) {
  return (
    hybridTrackVolumes[index]
      ?.size
    ?? 0
  ) > 0;
}

function useTrackSpecificVolume(
  index
) {
  return (
    Boolean(
      $("showTrackVolumes")
        ?.checked
    )
    && hasTrackSpecificVolume(
      index
    )
  );
}

function applyHybridVolumeMode(
  index
) {
  const useTrackSpecific =
    useTrackSpecificVolume(
      index
    );

  if (inferredCollection) {
    inferredCollection.show =
      !useTrackSpecific;
  }

  const mode =
    $("hybridVolumeMode");

  if (mode) {
    mode.textContent =
      useTrackSpecific
        ? "Measured-track-specific"
        : (
            Boolean(
              $("showTrackVolumes")
                ?.checked
            )
              ? "Frame-wide fallback (no measured track)"
              : "Frame-wide inferred"
          );
  }

  scene.requestRender();

  return useTrackSpecific;
}

function trackPointSize(
  supportBand
) {
  const base =
    Number(
      $("pointSize").value
    );

  const scale =
    supportBand === "high"
      ? 1.0
      : supportBand === "medium"
        ? 0.82
        : 0.62;

  return Math.max(
    1.5,
    base * scale
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

function canvasImageData(
  canvas
) {
  return canvas
    .getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    )
    .getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );
}

async function loadOneDopplerRecord(
  radarId
) {
  const source =
    await loadDopplerDiagnostic(
      radarId
    );

  const decoded =
    decodeGeoreferencedDoppler(
      radarId,
      canvasImageData(
        source.canvas
      )
    );

  const samples =
    geolocatedDopplerSamples(
      decoded,
      {
        stride:
          1,

        includeZero:
          false
      }
    );

  return {
    radarId:
      String(
        radarId
      ),

    product:
      source.product,

    observedUtc:
      source.observedUtc
      ?? null,

    timeBasis:
      source.timeSource
      ?? "timestamp-unavailable",

    samples
  };
}

function dopplerDisplayColour(
  velocity
) {
  const value =
    Number(
      velocity
    );

  if (
    value < 0
  ) {
    const strength =
      Math.min(
        1,
        Math.abs(
          value
        ) / 70
      );

    return Cesium.Color
      .fromHsl(
        0.56,
        0.95,
        0.72
          - strength
            * 0.32,
        0.78
      );
  }

  const strength =
    Math.min(
      1,
      value / 70
    );

  return Cesium.Color
    .fromHsl(
      0.13
        - strength
          * 0.12,
      0.95,
      0.62
        - strength
          * 0.18,
      0.78
    );
}

function clearDopplerOverlay() {
  if (
    dopplerOverlayCollection
  ) {
    scene.primitives.remove(
      dopplerOverlayCollection
    );

    dopplerOverlayCollection =
      null;
  }

  const count =
    $("dopplerOverlayCount");

  if (count) {
    count.textContent =
      "0";
  }
}

function selectedDopplerRecord() {
  const radarId =
    $("dopplerOverlayRadar")
      ?.value
    ?? "66";

  return (
    latestDopplerRecords
      .find(
        record =>
          record.radarId
          === radarId
      )
    ?? null
  );
}

function renderDopplerOverlay() {
  clearDopplerOverlay();

  const status =
    $("dopplerOverlayStatus");

  if (
    !$("showDopplerOverlay")
      ?.checked
  ) {
    if (status) {
      status.textContent =
        "hidden";
    }

    return;
  }

  if (
    !hybridFrames.length
    || hybridFrameIndex
      !== hybridFrames.length - 1
  ) {
    if (status) {
      status.textContent =
        "latest sequence frame only";
    }

    return;
  }

  const record =
    selectedDopplerRecord();

  if (!record) {
    if (status) {
      status.textContent =
        "selected radar unavailable";
    }

    return;
  }

  dopplerOverlayCollection =
    scene.primitives.add(
      new Cesium
        .PointPrimitiveCollection()
    );

  let rendered =
    0;

  for (
    const sample
    of record.samples
  ) {
    dopplerOverlayCollection.add({
      position:
        Cesium.Cartesian3
          .fromDegrees(
            sample.longitude,
            sample.latitude,
            180
          ),

      color:
        dopplerDisplayColour(
          sample.velocity_kmh
        ),

      pixelSize:
        3,

      disableDepthTestDistance:
        Number.POSITIVE_INFINITY
    });

    rendered++;
  }

  $("dopplerOverlayCount")
    .textContent =
      rendered
        .toLocaleString();

  if (status) {
    status.textContent =
      `${record.radarId} non-zero exact-palette radial velocity`;
  }

  scene.requestRender();
}

function formatDopplerUtc(
  value
) {
  if (!value) {
    return "timestamp unavailable";
  }

  return value
    .replace(
      "T",
      " "
    )
    .replace(
      ":00.000Z",
      " UTC"
    )
    .replace(
      ".000Z",
      " UTC"
    );
}

function renderDopplerSourceRows() {
  const output =
    $("dopplerSourceRows");

  if (
    !output
  ) {
    return;
  }

  const rows =
    hybridDopplerContext
      ?.sourceStatus
      ?? [];

  if (
    !rows.length
  ) {
    output.innerHTML =
      '<div class="hybrid-muted">No Doppler source metadata available.</div>';

    return;
  }

  output.innerHTML =
    rows
      .map(
        source => {
          const delta =
            source
              .time_delta_minutes;

          const deltaText =
            delta == null
              ? "delta —"
              : `Δ${delta.toFixed(1)} min`;

          const match =
            source.time_matched
              ? "MATCH"
              : "NO MATCH";

          return (
            `<div class="track-volume-row">` +
              `<div>` +
                `<strong>Radar ${source.radar_id}</strong>` +
                `<span>${formatDopplerUtc(source.source_time_utc)}</span>` +
                `<span>${deltaText}</span>` +
                `<span>${match}</span>` +
              `</div>` +
              `<div>` +
                `<span>${source.time_basis}</span>` +
                `<span>${Number(source.sample_count).toLocaleString()} decoded non-zero samples</span>` +
              `</div>` +
            `</div>`
          );
        }
      )
      .join("");
}


async function loadLatestTrackDopplerContext() {
  const frameIndex =
    hybridFrames.length
    - 1;

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

  if (
    !frame
    || !segmentation
  ) {
    hybridDopplerContext =
      null;

    return;
  }

  const settled =
    await Promise.allSettled(
      [
        "66",
        "50",
        "08"
      ].map(
        radarId =>
          loadOneDopplerRecord(
            radarId
          )
      )
    );

  const records =
    settled
      .filter(
        item =>
          item.status
          === "fulfilled"
      )
      .map(
        item =>
          item.value
      );

  latestDopplerRecords =
    records;

  hybridDopplerContext =
    buildTrackDopplerContexts({
      frame,

      segmentation,

      tracks:
        result?.tracks
        ?? [],

      dopplerRecords:
        records,

      maxTimeDeltaMinutes:
        8,

      minimumSamples:
        3
    });

  hybridDopplerLoadedForFrame =
    frame.observedUtc;

  const loaded =
    records.length;

  const matched =
    hybridDopplerContext
      .sourceStatus
      .filter(
        source =>
          source.time_matched
      )
      .length;

  const failed =
    settled.length
    - loaded;

  const tracksWithDoppler =
    hybridDopplerContext
      .tracks_with_doppler;

  $("dopplerRadarsLoaded")
    .textContent =
      String(
        loaded
      );

  $("dopplerRadarsMatched")
    .textContent =
      String(
        matched
      );

  $("dopplerTracksMatched")
    .textContent =
      String(
        tracksWithDoppler
      );

  $("dopplerFrameTime")
    .textContent =
      frame.observedUtc
        .replace(
          "T",
          " "
        )
        .replace(
          "Z",
          " UTC"
        );

  $("dopplerFailures")
    .textContent =
      String(
        failed
      );

  renderDopplerSourceRows();

  renderDopplerOverlay();
}

function dopplerContextForTrack(
  index,
  trackId
) {
  if (
    index
    !== hybridFrames.length - 1
    || !hybridDopplerContext
    || hybridDopplerLoadedForFrame
      !== hybridFrames[index]
        ?.observedUtc
  ) {
    return null;
  }

  return (
    hybridDopplerContext
      .contextByTrack
      .get(
        trackId
      )
    ?? null
  );
}

function formatSignedKmh(
  value
) {
  if (
    value == null
  ) {
    return "—";
  }

  return `${
    value > 0
      ? "+"
      : ""
  }${Number(value).toFixed(0)} km/h`;
}

function renderHybridTracks(index) {
  hybridSource.entities.suspendEvents();

  clearHybridTrackVolumeCollection();

  const showTrackVolumes =
    useTrackSpecificVolume(
      index
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
              trackPointSize(
                point.support_band
              ),

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

      const dopplerContext =
        dopplerContextForTrack(
          index,
          track.track_id
        );

      const primaryDoppler =
        dopplerContext
          ?.primary
        ?? null;

      const dopplerSummary =
        primaryDoppler
          ? (
              `Doppler ${primaryDoppler.radar_id}: ` +
              `${formatSignedKmh(primaryDoppler.strongest_toward_kmh)} toward / ` +
              `${formatSignedKmh(primaryDoppler.strongest_away_kmh)} away; ` +
              `span ${
                primaryDoppler.radial_span_kmh == null
                  ? "—"
                  : `${primaryDoppler.radial_span_kmh.toFixed(0)} km/h`
              }; ${primaryDoppler.sample_count} footprint samples`
            )
          : (
              index === hybridFrames.length - 1
                ? "Doppler — no time-matched non-zero samples in this measured footprint"
                : "Doppler — latest frame only"
            );

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
            <span>${dopplerSummary}</span>
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
  const renderToken =
    ++hybridSceneRenderToken;

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

  const surfaceApplied =
    await renderSurface(
      frame,
      renderToken
    );

  if (!surfaceApplied) {
    return;
  }

  renderInferredVolume(
    frame
  );

  applyHybridVolumeMode(
    hybridFrameIndex
  );

  renderHybridTracks(
    hybridFrameIndex
  );

  renderDopplerOverlay();

  updateHybridSourceMetrics(
    frame
  );

  const sceneFrame =
    $("hybridSceneFrame");

  if (sceneFrame) {
    sceneFrame.textContent =
      frame.observedUtc
        .replace("T", " ")
        .replace("Z", " UTC");
  }

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

  hybridDopplerContext =
    null;

  hybridDopplerLoadedForFrame =
    null;

  latestDopplerRecords =
    [];

  clearDopplerOverlay();

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

  setStatus(
    "Tracking complete. Loading current public Doppler from 66 / 50 / 08 and matching it to the latest measured storm footprints…"
  );

  try {
    await loadLatestTrackDopplerContext();
  } catch (error) {
    console.warn(
      "Doppler track context unavailable",
      error
    );

    hybridDopplerContext =
      null;

    hybridDopplerLoadedForFrame =
      null;

    $("dopplerRadarsLoaded").textContent =
      "0";

    $("dopplerRadarsMatched").textContent =
      "0";

    $("dopplerTracksMatched").textContent =
      "0";

    $("dopplerFailures").textContent =
      "3";
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
    `Vertical intensity uses the five-event model; inferred geometry does not create track identity. ` +
    `Latest-frame Doppler is footprint-matched radial-velocity context only and does not create or move ST tracks.`,
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

  const renderToken =
    ++hybridSceneRenderToken;

  const surfaceApplied =
    await renderSurface(
      frame,
      renderToken
    );

  if (!surfaceApplied) {
    return;
  }

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
    applyHybridVolumeMode(
      hybridFrameIndex
    );

    renderHybridTracks(
      hybridFrameIndex
    );
  }
);

$("showDopplerOverlay").addEventListener(
  "change",
  () => {
    renderDopplerOverlay();
  }
);

$("dopplerOverlayRadar").addEventListener(
  "change",
  () => {
    renderDopplerOverlay();
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

      if (hybridResults.length) {
        applyHybridVolumeMode(
          hybridFrameIndex
        );

        renderHybridTracks(
          hybridFrameIndex
        );
      }
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

      if (hybridResults.length) {
        applyHybridVolumeMode(
          hybridFrameIndex
        );

        renderHybridTracks(
          hybridFrameIndex
        );
      }
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

      if (hybridResults.length) {
        applyHybridVolumeMode(
          hybridFrameIndex
        );

        renderHybridTracks(
          hybridFrameIndex
        );
      }
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

      if (hybridResults.length) {
        applyHybridVolumeMode(
          hybridFrameIndex
        );

        renderHybridTracks(
          hybridFrameIndex
        );
      }
    }
  }
);

$("resetButton").addEventListener(
  "click",
  () => {
    resetView();
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
