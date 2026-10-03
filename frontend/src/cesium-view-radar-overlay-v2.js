import { RADARS } from "./config.js";
import { directPoint } from "./geo.js";
import { SOURCE_PALETTES } from "./palette.js?v=radar-overlay-v1";

// DISPLAY ONLY: stronger contrast than the BOM source RGBs so weak echoes
// remain visible over the basemap. Scientific categories and dBZ thresholds
// are unchanged and continue to come from the decoded BOM pixels.
const DISPLAY_REFLECTIVITY_RGB = Object.freeze({
  1: [170, 215, 255],
  2: [115, 175, 255],
  3: [70, 130, 255],
  4: [25, 75, 255],
  5: [0, 225, 190],
  6: [0, 170, 120],
  7: [0, 115, 75],
  8: [255, 245, 0],
  9: [255, 205, 0],
  10: [255, 155, 0],
  11: [255, 95, 0],
  12: [255, 0, 0],
  13: [205, 0, 0],
  14: [130, 0, 0],
  15: [75, 0, 75]
});


const MAP_LOCK_VERSION = "v3";

function colourForTrack(trackId) {
  const number = Number(String(trackId).replace(/\D/g, "")) || 1;
  const hue = (number * 0.61803398875) % 1;
  return Cesium.Color.fromHsl(hue, 0.78, 0.58, 1);
}

function angleDifference(a, b) {
  const twoPi = Math.PI * 2;
  let d = Math.abs(a - b) % twoPi;
  if (d > Math.PI) d = twoPi - d;
  return d;
}

