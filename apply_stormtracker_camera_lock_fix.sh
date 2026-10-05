#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

echo "StormTracker camera-control fix"
echo

if [ ! -f frontend/src/cesium-view.js ] || [ ! -f frontend/app.css ]; then
  echo "ERROR: Expected StormTracker frontend files were not found."
  exit 1
fi

BACKUP_DIR="/tmp/stormtracker-camera-fix-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
cp frontend/src/cesium-view.js "$BACKUP_DIR/cesium-view.js"
cp frontend/app.css "$BACKUP_DIR/app.css"

echo "Temporary backups: $BACKUP_DIR"
echo

cat > frontend/src/cesium-view.js <<'EOF'
import { RADARS } from "./config.js";
import { directPoint } from "./geo.js";

function colourForTrack(trackId) {
  const number = Number(String(trackId).replace(/\D/g, "")) || 1;
  const hue = (number * 0.61803398875) % 1;
  return Cesium.Color.fromHsl(hue, 0.78, 0.58, 1);
}

export function createCesiumView(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Cesium container not found: ${containerId}`);
  }

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

  // Remove all momentum and ambiguous camera gestures.
  controller.inertiaSpin = 0;
  controller.inertiaTranslate = 0;
  controller.inertiaZoom = 0;
  controller.bounceAnimationTime = 0;
  controller.enableTilt = false;
  controller.enableLook = false;
  controller.minimumZoomDistance = 500;
  controller.maximumZoomDistance = 5_000_000;

  // Only permit deliberate pan and zoom gestures when navigation is unlocked.
  controller.rotateEventTypes = Cesium.CameraEventType.LEFT_DRAG;
  controller.zoomEventTypes = [
    Cesium.CameraEventType.WHEEL,
    Cesium.CameraEventType.PINCH
  ];
  controller.tiltEventTypes = [];
  controller.lookEventTypes = [];

  const HOME = Object.freeze({
    longitude: 152.95,
    latitude: -27.15,
    height: 650000
  });

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

  // ------------------------------------------------------------------
  // EXPLICIT CAMERA LOCK
  //
  // Camera movement is disabled by default. This prevents trackpad,
  // touchscreen, iOS/Safari and wheel events from moving the map unless
  // the user deliberately unlocks it.
  // ------------------------------------------------------------------

  const controls = document.createElement("div");
  controls.className = "map-nav-controls";

  const lockButton = document.createElement("button");
  lockButton.type = "button";
  lockButton.className = "map-nav-button map-nav-lock";
  lockButton.setAttribute("aria-pressed", "true");

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "map-nav-button";
  resetButton.textContent = "Reset view";

  const stateLabel = document.createElement("div");
  stateLabel.className = "map-nav-state";

  controls.append(lockButton, resetButton, stateLabel);
  container.parentElement?.appendChild(controls);

  let navigationLocked = true;

  function applyNavigationLock() {
    controller.enableInputs = !navigationLocked;

    lockButton.textContent = navigationLocked
      ? "Unlock map"
      : "Lock map";

    lockButton.setAttribute(
      "aria-pressed",
      navigationLocked ? "true" : "false"
    );

    stateLabel.textContent = navigationLocked
      ? "Navigation locked"
      : "Navigation unlocked";

    controls.dataset.locked = navigationLocked ? "true" : "false";

    scene.requestRender();
  }

  lockButton.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();

    navigationLocked = !navigationLocked;
    applyNavigationLock();
  });

  resetButton.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();

    resetCamera();

    // Resetting the view also re-locks navigation so the map cannot
    // immediately wander again from a stray touch/trackpad gesture.
    navigationLocked = true;
    applyNavigationLock();
  });

  // Prevent buttons from leaking pointer/wheel events into Cesium.
  for (const eventName of [
    "pointerdown",
    "pointermove",
    "pointerup",
    "touchstart",
    "touchmove",
    "touchend",
    "wheel"
  ]) {
    controls.addEventListener(
      eventName,
      event => event.stopPropagation(),
      { passive: eventName !== "wheel" }
    );
  }

  resetCamera();
  applyNavigationLock();

  function render(result) {
    stormSource.entities.suspendEvents();

    try {
      stormSource.entities.removeAll();

      const active = new Set(result.active_track_ids ?? []);

      for (const track of result.tracks ?? []) {
        if (!track.latest) continue;

        const color = colourForTrack(track.track_id);
        const history = track.history ?? [];

        const positions = history.map(observation =>
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
            pixelSize: active.has(track.track_id) ? 13 : 8,
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
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.55)
          },
          rectangle: {
            coordinates: Cesium.Rectangle.fromDegrees(
              observation.min_longitude,
              observation.min_latitude,
              observation.max_longitude,
              observation.max_latitude
            ),
            material: color.withAlpha(0.08),
            outline: true,
            outlineColor: color.withAlpha(0.7),
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
              material: new Cesium.PolylineDashMaterialProperty({
                color: color.withAlpha(0.75),
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
    render,
    resetCamera
  };
}
EOF

cat > frontend/app.css <<'EOF'
:root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:#0b1116; color:#edf3f7; }
* { box-sizing:border-box; }
html, body, #app { height:100%; margin:0; }
body { overflow:hidden; }
#app { display:grid; grid-template-columns:minmax(330px,390px) 1fr; }
.sidebar { overflow:auto; padding:14px; background:#101820; border-right:1px solid #2d3b45; }
.map { position:relative; min-width:0; overflow:hidden; }
#cesiumContainer { width:100%; height:100%; }
h1 { font-size:21px; margin:0 0 4px; }
.subtitle { color:#9fb0bb; font-size:12px; margin-bottom:12px; }
.card { background:#17212a; border:1px solid #30414d; border-radius:10px; padding:12px; margin-bottom:10px; }
.card h2 { font-size:13px; text-transform:uppercase; letter-spacing:.08em; margin:0 0 9px; color:#b9c8d1; }
.notice { border-color:#6d5d30; background:#211f17; font-size:12px; line-height:1.45; }
button, select, input { font:inherit; }
button { border:1px solid #4f6877; background:#223541; color:#f4f8fa; padding:8px 10px; border-radius:7px; cursor:pointer; }
button:hover { background:#2a4351; }
.controls { display:flex; flex-wrap:wrap; gap:7px; }
label { display:block; font-size:11px; color:#aebdc6; margin:8px 0 4px; }
input[type="url"], select { width:100%; padding:7px; border-radius:6px; border:1px solid #40535e; background:#0e171d; color:#edf3f7; }
input[type="file"] { width:100%; font-size:11px; }
#status { font-size:12px; line-height:1.4; color:#d3dce2; }
#status[data-kind="error"] { color:#ff9d91; }
#status[data-kind="ok"] { color:#9de0b9; }
.muted { color:#91a2ac; }
table { width:100%; border-collapse:collapse; font-size:10.5px; }
th,td { text-align:left; padding:5px 4px; border-bottom:1px solid #2b3a44; vertical-align:top; }
th { color:#a8bac5; position:sticky; top:0; background:#17212a; }
tr.active td:first-child { color:#72e0ae; }
.small { font-size:11px; line-height:1.45; }
code { color:#dce9ef; }

.map,
#cesiumContainer,
#cesiumContainer canvas {
  overscroll-behavior: none;
}

#cesiumContainer canvas {
  touch-action: none;
}

.sidebar {
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

/* Explicit map navigation controls. */
.map-nav-controls {
  position:absolute;
  z-index:1000;
  top:10px;
  right:10px;
  display:flex;
  align-items:center;
  gap:6px;
  padding:6px;
  border:1px solid rgba(255,255,255,.18);
  border-radius:9px;
  background:rgba(11,17,22,.88);
  backdrop-filter:blur(6px);
  -webkit-backdrop-filter:blur(6px);
  pointer-events:auto;
  user-select:none;
  -webkit-user-select:none;
}

.map-nav-button {
  padding:7px 9px;
  font-size:12px;
  white-space:nowrap;
}

.map-nav-controls[data-locked="true"] .map-nav-lock {
  border-color:#5d9775;
  background:#183529;
}

.map-nav-controls[data-locked="false"] .map-nav-lock {
  border-color:#a88445;
  background:#44351c;
}

.map-nav-state {
  padding:0 5px;
  font-size:10px;
  color:#b8c4cb;
  white-space:nowrap;
}

@media (max-width:850px) {
  #app {
    grid-template-columns:1fr;
    grid-template-rows:46% 54%;
  }

  .sidebar {
    border-right:0;
    border-bottom:1px solid #2d3b45;
  }

  .map-nav-controls {
    top:6px;
    right:6px;
    gap:4px;
    padding:4px;
  }

  .map-nav-state {
    display:none;
  }

  .map-nav-button {
    padding:6px 8px;
    font-size:11px;
  }
}
EOF

echo "Camera-lock replacement installed."
echo
echo "Running regression tests..."
node frontend/tests/run-node-tests.mjs

echo
echo "Checking JavaScript syntax..."
find frontend -type f -name '*.js' -print0 | xargs -0 -n1 node --check

echo
echo "Changed files:"
git status --short frontend/src/cesium-view.js frontend/app.css

echo
echo "SUCCESS"
echo
echo "If the output above says '12 tests passed', run:"
echo
echo 'git add frontend/src/cesium-view.js frontend/app.css'
echo 'git commit -m "Add explicit map navigation lock"'
echo 'git push'
