from pathlib import Path

ROOT = Path("/workspaces/StormTracker")
SOURCE = ROOT / "frontend/doppler-georef-v1.html"
TARGET = ROOT / "frontend/doppler-georef-v2.html"

if not SOURCE.exists():
    raise SystemExit(f"ERROR: missing required file: {SOURCE}")

print("StormTracker — Doppler geolocation camera-stability fix V2")
print("Preflight: reading V1 without modifying it...")

text = SOURCE.read_text(encoding="utf-8")

def require_once(haystack, needle, label):
    count = haystack.count(needle)
    if count != 1:
        raise SystemExit(
            f"ERROR: preflight expected exactly one {label}, found {count}. "
            "No file has been written."
        )

def replace_once(haystack, old, new, label):
    require_once(haystack, old, label)
    return haystack.replace(old, new, 1)

# Validate all structural anchors before changing anything.
anchors = {
    "title": "StormTracker — Doppler Geolocation V1",
    "cesium CSS": """  #cesiumContainer {
    width:100%;
    height:100%;
  }""",
    "viewer options": """      requestRenderMode:true,
      maximumRenderTimeChange:
        Infinity""",
    "scene block": """const scene =
  viewer.scene;

scene.fog.enabled =
  false;""",
    "radar camera block": """  viewer.camera.setView({
    destination:
      Cesium.Cartesian3.fromDegrees(
        radar.longitude,
        radar.latitude,
        420000
      ),

    orientation: {
      heading:0,
      pitch:
        -Cesium.Math.PI_OVER_TWO,
      roll:0
    }
  });""",
    "Gympie button": """      <button data-radar="08">
        Load Gympie 08
      </button>""",
    "listener block": """for (
  const button
  of document.querySelectorAll(
    "[data-radar]"
  )
) {"""
}

for label, needle in anchors.items():
    require_once(text, needle, label)

print("Preflight: PASS")
print("Applying fixes in memory...")

text = replace_once(
    text,
    "StormTracker — Doppler Geolocation V1",
    "StormTracker — Doppler Geolocation V2",
    "title"
)

text = replace_once(
    text,
    """  #cesiumContainer {
    width:100%;
    height:100%;
  }""",
    """  #cesiumContainer {
    width:100%;
    height:100%;
    overscroll-behavior:none;
    touch-action:none;
  }

  #cesiumContainer canvas {
    overscroll-behavior:none;
    touch-action:none;
  }

  aside {
    overscroll-behavior:contain;
    -webkit-overflow-scrolling:touch;
  }""",
    "cesium CSS"
)

text = replace_once(
    text,
    """      requestRenderMode:true,
      maximumRenderTimeChange:
        Infinity""",
    """      requestRenderMode:true,
      maximumRenderTimeChange:
        Infinity,
      useBrowserRecommendedResolution:
        true""",
    "viewer options"
)

text = replace_once(
    text,
    """const scene =
  viewer.scene;

scene.fog.enabled =
  false;""",
    """const scene =
  viewer.scene;

const controller =
  scene.screenSpaceCameraController;

scene.fog.enabled =
  false;

scene.globe.enableLighting =
  false;

scene.globe.maximumScreenSpaceError =
  4;

controller.inertiaSpin =
  0;

controller.inertiaTranslate =
  0;

controller.inertiaZoom =
  0;

controller.bounceAnimationTime =
  0;

controller.minimumZoomDistance =
  500;

controller.maximumZoomDistance =
  5000000;

controller.enableRotate =
  true;

controller.enableTilt =
  true;

controller.enableTranslate =
  true;

controller.enableZoom =
  true;

controller.enableLook =
  true;

function setInitialSeqView() {
  viewer.camera.cancelFlight();

  viewer.camera.setView({
    destination:
      Cesium.Cartesian3.fromDegrees(
        153.05,
        -27.35,
        420000
      ),

    orientation: {
      heading:
        0,

      pitch:
        -Cesium.Math.PI_OVER_TWO,

      roll:
        0
    }
  });

  scene.requestRender();
}

setInitialSeqView();""",
    "scene block"
)

text = replace_once(
    text,
    """  viewer.camera.setView({
    destination:
      Cesium.Cartesian3.fromDegrees(
        radar.longitude,
        radar.latitude,
        420000
      ),

    orientation: {
      heading:0,
      pitch:
        -Cesium.Math.PI_OVER_TWO,
      roll:0
    }
  });""",
    """  viewer.camera.cancelFlight();

  viewer.camera.setView({
    destination:
      Cesium.Cartesian3.fromDegrees(
        radar.longitude,
        radar.latitude,
        420000
      ),

    orientation: {
      heading:
        0,

      pitch:
        -Cesium.Math.PI_OVER_TWO,

      roll:
        0
    }
  });""",
    "radar camera block"
)

text = replace_once(
    text,
    """      <button data-radar="08">
        Load Gympie 08
      </button>""",
    """      <button data-radar="08">
        Load Gympie 08
      </button>

      <button id="resetViewButton">
        Reset SEQ view
      </button>""",
    "Gympie button"
)

text = replace_once(
    text,
    """for (
  const button
  of document.querySelectorAll(
    "[data-radar]"
  )
) {""",
    """document
  .getElementById(
    "resetViewButton"
  )
  .addEventListener(
    "click",
    () =>
      setInitialSeqView()
  );

for (
  const button
  of document.querySelectorAll(
    "[data-radar]"
  )
) {""",
    "listener block"
)

checks = [
    "StormTracker — Doppler Geolocation V2",
    "controller.inertiaSpin =",
    "controller.inertiaTranslate =",
    "controller.inertiaZoom =",
    "controller.enableRotate =",
    "controller.enableTilt =",
    "function setInitialSeqView()",
    "setInitialSeqView();",
    'id="resetViewButton"',
    "touch-action:none;",
    "overscroll-behavior:none;"
]

for needle in checks:
    if needle not in text:
        raise SystemExit(
            f"ERROR: final self-check failed for: {needle}. "
            "No file has been written."
        )

if "Lock map" in text or "Unlock map" in text:
    raise SystemExit(
        "ERROR: unexpected map-lock control found. No file has been written."
    )

TARGET.write_text(text, encoding="utf-8")

print("Write: PASS")
print()
print("Generated:")
print("  frontend/doppler-georef-v2.html")
print()
print("SELF-CHECK: PASS")
print("  • no outer-space default view")
print("  • Cesium spin/translate/zoom inertia = 0")
print("  • browser overscroll/touch gestures contained")
print("  • rotate/tilt/pan/zoom remain enabled")
print("  • no map lock reintroduced")
print("  • Reset SEQ view button added")
print()
print("Commit and push:")
print("git add frontend/doppler-georef-v2.html")
print('git commit -m "Restore stable free-camera behaviour to Doppler map"')
print("git push")
print()
print("After Pages deploys, open:")
print(
    "https://blakesmith-intel.github.io/StormTracker/"
    "doppler-georef-v2.html"
)
print()
print("Expected immediately on page load:")
print("  SE Queensland top-down view — NOT the whole globe.")
print()
print("Then press:")
print("  Load Mt Stapylton 66")
print()
print(
    "Leave the mouse/touch input alone for 15–20 seconds. "
    "The map must remain completely stationary."
)
print()
print(
    "Then manually pan, zoom and rotate. Movement should stop immediately "
    "when input stops; rotation remains available."
)
