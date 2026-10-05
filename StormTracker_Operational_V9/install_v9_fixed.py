from pathlib import Path
import hashlib
import shutil
import subprocess
import tempfile

ROOT = Path("/workspaces/StormTracker")
HERE = Path(__file__).resolve().parent
PAYLOADS = HERE / "payloads"
FRONTEND = ROOT / "frontend"
SRC = FRONTEND / "src"
TESTS = FRONTEND / "tests"
SOURCE_JS = SRC / "live3d-core-v8-3.js"
SOURCE_HTML = FRONTEND / "live3d-core-v8-3.html"
SOURCE_WMTS = SRC / "bom-wmts-loop-v1.js"
TARGET_JS = SRC / "live3d-operational-v9.js"
TARGET_HTML = FRONTEND / "live3d-operational-v9.html"
TARGET_WMTS = SRC / "bom-wmts-loop-v2.js"
INDEX = FRONTEND / "index.html"
HELPER = SRC / "operational-loop-v1.js"
HELPER_TEST = TESTS / "run-operational-loop-v1-tests.mjs"
CAMERA = SRC / "stormtracker-camera-v1.js"
TRACKING = SRC / "tracking.js"
ASSESSMENT = SRC / "track-assessment-v2.js"
VALIDATION_SCENARIO = SRC / "christmas-2023-derecho-scenario-v1.js"
VALIDATION_PAGE = FRONTEND / "christmas-2023-derecho-test-v1.html"

