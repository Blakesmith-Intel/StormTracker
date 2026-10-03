const MANIFEST_URL =
  "./3d-data/aura66-20141127/manifest.json";

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
    maximumRenderTimeChange: Infinity
  }
);

viewer.scene.fog.enabled = false;
viewer.scene.globe.enableLighting = false;
viewer.scene.globe.maximumScreenSpaceError = 4;

const controller =
  viewer.scene.screenSpaceCameraController;

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
  console.warn("Basemap unavailable", error);
}

let manifest = null;
let currentFrame = 6;
let currentArray = null;
let pointCollection = null;
let navigationLocked = true;
let playing = false;

const frameCache = new Map();

function setStatus(message, kind = "normal") {
  $("status").textContent = message;
  $("status").style.color =
    kind === "error"
      ? "#ff9d91"
      : kind === "ok"
        ? "#99e2b7"
        : "#d6e0e5";
}

function dbzhColour(value) {
  if (value >= 60) return Cesium.Color.fromCssColorString("#bd2fff");
  if (value >= 55) return Cesium.Color.fromCssColorString("#ff5a22");
  if (value >= 50) return Cesium.Color.fromCssColorString("#ffd21a");
  if (value >= 40) return Cesium.Color.fromCssColorString("#00b96b");
  if (value >= 30) return Cesium.Color.fromCssColorString("#1e78ff");
  return Cesium.Color.fromCssColorString("#6ab6ff");
}

function velocityColour(value) {
  if (!Number.isFinite(value)) {
    return Cesium.Color.GRAY.withAlpha(0.35);
  }

  const magnitude = Math.min(
    1,
    Math.abs(value) / 40
  );

  if (value >= 0) {
    return new Cesium.Color(
      1,
      0.25 * (1 - magnitude),
      0.25 * (1 - magnitude),
      0.92
    );
  }

  return new Cesium.Color(
    0.20 * (1 - magnitude),
    0.35 * (1 - magnitude),
    1,
    0.92
  );
}

function displayAltitude(altitude) {
  const radarHeight =
    manifest?.radar?.antenna_height_m ?? 0;

  const exaggeration =
    Number($("exaggerationSlider").value);

  return (
    radarHeight
    + (
      altitude - radarHeight
    )
    * exaggeration
  );
}

function resetView() {
  const radar = manifest?.radar ?? {
    longitude: 153.24,
    latitude: -27.7178,
    antenna_height_m: 175
  };

  const target =
    Cesium.Cartesian3.fromDegrees(
      radar.longitude,
      radar.latitude,
      5000
    );

  viewer.camera.lookAt(
    target,
    new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(345),
      Cesium.Math.toRadians(-26),
      145000
    )
  );

  viewer.scene.requestRender();
}

function applyNavigationLock() {
  controller.enableInputs = !navigationLocked;

  $("lockButton").textContent =
    navigationLocked
      ? "Unlock 3-D view"
      : "Lock 3-D view";
}

async function loadFrameArray(index) {
  if (frameCache.has(index)) {
    return frameCache.get(index);
  }

  const frame = manifest.frames[index];

  const response = await fetch(
    frame.binary_url,
    { cache: "force-cache" }
  );

  if (!response.ok) {
    throw new Error(
      `Measured 3-D frame request failed: ${response.status}`
    );
  }

  const buffer = await response.arrayBuffer();

  if (buffer.byteLength !== frame.point_count * 5 * 4) {
    throw new Error(
      `Binary length mismatch for frame ${index}.`
    );
  }

  const array = new Float32Array(buffer);

  frameCache.set(index, array);

  // Keep memory bounded on small/mobile devices.
  if (frameCache.size > 3) {
    const firstKey =
      frameCache.keys().next().value;

    if (firstKey !== index) {
      frameCache.delete(firstKey);
    }
  }

  return array;
}

function renderCurrentArray() {
  if (!manifest || !currentArray) {
    return;
  }

  if (pointCollection) {
    viewer.scene.primitives.remove(
      pointCollection
    );
  }

  pointCollection =
    viewer.scene.primitives.add(
      new Cesium.PointPrimitiveCollection()
    );

  const threshold =
    Number($("thresholdSlider").value);

  const pointSize =
    Number($("pointSizeSlider").value);

  const colourMode =
    $("colourMode").value;

  let rendered = 0;

  for (
    let i = 0;
    i < currentArray.length;
    i += 5
  ) {
    const longitude = currentArray[i];
    const latitude = currentArray[i + 1];
    const altitude = currentArray[i + 2];
    const dbzh = currentArray[i + 3];
    const vradh = currentArray[i + 4];

    if (!Number.isFinite(dbzh) || dbzh < threshold) {
      continue;
    }

    const colour =
      colourMode === "vradh"
        ? velocityColour(vradh)
        : dbzhColour(dbzh).withAlpha(0.88);

    pointCollection.add({
      position:
        Cesium.Cartesian3.fromDegrees(
          longitude,
          latitude,
          displayAltitude(altitude)
        ),
      color: colour,
      pixelSize: pointSize,
      disableDepthTestDistance: 0
    });

    rendered++;
  }

  $("renderedCount").textContent =
    rendered.toLocaleString();

  viewer.scene.requestRender();
}

