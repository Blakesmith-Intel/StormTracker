from pathlib import Path
import subprocess

ROOT = Path("/workspaces/StormTracker")
CAMERA = ROOT / "frontend/src/stormtracker-camera-v1.js"
DOPPLER = ROOT / "frontend/doppler-georef-v5.html"
TEST = ROOT / "frontend/tests/run-stormtracker-camera-v1-tests.mjs"

for path in [CAMERA, DOPPLER, TEST]:
    if not path.exists():
        raise SystemExit(
            f"ERROR: missing required file: {path}"
        )

print("StormTracker — shared camera wheel-step refinement V1.1")
print()

camera = CAMERA.read_text(encoding="utf-8")

def replace_once(text, old, new, label):
    count = text.count(old)

    if count != 1:
        raise SystemExit(
            f"ERROR: expected exactly one {label}, found {count}. "
            "No file has been changed."
        )

    return text.replace(old, new, 1)

insert_anchor = '''export function zoomStateByDirection(
  state,
  direction,
  {
    zoomInFactor = 0.82,
    zoomOutFactor = 1.22,
    minimumRange = 800,
    maximumRange = 5000000
  } = {}
) {'''

helper = '''export function classifyWheelDelta(
  deltaY,
  deltaMode = 0
) {
  const value =
    Number(
      deltaY
    );

  if (
    !Number.isFinite(
      value
    )
    || value === 0
  ) {
    return {
      mode:"none",
      steps:0
    };
  }

  const direction =
    value < 0
      ? -1
      : 1;

  const magnitude =
    Math.abs(
      value
    );

  if (
    deltaMode === 1
  ) {
    return {
      mode:"discrete",
      steps:
        direction
        * Math.max(
            1,
            Math.min(
              6,
              Math.round(
                magnitude / 3
              )
            )
          )
    };
  }

  if (
    deltaMode === 2
  ) {
    return {
      mode:"discrete",
      steps:
        direction
    };
  }

  if (
    magnitude >= 80
  ) {
    return {
      mode:"discrete",
      steps:
        direction
        * Math.max(
            1,
            Math.min(
              6,
              Math.round(
                magnitude / 100
              )
            )
          )
    };
  }

  return {
    mode:"smooth",
    steps:
      direction
  };
}

'''

if camera.count(insert_anchor) != 1:
    raise SystemExit(
        "ERROR: zoom helper insertion anchor changed. "
        "No file has been changed."
    )

camera = camera.replace(
    insert_anchor,
    helper + insert_anchor,
    1
)

old_wheel = '''  function onWheel(event) {
    event.preventDefault();
    event.stopPropagation();

    // One zoom step per wheel/trackpad gesture.
    // Momentum events extend the quiet period but do not keep zooming.
    if (!wheelGestureOpen) {
      wheelGestureOpen = true;

      zoomDirection(
        event.deltaY < 0
          ? -1
          : 1
      );
    }

    closeWheelGestureLater();
  }'''

new_wheel = '''  function onWheel(event) {
    event.preventDefault();
    event.stopPropagation();

    const wheel =
      classifyWheelDelta(
        event.deltaY,
        event.deltaMode
      );

    if (
      wheel.mode
      === "none"
    ) {
      return;
    }

    if (
      wheel.mode
      === "discrete"
    ) {
      const direction =
        wheel.steps < 0
          ? -1
          : 1;

      for (
        let index = 0;
        index < Math.abs(
          wheel.steps
        );
        index++
      ) {
        zoomDirection(
          direction
        );
      }

      wheelGestureOpen =
        false;

      if (
        wheelQuietTimer
      ) {
        clearTimeout(
          wheelQuietTimer
        );

        wheelQuietTimer =
          null;
      }

      return;
    }

    if (
      !wheelGestureOpen
    ) {
      wheelGestureOpen =
        true;

      zoomDirection(
        wheel.steps
      );
    }

    closeWheelGestureLater();
  }'''

camera = replace_once(
    camera,
    old_wheel,
    new_wheel,
    "wheel handler"
)

for needle in [
    "export function classifyWheelDelta(",
    'mode:"discrete"',
    'mode:"smooth"',
    "magnitude >= 80",
    "wheel.mode\n      === \"discrete\""
]:
    if needle not in camera:
        raise SystemExit(
            f"ERROR: internal wheel refinement check failed: {needle!r}. "
            "No file has been changed."
        )