STATUS_FUNCTION = 'function setStatus(message, kind = "normal") {\n  $("status").textContent = message;\n\n  $("status").dataset.kind = kind;\n}'
OPERATIONAL_FUNCTIONS = 'function setStatus(message, kind = "normal") {\n  $("status").textContent = message;\n\n  $("status").dataset.kind = kind;\n}\n\nfunction selectedLoopMinutes() {\n  return normaliseLoopMinutes(\n    $("loopDurationMinutes")\n      ?.value\n    ?? 30\n  );\n}\n\nfunction selectedPlaybackSpeed() {\n  return Number(\n    $("playbackSpeed")\n      ?.value\n    ?? 1\n  );\n}\n\nfunction updateLoopButtonLabel() {\n  const minutes =\n    selectedLoopMinutes();\n\n  const button =\n    $("loadHybridButton");\n\n  if (button) {\n    button.textContent =\n      `Load ${minutes}-min storm loop`;\n  }\n\n  const loopWindow =\n    $("operationalLoopWindow");\n\n  if (loopWindow) {\n    loopWindow.textContent =\n      `${minutes} min`;\n  }\n}\n\nfunction sourceAgeText(\n  observedUtc\n) {\n  const epoch =\n    Date.parse(\n      observedUtc\n    );\n\n  if (\n    !Number.isFinite(\n      epoch\n    )\n  ) {\n    return "—";\n  }\n\n  const ageMinutes =\n    (\n      Date.now()\n      - epoch\n    )\n    / 60000;\n\n  if (\n    ageMinutes < -2\n  ) {\n    return "clock anomaly";\n  }\n\n  if (\n    ageMinutes < 1\n  ) {\n    return "<1 min";\n  }\n\n  return `${Math.round(ageMinutes)} min`;\n}\n\nfunction updateOperationalOverview(\n  frame,\n  mode =\n    "sequence"\n) {\n  const sourceMode =\n    $("operationalSourceMode");\n\n  if (sourceMode) {\n    sourceMode.textContent =\n      mode === "latest"\n        ? "Latest frame"\n        : `${selectedLoopMinutes()}-min loop`;\n  }\n\n  const age =\n    $("operationalSourceAge");\n\n  if (age) {\n    age.textContent =\n      frame\n        ? sourceAgeText(\n            frame.observedUtc\n          )\n        : "—";\n  }\n\n  const loaded =\n    $("operationalFramesLoaded");\n\n  if (loaded) {\n    loaded.textContent =\n      String(\n        mode === "latest"\n          ? (\n              frame\n                ? 1\n                : 0\n            )\n          : hybridFrames.length\n      );\n  }\n\n  const result =\n    mode === "sequence"\n      ? hybridResults[\n          hybridFrameIndex\n        ]\n      : null;\n\n  const active =\n    $("operationalActiveTracks");\n\n  if (active) {\n    active.textContent =\n      result\n        ? String(\n            result.active_track_ids\n              ?.length\n            ?? 0\n          )\n        : "—";\n  }\n\n  const doppler =\n    $("operationalDoppler");\n\n  if (doppler) {\n    if (\n      mode !== "sequence"\n    ) {\n      doppler.textContent =\n        "not loaded";\n    } else {\n      const state =\n        dopplerStateForFrame(\n          hybridFrameIndex\n        );\n\n      const matched =\n        state?.pairings\n          ?.filter(\n            pairing =>\n              pairing.matched\n          )\n          .length\n        ?? 0;\n\n      doppler.textContent =\n        `${matched}/3 matched`;\n    }\n  }\n\n  const frameTime =\n    $("operationalFrameTime");\n\n  if (frameTime) {\n    frameTime.textContent =\n      frame?.observedUtc\n        ?.replace(\n          "T",\n          " "\n        )\n        .replace(\n          "Z",\n          " UTC"\n        )\n      ?? "—";\n  }\n}\n\nfunction setAdvancedScienceVisible(\n  visible\n) {\n  for (\n    const section\n    of document.querySelectorAll(\n      ".science-advanced"\n    )\n  ) {\n    section.hidden =\n      !visible;\n  }\n\n  const toggle =\n    $("showAdvancedScience");\n\n  if (toggle) {\n    toggle.checked =\n      Boolean(\n        visible\n      );\n  }\n}'
ASSESSMENT_IMPORT = 'import {\n  buildFootprintRestrictedTrackAssessment\n} from "./track-assessment-v2.js?v=assessment-v2";'
ASSESSMENT_IMPORT_NEW = 'import {\n  buildFootprintRestrictedTrackAssessment\n} from "./track-assessment-v2.js?v=assessment-v2";\n\nimport {\n  frameCountForLoopMinutes,\n  normaliseLoopMinutes,\n  playbackDelayForSpeed\n} from "./operational-loop-v1.js?v=operational-v9";'
LOAD_START_OLD = 'async function loadHybridSequence() {\n  setStatus(\n    "Loading six BOM frames for measured-2D tracking + inferred-3D volume…"\n  );\n\n  await hybridWorker.reset();\n\n  hybridFrames =\n    await loadRecentBomReflectivityMosaics(\n      Date.now(),\n      6,\n      progress => {'
LOAD_START_NEW = 'async function loadHybridSequence() {\n  const loopMinutes =\n    selectedLoopMinutes();\n\n  const requestedFrames =\n    frameCountForLoopMinutes(\n      loopMinutes\n    );\n\n  setStatus(\n    `Loading up to ${requestedFrames} BOM frames for a ${loopMinutes}-minute measured-2D tracking loop + inferred-3D volume…`\n  );\n\n  await hybridWorker.reset();\n\n  hybridFrames =\n    await loadRecentBomReflectivityMosaics(\n      Date.now(),\n      requestedFrames,\n      progress => {'
RESET_ANCHOR = '  hybridResults = [];\n  hybridHistory = new Map();\n  hybridTrackVolumes = [];'
RESET_NEW = '  hybridResults = [];\n  hybridHistory = new Map();\n  hybridTrackVolumes = [];\n\n  $("operationalFramesLoaded").textContent =\n    String(\n      hybridFrames.length\n    );\n\n  $("operationalLoopWindow").textContent =\n    `${loopMinutes} min`;'
SHOW_ANCHOR = '  updateHybridSourceMetrics(\n    frame\n  );\n\n  const sceneFrame ='
SHOW_NEW = '  updateHybridSourceMetrics(\n    frame\n  );\n\n  updateOperationalOverview(\n    frame,\n    "sequence"\n  );\n\n  const sceneFrame ='
LATEST_ANCHOR = '  $("sourceMaximum").textContent =\n    maximumCategory\n      ? (\n          maxLower == null\n            ? `category ${maximumCategory}`\n            : `category ${maximumCategory} (>=${maxLower} dBZ)`\n        )\n      : "none";\n\n  setStatus('
LATEST_NEW = '  $("sourceMaximum").textContent =\n    maximumCategory\n      ? (\n          maxLower == null\n            ? `category ${maximumCategory}`\n            : `category ${maximumCategory} (>=${maxLower} dBZ)`\n        )\n      : "none";\n\n  updateOperationalOverview(\n    frame,\n    "latest"\n  );\n\n  setStatus('
INIT_ANCHOR = '  resetView();\n\n  setStatus(\n    "Prototype model loaded. Press “Load latest inferred 3-D”."\n  );'
INIT_NEW = '  resetView();\n\n  updateLoopButtonLabel();\n\n  setAdvancedScienceVisible(\n    false\n  );\n\n  updateOperationalOverview(\n    null,\n    "latest"\n  );\n\n  setStatus(\n    "Operational V9 ready. Load the latest frame or a 30–180 minute storm loop."\n  );'
LISTENER_ANCHOR = '$("loadHybridButton").addEventListener(\n  "click",\n  () =>\n    loadHybridSequence()\n      .catch(\n        error => {\n          console.error(error);\n\n          setStatus(\n            error.message,\n            "error"\n          );\n        }\n      )\n);'
LISTENER_NEW = '$("loadHybridButton").addEventListener(\n  "click",\n  () =>\n    loadHybridSequence()\n      .catch(\n        error => {\n          console.error(error);\n\n          setStatus(\n            error.message,\n            "error"\n          );\n        }\n      )\n);\n\n$("loopDurationMinutes").addEventListener(\n  "change",\n  () => {\n    updateLoopButtonLabel();\n  }\n);\n\n$("jumpLatestButton").addEventListener(\n  "click",\n  () => {\n    if (\n      hybridFrames.length\n    ) {\n      showHybridFrame(\n        hybridFrames.length - 1\n      )\n        .catch(\n          error =>\n            setStatus(\n              error.message,\n              "error"\n            )\n        );\n\n      return;\n    }\n\n    loadLatest()\n      .catch(\n        error => {\n          console.error(\n            error\n          );\n\n          setStatus(\n            error.message,\n            "error"\n          );\n        }\n      );\n  }\n);\n\n$("showAdvancedScience").addEventListener(\n  "change",\n  event => {\n    setAdvancedScienceVisible(\n      event.target.checked\n    );\n  }\n);'
CSS_ANCHOR = '    .uncertainty-note {\n      margin-top:7px;\n      color:#91a3ad;\n      font-size:10px;\n      line-height:1.4;\n    }'
CSS_NEW = '    .uncertainty-note {\n      margin-top:7px;\n      color:#91a3ad;\n      font-size:10px;\n      line-height:1.4;\n    }\n\n    .operational-control-grid {\n      display:grid;\n      grid-template-columns:1fr 1fr;\n      gap:8px;\n      margin-bottom:8px;\n    }\n\n    .operational-control-grid label {\n      margin:0;\n    }\n\n    .operational-control-grid select {\n      width:100%;\n      margin-top:4px;\n      padding:7px;\n      border:1px solid #4a6575;\n      border-radius:6px;\n      background:#203440;\n      color:#f2f7f9;\n    }\n\n    .science-toggle {\n      display:flex;\n      gap:7px;\n      align-items:center;\n      margin-top:9px;\n      padding-top:8px;\n      border-top:1px solid #2a3942;\n    }\n\n    #jumpLatestButton {\n      width:100%;\n      margin-top:7px;\n    }'
WARNING_END = '    </section>\n\n    <section class="card">\n      <h2>\n        Live source\n      </h2>'
OVERVIEW = '    </section>\n\n    <section class="card">\n      <h2>\n        Operational overview\n      </h2>\n\n      <div class="metric">\n        <span>Display mode</span>\n        <strong id="operationalSourceMode">Latest frame</strong>\n\n        <span>Displayed frame</span>\n        <strong id="operationalFrameTime">—</strong>\n\n        <span>Source age</span>\n        <strong id="operationalSourceAge">—</strong>\n\n        <span>Loop window</span>\n        <strong id="operationalLoopWindow">30 min</strong>\n\n        <span>Frames loaded</span>\n        <strong id="operationalFramesLoaded">0</strong>\n\n        <span>Active ST tracks</span>\n        <strong id="operationalActiveTracks">—</strong>\n\n        <span>Doppler coverage</span>\n        <strong id="operationalDoppler">not loaded</strong>\n      </div>\n\n      <label class="science-toggle">\n        <input\n          id="showAdvancedScience"\n          type="checkbox"\n        >\n        Show advanced 3-D science / validation controls\n      </label>\n    </section>\n\n    <section class="card">\n      <h2>\n        Live source\n      </h2>'
LOOP_BUTTON = '      <button\n        id="loadHybridButton"\n        style="width:100%"\n      >\n        Load 30-min hybrid storm sequence\n      </button>'
LOOP_CONTROLS = '      <div class="operational-control-grid">\n        <label>\n          Loop window\n          <select id="loopDurationMinutes">\n            <option value="30" selected>30 minutes</option>\n            <option value="60">1 hour</option>\n            <option value="90">1.5 hours</option>\n            <option value="120">2 hours</option>\n            <option value="150">2.5 hours</option>\n            <option value="180">3 hours</option>\n          </select>\n        </label>\n\n        <label>\n          Playback speed\n          <select id="playbackSpeed">\n            <option value="0.5">0.5×</option>\n            <option value="1" selected>1×</option>\n            <option value="2">2×</option>\n          </select>\n        </label>\n      </div>\n\n      <button\n        id="loadHybridButton"\n        style="width:100%"\n      >\n        Load 30-min storm loop\n      </button>\n\n      <button\n        id="jumpLatestButton"\n        type="button"\n      >\n        Jump to latest frame\n      </button>\n\n      <div class="uncertainty-note">\n        Selectable in 30-minute increments up to 3 hours using the native\n        5-minute reflectivity cadence. Doppler is shown/analysed only where a\n        time-matched radar frame is available; a stale Doppler frame is never reused.\n      </div>'

