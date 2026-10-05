#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

MODEL_SOURCE="data/aura/derived/66/2014-11-27/inferred_vertical_profile_model_v1.json"
VALIDATION_SOURCE="data/aura/derived/66/2014-11-27/inferred_volume_validation_v1.json"

echo "StormTracker — live inferred 3-D prototype v1"
echo

for f in \
  "$MODEL_SOURCE" \
  "$VALIDATION_SOURCE" \
  frontend/src/bom-wmts-diagnostics-v1.js \
  frontend/src/palette.js
do
  if [ ! -f "$f" ]; then
    echo "ERROR: Missing required file:"
    echo "  $f"
    exit 1
  fi
done

mkdir -p frontend/3d-models frontend/tests

cp "$MODEL_SOURCE" \
  frontend/3d-models/inferred_vertical_profile_model_v1.json

cp "$VALIDATION_SOURCE" \
  frontend/3d-models/inferred_volume_validation_v1.json

cat > frontend/src/inferred-volume-v1.js <<'JS'
import {
  REFLECTIVITY_CLASSES
} from "./palette.js?v=live3d-v1";

export const DEFAULT_OCCUPANCY_THRESHOLD = 0.35;
export const MINIMUM_INPUT_DBZ = 23.0;

export function representativeDbzForCategory(category) {
  const range = REFLECTIVITY_CLASSES[category];

  if (!range) {
    return null;
  }

  const [lower, upper] = range;

  // Category 1 spans 12–23 dBZ and therefore straddles the model's
  // 20 dBZ training floor. Do not infer a vertical column from it.
  if (category === 1) {
    return null;
  }

  if (upper == null) {
    return lower + 2.0;
  }

  return 0.5 * (lower + upper);
}

export function profileForDbz(model, dbz) {
  if (!model?.profiles || !Number.isFinite(dbz)) {
    return null;
  }

  return (
    model.profiles.find(profile =>
      dbz >= profile.low_level_dbz_min &&
      dbz < profile.low_level_dbz_max
    )
    ?? model.profiles.at(-1)
    ?? null
  );
}

export function inferColumn(
  model,
  inputDbz,
  {
    occupancyThreshold = DEFAULT_OCCUPANCY_THRESHOLD,
    minimumOutputDbz = 20.0
  } = {}
) {
  if (
    !Number.isFinite(inputDbz)
    || inputDbz < MINIMUM_INPUT_DBZ
  ) {
    return [];
  }

  const profile = profileForDbz(
    model,
    inputDbz
  );

  if (!profile) {
    return [];
  }

  const points = [];

  for (const level of profile.levels ?? []) {
    const occupancy =
      Number(level.occupancy_probability);

    const delta =
      Number(level.median_delta_dbz);

    if (
      !Number.isFinite(occupancy)
      || !Number.isFinite(delta)
      || occupancy < occupancyThreshold
    ) {
      continue;
    }

    const dbzh =
      inputDbz + delta;

    if (
      !Number.isFinite(dbzh)
      || dbzh < minimumOutputDbz
    ) {
      continue;
    }

    points.push({
      altitude_m_amsl:
        Number(level.altitude_m_amsl),

      dbzh,

      confidence:
        occupancy,

      p25_delta_dbz:
        level.p25_delta_dbz == null
          ? null
          : Number(level.p25_delta_dbz),

      p75_delta_dbz:
        level.p75_delta_dbz == null
          ? null
          : Number(level.p75_delta_dbz)
    });
  }

  return points;
}

export function webMercatorToDegrees(x, y) {
  const radius = 6378137;

  return {
    longitude:
      x / radius * 180 / Math.PI,

    latitude:
      (
        2 * Math.atan(
          Math.exp(y / radius)
        )
        - Math.PI / 2
      )
      * 180 / Math.PI
  };
}

