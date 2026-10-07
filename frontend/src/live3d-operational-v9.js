import { QLD_RADAR_SITES, dopplerRadarsForRegion } from "./qld-radar-sites-v1.js";
import {
  loadLatestBomReflectivityMosaic,
  findLatestBomReflectivityTime,
  discoverBomReflectivityHistory,
  loadBomReflectivityMosaicAtTime
} from "./bom-wmts-loop-v2.js?v=operational-v9-7";

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
  createStormTrackerTouchCameraGestures
} from "./touch-camera-gestures-v1.js?v=operational-v9-7-4";

import {
  loadDopplerDiagnostic,
  loadDopplerFrame,
  loadDopplerHistory
} from "./bom-doppler-intake-v3.js?v=operational-v9-7";

import {
  geolocatedHistoricalDopplerSamples,
  paletteFromLatestDopplerImage
} from "./bom-doppler-history-spatial-v1.js?v=operational-v9-7";

import {
  geolocatedDopplerDisplaySamples
} from "./bom-doppler-display-v2.js?v=operational-v9-7";

import {
  buildTrackDopplerContexts
} from "./track-doppler-context-v1.js?v=track-context-v1";

import {
  buildFootprintRestrictedTrackAssessment
} from "./track-assessment-v2.js?v=assessment-v2";

import {
  playbackDelayForSpeed
} from "./operational-loop-v1.js?v=operational-v9";

import {
  ALL_AVAILABLE_LOOP_VALUE,
  availableRadarLoopMinutes,
  continuousRadarHistoryTimes,
  buildRadarPlaybackPlan,
  normaliseRadarHistoryTimes,
  radarHistorySpanMinutes,
  selectRadarHistoryPlan
} from "./radar-history-window-v1.js?v=9.8.3";

import {
  interpolateRadarFrame,
  isTemporallyInferredRadarFrame
} from "./radar-temporal-interpolation-v1.js?v=9.8.3";

import {
  getRadarFrames,
  putRadarFrame,
  pruneRadarFrames
} from "./storage.js?v=9.8.3";

import { buildSharedProductTimeline } from "./shared-product-timeline-v1.js?v=operational-v9-7";
import { createSceneCrossfade } from "./scene-crossfade-v1.js?v=operational-v9-6";
import { formatProductTime, formatProductTimeRange } from "./product-time-display-v1.js?v=operational-v9-3";
import {
  radarHistoryTimeline,
  needsChronologicalRadarRebuild,
  automaticRefreshUsesDopplerGate,
  automaticRefreshEndUtc,
  hasNewMatchedProducts,
  createLiveLoopRefresh
} from "./live-loop-refresh-v1.js?v=9.9.0-4";
import { createContinuousPlayback } from "./continuous-playback-v1.js?v=operational-v9-1";
import { buildTrackThreatCone } from "./track-threat-cone-v1.js?v=threat-cone-v1-1";
import {
  BASEMAP_IDS,
  createStormTrackerBasemapManager
} from "./context-layers/basemap-manager-v1.js?v=9.12.3";

import {
  createQueenslandTownLabelLayer
} from "./context-layers/qld-town-label-layer-v1.js?v=9.12.3";

import {
  syncFrameSlider
} from "./frame-slider-v1.js?v=9.9.0-2";

import {
  createStormTrackerTerrainManager
} from "./context-layers/terrain-manager-v1.js?v=9.9.0-4";

import {
  createCameraPerformanceGovernor
} from "./camera-performance-v1.js?v=9.9.0-5";

import {
  initialiseOperationalFloodRoadClosures
} from "./context-layers/flood-road-closures-operational-v1.js?v=9.12.0";

import {
  initialiseOperationalPowerOutages
} from "./context-layers/power-outages-operational-v1.js?v=9.12.1";

import {
  initialiseOperationalRiverGauges
} from "./context-layers/river-gauges-operational-v1.js?v=9.12.0";

import {
  DEFAULT_DOPPLER_FADE_OUT_MS,
  dopplerOverlayFrameKey,
  createDopplerLayerTransition
} from "./doppler-layer-transition-v1.js?v=9.9.1";

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
    // Keep Cesium attribution outside the crossfaded render surface so its logo
    // and provider credits remain static while weather frames transition.
    creditContainer: $("cesiumCredits"),
    creditViewport: $("mapPanel"),
    terrainProvider:
      new Cesium.EllipsoidTerrainProvider(),
    baseLayer: false,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    useBrowserRecommendedResolution: true
  }
);

const scene = viewer.scene;
const frameCrossfade = createSceneCrossfade({ scene, container: $("mapPanel") });
// Keep every camera gesture and manual control immediate during a visual fade.
for (const event of ["pointerdown", "pointermove", "wheel", "keydown"]) {
  document.addEventListener(event, () => frameCrossfade.clear(), { passive: true });
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    frameCrossfade.clear();
    cameraPerformance.restore();
  }
});
window.addEventListener("resize", () => frameCrossfade.clear());
window.addEventListener("pagehide", () => touchCameraGestures.destroy(), { once:true });

scene.fog.enabled = false;
scene.globe.enableLighting = false;
scene.globe.maximumScreenSpaceError = 4;

const cameraPerformance =
  createCameraPerformanceGovernor({
    globe:
      scene.globe,
    scene
  });

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

let mapCamera = null;

const touchCameraGestures =
  createStormTrackerTouchCameraGestures({
    container: $("cesiumContainer"),
    getController: () => mapCamera,
    onGesture: () => {
      frameCrossfade.clear();
      cameraPerformance.pulse();
    }
  });

mapCamera =
  createStormTrackerCameraController({
    viewer,

    container:
      document.getElementById(
        "cesiumContainer"
      ),

    home:
      CORE_HOME,

    onInteraction:
      () =>
        cameraPerformance.pulse()
  });

let queenslandTownLabels = null;
function syncBasemapReferenceLayer(basemapId) {
  if (queenslandTownLabels) {
    queenslandTownLabels.setMode(basemapId);
    return;
  }
  queenslandTownLabels = createQueenslandTownLabelLayer({
    viewer,
    CesiumRef: Cesium,
    mode: basemapId,
    onStatus: ({ kind, message }) => {
      if (kind === "warning") setBasemapStatus(message, "normal");
    }
  });
  void queenslandTownLabels.start().catch(error => {
    console.warn("Queensland town labels unavailable", error);
  });
}

// Read-only QA instrumentation is opt-in and does not alter live controls.
if (new URLSearchParams(window.location.search).has("qaTownLabels")) {
  window.__stormtrackerTownLabelDiagnostics = () => ({
    count: queenslandTownLabels?.count ?? 0,
    visible: queenslandTownLabels?.visibleLabels ?? [],
    labelMode: queenslandTownLabels?.mode ?? "unloaded",
    cameraHeight: queenslandTownLabels?.cameraHeight ?? null,
    cameraPitchDegrees: queenslandTownLabels?.cameraPitchDegrees ?? null,
    labelCalculations: queenslandTownLabels?.calculationCount ?? 0
  });
  // Development-only reproducible camera positions for mobile visual QA.
  window.__stormtrackerTownLabelTestCamera = (longitude, latitude, height, pitch) => {
    // Camera range is distance from the named town, not altitude above a
    // potentially offset view. Keep the town at the visual centre.
    viewer.camera.lookAt(
      Cesium.Cartesian3.fromDegrees(longitude, latitude, 0),
      new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(pitch), height)
    );
    queenslandTownLabels?.draw(true);
    scene.requestRender();
  };
}

function setTerrainStatus(
  message,
  kind = "ok"
) {
  const status =
    $("terrainStatus");

  if (!status) return;

  status.textContent =
    message;

  status.dataset.kind =
    kind;
}

const terrainManager =
  createStormTrackerTerrainManager({
    Cesium,
    viewer,
    storage:
      window.localStorage,
    onStatus:
      setTerrainStatus
  });

function setBasemapStatus(
  message,
  kind = "ok"
) {
  const status =
    $("basemapStatus");

  if (!status) return;

  status.textContent =
    message;

  status.dataset.kind =
    kind;
}

const basemapManager =
  createStormTrackerBasemapManager({
    Cesium,
    viewer,
    storage:
      window.localStorage,
    onStatus:
      setBasemapStatus
  });