test = TEST.read_text(encoding="utf-8")

import_old = '''import {
  orbitStateByPixels,
  panTargetByScreenPixels,
  zoomStateByDirection
} from "../src/stormtracker-camera-v1.js";'''

import_new = '''import {
  classifyWheelDelta,
  orbitStateByPixels,
  panTargetByScreenPixels,
  zoomStateByDirection
} from "../src/stormtracker-camera-v1.js";'''

test = replace_once(
    test,
    import_old,
    import_new,
    "camera test import"
)

console_line = '''console.log(
  "7 shared camera controller tests passed."
);'''

test_append = '''

assert.deepEqual(
  classifyWheelDelta(
    -100,
    0
  ),
  {
    mode:"discrete",
    steps:-1
  }
);

assert.deepEqual(
  classifyWheelDelta(
    100,
    0
  ),
  {
    mode:"discrete",
    steps:1
  }
);

assert.deepEqual(
  classifyWheelDelta(
    200,
    0
  ),
  {
    mode:"discrete",
    steps:2
  }
);

assert.deepEqual(
  classifyWheelDelta(
    15,
    0
  ),
  {
    mode:"smooth",
    steps:1
  }
);

console.log(
  "11 shared camera controller tests passed."
);'''

test = replace_once(
    test,
    console_line,
    test_append,
    "camera test footer"
)

doppler = DOPPLER.read_text(encoding="utf-8")

doppler = replace_once(
    doppler,
    './src/stormtracker-camera-v1.js?v=camera-v1',
    './src/stormtracker-camera-v1.js?v=camera-v1.1-wheel',
    "Doppler shared-camera cache key"
)

old_mode = '''Camera mode: SHARED CUSTOM MOUSE V1. Left-drag pans; right-drag
      rotates/tilts; Shift+left-drag or middle-drag tilts; wheel zooms one
      deterministic step per gesture. Native Cesium camera input remains
      disabled. There is no map-lock toggle.'''

new_mode = '''Camera mode: SHARED CUSTOM MOUSE V1.1. Left-drag pans;
      right-drag rotates/tilts; Shift+left-drag or middle-drag tilts.
      Each discrete mouse-wheel notch produces one zoom step; smooth trackpad
      input remains momentum-suppressed. Native Cesium camera input stays
      disabled. There is no map-lock toggle.'''

doppler = replace_once(
    doppler,
    old_mode,
    new_mode,
    "Doppler camera-mode note"
)

CAMERA.write_text(
    camera,
    encoding="utf-8"
)

TEST.write_text(
    test,
    encoding="utf-8"
)

DOPPLER.write_text(
    doppler,
    encoding="utf-8"
)

print("Checking JavaScript syntax...")

subprocess.run(
    [
        "node",
        "--check",
        "frontend/src/stormtracker-camera-v1.js"
    ],
    cwd=ROOT,
    check=True
)

print()
print("Running shared camera tests...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-stormtracker-camera-v1-tests.mjs"
    ],
    cwd=ROOT,
    check=True
)

print()
print("Running existing StormTracker tests...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-node-tests.mjs"
    ],
    cwd=ROOT,
    check=True
)

print()
print("SUCCESS")
print("Expected:")
print("  11 shared camera controller tests passed.")
print("  14 tests passed.")
print()
print("Commit and push:")
print(
    "git add "
    "frontend/src/stormtracker-camera-v1.js "
    "frontend/doppler-georef-v5.html "
    "frontend/tests/run-stormtracker-camera-v1-tests.mjs"
)
print(
    'git commit -m "Align shared camera zoom with mouse wheel notches"'
)
print("git push")
print()
print("After Pages deploys, reload:")
print(
    "https://blakesmith-intel.github.io/StormTracker/"
    "doppler-georef-v5.html"
)
print()
print("Expected wheel behaviour:")
print("  one wheel notch forward  = one zoom-in step")
print("  one wheel notch backward = one zoom-out step")
print("  rapid wheel notches      = matching number of zoom steps")
print("  smooth trackpad motion   = one step per gesture, momentum suppressed")
print()
print(
    "This modifies the SHARED camera module, not a Doppler-only controller. "
    "Once confirmed, every active StormTracker Cesium view should import "
    "this exact controller."
)