required = [
    SOURCE_JS,
    SOURCE_HTML,
    SOURCE_WMTS,
    INDEX,
    CAMERA,
    TRACKING,
    ASSESSMENT,
    VALIDATION_SCENARIO,
    VALIDATION_PAGE,
    PAYLOADS / "frontend/src/operational-loop-v1.js",
    PAYLOADS / "frontend/tests/run-operational-loop-v1-tests.mjs",
]

for path in required:
    if not path.exists():
        raise SystemExit(
            f"ERROR: required file missing: {path}"
        )

def sha256(path):
    return hashlib.sha256(
        path.read_bytes()
    ).hexdigest()

def replace_once(text, old, new, label):
    count = text.count(old)

    if count != 1:
        raise SystemExit(
            f"ERROR: expected exactly one {label}, found {count}. "
            "No Operational V9 files were written."
        )

    return text.replace(old, new, 1)

protected = {
    path: sha256(path)
    for path in [
        CAMERA,
        TRACKING,
        ASSESSMENT,
        VALIDATION_SCENARIO,
        VALIDATION_PAGE,
    ]
}

print("StormTracker — Operational V9 consolidation")
print()
print("No tracking/scoring/science algorithm changes.")
print("Adding 30–180 minute loops, playback controls, operational summary and UI consolidation.")
print()