async function showFrame(index) {
  index = Math.max(
    0,
    Math.min(
      manifest.frames.length - 1,
      Number(index)
    )
  );

  currentFrame = index;
  $("frameSlider").value = String(index);

  const frame = manifest.frames[index];

  $("frameLabel").textContent =
    `${index + 1}/${manifest.frames.length}`;

  setStatus(
    `Loading measured AURA frame ${index + 1}/${manifest.frames.length}…`
  );

  currentArray =
    await loadFrameArray(index);

  renderCurrentArray();

  $("scanTime").textContent =
    frame.scan_time.replace("T", " ").replace("Z", " UTC");

  $("maxDbzh").textContent =
    `${Number(frame.maximum_dbzh).toFixed(1)} dBZ`;

  const top40 =
    frame.echo_tops?.["40"]?.maximum_echo_top_m_amsl;

  const top50 =
    frame.echo_tops?.["50"]?.maximum_echo_top_m_amsl;

  $("echoTop40").textContent =
    top40 == null
      ? "none"
      : `${(top40 / 1000).toFixed(1)} km`;

  $("echoTop50").textContent =
    top50 == null
      ? "none"
      : `${(top50 / 1000).toFixed(1)} km`;

  setStatus(
    `Measured 3-D frame loaded: ${frame.scan_time}; ` +
    `${frame.point_count.toLocaleString()} exported occupied voxels at >=` +
    `${manifest.browser_minimum_dbzh} dBZ.`,
    "ok"
  );
}

function delay(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

async function playOnce() {
  if (playing) return;

  playing = true;
  $("playButton").disabled = true;

  try {
    for (
      let index = 0;
      index < manifest.frames.length;
      index++
    ) {
      await showFrame(index);
      await delay(550);
    }
  } finally {
    playing = false;
    $("playButton").disabled = false;
  }
}

$("frameSlider").addEventListener(
  "input",
  event => {
    showFrame(
      Number(event.target.value)
    ).catch(error =>
      setStatus(error.message, "error")
    );
  }
);

$("thresholdSlider").addEventListener(
  "input",
  event => {
    $("thresholdLabel").textContent =
      event.target.value;

    renderCurrentArray();
  }
);

$("exaggerationSlider").addEventListener(
  "input",
  event => {
    $("exaggerationLabel").textContent =
      Number(event.target.value).toFixed(1);

    renderCurrentArray();
  }
);

$("pointSizeSlider").addEventListener(
  "input",
  event => {
    $("pointSizeLabel").textContent =
      event.target.value;

    renderCurrentArray();
  }
);

$("colourMode").addEventListener(
  "change",
  renderCurrentArray
);

$("prevButton").addEventListener(
  "click",
  () => showFrame(currentFrame - 1)
    .catch(error =>
      setStatus(error.message, "error")
    )
);

$("nextButton").addEventListener(
  "click",
  () => showFrame(currentFrame + 1)
    .catch(error =>
      setStatus(error.message, "error")
    )
);

$("playButton").addEventListener(
  "click",
  () => playOnce()
    .catch(error =>
      setStatus(error.message, "error")
    )
);

$("lockButton").addEventListener(
  "click",
  () => {
    navigationLocked = !navigationLocked;
    applyNavigationLock();
  }
);

$("resetViewButton").addEventListener(
  "click",
  () => {
    resetView();
    navigationLocked = true;
    applyNavigationLock();
  }
);

async function initialise() {
  const response =
    await fetch(
      MANIFEST_URL,
      { cache: "no-store" }
    );

  if (!response.ok) {
    throw new Error(
      `Measured AURA manifest request failed: ${response.status}`
    );
  }

  manifest = await response.json();

  if (
    manifest.format !== "StormTrackerAura3DBrowserV1"
    || manifest.frame_count !== 13
  ) {
    throw new Error(
      "Unexpected measured AURA browser manifest."
    );
  }

  $("frameSlider").max =
    String(manifest.frame_count - 1);

  currentFrame =
    Math.min(6, manifest.frame_count - 1);

  resetView();

  navigationLocked = true;
  applyNavigationLock();

  await showFrame(currentFrame);
}

initialise().catch(error => {
  console.error(error);
  setStatus(error.message, "error");
});