try {
  const initialBasemap =
    basemapManager.initialise();

  $("basemapSelect").value =
    initialBasemap.id;

  syncBasemapReferenceLayer(
    initialBasemap.id
  );
} catch (error) {
  console.warn(
    "Stored basemap unavailable; falling back to Street.",
    error
  );

  try {
    const fallback =
      basemapManager.setBasemap(
        BASEMAP_IDS.STREET
      );

    $("basemapSelect").value =
      fallback.id;

    syncBasemapReferenceLayer(
      fallback.id
    );
  } catch (fallbackError) {
    console.warn(
      "Street basemap unavailable",
      fallbackError
    );

    setBasemapStatus(
      "Basemap unavailable · weather layers remain active",
      "error"
    );
  }
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

initialiseOperationalFloodRoadClosures({
  viewer
});

initialiseOperationalPowerOutages({
  viewer
});

initialiseOperationalRiverGauges({
  viewer
});

let hybridFrames = [];
let hybridResults = [];
let hybridFrameIndex = 0;
let hybridHistory = new Map();
let sequenceLoading = false;
let sharedTimeline = null;
let preparedDopplerStates = [];
let publishedSharedTimeline = null;
let loadedLoopSelection = null;
let loadedWithDoppler = null;
let availableRadarHistoryTimes = [];
let lastSourceDiscoveryRegion = null;
let lastSourceDiscoveryAt = 0;
let lastSourceDiscoveryTimes = [];
let trackedThrough = null;
const radarFrameCache = new Map();
const radarResultCache = new Map();
const autoRefresh = createLiveLoopRefresh({
  refresh: () => document.hidden ? undefined : runSourceLoad(() => loadHybridSequence(true), true),
  onError: error => { $("autoRefreshNote").textContent = `Auto update retry: ${error.message}`; }
});

const playback = createContinuousPlayback({
  count: () => hybridFrames.length,
  currentIndex: () => hybridFrameIndex,
  showFrame: showHybridFrame,
  delay: () => playbackDelayForSpeed(selectedPlaybackSpeed()),
  onPlayingChange: playing => {
    $("hybridPlayButton").textContent = playing ? "Pause" : "Play";
    $("hybridPlayButton").setAttribute("aria-pressed", String(playing));
  },
  onError: error => { frameCrossfade.clear(); setStatus(error.message, "error"); }
});

let hybridTrackVolumes = [];
let hybridTrackVolumeCollection = null;

let hybridDopplerFrameStates =
  [];

let dopplerHistories =
  new Map();

let dopplerPalettes =
  new Map();

let dopplerLatestRecords =
  new Map();

let dopplerFrameCache =
  new Map();

const dopplerOverlayTransition =
  createDopplerLayerTransition({
    imageryLayers:
      viewer.imageryLayers,

    requestRender:
      () =>
        scene.requestRender()
  });

let dopplerOverlayRenderToken =
  0;

let selectedTrackDisplayId =
  "";

// Prevent an older asynchronous radar-image load from replacing a newer
// frame after rapid scrubbing/playback.
let hybridSceneRenderToken = 0;

function setStatus(message, kind = "normal") {
  $("status").textContent = message;

  $("status").dataset.kind = kind;
}

function selectedLoopSelection() {
  return $("loopDurationMinutes")?.value || "30";
}

function selectedLoopMinutes() {
  const selection = selectedLoopSelection();
  return selection === ALL_AVAILABLE_LOOP_VALUE
    ? radarHistorySpanMinutes(availableRadarHistoryTimes)
    : Number(selection);
}

function availableHistorySummary(times = availableRadarHistoryTimes) {
  const history = normaliseRadarHistoryTimes(times);
  if (!history.length) return "Radar history unavailable";

  const plan = buildRadarPlaybackPlan(history);
  const inferred =
    plan.filter(entry => entry.kind === "inferred").length;
  const span =
    plan.length > 1
      ? Math.round(
          (
            Date.parse(plan.at(-1).observedUtc)
            - Date.parse(plan[0].observedUtc)
          ) / 60000
        )
      : 0;

  return (
    `Radar history available: ${span} min · ` +
    `${history.length} observed + ${inferred} inferred display frames · ` +
    formatProductTimeRange(
      plan[0]?.observedUtc,
      plan.at(-1)?.observedUtc
    )
  );
}

function updateRadarHistoryOptions(times, { preserveSelection = true } = {}) {
  availableRadarHistoryTimes = continuousRadarHistoryTimes(times);
  const selector = $("loopDurationMinutes");
  const previous = preserveSelection ? selector.value : "30";
  const available = availableRadarLoopMinutes(availableRadarHistoryTimes);
  const options = available.map(minutes => {
    const option = document.createElement("option");
    option.value = String(minutes);
    option.textContent = `${minutes} min`;
    return option;
  });

  if (availableRadarHistoryTimes.length) {
    const all = document.createElement("option");
    const plan =
      buildRadarPlaybackPlan(
        availableRadarHistoryTimes
      );
    const span =
      plan.length > 1
        ? Math.round(
            (
              Date.parse(plan.at(-1).observedUtc)
              - Date.parse(plan[0].observedUtc)
            ) / 60000
          )
        : 0;

    all.value = ALL_AVAILABLE_LOOP_VALUE;
    all.textContent =
      `All available · ${span} min / ${plan.length} display frames`;
    options.push(all);
  }

  selector.replaceChildren(...options);

  if (!options.length) {
    const unavailable = document.createElement("option");
    unavailable.value = "";
    unavailable.textContent = "No radar history";
    selector.append(unavailable);
    selector.disabled = true;
    return;
  }

  selector.disabled = sequenceLoading;
  const values = new Set(options.map(option => option.value));
  let desired = values.has(previous)
    ? previous
    : (
        previous === "" && values.has("30")
          ? "30"
          : ALL_AVAILABLE_LOOP_VALUE
      );

  if (
    $("showDopplerOverlay")?.checked
    && values.has("30")
  ) {
    desired = "30";
  }

  selector.value = desired;
}

function selectedPlaybackSpeed() {
  return Number(
    $("playbackSpeed")
      ?.value
    ?? 1
  );
}

function updateLoopButtonLabel() {
  const selection = selectedLoopSelection();
  const minutes = selectedLoopMinutes();
  const allAvailable = selection === ALL_AVAILABLE_LOOP_VALUE;

  const button = $("loadHybridButton");
  if (button) {
    button.textContent =
      window.matchMedia?.("(max-width:700px)").matches
        ? (allAvailable ? "Load all" : `Load ${minutes}m`)
        : (allAvailable
            ? "Load all available radar history"
            : `Load ${minutes}-min storm loop`);
  }

  const loopWindow = $("operationalLoopWindow");
  if (loopWindow && !hybridFrames.length) {
    loopWindow.textContent = availableRadarHistoryTimes.length
      ? (allAvailable
          ? `${Math.round(minutes)} min available`
          : `${minutes} min selected`)
      : "Checking history";
  }

  $("dopplerHistoryWarning").hidden =
    !allAvailable && minutes <= 30;
}

function enforceDopplerWindow() {
  if (!$("showDopplerOverlay").checked) {
    updateLoopButtonLabel();
    return;
  }

  const available = new Set(
    availableRadarLoopMinutes(availableRadarHistoryTimes)
      .map(String)
  );

  if (!available.has("30")) {
    $("showDopplerOverlay").checked = false;
    clearDopplerOverlay();
    $("autoRefreshNote").textContent =
      "Doppler unavailable: current radar history does not support the 30-minute shared loop.";
  } else if (selectedLoopSelection() !== "30") {
    $("loopDurationMinutes").value = "30";
    $("autoRefreshNote").textContent =
      "Doppler selected: loop changed to 30 minutes.";
  }

  updateLoopButtonLabel();
}

function sourceAgeText(
  observedUtc
) {
  const epoch =
    Date.parse(
      observedUtc
    );

  if (
    !Number.isFinite(
      epoch
    )
  ) {
    return "—";
  }

  const ageMinutes =
    (
      Date.now()
      - epoch
    )
    / 60000;

  if (
    ageMinutes < -2
  ) {
    return "clock anomaly";
  }

  if (
    ageMinutes < 1
  ) {
    return "<1 min";
  }

  return `${Math.round(ageMinutes)} min`;
}

function updateOperationalOverview(
  frame,
  mode =
    "sequence"
) {
  const sourceMode =
    $("operationalSourceMode");

  if (sourceMode) {
    sourceMode.textContent =
      mode === "latest"
        ? "Latest frame"
        : isTemporallyInferredRadarFrame(frame)
          ? "Radar loop · inferred gap frame"
          : (loadedWithDoppler ? "Radar / Doppler loop" : "Radar tracking loop");
  }

  const age =
    $("operationalSourceAge");

  if (age) {
    age.textContent =
      frame
        ? sourceAgeText(
            frame.observedUtc
          )
        : "—";
  }

  const loaded =
    $("operationalFramesLoaded");

  if (loaded) {
    loaded.textContent =
      String(
        mode === "latest"
          ? (
              frame
                ? 1
                : 0
            )
          : hybridFrames.length
      );
  }

  const result =
    mode === "sequence"
      ? hybridResults[
          hybridFrameIndex
        ]
      : null;

  const active =
    $("operationalActiveTracks");

  if (active) {
    active.textContent =
      result
        ? String(
            result.active_track_ids
              ?.length
            ?? 0
          )
        : "—";
  }

  const doppler =
    $("operationalDoppler");

  if (doppler) {
    if (
      mode !== "sequence"
    ) {
      doppler.textContent =
        "not loaded";
    } else if (
      isTemporallyInferredRadarFrame(frame)
    ) {
      doppler.textContent =
        "not applied · inferred frame";
    } else {
      const state =
        dopplerStateForFrame(
          hybridFrameIndex
        );

      const matched =
        state?.pairings
          ?.filter(
            pairing =>
              pairing.matched
          )
          .length
        ?? 0;

      doppler.textContent =
        selectedSourceRadars().length ? `${matched}/${selectedSourceRadars().length} matched${sharedTimeline?.unavailableRadarIds.length ? " · degraded" : ""}` : "Radar only";
    }
  }

  const frameTime = $("operationalFrameTime");
  if (frameTime) {
    frameTime.textContent = frame?.observedUtc ? formatProductTime(frame.observedUtc, { compact: true }) : "—";
    frameTime.title = frame?.observedUtc ? formatProductTime(frame.observedUtc) : "";
    frameTime.dataset.observedUtc = frame?.observedUtc ?? "";
  }

}

function setAdvancedScienceVisible(visible) {
  const dialog = $("detailsDialog");
  if (visible && !dialog.open) dialog.showModal();
  if (!visible && dialog.open) dialog.close();
  $("showAdvancedScience").checked = Boolean(visible);
}

function selectDetailsTab(name) {
  for (const panel of document.querySelectorAll("[data-detail-panel]")) {
    panel.hidden = panel.dataset.detailPanel !== name;
  }
  for (const button of document.querySelectorAll("[data-detail-tab]")) {
    button.setAttribute("aria-selected", String(button.dataset.detailTab === name));
  }
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

function selectedRadarRegion() { return $("radarSite").value; }
function selectedSourceRadars() { return dopplerRadarsForRegion(selectedRadarRegion()); }
function resetView() {
  const site = QLD_RADAR_SITES[selectedRadarRegion()];
  if (site) mapCamera.setView({...CORE_HOME, longitude:site.longitude, latitude:site.latitude});
  else mapCamera.reset();
}
function configureRadarSite() {
  const ids = selectedSourceRadars();
  const selector = $("dopplerOverlayRadar");
  selector.replaceChildren(...ids.map(id => {
    const option = document.createElement("option"); option.value = id;
    option.textContent = `${id} · ${QLD_RADAR_SITES[id].name}`; return option;
  }));
  selector.disabled = ids.length === 0;
  $("showDopplerOverlay").disabled =
    ids.length === 0
    || !availableRadarLoopMinutes(availableRadarHistoryTimes).includes(30);
  if (!ids.length) $("showDopplerOverlay").checked = false;
  $("radarSite").title = selectedRadarRegion() === "SEQ" ? "Regional mosaic: Mt Stapylton, Marburg and Gympie" :
    `${QLD_RADAR_SITES[selectedRadarRegion()].name}: ${ids.length ? "Doppler available" : "reflectivity only"}`;
}
for (const site of Object.values(QLD_RADAR_SITES).sort((a,b) => a.name.localeCompare(b.name))) {
  const option = document.createElement("option"); option.value = site.id;
  option.textContent = `${site.name}${site.dopplerProduct ? "" : " · radar only"}`;
  $("radarSite").append(option);
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
      255;
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
    Number($("radarOpacity").value) / 100;

  viewer.imageryLayers.add(
    surfaceLayer
  );

  // Reflectivity is the primary weather layer. Doppler is display context below it.
  viewer.imageryLayers.raiseToTop(
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


function sameObservedInstant(
  left,
  right
) {
  const leftTime =
    Date.parse(left);

  const rightTime =
    Date.parse(right);

  return (
    Number.isFinite(leftTime)
    && Number.isFinite(rightTime)
    && leftTime === rightTime
  );
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

function selectedTrackId() {
  return selectedTrackDisplayId || null;
}

function trackObservationForFrame(track, index) {
  return track?.history?.find(item =>
    sameObservedInstant(
      item.observed_utc,
      hybridFrames[index]?.observedUtc
    )
  ) ?? null;
}

function hasTrackSpecificVolume(
  index
) {
  const volumeMap = hybridTrackVolumes[index];
  const wanted = selectedTrackId();
  return wanted
    ? Boolean(volumeMap?.has(wanted))
    : (volumeMap?.size ?? 0) > 0;
}

function updateTrackDisplayControls(index) {
  const select = $("trackDisplayFilter");
  const result = hybridResults[index];
  if (!select) return;

  if (!result) {
    select.innerHTML =
      '<option value="">Inferred display frame · no measured tracks</option>';
    select.disabled = true;
    const cone = $("showTrackThreatCone");
    if (cone) {
      cone.checked = false;
      cone.disabled = true;
    }
    const status = $("trackThreatConeStatus");
    if (status) {
      status.textContent =
        "Track analysis is paused on temporally inferred display frames.";
    }
    return;
  }

  select.disabled = false;

  const frameTracks = (result.tracks ?? [])
    .filter(track => trackObservationForFrame(track, index))
    .sort((a, b) => a.track_id.localeCompare(b.track_id));

  const options = [
    `<option value="">All tracks (${frameTracks.length})</option>`,
    ...frameTracks.map(track =>
      `<option value="${track.track_id}">${track.track_id} · ${track.observation_count} obs</option>`
    )
  ];

  if (selectedTrackDisplayId && !frameTracks.some(track => track.track_id === selectedTrackDisplayId)) {
    options.push(`<option value="${selectedTrackDisplayId}">${selectedTrackDisplayId} · not in this frame</option>`);
  }

  select.innerHTML = options.join("");
  select.value = selectedTrackDisplayId;

  const selectedTrack = selectedTrackDisplayId
    ? (result.tracks ?? []).find(track => track.track_id === selectedTrackDisplayId)
    : null;
  const observation = selectedTrack
    ? trackObservationForFrame(selectedTrack, index)
    : null;
  const cone = $("showTrackThreatCone");
  const status = $("trackThreatConeStatus");
  const canProject = Boolean(selectedTrackDisplayId && selectedTrack?.motion && observation);
  cone.disabled = !canProject;
  if (!selectedTrackDisplayId) cone.checked = false;
  if (status) {
    status.textContent = !selectedTrackDisplayId
      ? "Select one track to enable the +90-minute motion cone."
      : canProject
        ? `${selectedTrackDisplayId}: +90-minute constant-motion cone available.`
        : `${selectedTrackDisplayId}: motion cone unavailable in this frame.`;
  }
}

function resetTrackDisplaySelection() {
  selectedTrackDisplayId = "";
  if ($("trackDisplayFilter")) $("trackDisplayFilter").value = "";
  if ($("showTrackThreatCone")) {
    $("showTrackThreatCone").checked = false;
    $("showTrackThreatCone").disabled = true;
  }
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
  const wanted = selectedTrackId();
  const trackVolumesRequested = Boolean($("showTrackVolumes")?.checked);
  const temporalInferred =
    isTemporallyInferredRadarFrame(
      hybridFrames[index]
    );
  const useTrackSpecific =
    !temporalInferred
    && trackVolumesRequested
    && hasTrackSpecificVolume(index);

  if (inferredCollection) {
    inferredCollection.show =
      temporalInferred
        ? true
        : wanted && trackVolumesRequested
          ? false
          : !useTrackSpecific;
  }

  const mode = $("hybridVolumeMode");
  if (mode) {
    mode.textContent = temporalInferred
      ? "Temporal gap-fill · frame-wide inferred"
      : useTrackSpecific
        ? (wanted ? `Selected ${wanted}` : "Measured-track-specific")
        : wanted && trackVolumesRequested
          ? `Selected ${wanted} · no track volume in frame`
          : trackVolumesRequested
            ? "Frame-wide fallback (no measured track)"
            : "Frame-wide inferred";
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
    1.0,
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
          - strength * 0.32,
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
        - strength * 0.12,
      0.95,
      0.62
        - strength * 0.18,
      0.78
    );
}

function dopplerCrossfadeDurationMs() {
  const playbackDelay =
    playbackDelayForSpeed(
      selectedPlaybackSpeed()
    );

  return Math.max(
    100,
    Math.min(
      180,
      Math.round(
        playbackDelay * 0.45
      )
    )
  );
}

function clearDopplerOverlay({
  smooth = false
} = {}) {
  dopplerOverlayRenderToken++;

  dopplerOverlayTransition.clear({
    durationMs:
      smooth
        ? Math.min(
            DEFAULT_DOPPLER_FADE_OUT_MS,
            dopplerCrossfadeDurationMs()
          )
        : 0
  });

  const count =
    $("dopplerOverlayCount");

  if (count) {
    count.textContent =
      "0";
  }
}

function dopplerCanvasForFrame(frame, samples) {
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create Doppler overlay canvas.");
  const southWest = webMercatorToDegrees(frame.georef.minX, frame.georef.minY);
  const northEast = webMercatorToDegrees(frame.georef.maxX, frame.georef.maxY);
  const longitudeSpan = northEast.longitude - southWest.longitude;
  const latitudeSpan = northEast.latitude - southWest.latitude;
  let rendered = 0;
  for (const sample of samples) {
    if (!Number.isFinite(sample.longitude) || !Number.isFinite(sample.latitude)) continue;
    const x = (sample.longitude - southWest.longitude) / longitudeSpan * canvas.width;
    const y = (northEast.latitude - sample.latitude) / latitudeSpan * canvas.height;
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;
    const rgb = sample.palette_rgb;
    context.fillStyle = rgb
      ? `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`
      : dopplerDisplayColour(sample.velocity_kmh).toCssColorString();
    context.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    rendered++;
  }
  return {
    canvas,
    rectangle: Cesium.Rectangle.fromDegrees(
      southWest.longitude, southWest.latitude,
      northEast.longitude, northEast.latitude
    ),
    rendered
  };
}

async function decodeHistoricalDopplerFrame(
  radarId,
  frameDescriptor,
  palettes = dopplerPalettes
) {
  const key =
    `${radarId}:${frameDescriptor.filename}`;

  if (
    dopplerFrameCache
      .has(
        key
      )
  ) {
    return dopplerFrameCache
      .get(
        key
      );
  }

  const promise =
    (
      async () => {
        const source =
          await loadDopplerFrame(
            radarId,
            frameDescriptor
          );

        const palette =
          palettes
            .get(
              String(
                radarId
              )
            );

        if (!palette) {
          throw new Error(
            `No calibrated Doppler palette for radar ${radarId}.`
          );
        }

        const sourceImageData =
          canvasImageData(
            source.canvas
          );

        const decoded =
          geolocatedHistoricalDopplerSamples(
            radarId,
            sourceImageData,
            palette,
            {
              stride:
                1,

              includeZero:
                false
            }
          );

        const displayDecoded =
          geolocatedDopplerDisplaySamples(
            radarId,
            sourceImageData,
            palette,
            {
              stride:
                1,

              includeZero:
                false,

              relaxedDistance:
                24
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
            ?? frameDescriptor.observedUtc,

          timeBasis:
            source.timeSource
            ?? "bom-history-filename-utc",

          filename:
            frameDescriptor.filename,

          validPixelCount:
            decoded.validPixelCount,

          nonZeroPixelCount:
            decoded.nonZeroPixelCount,

          samples:
            decoded.samples,

          displayPixelCount:
            displayDecoded.displayPixelCount,

          displaySamples:
            displayDecoded.samples
        };
      }
    )();

  dopplerFrameCache.set(
    key,
    promise
  );

  try {
    return await promise;
  } catch (error) {
    dopplerFrameCache.delete(
      key
    );

    throw error;
  }
}

async function loadDopplerHistoriesAndPalettes() {
  const radarIds = selectedSourceRadars();

  const settled =
    await Promise.allSettled(
      radarIds.map(
        async radarId => {
          const [
            history,
            latest
          ] =
            await Promise.all([
              loadDopplerHistory(
                radarId
              ),

              loadDopplerDiagnostic(
                radarId
              )
            ]);

          const latestImageData =
            canvasImageData(
              latest.canvas
            );

          const palette =
            paletteFromLatestDopplerImage(
              latestImageData
            );

          const decodedLatest =
            geolocatedHistoricalDopplerSamples(
              radarId,
              latestImageData,
              palette,
              {
                stride:
                  1,

                includeZero:
                  false
              }
            );

          const displayLatest =
            geolocatedDopplerDisplaySamples(
              radarId,
              latestImageData,
              palette,
              {
                stride:
                  1,

                includeZero:
                  false,

                relaxedDistance:
                  24
              }
            );

          return {
            radarId,

            history,

            palette,

            latestRecord: {
              radarId:
                String(
                  radarId
                ),

              product:
                latest.product,

              observedUtc:
                latest.observedUtc,

              timeBasis:
                latest.timeSource
                ?? "bom-product-page-received-at",

              filename:
                `${latest.product}.gif`,

              validPixelCount:
                decodedLatest.validPixelCount,

              nonZeroPixelCount:
                decodedLatest.nonZeroPixelCount,

              samples:
                decodedLatest.samples,

              displayPixelCount:
                displayLatest.displayPixelCount,

              displaySamples:
                displayLatest.samples
            }
          };
        }
      )
    );

  const histories =
    new Map();

  const palettes =
    new Map();

  const latestRecords =
    new Map();

  for (
    const result
    of settled
  ) {
    if (
      result.status
      !== "fulfilled"
    ) {
      continue;
    }

    histories.set(
      result.value.radarId,
      result.value.history
    );

    palettes.set(
      result.value.radarId,
      result.value.palette
    );

    if (
      result.value.latestRecord
        ?.observedUtc
    ) {
      latestRecords.set(
        result.value.radarId,
        result.value.latestRecord
      );
    }
  }
  const errors = new Map(settled.flatMap((result, index) => result.status === "rejected"
    ? [[radarIds[index], result.reason?.message ?? "Doppler source unavailable"]] : []));
  return { histories, palettes, latestRecords, errors };
}

async function prepareDopplerState(entry, sources) {
  const pairings = entry.pairings.map(pair => ({ ...pair }));
  const loadResults =
    await Promise.allSettled(
      pairings.map(
        pairing => {
          if (
            !pairing.matched
            || !pairing.candidate
          ) {
            return Promise.resolve({
              radarId:
                pairing.radarId,

              observedUtc:
                pairing.candidate
                  ?.observedUtc
                ?? null,

              timeBasis:
                "bom-history-filename-utc",

              filename:
                pairing.candidate
                  ?.filename
                ?? null,

              samples:
                []
            });
          }

          if (
            pairing.candidate
              .source_kind
            === "latest"
          ) {
            const latestRecord =
              sources.latestRecords
                .get(
                  pairing.radarId
                );

            if (!latestRecord) {
              throw new Error(
                `Latest BOM Doppler unavailable for radar ${pairing.radarId}.`
              );
            }

            return Promise.resolve(
              latestRecord
            );
          }

          return decodeHistoricalDopplerFrame(
            pairing.radarId,
            pairing.candidate,
            sources.palettes
          );
        }
      )
    );

  const records =
    [];

  let sourceFailures =
    0;

  for (
    let index = 0;
    index < pairings.length;
    index++
  ) {
    const pairing =
      pairings[
        index
      ];

    const load =
      loadResults[
        index
      ];

    if (
      load.status
      === "fulfilled"
    ) {
      if (pairing.matched && (!Number.isFinite(Date.parse(load.value.observedUtc)) || Math.abs(Date.parse(load.value.observedUtc) - Date.parse(entry.observedUtc)) > 8 * 60000)) {
        pairing.matched = false;
        pairing.loadError = `Doppler ${pairing.radarId} returned an invalid/out-of-window source timestamp.`;
        // A successfully decoded but rejected response must not poison retries.
        dopplerFrameCache.delete(`${pairing.radarId}:${pairing.candidate?.filename}`);
        sourceFailures++;
      }
      records.push(load.value);
    } else {
      sourceFailures++;
      pairing.matched = false;
      pairing.loadError = load.reason?.message ?? "Doppler image unavailable";

      records.push({
        radarId:
          pairing.radarId,

        observedUtc:
          pairing.candidate
            ?.observedUtc
          ?? null,

        timeBasis:
          "bom-history-filename-utc",

        filename:
          pairing.candidate
            ?.filename
          ?? null,

        samples:
          []
      });
    }
  }

  return { reflectivityUtc: entry.observedUtc, pairings, records, sourceFailures };
}

async function buildDopplerSequence() {
  hybridDopplerFrameStates = hybridFrames.map((frame, frameIndex) => {
    const state = preparedDopplerStates[frameIndex];
    const result = hybridResults[frameIndex];
    return {
      ...state,
      frameIndex,
      context: buildTrackDopplerContexts({
        frame,
        segmentation: result?.segmentations?.[0],
        tracks: result?.tracks ?? [],
        dopplerRecords: state.records.filter(record => QLD_RADAR_SITES[record.radarId]?.analysisGeorefVerified),
        maxTimeDeltaMinutes: 8,
        minimumSamples: 3
      })
    };
  });
}

function dopplerStateForFrame(
  index
) {
  return (
    hybridDopplerFrameStates[
      index
    ]
    ?? null
  );
}

function dopplerContextForTrack(
  index,
  trackId
) {
  return (
    dopplerStateForFrame(
      index
    )
      ?.context
      ?.contextByTrack
      ?.get(
        trackId
      )
    ?? null
  );
}

function selectedDopplerRecord(
  index
) {
  const radarId =
    $("dopplerOverlayRadar")
      ?.value
    ?? "66";

  const state =
    dopplerStateForFrame(
      index
    );

  if (!state) {
    return null;
  }

  const pairing =
    state.pairings
      .find(
        item =>
          item.radarId
          === radarId
      );

  if (
    !pairing
    || !pairing.matched
  ) {
    return null;
  }

  return (
    state.records
      .find(
        record =>
          record.radarId
          === radarId
          && Array.isArray(record.displaySamples)
      )
    ?? null
  );
}

function formatDopplerUtc(value) {
  return formatProductTime(value);
}

function renderDopplerVelocityLegend(
  radarId
) {
  const output =
    $("dopplerVelocityLegend");

  if (!output) {
    return;
  }

  const palette =
    dopplerPalettes
      .get(
        String(
          radarId
        )
      );

  if (
    !palette
    || !palette.swatches
      ?.length
  ) {
    output.innerHTML =
      '<span class="hybrid-muted">Doppler velocity palette unavailable.</span>';

    return;
  }

  output.innerHTML = '<div class="velocity-scale">' + palette.swatches.map(swatch => {
    const label = swatch.velocity_kmh > 0 ? `+${swatch.velocity_kmh}` : String(swatch.velocity_kmh);
    return `<span class="velocity-step" title="${label} km/h radial velocity"><i style="background:rgb(${swatch.rgb.join(',')})"></i><span>${label}</span></span>`;
  }).join("") + '</div><div class="velocity-directions"><span>Blue: toward radar</span><span>Yellow/red: away</span></div>';

}

function renderDopplerOverlay() {
  renderDopplerVelocityLegend(
    $("dopplerOverlayRadar").value
  );

  const renderToken =
    ++dopplerOverlayRenderToken;

  const status =
    $("dopplerOverlayStatus");

  const clearForMissingFrame =
    message => {
      dopplerOverlayTransition.clear({
        durationMs:
          DEFAULT_DOPPLER_FADE_OUT_MS
      });

      const count =
        $("dopplerOverlayCount");

      if (count) {
        count.textContent =
          "0";
      }

      if (status) {
        status.textContent =
          message;
      }
    };

  if (
    !$("showDopplerOverlay")
      ?.checked
  ) {
    dopplerOverlayTransition.clear();

    const count =
      $("dopplerOverlayCount");

    if (count) {
      count.textContent =
        "0";
    }

    if (status) {
      status.textContent =
        "hidden";
    }

    return;
  }

  const state =
    dopplerStateForFrame(
      hybridFrameIndex
    );

  if (!state) {
    clearForMissingFrame(
      "Doppler sequence not loaded"
    );

    return;
  }

  const radarId =
    $("dopplerOverlayRadar")
      ?.value
    ?? "66";

  const pairing =
    state.pairings.find(
      item =>
        item.radarId === radarId
    );

  if (
    !pairing
    || !pairing.candidate
  ) {
    clearForMissingFrame(
      `${radarId} — no historical frame`
    );

    return;
  }

  if (!pairing.matched) {
    clearForMissingFrame(
      `${radarId} — NO MATCH (Δ${pairing.deltaMinutes.toFixed(1)} min)`
    );

    return;
  }

  const record =
    selectedDopplerRecord(
      hybridFrameIndex
    );

  if (!record) {
    clearForMissingFrame(
      `${radarId} — matched frame failed to decode`
    );

    return;
  }

  const frame =
    hybridFrames[
      hybridFrameIndex
    ];

  if (!frame) {
    return;
  }

  renderDopplerVelocityLegend(
    radarId
  );

  const displaySamples =
    record.displaySamples
    ?? record.samples
    ?? [];

  const frameKey =
    dopplerOverlayFrameKey(
      radarId,
      record
    );

  const opacity =
    Number(
      $("dopplerOpacity").value
    )
    / 100;

  if (
    frameKey
    && dopplerOverlayTransition.currentKey
      === frameKey
  ) {
    dopplerOverlayTransition
      .setOpacity(
        opacity
      );

    if (status) {
      status.textContent =
        `${radarId} ${formatDopplerUtc(record.observedUtc)} (Δ${pairing.deltaMinutes.toFixed(1)} min)`;
    }

    return;
  }

  const raster =
    dopplerCanvasForFrame(
      frame,
      displaySamples
    );

  $("dopplerOverlayCount")
    .textContent =
      raster.rendered
        .toLocaleString();

  if (status) {
    status.textContent =
      `${radarId} ${formatDopplerUtc(record.observedUtc)} (Δ${pairing.deltaMinutes.toFixed(1)} min)`;
  }

  Cesium.SingleTileImageryProvider
    .fromUrl(
      raster.canvas
        .toDataURL(
          "image/png"
        ),
      {
        rectangle:
          raster.rectangle
      }
    )
    .then(
      provider => {
        if (
          renderToken
            !== dopplerOverlayRenderToken
          || !$("showDopplerOverlay")
            ?.checked
        ) {
          return;
        }

        const layer =
          new Cesium.ImageryLayer(
            provider
          );

        dopplerOverlayTransition
          .replace({
            layer,
            key:
              frameKey,
            alpha:
              opacity,
            durationMs:
              dopplerCrossfadeDurationMs(),

            onAdded:
              () => {
                if (surfaceLayer) {
                  viewer.imageryLayers
                    .raiseToTop(
                      surfaceLayer
                    );
                }

              }
          });
      }
    )
    .catch(
      error => {
        if (
          renderToken
          !== dopplerOverlayRenderToken
        ) {
          return;
        }

        dopplerOverlayTransition
          .clear({
            durationMs:
              DEFAULT_DOPPLER_FADE_OUT_MS
          });

        if (status) {
          status.textContent =
            `${radarId} — overlay render failed`;
        }

        console.warn(
          "Doppler imagery overlay unavailable",
          error
        );
      }
    );
}

function updateDopplerUiForFrame(
  index
) {
  const state =
    dopplerStateForFrame(
      index
    );

  if (!state) {
    $("dopplerRadarsLoaded")
      .textContent =
        "0";

    $("dopplerRadarsMatched")
      .textContent =
        "0";

    $("dopplerTracksMatched")
      .textContent =
        "0";

    $("dopplerFailures")
      .textContent =
        "0";

    $("dopplerFrameTime")
      .textContent =
        "—";

    $("dopplerSourceRows")
      .innerHTML =
        '<div class="hybrid-muted">Doppler sequence not loaded.</div>';

    renderDopplerOverlay();

    return;
  }

  const matched =
    state.pairings
      .filter(
        pairing =>
          pairing.matched
      )
      .length;

  const loaded =
    state.records
      .filter(
        record =>
          record.samples
            ?.length
      )
      .length;

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
        state.context
          ?.tracks_with_doppler
        ?? 0
      );

  $("dopplerFailures")
    .textContent =
      String(
        state.sourceFailures
      );

  $("dopplerFrameTime")
    .textContent =
      formatDopplerUtc(
        state.reflectivityUtc
      );

  $("dopplerSourceRows")
    .innerHTML =
      state.pairings
        .map(
          pairing => {
            const candidate =
              pairing.candidate;

            const delta =
              pairing.deltaMinutes;

            const matchText =
              pairing.matched
                ? "MATCH"
                : "NO MATCH";

            return (
              `<div class="track-volume-row">` +
                `<div>` +
                  `<strong>Radar ${pairing.radarId}</strong>` +
                  `<span>${formatDopplerUtc(candidate?.observedUtc)}</span>` +
                  `<span>${
                    delta == null
                      ? "delta —"
                      : `Δ${delta.toFixed(1)} min`
                  }</span>` +
                  `<span>${matchText}</span>` +
                `</div>` +
                `<div>` +
                  `<span>${
                    candidate?.source_kind === "latest"
                      ? "source: BOM current IDRnnnI.gif"
                      : "source: BOM timestamped history PNG"
                  }</span>` +
                  `<span>${candidate?.filename ?? "no historical candidate"}</span>` +
                `</div>` +
              `</div>`
            );
          }
        )
        .join("");

  renderDopplerOverlay();
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
  const showTrackVolumes = useTrackSpecificVolume(index);
  if (showTrackVolumes) hybridTrackVolumeCollection = scene.primitives.add(new Cesium.PointPrimitiveCollection());
  try {
    hybridSource.entities.removeAll();
    const result = hybridResults[index];
    const volumeMap = hybridTrackVolumes[index];
    if (!result) {
      $("hybridTrackCount").textContent = "0";
      $("hybridPersistentCount").textContent = "0";
      $("hybridRows").innerHTML =
        '<div class="hybrid-muted">Temporally inferred radar display frame. Track identity, Doppler analysis and scoring use observed frames only.</div>';
      scene.requestRender();
      return;
    }
    const active = new Set(result.active_track_ids ?? []);
    const rows = [];
    const frameTracks = (result.tracks ?? []).filter(track => trackObservationForFrame(track, index));
    const wanted = selectedTrackId();
    $("hybridTrackCount").textContent = String(frameTracks.length);

    for (const track of frameTracks) {
      if (wanted && track.track_id !== wanted) continue;
      const observation = trackObservationForFrame(track, index);
      const volumeRecord = volumeMap?.get(track.track_id) ?? null;
      const volume = volumeRecord?.volume ?? null;
      const trend = volumeRecord?.trend ?? null;
      const colour = trackColour(track.track_id);
      const altitude = 1200;
      const position = Cesium.Cartesian3.fromDegrees(
        observation.centroid_longitude,
        observation.centroid_latitude,
        displayAltitude(altitude)
      );

      hybridSource.entities.add({
        id: `hybrid-${index}-${track.track_id}`,
        position,
        point: {
          pixelSize: active.has(track.track_id) ? 12 : 8,
          color: colour,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        label: {
          show: Boolean($("showTrackLabels")?.checked),
          text: `${track.track_id}  ≥${Number(observation.maximum_dbzh_lower_bound).toFixed(0)} dBZ`,
          font: "12px sans-serif",
          pixelOffset: new Cesium.Cartesian2(0, -18),
          fillColor: Cesium.Color.WHITE,
          showBackground: true,
          backgroundColor: Cesium.Color.BLACK.withAlpha(0.62),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });

      if (showTrackVolumes && volume && hybridTrackVolumeCollection) {
        for (const point of volume.points) {
          hybridTrackVolumeCollection.add({
            position: Cesium.Cartesian3.fromDegrees(
              point.longitude,
              point.latitude,
              displayAltitude(point.altitude_m_amsl)
            ),
            color: colourForDbzh(point.dbzh).withAlpha(point.alpha),
            pixelSize: trackPointSize(point.support_band),
            disableDepthTestDistance: 0
          });
        }
      }

      if (!hybridHistory.has(track.track_id)) hybridHistory.set(track.track_id, []);
      const history = hybridHistory.get(track.track_id);
      if (!history.some(item => item.frameIndex === index)) {
        history.push({
          frameIndex: index,
          longitude: observation.centroid_longitude,
          latitude: observation.centroid_latitude,
          altitude
        });
      }
      const trail = history
        .filter(item => item.frameIndex <= index)
        .sort((a, b) => a.frameIndex - b.frameIndex);
      if (trail.length >= 2) {
        hybridSource.entities.add({
          id: `hybrid-trail-${track.track_id}`,
          polyline: {
            positions: trail.map(item => Cesium.Cartesian3.fromDegrees(
              item.longitude, item.latitude, displayAltitude(item.altitude)
            )),
            width: active.has(track.track_id) ? 3 : 1.5,
            material: colour.withAlpha(active.has(track.track_id) ? 0.9 : 0.35),
            depthFailMaterial: colour.withAlpha(active.has(track.track_id) ? 0.9 : 0.35),
            clampToGround: false
          }
        });
      }

      if (wanted === track.track_id && $("showTrackThreatCone")?.checked) {
        const cone = buildTrackThreatCone(track, observation, {
          horizonMinutes: 90,
          directionChangeThresholdDegrees: 12
        });
        if (cone) {
          const coneAltitude = displayAltitude(350);
          const coneColour = colour.withAlpha(0.30);
          hybridSource.entities.add({
            id: `hybrid-threat-cone-${track.track_id}`,
            polygon: {
              hierarchy: new Cesium.PolygonHierarchy(
                cone.polygon.map(point => Cesium.Cartesian3.fromDegrees(
                  point.longitude, point.latitude, coneAltitude
                ))
              ),
              perPositionHeight: true,
              material: coneColour
            }
          });

          const boundary = [...cone.polygon, cone.polygon[0]];
          hybridSource.entities.add({
            id: `hybrid-threat-boundary-${track.track_id}`,
            polyline: {
              positions: boundary.map(point => Cesium.Cartesian3.fromDegrees(
                point.longitude, point.latitude, coneAltitude + 25
              )),
              width: 4,
              material: colour.withAlpha(1.0),
              depthFailMaterial: Cesium.Color.WHITE.withAlpha(0.85),
              clampToGround: false
            }
          });

          hybridSource.entities.add({
            id: `hybrid-threat-centreline-${track.track_id}`,
            polyline: {
              positions: cone.centreline.map(point => Cesium.Cartesian3.fromDegrees(
                point.longitude, point.latitude, coneAltitude + 35
              )),
              width: 3,
              material: new Cesium.PolylineDashMaterialProperty({
                color: colour.withAlpha(1.0),
                dashLength: 12
              }),
              depthFailMaterial: colour.withAlpha(0.95),
              clampToGround: false
            }
          });

          for (const sample of cone.samples.filter(item => item.minutes_ahead > 0)) {
            hybridSource.entities.add({
              id: `hybrid-threat-marker-${track.track_id}-${sample.minutes_ahead}`,
              position: Cesium.Cartesian3.fromDegrees(
                sample.centre.longitude,
                sample.centre.latitude,
                coneAltitude + 45
              ),
              point: {
                pixelSize: 8,
                color: colour,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
              },
              label: {
                text: `+${sample.minutes_ahead}m`,
                font: "12px sans-serif",
                pixelOffset: new Cesium.Cartesian2(0, -16),
                fillColor: Cesium.Color.WHITE,
                showBackground: true,
                backgroundColor: Cesium.Color.BLACK.withAlpha(0.72),
                disableDepthTestDistance: Number.POSITIVE_INFINITY
              }
            });
          }

          const status = $("trackThreatConeStatus");
          if (status) {
            const turnText = cone.direction_change_detected
              ? `direction updated ${cone.direction_change_degrees.toFixed(0)}°`
              : `${cone.direction_change_threshold_degrees.toFixed(0)}° turn tolerance`;
            status.textContent =
              `${track.track_id}: +90m motion cone · ${cone.speed_kmh.toFixed(0)} km/h · ` +
              `heading ${cone.heading_degrees.toFixed(0)}° · ±${cone.heading_half_angle_degrees.toFixed(0)}° spread · ` +
              `${turnText}. Not a forecast probability.`;
          }
        }
      }

      const top40Text = volume?.high_support_top_40_m_amsl != null
        ? `${(volume.high_support_top_40_m_amsl / 1000).toFixed(1)} km`
        : "—";
      const trendText = trend
        ? `${trend.metres_per_10_min >= 0 ? "+" : ""}${(trend.metres_per_10_min / 1000).toFixed(1)} km/10m`
        : "—";
      const supportText = volume
        ? `${volume.high_support_points}/${volume.inferred_point_count}`
        : "—";
      const dopplerContext = dopplerContextForTrack(index, track.track_id);
      const primaryDoppler = dopplerContext?.primary ?? null;
      const dopplerSummary = primaryDoppler
        ? `Doppler ${primaryDoppler.radar_id}: ${formatSignedKmh(primaryDoppler.strongest_toward_kmh)} toward / ${formatSignedKmh(primaryDoppler.strongest_away_kmh)} away; span ${primaryDoppler.radial_span_kmh == null ? "—" : `${primaryDoppler.radial_span_kmh.toFixed(0)} km/h`}; ${primaryDoppler.sample_count} footprint samples`
        : "Doppler — no time-matched non-zero samples in this measured footprint";
      const assessment = buildFootprintRestrictedTrackAssessment(
        track,
        dopplerContext,
        { referenceTime: new Date(hybridFrames[index].observedUtc) }
      );
      const dopplerAssessmentText = assessment.doppler_integrated
        ? `Doppler contribution ${assessment.doppler_component_score}/${assessment.doppler_component_maximum} from radar ${assessment.doppler_radar_id} (${assessment.doppler_sample_count} strict footprint samples)`
        : "Doppler contribution unavailable for this ST footprint";
      const assessmentText = `Convective/lightning assessment ${assessment.category} ${assessment.score}/100; confidence ${assessment.confidence}; evidence ${assessment.evidence_coverage_percent}/100`;
      rows.push(
        `<div class="track-volume-row"><div><strong>${track.track_id}</strong><span>${track.observation_count} obs</span><span>${track.motion ? `${track.motion.speed_kmh.toFixed(0)} km/h` : "motion —"}</span></div><div><span>high-support 40 dBZ top ${top40Text}</span><span>vertical trend ${trendText}</span><span>support ${supportText}</span><span>${dopplerSummary}</span><span><strong>${assessmentText}</strong></span><span>${dopplerAssessmentText}</span></div></div>`
      );
    }

    $("hybridPersistentCount").textContent = String(
      (result.tracks ?? []).filter(track => track.observation_count >= 3).length
    );
    $("hybridRows").innerHTML = rows.length
      ? rows.join("")
      : '<div class="hybrid-muted">No measured ≥40 dBZ 2-D storm tracks in this frame.</div>';
  } finally {
    hybridSource.entities.resumeEvents();
  }
  scene.requestRender();
}

function updateHybridSourceMetrics(frame) {
  const inference =
    frame.sourceMetadata
      ?.temporalInference;

  $("sourceTime").textContent =
    inference
      ? `${formatProductTime(frame.observedUtc)} · INFERRED between ${formatProductTime(inference.beforeUtc, { compact: true })} and ${formatProductTime(inference.afterUtc, { compact: true })}`
      : formatProductTime(frame.observedUtc);

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

  const animateFrame = playback.isPlaying() && latestFrame && latestFrame.observedUtc !== frame.observedUtc;
  frameCrossfade.clear();
  if (animateFrame) await frameCrossfade.capture();
  if (renderToken !== hybridSceneRenderToken) return;
  latestFrame = frame;

  syncFrameSlider(
    $("hybridFrameSlider"),
    hybridFrames.length,
    hybridFrameIndex
  );

  const temporalInferred =
    isTemporallyInferredRadarFrame(frame);

  $("hybridFrameLabel").textContent =
    `${hybridFrameIndex + 1}/${hybridFrames.length}${temporalInferred ? " · inferred" : ""}`;

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

  updateTrackDisplayControls(
    hybridFrameIndex
  );

  applyHybridVolumeMode(
    hybridFrameIndex
  );

  renderHybridTracks(
    hybridFrameIndex
  );

  updateDopplerUiForFrame(
    hybridFrameIndex
  );

  updateHybridSourceMetrics(
    frame
  );

  updateOperationalOverview(
    frame,
    "sequence"
  );

  const sceneFrame =
    $("hybridSceneFrame");

  if (sceneFrame) {
    sceneFrame.textContent =
      formatProductTime(frame.observedUtc);
  }

  $("mapTruthLabel").textContent =
    temporalInferred
      ? "TEMPORALLY INFERRED 2-D · inferred vertical structure · display only"
      : "Measured reflectivity / inferred vertical structure";

  setStatus(
    temporalInferred
      ? (
          `Frame ${hybridFrameIndex + 1}/${hybridFrames.length} · ` +
          `${formatProductTime(frame.observedUtc, { compact: true })} · ` +
          "INFERRED temporal gap-fill · display only · excluded from tracking/scoring"
        )
      : (
          `Frame ${hybridFrameIndex + 1}/${hybridFrames.length} · ` +
          `${formatProductTime(frame.observedUtc, { compact: true })} · ` +
          `${loadedWithDoppler ? "shared radar / Doppler history" : "radar tracking history"}`
        ),
    "ok"
  );
  if (animateFrame) await frameCrossfade.play(Math.min(200, playbackDelayForSpeed(selectedPlaybackSpeed()) * .5));
}

async function warmRadarHistoryCache(
  region,
  observedTimes
) {
  // Let the interactive load finish first. Cache warming is opportunistic and
  // must never compete with a user-requested loop or a site change.
  await new Promise(
    resolve => setTimeout(resolve, 1500)
  );

  const candidates =
    normaliseRadarHistoryTimes(
      observedTimes
    );

  let warmedCount = 0;

  for (const observedUtc of candidates) {
    if (
      selectedRadarRegion() !== region
      || sequenceLoading
    ) {
      return;
    }

    if (radarFrameCache.has(observedUtc)) {
      continue;
    }

    try {
      const frame =
        await loadBomReflectivityMosaicAtTime(
          observedUtc,
          region
        );

      radarFrameCache.set(
        observedUtc,
        frame
      );

      await putRadarFrame(
        region,
        frame
      );

      warmedCount++;
    } catch (error) {
      // Probe-readable timestamps can still fail if one tile in the complete
      // mosaic disappears. Cache warming is best-effort and never affects the
      // currently displayed loop.
      console.warn(
        `Unable to warm radar history cache for ${region} at ${observedUtc}`,
        error
      );
    }
  }

  pruneRadarFrames({
    beforeEpoch:
      Date.now()
      - 4 * 60 * 60 * 1000,
    maxRecords: 240
  }).catch(error =>
    console.warn(
      "Unable to prune warmed radar history cache",
      error
    )
  );

  if (
    warmedCount > 0
    && selectedRadarRegion() === region
  ) {
    // Re-run the cheap automatic path immediately so newly warmed historical
    // observations become visible without requiring a manual Refresh click.
    void autoRefresh.check();
  }
}

async function loadHybridSequence(automatic = false) {
  if (!automatic) setStatus("Checking available BOM radar history…");

  const region = selectedRadarRegion();
  const now = Date.now();
  const cacheCutoff =
    now - 4 * 60 * 60 * 1000;

  const recentDiscovery =
    !automatic
    && lastSourceDiscoveryRegion === region
    && now - lastSourceDiscoveryAt < 60 * 1000
    && lastSourceDiscoveryTimes.length;

  const sourceDiscovery =
    automatic
      ? findLatestBomReflectivityTime(
          now,
          region
        ).then(observedUtc => [observedUtc])
      : recentDiscovery
        ? Promise.resolve(
            [...lastSourceDiscoveryTimes]
          )
        : discoverBomReflectivityHistory(
            now,
            180,
            region
          );

  const [
    discoveredTimes,
    cachedFrames,
    sources
  ] = await Promise.all([
    sourceDiscovery,
    getRadarFrames(
      region,
      cacheCutoff
    ).catch(error => {
      console.warn(
        "Persistent radar history cache unavailable",
        error
      );
      return [];
    }),
    loadDopplerHistoriesAndPalettes()
  ]);

  if (!automatic && !recentDiscovery) {
    lastSourceDiscoveryRegion = region;
    lastSourceDiscoveryAt = now;
    lastSourceDiscoveryTimes =
      [...discoveredTimes];
  }

  for (const frame of cachedFrames) {
    radarFrameCache.set(
      frame.observedUtc,
      frame
    );
  }

  const combinedHistory =
    normaliseRadarHistoryTimes([
      ...cachedFrames.map(
        frame => frame.observedUtc
      ),
      ...discoveredTimes
    ]);

  const newestHistoryEpoch =
    Math.max(
      ...combinedHistory.map(
        observedUtc =>
          Date.parse(observedUtc)
      )
    );

  const threeHourCutoff =
    newestHistoryEpoch
    - 180 * 60 * 1000;

  const historyTimes =
    combinedHistory.filter(
      observedUtc =>
        Date.parse(observedUtc)
        >= threeHourCutoff
    );

  updateRadarHistoryOptions(historyTimes);
  enforceDopplerWindow();

  const loopSelection = selectedLoopSelection();
  const loopMinutes = selectedLoopMinutes();
  const withDoppler = $("showDopplerOverlay").checked;
  const requestedPlan =
    selectRadarHistoryPlan(
      availableRadarHistoryTimes,
      withDoppler ? 30 : loopSelection
    );
  const times =
    requestedPlan
      .filter(entry => entry.kind === "observed")
      .map(entry => entry.observedUtc);
  const requestedInferred =
    withDoppler
      ? 0
      : requestedPlan
          .filter(entry => entry.kind === "inferred")
          .length;

  if (!automatic) {
    setStatus(
      withDoppler
        ? `Loading 30-minute shared radar / Doppler history from ${times.length} observed radar frames…`
        : (loopSelection === ALL_AVAILABLE_LOOP_VALUE
            ? `Loading all available radar history (${Math.round(loopMinutes)} min · ${times.length} observed + ${requestedInferred} inferred display frames)…`
            : `Loading ${loopMinutes}-minute radar history (${times.length} observed + ${requestedInferred} inferred display frames)…`)
    );
  }

  const shared = buildSharedProductTimeline(times, sources.histories, sources.latestRecords, selectedSourceRadars());
  shared.requestedRadarIds = selectedSourceRadars();

  // Radar-only playback must advance on new reflectivity even at sites that
  // also have a Doppler product. Doppler availability gates automatic refresh
  // only while the user has explicitly enabled the Doppler overlay.
  const dopplerGatedRefresh =
    automaticRefreshUsesDopplerGate(
      withDoppler,
      shared.requestedRadarIds
    );

  const needsHistoricalRebuild =
    automatic
    && !withDoppler
    && needsChronologicalRadarRebuild(
      times,
      trackedThrough,
      radarResultCache.keys()
    );

  if (
    automatic
    && dopplerGatedRefresh
  ) {
    const required =
      publishedSharedTimeline?.radarIds.length
        ? publishedSharedTimeline.radarIds
        : selectedSourceRadars();

    const failed =
      required.filter(
        id =>
          sources.errors.has(id)
      );

    if (failed.length) {
      throw new Error(
        failed
          .map(
            id =>
              `Doppler ${id}: ${sources.errors.get(id)}`
          )
          .join("; ")
      );
    }
  }
  const discoveredImages = new Set([...sources.histories].flatMap(([id, history]) =>
    history.frames.map(frame => `${id}:${frame.filename}`)));
  for (const key of dopplerFrameCache.keys()) if (!discoveredImages.has(key)) dopplerFrameCache.delete(key);
  const availableEndUtc =
    automaticRefreshEndUtc({
      withDoppler,
      radarTimes:
        times,
      sharedEndUtc:
        shared.endUtc
    });

  if (
    automatic
    && !needsHistoricalRebuild
    && (
      (
        dopplerGatedRefresh
        && !hasNewMatchedProducts(
          publishedSharedTimeline,
          shared
        )
      )
      || (
        hybridFrames.length
        && Date.parse(availableEndUtc)
          <= Date.parse(
            hybridFrames.at(-1).observedUtc
          )
      )
    )
  ) {
    $("autoRefreshNote").textContent =
      dopplerGatedRefresh
        ? "Auto update: waiting for new matching radar + Doppler images."
        : "Auto update: waiting for a new radar image.";

    return;
  }
  const radarTimes = automatic ? times.filter(time => Date.parse(time) <= Date.parse(availableEndUtc)) : times;
  const timeline = withDoppler ? shared : radarHistoryTimeline(radarTimes, shared);
  if (!timeline.entries.length) throw new Error("No matching source history available. The current loop is retained.");
  const frames = [], states = [], failures = [];
  let newestFailure = "";
  for (const [index, entry] of timeline.entries.entries()) {
    if (
      automatic
      && !needsHistoricalRebuild
      && trackedThrough
      && !radarResultCache.has(entry.observedUtc)
      && Date.parse(entry.observedUtc) <= Date.parse(trackedThrough)
    ) {
      failures.push(entry.observedUtc);
      continue;
    }
    if (!automatic) setStatus(`Loading frame ${index + 1}/${timeline.entries.length}: ${formatProductTime(entry.observedUtc, { compact: true })}`);
    const [radarLoad, dopplerLoad] = await Promise.allSettled([
      radarFrameCache.has(entry.observedUtc)
        ? Promise.resolve(radarFrameCache.get(entry.observedUtc))
        : loadBomReflectivityMosaicAtTime(entry.observedUtc, selectedRadarRegion()),
      prepareDopplerState(entry, sources)
    ]);
    const needsPair =
      withDoppler;

    if (
      radarLoad.status !== "fulfilled"
      || dopplerLoad.status !== "fulfilled"
      || (
        needsPair
        && !shared.radarIds.every(
          id =>
            dopplerLoad.value.pairings
              .some(
                pair =>
                  pair.radarId === id
                  && pair.matched
              )
        )
      )
    ) {
      failures.push(entry.observedUtc);
      if (entry.observedUtc === availableEndUtc) {
        newestFailure = radarLoad.status === "rejected" ? `Radar image: ${radarLoad.reason?.message}` :
          dopplerLoad.status === "rejected" ? `Doppler preparation: ${dopplerLoad.reason?.message}` :
          dopplerLoad.value.pairings.filter(pair => shared.radarIds.includes(pair.radarId) && !pair.matched)
            .map(pair => pair.loadError ?? `Doppler ${pair.radarId} image unavailable`).join("; ");
      }
      continue;
    }
    radarFrameCache.set(
      entry.observedUtc,
      radarLoad.value
    );

    if (
      !isTemporallyInferredRadarFrame(
        radarLoad.value
      )
    ) {
      putRadarFrame(
        region,
        radarLoad.value
      ).catch(error =>
        console.warn(
          "Unable to persist radar history frame",
          error
        )
      );
    }

    frames.push(radarLoad.value);
    states.push(dopplerLoad.value);
  }
  if (!frames.length || (automatic && frames.at(-1).observedUtc !== availableEndUtc)) {
    throw new Error(newestFailure || "Newest matching images could not be loaded; keeping the current loop and retrying automatically.");
  }
  // Reuse observations across normal forward refreshes so the worker sees each
  // scan once and retains storm IDs/history. Manual backfill and detected
  // browser-cache backfill rebuild chronologically before continuing forward.
  const rebuild =
    trackedThrough == null
    || needsHistoricalRebuild
    || frames.some(frame =>
      !radarResultCache.has(frame.observedUtc)
      && Date.parse(frame.observedUtc) <= Date.parse(trackedThrough));
  if (rebuild) {
    await hybridWorker.reset();
    radarResultCache.clear();
    trackedThrough = null;
  }
  const results = [];
  for (const frame of frames) {
    let result = radarResultCache.get(frame.observedUtc);
    if (!result) {
      result = await hybridWorker.processFrameBucket({ frames: [frame], referenceTime: frame.observedUtc,
        includeSegmentationLabels: true });
      radarResultCache.set(frame.observedUtc, result);
      trackedThrough = frame.observedUtc;
    }
    results.push(result);
  }
  const observedFrameByTime =
    new Map(
      frames.map(frame => [frame.observedUtc, frame])
    );
  const observedResultByTime =
    new Map(
      frames.map((frame, index) => [
        frame.observedUtc,
        results[index]
      ])
    );
  const observedStateByTime =
    new Map(
      frames.map((frame, index) => [
        frame.observedUtc,
        states[index]
      ])
    );

  let displayPlan;

  if (withDoppler) {
    displayPlan =
      frames.map(frame => ({
        observedUtc: frame.observedUtc,
        kind: "observed"
      }));
  } else {
    try {
      displayPlan =
        selectRadarHistoryPlan(
          frames.map(frame => frame.observedUtc),
          loopSelection
        );
    } catch {
      // A frame can pass the lightweight timestamp probe but fail while the
      // complete mosaic is loading. Keep the largest truthful playback run
      // that can still be assembled from successfully decoded observations.
      displayPlan =
        selectRadarHistoryPlan(
          frames.map(frame => frame.observedUtc),
          ALL_AVAILABLE_LOOP_VALUE
        );
    }
  }

  const displayFrames = [];
  const displayResults = [];
  const displayStates = [];

  for (const entry of displayPlan) {
    if (entry.kind === "observed") {
      const frame =
        observedFrameByTime.get(entry.observedUtc);
      if (!frame) continue;

      displayFrames.push(frame);
      displayResults.push(
        observedResultByTime.get(entry.observedUtc)
        ?? null
      );
      displayStates.push(
        observedStateByTime.get(entry.observedUtc)
        ?? {
          reflectivityUtc: entry.observedUtc,
          pairings: [],
          records: [],
          sourceFailures: 0
        }
      );
      continue;
    }

    const before =
      observedFrameByTime.get(entry.beforeUtc);
    const after =
      observedFrameByTime.get(entry.afterUtc);

    if (!before || !after) continue;

    const inferredFrame =
      interpolateRadarFrame(
        before,
        after,
        entry.observedUtc,
        entry.weight
      );

    displayFrames.push(inferredFrame);
    displayResults.push(null);
    displayStates.push({
      reflectivityUtc:
        entry.observedUtc,
      pairings:
        selectedSourceRadars()
          .map(radarId => ({
            radarId,
            matched: false,
            candidate: null,
            deltaMinutes: null
          })),
      records: [],
      sourceFailures: 0,
      inferredDisplayOnly: true
    });
  }

  if (!displayFrames.length) {
    throw new Error(
      "No radar display frames could be assembled from the available history."
    );
  }

  const oldTime = hybridFrames[hybridFrameIndex]?.observedUtc;
  const resume = automatic ? playback.isPlaying() : true;
  $("hybridFrameSlider").disabled = true;
  $("hybridPlayButton").disabled = true;
  await playback.pause();
  hybridFrames = displayFrames;
  hybridResults = displayResults;
  preparedDopplerStates = displayStates;
  dopplerHistories = sources.histories;
  dopplerPalettes = sources.palettes;
  dopplerLatestRecords = sources.latestRecords;
  const publishedEntries = shared.entries.filter(entry => frames.some(frame => frame.observedUtc === entry.observedUtc));
  publishedSharedTimeline = { ...shared, entries: publishedEntries, endUtc: publishedEntries.at(-1)?.observedUtc ?? null };
  loadedLoopSelection = loopSelection;
  loadedWithDoppler = withDoppler;
  sharedTimeline = {
    ...timeline,
    startUtc: hybridFrames[0].observedUtc,
    endUtc: hybridFrames.at(-1).observedUtc,
    spanMinutes:
      (
        Date.parse(hybridFrames.at(-1).observedUtc)
        - Date.parse(hybridFrames[0].observedUtc)
      ) / 60000,
    failures
  };
  hybridHistory = new Map();
  hybridTrackVolumes = [];
  hybridDopplerFrameStates = [];
  hybridFrameIndex = automatic
    ? Math.max(
        0,
        hybridFrames.findIndex(
          frame => frame.observedUtc === oldTime
        )
      )
    : 0;
  // Keep the current Doppler layer visible while the replacement frame is
  // prepared. showHybridFrame() will reuse, crossfade or fade it out as required.
  const range = formatProductTimeRange(sharedTimeline.startUtc, sharedTimeline.endUtc);
  $("operationalLoopWindow").textContent =
    loopSelection === ALL_AVAILABLE_LOOP_VALUE
      ? `${Math.round(sharedTimeline.spanMinutes)} min available`
      : `${loopMinutes} min loop`;
  $("operationalLoopWindow").title =
    `${Math.round(sharedTimeline.spanMinutes)} min actual scan span; ${withDoppler ? "shared source" : "radar"} history`;
  $("sharedHistoryNote").title =
    `${formatProductTime(sharedTimeline.startUtc)} → ${formatProductTime(sharedTimeline.endUtc)}`;
  const inferredLoaded =
    hybridFrames.filter(
      frame =>
        isTemporallyInferredRadarFrame(frame)
    ).length;
  const observedLoaded =
    hybridFrames.length - inferredLoaded;

  $("sharedHistoryNote").textContent =
    `${availableHistorySummary()} · Loaded ${observedLoaded} observed` +
    (inferredLoaded ? ` + ${inferredLoaded} inferred display frames` : "") +
    ` (${range})` +
    (shared.unavailableRadarIds.length ? ` · Doppler unavailable: ${shared.unavailableRadarIds.join(" / ")}` : "") +
    (failures.length ? ` · ${failures.length} unreadable source frames bridged/omitted where possible` : "");
  $("autoRefreshNote").textContent =
    needsHistoricalRebuild
      ? "Auto update: historical cache expanded; loop rebuilt chronologically."
      : `${withDoppler ? "Doppler: 30-min loop. " : ""}Auto update: checks ${dopplerGatedRefresh ? "matching radar + Doppler products" : "radar images"} every 5 minutes.`;
  if (
    selectedRadarRegion() !== "SEQ"
    && !["66","50","08"].includes(
      selectedRadarRegion()
    )
    && shared.requestedRadarIds.length > 0
  ) {
    $("sharedHistoryNote").textContent += " · wind display only (nominal registration)";
  }
  $("autoRefreshNote").title = "";

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
            sameObservedInstant(
              item.observed_utc,
              frame.observedUtc
            )
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

  await buildDopplerSequence();
  syncFrameSlider(
    $("hybridFrameSlider"),
    hybridFrames.length,
    hybridFrameIndex
  );
  $("hybridPlayButton").disabled = hybridFrames.length < 2;
  await showHybridFrame(hybridFrameIndex);
  if (resume) playback.play();
  // Bound decoded imagery and per-frame results while retaining worker tracks.
  const retained = new Set([...radarResultCache.keys()].sort().slice(-48));
  for (const cache of [radarFrameCache, radarResultCache]) {
    for (const key of cache.keys()) if (!retained.has(key)) cache.delete(key);
  }
  const wanted = new Set(states.flatMap(state => state.records.filter(record => record.filename)
    .map(record => `${record.radarId}:${record.filename}`)));
  for (const key of dopplerFrameCache.keys()) if (!wanted.has(key)) dopplerFrameCache.delete(key);

  pruneRadarFrames({
    beforeEpoch:
      Date.now()
      - 4 * 60 * 60 * 1000,
    maxRecords: 240
  }).catch(error =>
    console.warn(
      "Unable to prune persistent radar history cache",
      error
    )
  );

  // Bootstrap the browser-local archive with every source frame that the
  // Bureau still exposes, not just the currently selected display window.
  // This shortens the time needed to accumulate a full three-hour history.
  if (
    !automatic
    && !recentDiscovery
  ) {
    warmRadarHistoryCache(
      region,
      discoveredTimes
    );
  }
}

async function runSourceLoad(loader, background = false) {
  if (sequenceLoading || !model) return;
  if (!background) frameCrossfade.clear();
  sequenceLoading = true;
  $("loopDurationMinutes").disabled = true;
  $("showDopplerOverlay").disabled = true;
  $("radarSite").disabled = true;
  const buttons = background ? ["loadHybridButton", "loadButton"] : ["loadHybridButton", "loadButton", "jumpLatestButton", "hybridPlayButton"];
  for (const id of buttons) $(id).disabled = true;
  if (!background) {
    $("hybridFrameSlider").disabled = true;
    await playback.pause();
  }
  try {
    await loader();
  } catch (error) {
    if (background) {
      const failedRadar = error.message.match(/Doppler (\d{2,3})/)?.[1];
      $("autoRefreshNote").textContent = failedRadar
        ? `Auto update: Doppler ${failedRadar} unavailable; retrying.`
        : "Auto update: newest matched images unavailable; retrying.";
      $("autoRefreshNote").title = error.message;
    }
    else setStatus(error.message, "error");
  } finally {
    sequenceLoading = false;
    $("loopDurationMinutes").disabled = !availableRadarHistoryTimes.length;
    $("showDopplerOverlay").disabled =
      selectedSourceRadars().length === 0
      || !availableRadarLoopMinutes(availableRadarHistoryTimes).includes(30);

    $("radarSite").disabled = false;
    for (const id of ["loadHybridButton", "loadButton", "jumpLatestButton"]) $(id).disabled = false;
    $("hybridPlayButton").disabled = hybridFrames.length < 2;
    $("hybridFrameSlider").disabled = !hybridFrames.length;
  }
}

async function loadLatest() {
  setStatus(
    "Loading latest BOM reflectivity and building inferred vertical volume…"
  );

  const frame =
    await loadLatestBomReflectivityMosaic(Date.now(), selectedRadarRegion());

  latestFrame = frame;
  hybridSource.entities.removeAll();
  clearHybridTrackVolumeCollection();
  clearDopplerOverlay();
  hybridFrames = [];
  hybridResults = [];
  hybridDopplerFrameStates = [];
  syncFrameSlider(
    $("hybridFrameSlider"),
    0,
    0
  );
  hybridTrackVolumes = [];
  hybridFrameIndex = 0;
  sharedTimeline = null;
  publishedSharedTimeline = null;
  loadedLoopSelection = null;
  loadedWithDoppler = null;
  $("hybridFrameLabel").textContent = "—";
  $("hybridRows").innerHTML = '<div class="hybrid-muted">Load a shared loop to view storm tracks.</div>';
  $("operationalLoopWindow").textContent = "Latest only";
  $("sharedHistoryNote").textContent = "Load a loop to align radar and Doppler history.";
  $("hybridTrackCount").textContent = "0";
  $("hybridPersistentCount").textContent = "0";
  updateDopplerUiForFrame(0);

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
    formatProductTime(frame.observedUtc);

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

  updateOperationalOverview(
    frame,
    "latest"
  );

  setStatus(
    `INFERRED LIVE 3-D built from public BOM 2-D reflectivity at ${formatProductTime(frame.observedUtc)}. ` +
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

  const terrainControl =
    $("terrainEnabled");

  terrainManager
    .initialise()
    .then(result => {
      terrainControl.checked =
        Boolean(result?.enabled);
    })
    .catch(error => {
      console.warn(
        "3-D terrain initialisation failed",
        error
      );

      terrainControl.checked =
        false;

      setTerrainStatus(
        "3-D terrain unavailable · using flat fallback",
        "error"
      );
    });

  resetView();

  updateLoopButtonLabel();

  setAdvancedScienceVisible(
    false
  );

  updateOperationalOverview(
    null,
    "latest"
  );

  for (const id of ["loadHybridButton", "loadButton", "jumpLatestButton"]) $(id).disabled = false;
  setStatus("Loading live radar tracking history…");
  autoRefresh.start();
  await runSourceLoad(loadHybridSequence);
}


$("radarSite").addEventListener("change", () => runSourceLoad(async () => {
  frameCrossfade.clear();
  configureRadarSite(); resetView(); clearDopplerOverlay(); resetTrackDisplaySelection();
  radarFrameCache.clear(); radarResultCache.clear(); dopplerFrameCache.clear();
  trackedThrough = null; publishedSharedTimeline = null; latestFrame = null;
  lastSourceDiscoveryRegion = null;
  lastSourceDiscoveryAt = 0;
  lastSourceDiscoveryTimes = [];
  if (surfaceLayer) { viewer.imageryLayers.remove(surfaceLayer, true); surfaceLayer = null; }
  if (inferredCollection) { scene.primitives.remove(inferredCollection); inferredCollection = null; }
  hybridFrames = []; hybridResults = []; hybridDopplerFrameStates = [];
  syncFrameSlider(
    $("hybridFrameSlider"),
    0,
    0
  );
  availableRadarHistoryTimes = [];
  const historyOption = document.createElement("option");
  historyOption.value = "";
  historyOption.textContent = "Checking radar history…";
  $("loopDurationMinutes").replaceChildren(historyOption);
  $("loopDurationMinutes").disabled = true;
  $("operationalLoopWindow").textContent = "Checking history";
  hybridSource.entities.removeAll(); clearHybridTrackVolumeCollection();
  await loadHybridSequence();
}));

$("loadHybridButton").addEventListener("click", () => runSourceLoad(loadHybridSequence));
$("basemapSelect").addEventListener(
  "change",
  event => {
    frameCrossfade.clear();

    try {
      const result =
        basemapManager.setBasemap(
          event.target.value
        );

      event.target.value =
        result.id;

      syncBasemapReferenceLayer(
        result.id
      );
    } catch (error) {
      event.target.value =
        basemapManager.currentId
        ?? BASEMAP_IDS.STREET;

      setBasemapStatus(
        `Basemap switch failed · ${error.message ?? error}`,
        "error"
      );
    }
  }
);

$("terrainEnabled").addEventListener(
  "change",
  async event => {
    frameCrossfade.clear();

    const requested =
      event.target.checked;

    const result =
      await terrainManager.setEnabled(
        requested
      );

    if (
      requested
      && result.failed
    ) {
      event.target.checked =
        false;
    }
  }
);

$("loopDurationMinutes").addEventListener("change", () => {
  frameCrossfade.clear();
  if (
    $("showDopplerOverlay").checked
    && selectedLoopSelection() !== "30"
  ) {
    $("showDopplerOverlay").checked = false;
    clearDopplerOverlay();
  }
  updateLoopButtonLabel();
  if (!sequenceLoading) runSourceLoad(loadHybridSequence);
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) autoRefresh.check(); });
$("jumpLatestButton").addEventListener("click", async () => {
  if (sequenceLoading) return;
  await playback.pause();
  if (hybridFrames.length) {
    showHybridFrame(hybridFrames.length - 1).catch(error => setStatus(error.message, "error"));
  } else {
    runSourceLoad(loadLatest);
  }
});
$("showAdvancedScience").addEventListener("change", event => {
  selectDetailsTab("controls");
  setAdvancedScienceVisible(event.target.checked);
});
$("openDetailsButton").addEventListener("click", () => {
  selectDetailsTab("tracks");
  setAdvancedScienceVisible(true);
});
$("closeDetailsButton").addEventListener("click", () => setAdvancedScienceVisible(false));
$("detailsDialog").addEventListener("close", () => { $("showAdvancedScience").checked = false; });
for (const button of document.querySelectorAll("[data-detail-tab]")) {
  button.addEventListener("click", () => selectDetailsTab(button.dataset.detailTab));
}
$("hybridFrameSlider").addEventListener("input", async event => {
  frameCrossfade.clear();
  const index = Number(event.target.value);
  await playback.pause();
  showHybridFrame(index).catch(error => setStatus(error.message, "error"));
});
$("hybridPlayButton").addEventListener("click", () => {
  frameCrossfade.clear();
  if (playback.isPlaying()) playback.pause();
  else playback.play();
});

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

$("showTrackLabels").addEventListener("change", () => renderHybridTracks(hybridFrameIndex));
$("trackDisplayFilter").addEventListener("change", event => {
  selectedTrackDisplayId = event.target.value || "";
  if (!selectedTrackDisplayId) $("showTrackThreatCone").checked = false;
  updateTrackDisplayControls(hybridFrameIndex);
  applyHybridVolumeMode(hybridFrameIndex);
  renderHybridTracks(hybridFrameIndex);
});
$("showTrackThreatCone").addEventListener("change", () => renderHybridTracks(hybridFrameIndex));

$("showDopplerOverlay").addEventListener(
  "change",
  () => {
    enforceDopplerWindow();

    if (
      !$("showDopplerOverlay")
        .checked
    ) {
      clearDopplerOverlay({
        smooth:
          true
      });
    }

    if (
      !sequenceLoading
      && (
        loadedWithDoppler
          !== $("showDopplerOverlay").checked
        || loadedLoopSelection
          !== selectedLoopSelection()
      )
    ) {
      runSourceLoad(
        loadHybridSequence
      );
    } else {
      renderDopplerOverlay();
    }
  }
);

// Opacity changes only rendered colours, never decoded samples or tracking.
$("radarOpacity").addEventListener("input", event => {
  frameCrossfade.clear();
  const opacity = Number(event.target.value) / 100;
  $("radarOpacityValue").textContent = `${event.target.value}%`;
  if (surfaceLayer) surfaceLayer.alpha = opacity;
  scene.requestRender();
});
$("dopplerOpacity").addEventListener("input", event => {
  frameCrossfade.clear();
  const opacity = Number(event.target.value) / 100;
  $("dopplerOpacityValue").textContent = `${event.target.value}%`;
  dopplerOverlayTransition.setOpacity(
    opacity
  );
  scene.requestRender();
});

$("dopplerOverlayRadar").addEventListener(
  "change",
  () => {
    renderDopplerOverlay();
  }
);

$("loadButton").addEventListener("click", () => runSourceLoad(loadLatest));

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
