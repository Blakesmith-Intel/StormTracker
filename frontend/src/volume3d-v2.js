const MANIFEST_URL = "./3d-data/aura66-20141127/manifest.json";
const TRACK_URL = "./3d-data/aura66-20141127/storm-objects-tracks.json";

const $ = id => document.getElementById(id);

const viewer = new Cesium.Viewer("cesiumContainer", {
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
  maximumRenderTimeChange: Infinity
});

viewer.scene.fog.enabled = false;
viewer.scene.globe.enableLighting = false;
viewer.scene.globe.maximumScreenSpaceError = 4;

const controller = viewer.scene.screenSpaceCameraController;
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

const stormSource = new Cesium.CustomDataSource("measured-3d-storm-objects");
viewer.dataSources.add(stormSource);

let manifest = null;
let trackData = null;
let currentFrame = 6;
let currentArray = null;
let pointCollection = null;
let navigationLocked = true;
let playing = false;

const frameCache = new Map();

function setStatus(message, kind = "normal") {
  $("status").textContent = message;
  $("status").style.color =
    kind === "error" ? "#ff9d91" :
    kind === "ok" ? "#99e2b7" :
    "#d6e0e5";
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
  if (!Number.isFinite(value)) return Cesium.Color.GRAY.withAlpha(0.35);
  const magnitude = Math.min(1, Math.abs(value) / 40);

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

function trackColour(trackId) {
  const number = Number(String(trackId).replace(/\D/g, "")) || 1;
  const hue = (number * 0.61803398875) % 1;
  return Cesium.Color.fromHsl(hue, 0.78, 0.58, 1);
}

function displayAltitude(altitude) {
  const radarHeight = manifest?.radar?.antenna_height_m ?? 0;
  const exaggeration = Number($("exaggerationSlider").value);
  return radarHeight + (altitude - radarHeight) * exaggeration;
}

function resetView() {
  const radar = manifest?.radar ?? {
    longitude: 153.24,
    latitude: -27.7178,
    antenna_height_m: 175
  };

  const target = Cesium.Cartesian3.fromDegrees(
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
    navigationLocked ? "Unlock 3-D view" : "Lock 3-D view";
}

async function loadFrameArray(index) {
  if (frameCache.has(index)) return frameCache.get(index);

  const frame = manifest.frames[index];
  const response = await fetch(frame.binary_url, { cache: "force-cache" });

  if (!response.ok) {
    throw new Error(`Measured 3-D frame request failed: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();

  if (buffer.byteLength !== frame.point_count * 5 * 4) {
    throw new Error(`Binary length mismatch for frame ${index}.`);
  }

  const array = new Float32Array(buffer);
  frameCache.set(index, array);

  if (frameCache.size > 3) {
    const firstKey = frameCache.keys().next().value;
    if (firstKey !== index) frameCache.delete(firstKey);
  }

  return array;
}

function renderVolume() {
  if (!manifest || !currentArray) return;

  if (pointCollection) {
    viewer.scene.primitives.remove(pointCollection);
  }

  pointCollection = viewer.scene.primitives.add(
    new Cesium.PointPrimitiveCollection()
  );

  const threshold = Number($("thresholdSlider").value);
  const pointSize = Number($("pointSizeSlider").value);
  const colourMode = $("colourMode").value;

  let rendered = 0;

  for (let i = 0; i < currentArray.length; i += 5) {
    const longitude = currentArray[i];
    const latitude = currentArray[i + 1];
    const altitude = currentArray[i + 2];
    const dbzh = currentArray[i + 3];
    const vradh = currentArray[i + 4];

    if (!Number.isFinite(dbzh) || dbzh < threshold) continue;

    const colour =
      colourMode === "vradh"
        ? velocityColour(vradh)
        : dbzhColour(dbzh).withAlpha(0.88);

    pointCollection.add({
      position: Cesium.Cartesian3.fromDegrees(
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

  $("renderedCount").textContent = rendered.toLocaleString();
  viewer.scene.requestRender();
}

function renderStormObjects() {
  stormSource.entities.suspendEvents();

  try {
    stormSource.entities.removeAll();

    if (!trackData || !$("showStormObjects").checked) {
      $("activeStormObjects").innerHTML =
        '<div class="muted">Storm-object overlay hidden.</div>';
      $("stormObjectCount").textContent = "0";
      return;
    }

    const frame = trackData.frames.find(
      item => Number(item.frame_index) === currentFrame
    );

    if (!frame) {
      $("activeStormObjects").innerHTML =
        '<div class="muted">No object data for this frame.</div>';
      $("stormObjectCount").textContent = "0";
      return;
    }

    const activeIds = new Set(frame.cells.map(cell => cell.track_id));
    const showEnvelopes = $("showEnvelopes").checked;
    const activeRows = [];

    for (const cell of frame.cells) {
      const colour = trackColour(cell.track_id);
      const centre = cell.centroid;

      const position = Cesium.Cartesian3.fromDegrees(
        centre.longitude,
        centre.latitude,
        displayAltitude(centre.altitude_m)
      );

      stormSource.entities.add({
        id: `cell-${currentFrame}-${cell.track_id}`,
        position,
        point: {
          pixelSize: 10,
          color: colour,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1
        },
        label: {
          text: `${cell.track_id}  ${cell.maximum_dbzh.toFixed(0)} dBZ`,
          font: "12px sans-serif",
          pixelOffset: new Cesium.Cartesian2(0, -18),
          fillColor: Cesium.Color.WHITE,
          showBackground: true,
          backgroundColor: Cesium.Color.BLACK.withAlpha(0.6)
        }
      });

      if (showEnvelopes) {
        const envelope = cell.display_envelope;
        const boxPosition = Cesium.Cartesian3.fromDegrees(
          envelope.longitude,
          envelope.latitude,
          displayAltitude(envelope.altitude_m)
        );

        const verticalScale = Number($("exaggerationSlider").value);

        stormSource.entities.add({
          id: `box-${currentFrame}-${cell.track_id}`,
          position: boxPosition,
          orientation: Cesium.Transforms.headingPitchRollQuaternion(
            boxPosition,
            new Cesium.HeadingPitchRoll(0, 0, 0)
          ),
          box: {
            dimensions: new Cesium.Cartesian3(
              envelope.east_west_m,
              envelope.north_south_m,
              envelope.vertical_m * verticalScale
            ),
            material: colour.withAlpha(0.055),
            outline: true,
            outlineColor: colour.withAlpha(0.75)
          }
        });
      }

      const top40 = cell.echo_top_40_m_amsl;
      const speed = cell.motion_from_previous?.speed_kmh;

      activeRows.push(
        `<div class="storm-row">
          <strong>${cell.track_id}</strong>
          <span>${cell.maximum_dbzh.toFixed(1)} dBZ</span>
          <span>${top40 == null ? "40 dBZ top: —" : `40 dBZ top: ${(top40 / 1000).toFixed(1)} km`}</span>
          <span>${speed == null ? "new" : `${speed.toFixed(0)} km/h`}</span>
        </div>`
      );
    }

    for (const track of trackData.tracks) {
      const observations = track.observations.filter(
        observation => Number(observation.frame_index) <= currentFrame
      );

      if (observations.length < 2) continue;

      const positions = observations.map(
        observation => Cesium.Cartesian3.fromDegrees(
          observation.longitude,
          observation.latitude,
          displayAltitude(observation.altitude_m)
        )
      );

      const colour = trackColour(track.track_id);

      stormSource.entities.add({
        id: `trail-${track.track_id}`,
        polyline: {
          positions,
          width: activeIds.has(track.track_id) ? 3 : 1.5,
          material: colour.withAlpha(
            activeIds.has(track.track_id) ? 0.9 : 0.35
          ),
          clampToGround: false
        }
      });
    }

    $("activeStormObjects").innerHTML =
      activeRows.length
        ? activeRows.join("")
        : '<div class="muted">No accepted 3-D storm objects in this frame.</div>';

    $("stormObjectCount").textContent = String(frame.cells.length);
  } finally {
    stormSource.entities.resumeEvents();
  }

  viewer.scene.requestRender();
}

function rerenderAll() {
  renderVolume();
  renderStormObjects();
}

async function showFrame(index) {
  index = Math.max(
    0,
    Math.min(manifest.frames.length - 1, Number(index))
  );

  currentFrame = index;
  $("frameSlider").value = String(index);

  const frame = manifest.frames[index];

  $("frameLabel").textContent = `${index + 1}/${manifest.frames.length}`;

  setStatus(
    `Loading measured AURA frame ${index + 1}/${manifest.frames.length}…`
  );

  currentArray = await loadFrameArray(index);
  rerenderAll();

  $("scanTime").textContent =
    frame.scan_time.replace("T", " ").replace("Z", " UTC");

  $("maxDbzh").textContent =
    `${Number(frame.maximum_dbzh).toFixed(1)} dBZ`;

  const top40 = frame.echo_tops?.["40"]?.maximum_echo_top_m_amsl;
  const top50 = frame.echo_tops?.["50"]?.maximum_echo_top_m_amsl;

  $("echoTop40").textContent =
    top40 == null ? "none" : `${(top40 / 1000).toFixed(1)} km`;

  $("echoTop50").textContent =
    top50 == null ? "none" : `${(top50 / 1000).toFixed(1)} km`;

  setStatus(
    `Measured 3-D frame loaded: ${frame.scan_time}; ` +
    `${frame.point_count.toLocaleString()} occupied voxels exported at >=` +
    `${manifest.browser_minimum_dbzh} dBZ; ` +
    `${$("stormObjectCount").textContent} segmented storm objects.`,
    "ok"
  );
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function playOnce() {
  if (playing) return;

  playing = true;
  $("playButton").disabled = true;

  try {
    for (let index = 0; index < manifest.frames.length; index++) {
      await showFrame(index);
      await delay(650);
    }
  } finally {
    playing = false;
    $("playButton").disabled = false;
  }
}

$("frameSlider").addEventListener("input", event => {
  showFrame(Number(event.target.value)).catch(
    error => setStatus(error.message, "error")
  );
});

$("thresholdSlider").addEventListener("input", event => {
  $("thresholdLabel").textContent = event.target.value;
  renderVolume();
});

$("exaggerationSlider").addEventListener("input", event => {
  $("exaggerationLabel").textContent =
    Number(event.target.value).toFixed(1);
  rerenderAll();
});

$("pointSizeSlider").addEventListener("input", event => {
  $("pointSizeLabel").textContent = event.target.value;
  renderVolume();
});

$("colourMode").addEventListener("change", renderVolume);
$("showStormObjects").addEventListener("change", renderStormObjects);
$("showEnvelopes").addEventListener("change", renderStormObjects);

$("prevButton").addEventListener("click", () => {
  showFrame(currentFrame - 1).catch(
    error => setStatus(error.message, "error")
  );
});

$("nextButton").addEventListener("click", () => {
  showFrame(currentFrame + 1).catch(
    error => setStatus(error.message, "error")
  );
});

$("playButton").addEventListener("click", () => {
  playOnce().catch(
    error => setStatus(error.message, "error")
  );
});

$("lockButton").addEventListener("click", () => {
  navigationLocked = !navigationLocked;
  applyNavigationLock();
});

$("resetViewButton").addEventListener("click", () => {
  resetView();
  navigationLocked = true;
  applyNavigationLock();
});

async function initialise() {
  const [volumeResponse, trackResponse] = await Promise.all([
    fetch(MANIFEST_URL, { cache: "no-store" }),
    fetch(TRACK_URL, { cache: "no-store" })
  ]);

  if (!volumeResponse.ok) {
    throw new Error(
      `Measured AURA manifest request failed: ${volumeResponse.status}`
    );
  }

  if (!trackResponse.ok) {
    throw new Error(
      `Measured 3-D storm-track request failed: ${trackResponse.status}`
    );
  }

  manifest = await volumeResponse.json();
  trackData = await trackResponse.json();

  if (
    manifest.format !== "StormTrackerAura3DBrowserV1"
    || manifest.frame_count !== 13
  ) {
    throw new Error("Unexpected measured AURA browser manifest.");
  }

  if (
    trackData.format !== "StormTrackerMeasured3DStormTracksV1"
    || trackData.frame_count !== 13
  ) {
    throw new Error("Unexpected measured 3-D storm-track product.");
  }

  $("frameSlider").max = String(manifest.frame_count - 1);
  $("persistentTrackCount").textContent =
    String(trackData.summary.persistent_tracks_3plus);

  currentFrame = Math.min(6, manifest.frame_count - 1);

  resetView();
  navigationLocked = true;
  applyNavigationLock();

  await showFrame(currentFrame);
}

initialise().catch(error => {
  console.error(error);
  setStatus(error.message, "error");
});