shutil.copy2(
    PAYLOADS / "frontend/src/operational-loop-v1.js",
    HELPER
)

shutil.copy2(
    PAYLOADS / "frontend/tests/run-operational-loop-v1-tests.mjs",
    HELPER_TEST
)

subprocess.run(
    ["node", "--check", str(HELPER)],
    check=True
)

subprocess.run(
    ["node", "frontend/tests/run-operational-loop-v1-tests.mjs"],
    cwd=ROOT,
    check=True
)

# Build WMTS loop V2 with dynamic candidate horizon.
wmts = SOURCE_WMTS.read_text(encoding="utf-8")

wmts = replace_once(
    wmts,
    "  for (const observedUtc of candidateBomReflectivityTimes(now, 14)) {",
    (
      "  const probeCount =\n"
      "    Math.max(\n"
      "      14,\n"
      "      Number(count) + 8\n"
      "    );\n\n"
      "  for (\n"
      "    const observedUtc\n"
      "    of candidateBomReflectivityTimes(\n"
      "      now,\n"
      "      probeCount\n"
      "    )\n"
      "  ) {"
    ),
    "fixed recent-frame probe horizon"
)

with tempfile.NamedTemporaryFile(
    mode="w",
    suffix=".mjs",
    encoding="utf-8",
    delete=False
) as tmp:
    tmp.write(wmts)
    staged_wmts = Path(tmp.name)

