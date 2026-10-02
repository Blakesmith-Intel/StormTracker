import { RADARS } from "./config.js";
import { directPoint } from "./geo.js";

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
    resetCamera
  };
}
