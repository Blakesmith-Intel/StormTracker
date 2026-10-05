from pathlib import Path

ROOT = Path("/workspaces/StormTracker")
SOURCE = ROOT / "frontend/doppler-georef-v2.html"
TARGET = ROOT / "frontend/doppler-georef-v3.html"

if not SOURCE.exists():
    raise SystemExit(
        f"ERROR: missing required file: {SOURCE}"
    )

print("StormTracker — deterministic free-camera candidate V3")
print("This does NOT claim the drift is fixed until browser validation passes.")
print()

text = SOURCE.read_text(encoding="utf-8")

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"ERROR: expected exactly one {label}, found {count}. "
            "No output written."
        )
    return text.replace(old, new, 1)

# Preflight every structural anchor before writing anything.
required = {
    "title":
        "StormTracker — Doppler Geolocation V2",

    "controller block":
        """controller.enableLook =
  true;""",

    "Gympie/reset buttons":
        """      <button data-radar="08">
        Load Gympie 08
      </button>

      <button id="resetViewButton">
        Reset SEQ view
      </button>""",

    "reset listener":
        """document
  .getElementById(
    "resetViewButton"
  )
  .addEventListener(
    "click",
    () =>
      setInitialSeqView()
  );"""
}

for label, needle in required.items():
    if text.count(needle) != 1:
        raise SystemExit(
            f"ERROR: preflight failed for {label}; "
            f"found {text.count(needle)} copies. No output written."
        )

# V3 label.
text = replace_once(
    text,
    "StormTracker — Doppler Geolocation V2",
    "StormTracker — Doppler Geolocation V3",
    "title"
)

# Replace unrestricted Cesium gesture configuration with deterministic inputs.
text = replace_once(
    text,
    """controller.enableLook =
  true;""",
    """controller.enableLook =
  false;

// IMPORTANT:
// The previous free-camera candidate still accepted every browser wheel,
// pinch and look gesture. On the user's hardware/network environment that
// allows stray trackpad/touch events to keep moving the camera.
//
// V3 keeps direct left-drag map movement, but removes the uncontrolled
// zoom/tilt/look gesture channels. Zoom, heading and pitch are provided by
// explicit buttons below. This preserves a free 3-D camera without a lock.
controller.rotateEventTypes =
  Cesium.CameraEventType.LEFT_DRAG;

controller.zoomEventTypes =
  [];

controller.tiltEventTypes =
  [];

controller.lookEventTypes =
  [];

function stopCameraMotion() {
  viewer.camera.cancelFlight();

  controller.inertiaSpin =
    0;

  controller.inertiaTranslate =
    0;

  controller.inertiaZoom =
    0;

  scene.requestRender();
}

function zoomByFactor(
  factor
) {
  stopCameraMotion();

  const cartographic =
    viewer.camera.positionCartographic;

  const amount =
    Math.max(
      500,
      cartographic.height
      * factor
    );

  if (factor > 0) {
    viewer.camera.zoomOut(
      amount
    );
  } else {
    viewer.camera.zoomIn(
      Math.abs(
        amount
      )
    );
  }

  stopCameraMotion();
}

function rotateHeading(
  degrees
) {
  stopCameraMotion();

  viewer.camera.setView({
    destination:
      Cesium.Cartesian3.clone(
        viewer.camera.positionWC
      ),

    orientation: {
      heading:
        viewer.camera.heading
        + Cesium.Math.toRadians(
            degrees
          ),

      pitch:
        viewer.camera.pitch,

      roll:
        0
    }
  });

  stopCameraMotion();
}

function tiltPitch(
  degrees
) {
  stopCameraMotion();

  const nextPitch =
    Cesium.Math.clamp(
      viewer.camera.pitch
      + Cesium.Math.toRadians(
          degrees
        ),
      Cesium.Math.toRadians(
        -89.5
      ),
      Cesium.Math.toRadians(
        -10
      )
    );

  viewer.camera.setView({
    destination:
      Cesium.Cartesian3.clone(
        viewer.camera.positionWC
      ),

    orientation: {
      heading:
        viewer.camera.heading,

      pitch:
        nextPitch,

      roll:
        0
    }
  });

  stopCameraMotion();
}""",
    "controller block"
)

# Add deterministic camera buttons. No lock button.
text = replace_once(
    text,
    """      <button data-radar="08">
        Load Gympie 08
      </button>

      <button id="resetViewButton">
        Reset SEQ view
      </button>""",
    """      <button data-radar="08">
        Load Gympie 08
      </button>

      <button id="resetViewButton">
        Reset SEQ view
      </button>

      <div
        style="
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:5px;
          margin-top:8px
        "
      >
        <button id="rotateLeftButton">
          Rotate ↺
        </button>

        <button id="tiltUpButton">
          Tilt ↑
        </button>

        <button id="zoomInButton">
          Zoom +
        </button>

        <button id="rotateRightButton">
          Rotate ↻
        </button>

        <button id="tiltDownButton">
          Tilt ↓
        </button>

        <button id="zoomOutButton">
          Zoom −
        </button>
      </div>""",
    "camera buttons"
)

# Add a visible diagnostic note so there is no ambiguity about which input
# scheme is being tested.
status_anchor = """      <div id="status">
        Ready.
      </div>"""