export function createCesiumView(containerId) {
  const container = document.getElementById(containerId);

  if (!container) {
    throw new Error(`Cesium container not found: ${containerId}`);
  }

  const mapPanel = container.parentElement;

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
  const camera = viewer.camera;
  const controller = scene.screenSpaceCameraController;

  scene.requestRenderMode = true;
  scene.maximumRenderTimeChange = Infinity;
  scene.fog.enabled = false;
  scene.globe.enableLighting = false;
  scene.globe.maximumScreenSpaceError = 4;

  controller.inertiaSpin = 0;
  controller.inertiaTranslate = 0;
  controller.inertiaZoom = 0;
  controller.bounceAnimationTime = 0;
  controller.minimumZoomDistance = 500;
  controller.maximumZoomDistance = 5_000_000;

  const HOME = Object.freeze({
    longitude: 152.95,
    latitude: -27.15,
    height: 650000
  });

  let navigationLocked = true;
  let lockedCamera = null;
  let restoringCamera = false;
  let blockedInputCount = 0;

  function takeCameraSnapshot() {
    lockedCamera = {
      position: Cesium.Cartesian3.clone(camera.position),
      heading: camera.heading,
      pitch: camera.pitch,
      roll: camera.roll
    };
  }

  function cameraHasMovedFromLock() {
    if (!lockedCamera) return false;

    const positionDistance =
      Cesium.Cartesian3.distance(camera.position, lockedCamera.position);

    return (
      positionDistance > 0.05 ||
      angleDifference(camera.heading, lockedCamera.heading) > 1e-7 ||
      angleDifference(camera.pitch, lockedCamera.pitch) > 1e-7 ||
      angleDifference(camera.roll, lockedCamera.roll) > 1e-7
    );
  }

  function restoreLockedCamera() {
    if (
      !navigationLocked ||
      !lockedCamera ||
      restoringCamera ||
      !cameraHasMovedFromLock()
    ) {
      return;
    }

    restoringCamera = true;

    try {
      camera.cancelFlight();

      camera.setView({
        destination: Cesium.Cartesian3.clone(lockedCamera.position),
        orientation: {
          heading: lockedCamera.heading,
          pitch: lockedCamera.pitch,
          roll: lockedCamera.roll
        }
      });
    } finally {
      restoringCamera = false;
    }

    scene.requestRender();
  }

  function resetCamera() {
    camera.cancelFlight();

    camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        HOME.longitude,
        HOME.latitude,
        HOME.height
      ),
      orientation: {
        heading: 0,
        pitch: -Cesium.Math.PI_OVER_TWO,
        roll: 0
      }
    });

    takeCameraSnapshot();
    scene.requestRender();
  }

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

  let reflectivityLayer = null;
  const radarLegend = document.createElement("div");
  radarLegend.className = "stormtracker-radar-legend";
  radarLegend.innerHTML = `
    <div style="font-weight:700;margin-bottom:5px">Reflectivity</div>
    <div style="font-size:10px;margin-bottom:6px">Enhanced display colours — dBZ categories unchanged</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px">
      ${[
        [1,"12+"],[4,"31+"],[6,"37+"],[7,"40+"],[8,"43+"],
        [9,"46+"],[10,"49+"],[11,"52+"],[12,"55+"],[13,"58+"],
        [14,"61+"],[15,"64+"]
      ].map(([category,label]) => {
        const rgb = DISPLAY_REFLECTIVITY_RGB[category];
        return `<div style="display:flex;align-items:center;gap:3px;font-size:9px">
          <span style="width:10px;height:10px;background:rgb(${rgb.join(",")});display:inline-block;border:1px solid rgba(255,255,255,.35)"></span>
          <span>${label}</span>
        </div>`;
      }).join("")}
    </div>
  `;

  Object.assign(radarLegend.style, {
    position: "absolute",
    left: "10px",
    bottom: "28px",
    zIndex: "850",
    padding: "8px",
    borderRadius: "8px",
    background: "rgba(11,17,22,.88)",
    color: "#eef5f8",
    border: "1px solid rgba(255,255,255,.18)",
    pointerEvents: "none",
    maxWidth: "290px"
  });

  mapPanel?.appendChild(radarLegend);


  function webMercatorToDegrees(x, y) {
    const radius = 6378137;

    return {
      longitude: x / radius * 180 / Math.PI,
      latitude:
        (2 * Math.atan(Math.exp(y / radius)) - Math.PI / 2) *
        180 / Math.PI
    };
  }

  function reflectivityRgb(category) {
    return DISPLAY_REFLECTIVITY_RGB[category] ?? null;
  }

  async function renderReflectivity(frame) {
    if (!frame?.georef || !frame?.categories) {
      throw new Error(
        "Live radar overlay requires a georeferenced reflectivity frame."
      );
    }

    if (frame.georef.projection !== "EPSG:3857") {
      throw new Error(
        `Unsupported radar overlay projection: ${frame.georef.projection}`
      );
    }

    const width = Number(frame.width);
    const height = Number(frame.height);
    const categories = frame.categories;

    if (categories.length !== width * height) {
      throw new Error(
        "Radar overlay category array does not match frame dimensions."
      );
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "Browser could not create the live reflectivity overlay canvas."
      );
    }

    const imageData = context.createImageData(width, height);
    const rgba = imageData.data;

    for (let pixel = 0, i = 0; pixel < categories.length; pixel++, i += 4) {
      const category = categories[pixel];

      if (!category) {
        rgba[i + 3] = 0;
        continue;
      }

      const rgb = reflectivityRgb(category);

      if (!rgb) {
        rgba[i + 3] = 0;
        continue;
      }

      rgba[i] = rgb[0];
      rgba[i + 1] = rgb[1];
      rgba[i + 2] = rgb[2];

      // Slightly stronger opacity for higher-reflectivity echoes.
      rgba[i + 3] = Math.min(
        255,
        185 + category * 4
      );
    }

    context.putImageData(imageData, 0, 0);

    const southWest = webMercatorToDegrees(
      frame.georef.minX,
      frame.georef.minY
    );

    const northEast = webMercatorToDegrees(
      frame.georef.maxX,
      frame.georef.maxY
    );

    const rectangle = Cesium.Rectangle.fromDegrees(
      southWest.longitude,
      southWest.latitude,
      northEast.longitude,
      northEast.latitude
    );

    const provider =
      await Cesium.SingleTileImageryProvider.fromUrl(
        canvas.toDataURL("image/png"),
        { rectangle }
      );

    if (reflectivityLayer) {
      viewer.imageryLayers.remove(
        reflectivityLayer,
        true
      );
    }

    reflectivityLayer =
      new Cesium.ImageryLayer(provider);

    reflectivityLayer.alpha = 1.0;

    viewer.imageryLayers.add(
      reflectivityLayer
    );

    scene.requestRender();
  }

  function clearReflectivity() {
    if (!reflectivityLayer) {
      return;
    }

    viewer.imageryLayers.remove(
      reflectivityLayer,
      true
    );

    reflectivityLayer = null;
    scene.requestRender();
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

  const inputShield = document.createElement("div");
  inputShield.className = "map-input-shield";
  inputShield.setAttribute("aria-hidden", "true");
  mapPanel?.appendChild(inputShield);

  const controls = document.createElement("div");
  controls.className = "map-nav-controls";

  const versionBadge = document.createElement("div");
  versionBadge.className = "map-lock-version";
  versionBadge.textContent = `MAP LOCK ${MAP_LOCK_VERSION}`;

  const lockButton = document.createElement("button");
  lockButton.type = "button";
  lockButton.className = "map-nav-button map-nav-lock";

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "map-nav-button";
  resetButton.textContent = "Reset view";

  const stateLabel = document.createElement("div");
  stateLabel.className = "map-nav-state";

  controls.append(
    versionBadge,
    lockButton,
    resetButton,
    stateLabel
  );

  mapPanel?.appendChild(controls);

  function setCesiumControllerEnabled(enabled) {
    controller.enableInputs = enabled;
    controller.enableRotate = enabled;
    controller.enableTranslate = enabled;
    controller.enableZoom = enabled;
    controller.enableTilt = false;
    controller.enableLook = false;
  }

  function updateLockUi() {
    inputShield.dataset.active = navigationLocked ? "true" : "false";
    controls.dataset.locked = navigationLocked ? "true" : "false";

    lockButton.textContent = navigationLocked
      ? "Unlock map"
      : "Lock map";

    lockButton.setAttribute(
      "aria-pressed",
      navigationLocked ? "true" : "false"
    );

    stateLabel.textContent = navigationLocked
      ? `Navigation locked · blocked ${blockedInputCount}`
      : "Navigation unlocked";
  }

  function lockNavigation() {
    camera.cancelFlight();
    takeCameraSnapshot();
    navigationLocked = true;
    setCesiumControllerEnabled(false);
    updateLockUi();
    scene.requestRender();
  }

  function unlockNavigation() {
    navigationLocked = false;
    setCesiumControllerEnabled(true);
    updateLockUi();
    scene.requestRender();
  }

  function blockMapInput(event) {
    if (!navigationLocked) return;

    blockedInputCount += 1;

    if (event.cancelable) {
      event.preventDefault();
    }

    event.stopPropagation();
    updateLockUi();
  }

  for (const eventName of [
    "wheel",
    "mousewheel",
    "DOMMouseScroll",
    "pointerdown",
    "pointermove",
    "pointerup",
    "mousedown",
    "mousemove",
    "mouseup",
    "dblclick",
    "contextmenu",
    "touchstart",
    "touchmove",
    "touchend",
    "gesturestart",
    "gesturechange",
    "gestureend"
  ]) {
    inputShield.addEventListener(
      eventName,
      blockMapInput,
      { passive: false, capture: true }
    );
  }

  lockButton.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();

    if (navigationLocked) {
      unlockNavigation();
    } else {
      lockNavigation();
    }
  });

  resetButton.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();

    resetCamera();
    navigationLocked = true;
    setCesiumControllerEnabled(false);
    updateLockUi();
  });

  for (const eventName of [
    "wheel",
    "pointerdown",
    "pointermove",
    "pointerup",
    "touchstart",
    "touchmove",
    "touchend"
  ]) {
    controls.addEventListener(
      eventName,
      event => event.stopPropagation(),
      { passive: eventName !== "wheel" }
    );
  }

  camera.percentageChanged = 0.000001;

  camera.changed.addEventListener(() => {
    restoreLockedCamera();
  });

  scene.preRender.addEventListener(() => {
    restoreLockedCamera();
  });

  resetCamera();
  lockNavigation();

  function render(result) {
    stormSource.entities.suspendEvents();

    try {
      stormSource.entities.removeAll();

      const active = new Set(
        result.active_track_ids ?? []
      );

      for (const track of result.tracks ?? []) {
        if (!track.latest) continue;

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
              `${track.track_id}  ≥` +
              `${Number(
                observation.maximum_dbzh_lower_bound
              ).toFixed(0)} dBZ`,

            font: "12px sans-serif",
            pixelOffset: new Cesium.Cartesian2(0, -20),
            fillColor: Cesium.Color.WHITE,
            showBackground: true,

            backgroundColor:
              Cesium.Color.BLACK.withAlpha(0.55)
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
            id: `${track.track_id}-projection`,

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

    if (navigationLocked) {
      restoreLockedCamera();
    }

    scene.requestRender();
  }

  return {
    viewer,
    render,
    renderReflectivity,
    clearReflectivity,
    resetCamera
  };
}