try:
    subprocess.run(
        ["node", "--check", str(staged_wmts)],
        check=True
    )
finally:
    staged_wmts.unlink(missing_ok=True)

# Build Operational V9 JS from V8.3.
js = SOURCE_JS.read_text(encoding="utf-8")

js = replace_once(
    js,
    '} from "./bom-wmts-loop-v1.js?v=hybrid-v1";',
    '} from "./bom-wmts-loop-v2.js?v=operational-v9";',
    "reflectivity-loop import"
)

js = replace_once(
    js,
    ASSESSMENT_IMPORT,
    ASSESSMENT_IMPORT_NEW,
    "operational helper import"
)

js = replace_once(
    js,
    STATUS_FUNCTION,
    OPERATIONAL_FUNCTIONS,
    "operational helper functions"
)

js = replace_once(
    js,
    "      await hybridDelay(650);",
    (
      "      await hybridDelay(\n"
      "        playbackDelayForSpeed(\n"
      "          selectedPlaybackSpeed()\n"
      "        )\n"
      "      );"
    ),
    "fixed playback delay"
)

js = replace_once(
    js,
    LOAD_START_OLD,
    LOAD_START_NEW,
    "fixed six-frame loop loader"
)

js = replace_once(
    js,
    RESET_ANCHOR,
    RESET_NEW,
    "operational loop metrics"
)

js = replace_once(
    js,
    SHOW_ANCHOR,
    SHOW_NEW,
    "per-frame operational overview"
)

js = replace_once(
    js,
    LATEST_ANCHOR,
    LATEST_NEW,
    "latest-frame operational overview"
)

js = replace_once(
    js,
    INIT_ANCHOR,
    INIT_NEW,
    "operational initialisation"
)

js = replace_once(
    js,
    LISTENER_ANCHOR,
    LISTENER_NEW,
    "operational event listeners"
)

for required_text in [
    './track-assessment-v2.js?v=assessment-v2',
    './stormtracker-camera-v1.js?v=camera-v1.1-wheel',
    'loadRecentBomReflectivityMosaics',
    'buildTrackDopplerContexts',
    'frameCountForLoopMinutes',
    'jumpLatestButton',
    'showAdvancedScience',
]:
    if required_text not in js:
        raise SystemExit(
            f"ERROR: generated Operational V9 missing {required_text!r}."
        )

with tempfile.NamedTemporaryFile(
    mode="w",
    suffix=".mjs",
    encoding="utf-8",
    delete=False
) as tmp:
    tmp.write(js)
    staged_js = Path(tmp.name)

try:
    subprocess.run(
        ["node", "--check", str(staged_js)],
        check=True
    )
finally:
    staged_js.unlink(missing_ok=True)

print("Generated Operational V9 JavaScript syntax: PASS")

# Build Operational V9 HTML.
html = SOURCE_HTML.read_text(encoding="utf-8")

html = replace_once(
    html,
    "StormTracker — Hybrid Storm Volume Core V8.3",
    "StormTracker — Operational V9",
    "live page title"
)

html = replace_once(
    html,
    "      StormTracker Live 3-D",
    "      StormTracker",
    "live page heading"
)

html = replace_once(
    html,
    "      measured 2-D storm masks • persistent ST identities • track-specific inferred vertical volumes • corrected Web Mercator registration • core V5",
    "      operational live weather • measured 2-D ST tracking • inferred 3-D • time-matched Doppler",
    "live page subtitle"
)