text = replace_once(
    text,
    status_anchor,
    """      <div id="status">
        Ready. V3 camera test: left-drag moves the map; wheel/pinch camera
        input is intentionally disabled; use the explicit zoom/rotate/tilt
        buttons while stability is validated.
      </div>""",
    "status text"
)

# Add button listeners after the Reset listener.
text = replace_once(
    text,
    """document
  .getElementById(
    "resetViewButton"
  )
  .addEventListener(
    "click",
    () =>
      setInitialSeqView()
  );""",
    """document
  .getElementById(
    "resetViewButton"
  )
  .addEventListener(
    "click",
    () => {
      stopCameraMotion();
      setInitialSeqView();
      stopCameraMotion();
    }
  );

document
  .getElementById(
    "rotateLeftButton"
  )
  .addEventListener(
    "click",
    () =>
      rotateHeading(
        -10
      )
  );

document
  .getElementById(
    "rotateRightButton"
  )
  .addEventListener(
    "click",
    () =>
      rotateHeading(
        10
      )
  );

document
  .getElementById(
    "tiltUpButton"
  )
  .addEventListener(
    "click",
    () =>
      tiltPitch(
        7.5
      )
  );

document
  .getElementById(
    "tiltDownButton"
  )
  .addEventListener(
    "click",
    () =>
      tiltPitch(
        -7.5
      )
  );

document
  .getElementById(
    "zoomInButton"
  )
  .addEventListener(
    "click",
    () =>
      zoomByFactor(
        -0.18
      )
  );

document
  .getElementById(
    "zoomOutButton"
  )
  .addEventListener(
    "click",
    () =>
      zoomByFactor(
        0.18
      )
  );""",
    "camera listeners"
)

# Capture and suppress browser wheel/pinch gesture events over the map.
# This is the key difference from V2.
script_anchor = """setInitialSeqView();

const points ="""

text = replace_once(
    text,
    script_anchor,
    """setInitialSeqView();

const cesiumContainer =
  document.getElementById(
    "cesiumContainer"
  );

for (
  const eventName
  of [
    "wheel",
    "mousewheel",
    "DOMMouseScroll",
    "gesturestart",
    "gesturechange",
    "gestureend"
  ]
) {
  cesiumContainer.addEventListener(
    eventName,
    event => {
      if (
        event.cancelable
      ) {
        event.preventDefault();
      }

      event.stopPropagation();
    },
    {
      passive:false,
      capture:true
    }
  );
}

const points =""",
    "input suppression"
)

# Make radar loading stop all camera movement before and after setView.
text = replace_once(
    text,
    """  viewer.camera.cancelFlight();

  viewer.camera.setView({
    destination:""",
    """  stopCameraMotion();

  viewer.camera.setView({
    destination:""",
    "radar camera pre-stop"
)

text = replace_once(
    text,
    """  scene.requestRender();

  $("status").textContent =
    `DOPPLER GEOLOCATION PASS CANDIDATE — ${radar.product}; ` +""",
    """  stopCameraMotion();

  $("status").textContent =
    `DOPPLER GEOLOCATION PASS CANDIDATE — ${radar.product}; ` +""",
    "radar camera post-stop"
)

# Final static self-checks before output.
checks = [
    "StormTracker — Doppler Geolocation V3",
    "controller.zoomEventTypes =\n  [];",
    "controller.tiltEventTypes =\n  [];",
    "controller.lookEventTypes =\n  [];",
    "function stopCameraMotion()",
    "function rotateHeading(",
    "function tiltPitch(",
    'id="zoomInButton"',
    'id="zoomOutButton"',
    'id="rotateLeftButton"',
    'id="rotateRightButton"',
    'id="tiltUpButton"',
    'id="tiltDownButton"',
    '"wheel"',
    "event.preventDefault();"
]

for needle in checks:
    if needle not in text:
        raise SystemExit(
            f"ERROR: final self-check failed for {needle!r}. "
            "No output written."
        )

if "Lock map" in text or "Unlock map" in text:
    raise SystemExit(
        "ERROR: a map-lock control was unexpectedly introduced. "
        "No output written."
    )

TARGET.write_text(
    text,
    encoding="utf-8"
)

print("Generated:")
print("  frontend/doppler-georef-v3.html")
print()
print("STATIC SELF-CHECK: PASS")
print("  • no lock control")
print("  • whole-Earth startup removed")
print("  • camera inertia remains zero")
print("  • wheel/pinch/gesture camera input suppressed")
print("  • left-drag map movement retained")
print("  • explicit zoom / rotate / tilt controls added")
print()
print("Commit and push:")
print("git add frontend/doppler-georef-v3.html")
print(
    'git commit -m "Gate Doppler camera input and remove drift paths"'
)
print("git push")
print()
print("After Pages deploys, open:")
print(
    "https://blakesmith-intel.github.io/StormTracker/"
    "doppler-georef-v3.html"
)
print()
print("Validation:")
print("  1. Do not touch the map for 20 seconds.")
print("  2. It must remain stationary.")
print("  3. Load Mt Stapylton 66.")
print("  4. Do not touch it for another 20 seconds.")
print("  5. It must remain stationary.")
print("  6. Test left-drag, Rotate, Tilt and Zoom buttons.")
print()
print(
    "Do not call this fixed unless all six checks pass."
)
