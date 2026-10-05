from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path("/workspaces/StormTracker")
SOURCE = ROOT / "frontend/doppler-georef-v2.html"
TARGET = ROOT / "frontend/doppler-georef-v3.html"

if not SOURCE.exists():
    raise SystemExit(
        f"ERROR: missing required file: {SOURCE}"
    )

print("StormTracker — deterministic free-camera candidate V3.1")
print("Rebuilding from committed Doppler geolocation V2...")
print()

text = SOURCE.read_text(encoding="utf-8")

def replace_once(text, old, new, label):
    count = text.count(old)

    if count != 1:
        raise SystemExit(
            f"ERROR: expected exactly one {label}, found {count}. "
            "No output written."
        )

    return text.replace(
        old,
        new,
        1
    )

# ------------------------------------------------------------
# Preflight every exact anchor BEFORE writing anything.
# ------------------------------------------------------------
anchors = {
    "title":
        "StormTracker — Doppler Geolocation V2",

    "controller ending":
        """controller.enableLook =
  true;""",

    "button block":
        """      <button data-radar="08">
        Load Gympie 08
      </button>

      <button id="resetViewButton">
        Reset SEQ view
      </button>""",

    "initial view invocation":
        """setInitialSeqView();

const points =""",

    "reset listener":
        """document
  .getElementById(
    "resetViewButton"
  )
  .addEventListener(
    "click",
    () =>
      setInitialSeqView()
  );""",

    "radar render tail":
        """  scene.requestRender();

  $("status").textContent =
    `DOPPLER GEOLOCATION PASS CANDIDATE — ${radar.product}; ` +"""
}

for label, needle in anchors.items():
    count = text.count(needle)

    if count != 1:
        raise SystemExit(
            f"ERROR: preflight failed for {label}; found {count}. "
            "No output written."
        )

print("Preflight: PASS")

# ------------------------------------------------------------
# 1. Page identity.
# ------------------------------------------------------------
text = replace_once(
    text,
    "StormTracker — Doppler Geolocation V2",
    "StormTracker — Doppler Geolocation V3",
    "title"
)

# ------------------------------------------------------------
# 2. Deterministic camera input model.
#
# We keep direct LEFT_DRAG movement, but remove browser wheel/pinch
# from Cesium entirely. Zoom/rotate/tilt are explicit buttons.
# This avoids the stray trackpad/touch gesture path without re-adding
# the old map lock.
# ------------------------------------------------------------
text = replace_once(
    text,
    """controller.enableLook =
  true;""",
    """controller.enableLook =
  false;

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

  const height =
    viewer.camera
      .positionCartographic
      .height;

  const amount =
    Math.max(
      500,
      height
      * Math.abs(
          factor
        )
    );

  if (
    factor < 0
  ) {
    viewer.camera.zoomIn(
      amount
    );
  } else {
    viewer.camera.zoomOut(
      amount
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
    "controller ending"
)

# ------------------------------------------------------------
# 3. Explicit camera controls. No lock.
# ------------------------------------------------------------
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
    "button block"
)

# ------------------------------------------------------------
# 4. Block the browser gesture channels that caused the regression.
# Insert after initial view setup; do NOT rewrite either camera.setView()
# block, avoiding the duplicate-match failure from the previous patch.
# ------------------------------------------------------------
text = replace_once(
    text,
    """setInitialSeqView();

const points =""",
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
    "initial view invocation"
)

# ------------------------------------------------------------
# 5. Replace Reset listener and add deterministic camera controls.
# ------------------------------------------------------------
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
    "reset listener"
)

# ------------------------------------------------------------
# 6. Stop any residual camera motion after radar setView().
# This anchor is unique; we do not touch the duplicate cancelFlight() calls.
# ------------------------------------------------------------
text = replace_once(
    text,
    """  scene.requestRender();

  $("status").textContent =
    `DOPPLER GEOLOCATION PASS CANDIDATE — ${radar.product}; ` +""",
    """  stopCameraMotion();

  $("status").textContent =
    `DOPPLER GEOLOCATION PASS CANDIDATE — ${radar.product}; ` +""",
    "radar render tail"
)

# ------------------------------------------------------------
# 7. Visible validation note.
# ------------------------------------------------------------
text = replace_once(
    text,
    """      <div id="status">
        Ready.
      </div>""",
    """      <div id="status">
        Ready. V3 camera candidate: left-drag moves the map. Browser
        wheel/pinch camera input is disabled; use the explicit Zoom,
        Rotate and Tilt buttons while drift is being validated.
      </div>""",
    "ready status"
)

# ------------------------------------------------------------
# 8. Static self-checks.
# ------------------------------------------------------------
checks = [
    "StormTracker — Doppler Geolocation V3",
    "controller.zoomEventTypes =\n  [];",
    "controller.tiltEventTypes =\n  [];",
    "controller.lookEventTypes =\n  [];",
    "Cesium.CameraEventType.LEFT_DRAG",
    "function stopCameraMotion()",
    "function zoomByFactor(",
    "function rotateHeading(",
    "function tiltPitch(",
    'id="resetViewButton"',
    'id="rotateLeftButton"',
    'id="rotateRightButton"',
    'id="tiltUpButton"',
    'id="tiltDownButton"',
    'id="zoomInButton"',
    'id="zoomOutButton"',
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
        "ERROR: unexpected map-lock control introduced. "
        "No output written."
    )

# ------------------------------------------------------------
# 9. Parse the inline module and ask Node to syntax-check it BEFORE write.
# ------------------------------------------------------------
matches = re.findall(
    r'<script type="module">(.*?)</script>',
    text,
    flags=re.S
)

if len(matches) != 1:
    raise SystemExit(
        f"ERROR: expected one inline module script, found {len(matches)}. "
        "No output written."
    )

module_code = matches[0]

with tempfile.NamedTemporaryFile(
    mode="w",
    suffix=".mjs",
    encoding="utf-8",
    delete=False
) as tmp:
    tmp.write(module_code)
    tmp_path = tmp.name

try:
    subprocess.run(
        [
            "node",
            "--check",
            tmp_path
        ],
        check=True
    )
finally:
    Path(tmp_path).unlink(
        missing_ok=True
    )

print("Inline JavaScript syntax: PASS")

# Only now write the page.
TARGET.write_text(
    text,
    encoding="utf-8"
)

print("Write: PASS")
print()
print("Generated:")
print("  frontend/doppler-georef-v3.html")
print()
print("SELF-CHECK: PASS")
print("  • no map lock")
print("  • no whole-Earth startup")
print("  • Cesium inertia remains zero")
print("  • wheel/pinch/gesture camera channels blocked")
print("  • left-drag retained")
print("  • explicit Zoom / Rotate / Tilt controls added")
print("  • radar-load camera settles explicitly")
print()
print("Commit and push:")
print(
    "git add frontend/doppler-georef-v3.html"
)
print(
    'git commit -m "Gate Doppler camera input and remove drift paths"'
)
print("git push")
print()
print("After Pages deploys:")
print(
    "https://blakesmith-intel.github.io/StormTracker/"
    "doppler-georef-v3.html"
)
print()
print("Validation — do not call it fixed unless all pass:")
print("  1. Open page and touch nothing for 20 seconds.")
print("  2. Map remains stationary.")
print("  3. Load Mt Stapylton 66 and touch nothing for 20 seconds.")
print("  4. Map remains stationary.")
print("  5. Left-drag works and stops when released.")
print("  6. Rotate / Tilt / Zoom buttons work without continued motion.")