html = replace_once(
    html,
    CSS_ANCHOR,
    CSS_NEW,
    "operational CSS"
)

html = replace_once(
    html,
    WARNING_END,
    OVERVIEW,
    "operational overview card"
)

html = replace_once(
    html,
    "        Load latest inferred 3-D",
    "        Refresh latest live frame",
    "latest-frame button label"
)

for heading in [
    "Inference controls",
    "Current inferred volume",
    "Vertical uncertainty display",
    "Five-event cross-validation",
]:
    old = (
        '    <section class="card">\n'
        '      <h2>\n'
        f'        {heading}\n'
        '      </h2>'
    )

    new = (
        '    <section class="card science-advanced" hidden>\n'
        '      <h2>\n'
        f'        {heading}\n'
        '      </h2>'
    )

    html = replace_once(
        html,
        old,
        new,
        f"advanced section {heading}"
    )

html = replace_once(
    html,
    "        Hybrid storm sequence",
    "        Live storm loop",
    "loop card heading"
)

html = replace_once(
    html,
    LOOP_BUTTON,
    LOOP_CONTROLS,
    "operational loop controls"
)

html = replace_once(
    html,
    "        Play once",
    "        Play loop once",
    "playback button label"
)

html = replace_once(
    html,
    'src="./src/live3d-core-v8-3.js"',
    'src="./src/live3d-operational-v9.js"',
    "Operational V9 script reference"
)

# Main shell: Live mode -> V9. Historical validation target must stay intact.
index = INDEX.read_text(encoding="utf-8")

index = replace_once(
    index,
    'src="./live3d-core-v8-3.html"',
    'src="./live3d-operational-v9.html"',
    "main product live iframe target"
)

if 'data-src="./christmas-2023-derecho-test-v1.html"' not in index:
    raise SystemExit(
        "ERROR: historical validation iframe target disappeared."
    )

# Write only after all generation checks passed.
TARGET_WMTS.write_text(wmts, encoding="utf-8")
TARGET_JS.write_text(js, encoding="utf-8")
TARGET_HTML.write_text(html, encoding="utf-8")
INDEX.write_text(index, encoding="utf-8")

for path, before in protected.items():
    if sha256(path) != before:
        raise SystemExit(
            f"ERROR: protected production file changed unexpectedly: {path}"
        )

print("Tracking, scoring, camera and historical validation unchanged: PASS")
print()

subprocess.run(
    ["node", "frontend/tests/run-operational-loop-v1-tests.mjs"],
    cwd=ROOT,
    check=True
)

subprocess.run(
    ["node", "frontend/tests/run-christmas-2023-regression-v1-tests.mjs"],
    cwd=ROOT,
    check=True
)

subprocess.run(
    ["node", "frontend/tests/run-christmas-2023-derecho-scenario-v1-tests.mjs"],
    cwd=ROOT,
    check=True
)

subprocess.run(
    ["node", "frontend/tests/run-node-tests.mjs"],
    cwd=ROOT,
    check=True
)

subprocess.run(
    ["node", "frontend/tests/run-stormtracker-camera-v1-tests.mjs"],
    cwd=ROOT,
    check=True
)

print()
print("SUCCESS — StormTracker Operational V9 installed.")
print()
print("Expected:")
print("  10 operational-loop contract tests passed.")
print("  12 main-product historical-regression contract tests passed.")
print("  18 Christmas 2023 severe-storm tracking scenario tests passed.")
print("  14 tests passed.")
print("  11 shared camera controller tests passed.")
print()
print("No relay deployment is required.")
print()
print("Commit/push:")
print(
    "git add "
    "frontend/index.html "
    "frontend/src/bom-wmts-loop-v2.js "
    "frontend/src/operational-loop-v1.js "
    "frontend/tests/run-operational-loop-v1-tests.mjs "
    "frontend/src/live3d-operational-v9.js "
    "frontend/live3d-operational-v9.html"
)
print(
    'git commit -m "Consolidate Operational V9 UI and live loop controls"'
)
print("git push")
print()
print("After Pages deploys, open the normal StormTracker root.")