export function pixelCentreMercator(
  frame,
  column,
  row
) {
  const dx =
    (
      frame.georef.maxX
      - frame.georef.minX
    )
    / frame.width;

  const dy =
    (
      frame.georef.maxY
      - frame.georef.minY
    )
    / frame.height;

  return {
    x:
      frame.georef.minX
      + (column + 0.5) * dx,

    y:
      frame.georef.maxY
      - (row + 0.5) * dy
  };
}
JS

cat > frontend/src/live3d-v1.js <<'JS'
import {
  loadLatestBomReflectivityMosaic
} from "./bom-wmts-diagnostics-v1.js?v=live3d-v1";

import {
  SOURCE_PALETTES
} from "./palette.js?v=live3d-v1";

import {
  DEFAULT_OCCUPANCY_THRESHOLD,
  inferColumn,
  pixelCentreMercator,
  representativeDbzForCategory,
  webMercatorToDegrees
} from "./inferred-volume-v1.js?v=live3d-v1";

const MODEL_URL =
  "./3d-models/inferred_vertical_profile_model_v1.json";

const VALIDATION_URL =
  "./3d-models/inferred_volume_validation_v1.json";

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
        const colour =
          colourForDbzh(
            point.dbzh
          ).withAlpha(
            Math.min(
              0.95,
              0.30
              + 0.70
              * point.confidence
            )
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
            pointSize,

          disableDepthTestDistance:
            0
        });

        renderedPoints++;
        confidenceSum +=
          point.confidence;

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

  scene.requestRender();
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
    !== "StormTrackerEmpiricalVerticalReflectivityModelV1"
  ) {
    throw new Error(
      "Unexpected inferred vertical model format."
    );
  }

  const aggregate =
    validation.aggregate;

  $("validationMae").textContent =
    `${aggregate.mean_intensity_mae_dbz.toFixed(2)} dBZ`;

  $("validationIou40").textContent =
    aggregate.thresholds["40"]
      .mean_iou
      .toFixed(3);

  $("validationTop40").textContent =
    `${(
      aggregate.thresholds["40"]
        .median_echo_top_absolute_error_m
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
JS

cat > frontend/live3d.html <<'HTML'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=device-width,initial-scale=1"
  >

  <title>
    StormTracker — Live Inferred 3-D
  </title>

  <link
    rel="stylesheet"
    href="https://unpkg.com/cesium@1.145.0/Build/Cesium/Widgets/widgets.css"
  >

  <script>
    window.CESIUM_BASE_URL =
      "https://unpkg.com/cesium@1.145.0/Build/Cesium/";
  </script>

  <script
    src="https://unpkg.com/cesium@1.145.0/Build/Cesium/Cesium.js"
  ></script>

  <style>
    * {
      box-sizing:
        border-box;
    }

    html,
    body,
    #app {
      width:
        100%;

      height:
        100%;

      margin:
        0;
    }

    body {
      overflow:
        hidden;

      background:
        #081116;

      color:
        #edf5f8;

      font-family:
        Inter,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
    }

    #app {
      display:
        grid;

      grid-template-columns:
        minmax(
          320px,
          380px
        )
        1fr;
    }

    aside {
      overflow:
        auto;

      padding:
        14px;

      background:
        #0e1820;

      border-right:
        1px solid #31424d;
    }

    #mapPanel {
      position:
        relative;

      min-width:
        0;

      overflow:
        hidden;
    }

    #cesiumContainer {
      width:
        100%;

      height:
        100%;
    }

    #inputShield {
      position:
        absolute;

      inset:
        0;

      z-index:
        700;

      display:
        block;

      background:
        transparent;

      touch-action:
        none;

      overscroll-behavior:
        none;
    }

    #nav {
      position:
        absolute;

      z-index:
        800;

      top:
        10px;

      right:
        10px;

      display:
        flex;

      gap:
        5px;

      padding:
        5px;

      border:
        1px solid
        rgba(
          255,
          255,
          255,
          0.18
        );

      border-radius:
        8px;

      background:
        rgba(
          8,
          17,
          22,
          0.92
        );
    }

    h1 {
      margin:
        0 0 5px;

      font-size:
        20px;
    }

    .sub {
      margin-bottom:
        12px;

      color:
        #a9bac4;

      font-size:
        11px;
    }

    .card {
      margin-bottom:
        10px;

      padding:
        11px;

      border:
        1px solid #31424d;

      border-radius:
        9px;

      background:
        #16222b;
    }

    .card h2 {
      margin:
        0 0 8px;

      font-size:
        12px;

      letter-spacing:
        0.07em;

      text-transform:
        uppercase;
    }

    .warning {
      border-color:
        #8a6c36;

      background:
        #282115;

      font-size:
        11px;

      line-height:
        1.45;
    }

    .metric {
      display:
        grid;

      grid-template-columns:
        1fr auto;

      gap:
        4px 10px;

      font-size:
        11px;

      line-height:
        1.4;
    }

    .metric span:nth-child(odd) {
      color:
        #9fb1bb;
    }

    label {
      display:
        block;

      margin:
        8px 0 4px;

      color:
        #b6c5cd;

      font-size:
        11px;
    }

    input[type="range"] {
      width:
        100%;
    }

    button {
      padding:
        8px 10px;

      border:
        1px solid #4a6575;

      border-radius:
        6px;

      background:
        #203440;

      color:
        #f2f7f9;

      cursor:
        pointer;
    }

    #loadButton {
      width:
        100%;

      padding:
        10px;
    }

    #status {
      font-size:
        11px;

      line-height:
        1.45;
    }

    #status[data-kind="error"] {
      color:
        #ff9d91;
    }

    #status[data-kind="ok"] {
      color:
        #99e2b7;
    }

    #legend {
      position:
        absolute;

      z-index:
        650;

      left:
        10px;

      bottom:
        25px;

      padding:
        8px;

      border:
        1px solid
        rgba(
          255,
          255,
          255,
          0.18
        );

      border-radius:
        8px;

      background:
        rgba(
          8,
          17,
          22,
          0.90
        );

      font-size:
        10px;

      pointer-events:
        none;
    }

    .legend-row {
      display:
        flex;

      align-items:
        center;

      gap:
        5px;

      margin:
        2px 0;
    }

    .swatch {
      width:
        12px;

      height:
        9px;

      border:
        1px solid
        rgba(
          255,
          255,
          255,
          0.35
        );
    }

    @media (
      max-width:
        850px
    ) {
      #app {
        grid-template-columns:
          1fr;

        grid-template-rows:
          48% 52%;
      }

      aside {
        border-right:
          0;

        border-bottom:
          1px solid #31424d;
      }
    }
  </style>
</head>

<body>
<div id="app">
  <aside>
    <h1>
      StormTracker Live 3-D
    </h1>

    <div class="sub">
      public BOM reflectivity • empirical vertical reconstruction • prototype V1
    </div>

    <section class="card warning">
      <strong>
        INFERRED VOLUMETRIC INTENSITY — NOT MEASURED VOLUMETRIC RADAR.
      </strong>

      Vertical structure is reconstructed from live 2-D reflectivity using
      empirical profiles calibrated against the historical measured AURA
      volume sequence. It must not be interpreted as the actual current
      vertical radar scan.
    </section>

    <section class="card">
      <h2>
        Live source
      </h2>

      <button id="loadButton">
        Load latest inferred 3-D
      </button>

      <div
        class="metric"
        style="margin-top:9px"
      >
        <span>Source time</span>
        <strong id="sourceTime">—</strong>

        <span>Decoded 2-D pixels</span>
        <strong id="decodedPixels">—</strong>

        <span>Observed 2-D maximum</span>
        <strong id="sourceMaximum">—</strong>
      </div>
    </section>

    <section class="card">
      <h2>
        Inference controls
      </h2>

      <label>
        Minimum displayed intensity:
        <strong>
          <span id="minimumDbzhValue">30</span> dBZ
        </strong>
      </label>

      <input
        id="minimumDbzh"
        type="range"
        min="20"
        max="60"
        value="30"
        step="5"
      >

      <label>
        Minimum profile occupancy:
        <strong>
          <span id="occupancyValue">0.35</span>
        </strong>
      </label>

      <input
        id="occupancyThreshold"
        type="range"
        min="0.35"
        max="0.85"
        value="0.35"
        step="0.05"
      >

      <label>
        Vertical scale:
        <strong>
          <span id="verticalScaleValue">1.0</span>×
        </strong>
      </label>

      <input
        id="verticalScale"
        type="range"
        min="1"
        max="4"
        value="1"
        step="0.5"
      >

      <label>
        Point size:
        <strong>
          <span id="pointSizeValue">3</span> px
        </strong>
      </label>

      <input
        id="pointSize"
        type="range"
        min="2"
        max="7"
        value="3"
        step="1"
      >
    </section>

    <section class="card">
      <h2>
        Current inferred volume
      </h2>

      <div class="metric">
        <span>Rendered columns</span>
        <strong id="renderedColumns">—</strong>

        <span>Rendered 3-D points</span>
        <strong id="renderedPoints">—</strong>

        <span>Display sampling</span>
        <strong id="adaptiveStride">—</strong>

        <span>Maximum inferred DBZH</span>
        <strong id="maxInferredDbzh">—</strong>

        <span>Inferred 40 dBZ top</span>
        <strong id="inferredTop40">—</strong>

        <span>Inferred 50 dBZ top</span>
        <strong id="inferredTop50">—</strong>

        <span>Mean profile confidence</span>
        <strong id="meanConfidence">—</strong>
      </div>
    </section>

    <section class="card">
      <h2>
        Historical validation
      </h2>

      <div class="metric">
        <span>Intensity MAE</span>
        <strong id="validationMae">—</strong>

        <span>40 dBZ volume IoU</span>
        <strong id="validationIou40">—</strong>

        <span>40 dBZ echo-top median error</span>
        <strong id="validationTop40">—</strong>
      </div>

      <div
        style="
          margin-top:8px;
          color:#9fb1bb;
          font-size:10px;
          line-height:1.4
        "
      >
        Validation is leave-one-frame-out within a single historical event
        and is therefore not independent out-of-event validation.
      </div>
    </section>

    <section class="card">
      <h2>
        Status
      </h2>

      <div id="status">
        Loading inferred-volume model…
      </div>
    </section>
  </aside>

  <main id="mapPanel">
    <div id="cesiumContainer"></div>

    <div id="inputShield"></div>

    <div id="nav">
      <button id="lockButton">
        Unlock 3-D view
      </button>

      <button id="resetButton">
        Reset view
      </button>
    </div>

    <div id="legend">
      <strong>
        Inferred intensity
      </strong>

      <div class="legend-row">
        <span
          class="swatch"
          style="background:#6ab6ff"
        ></span>
        20–29 dBZ
      </div>

      <div class="legend-row">
        <span
          class="swatch"
          style="background:#1e78ff"
        ></span>
        30–39 dBZ
      </div>

      <div class="legend-row">
        <span
          class="swatch"
          style="background:#00b96b"
        ></span>
        40–49 dBZ
      </div>

      <div class="legend-row">
        <span
          class="swatch"
          style="background:#ffd21a"
        ></span>
        50–54 dBZ
      </div>

      <div class="legend-row">
        <span
          class="swatch"
          style="background:#ff5a22"
        ></span>
        55–59 dBZ
      </div>

      <div class="legend-row">
        <span
          class="swatch"
          style="background:#bd2fff"
        ></span>
        60+ dBZ
      </div>
    </div>
  </main>
</div>

<script
  type="module"
  src="./src/live3d-v1.js"
></script>
</body>
</html>
HTML

cat > frontend/tests/run-inferred-volume-tests.mjs <<'JS'
import assert from "node:assert/strict";

import {
  inferColumn,
  pixelCentreMercator,
  representativeDbzForCategory,
  webMercatorToDegrees
} from "../src/inferred-volume-v1.js";

const model = {
  profiles: [
    {
      low_level_dbz_min: 20,
      low_level_dbz_max: 30,
      levels: [
        {
          altitude_m_amsl: 500,
          occupancy_probability: 0.8,
          median_delta_dbz: -2,
          p25_delta_dbz: -4,
          p75_delta_dbz: 0
        },
        {
          altitude_m_amsl: 1500,
          occupancy_probability: 0.2,
          median_delta_dbz: -8,
          p25_delta_dbz: -10,
          p75_delta_dbz: -6
        }
      ]
    }
  ]
};

assert.equal(
  representativeDbzForCategory(1),
  null
);

assert.equal(
  representativeDbzForCategory(2),
  25.5
);

const inferred =
  inferColumn(
    model,
    25.5,
    {
      occupancyThreshold: 0.35,
      minimumOutputDbz: 20
    }
  );

assert.equal(
  inferred.length,
  1
);

assert.equal(
  inferred[0].altitude_m_amsl,
  500
);

assert.ok(
  Math.abs(
    inferred[0].dbzh
    - 23.5
  ) < 1e-9
);

const frame = {
  width: 2,
  height: 2,
  georef: {
    minX: 0,
    maxX: 2000,
    minY: 0,
    maxY: 2000
  }
};

const centre =
  pixelCentreMercator(
    frame,
    0,
    0
  );

assert.deepEqual(
  centre,
  {
    x: 500,
    y: 1500
  }
);

const geographic =
  webMercatorToDegrees(
    0,
    0
  );

assert.ok(
  Math.abs(
    geographic.longitude
  ) < 1e-12
);

assert.ok(
  Math.abs(
    geographic.latitude
  ) < 1e-12
);

console.log(
  "4 inferred-volume tests passed."
);
JS

echo
echo "Checking JavaScript syntax..."
node --check frontend/src/inferred-volume-v1.js
node --check frontend/src/live3d-v1.js

echo
echo "Running inferred-volume unit tests..."
node frontend/tests/run-inferred-volume-tests.mjs

echo
echo "Running existing StormTracker regression tests..."
node frontend/tests/run-node-tests.mjs

echo
echo "Deployable files:"
ls -lh \
  frontend/live3d.html \
  frontend/src/live3d-v1.js \
  frontend/src/inferred-volume-v1.js \
  frontend/3d-models/inferred_vertical_profile_model_v1.json \
  frontend/3d-models/inferred_volume_validation_v1.json

echo
echo "Git status:"
git status --short \
  frontend/live3d.html \
  frontend/src/live3d-v1.js \
  frontend/src/inferred-volume-v1.js \
  frontend/tests/run-inferred-volume-tests.mjs \
  frontend/3d-models/inferred_vertical_profile_model_v1.json \
  frontend/3d-models/inferred_volume_validation_v1.json

echo
echo "SUCCESS"
echo "Expected:"
echo "  4 inferred-volume tests passed."
echo "  14 tests passed."
echo
echo "Commit and push:"
echo 'git add frontend/live3d.html frontend/src/live3d-v1.js frontend/src/inferred-volume-v1.js frontend/tests/run-inferred-volume-tests.mjs frontend/3d-models/inferred_vertical_profile_model_v1.json frontend/3d-models/inferred_volume_validation_v1.json'
echo 'git commit -m "Add live inferred 3-D volume prototype"'
echo 'git push'
echo
echo "After Pages deploys, open:"
echo "https://blakesmith-intel.github.io/StormTracker/live3d.html"
echo
echo "Then press 'Load latest inferred 3-D' and send back the screenshot and status."
