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
RELAY = ROOT / "relay"
V7_JS = SRC / "live3d-core-v7.js"
V7_HTML = FRONTEND / "live3d-core-v7.html"
V8_JS = SRC / "live3d-core-v8.js"
V8_HTML = FRONTEND / "live3d-core-v8.html"
CAMERA = SRC / "stormtracker-camera-v1.js"

OLD_IMPORT_INTAKE = 'import {\n  loadDopplerDiagnostic\n} from "./bom-doppler-intake-v2.js?v=product-time-v1";'
NEW_IMPORT_INTAKE = 'import {\n  loadDopplerDiagnostic,\n  loadDopplerFrame,\n  loadDopplerHistory,\n  nearestDopplerFrameForTime\n} from "./bom-doppler-intake-v3.js?v=per-frame-v1";'
OLD_IMPORT_SPATIAL = 'import {\n  decodeGeoreferencedDoppler,\n  geolocatedDopplerSamples\n} from "./bom-doppler-spatial-v1.js?v=track-context-v1";'
NEW_IMPORT_SPATIAL = 'import {\n  geolocatedHistoricalDopplerSamples,\n  paletteFromLatestDopplerImage\n} from "./bom-doppler-history-spatial-v1.js?v=history-spatial-v1";'
OLD_STATE = 'let hybridDopplerContext =\n  null;\n\nlet hybridDopplerLoadedForFrame =\n  null;\n\nlet latestDopplerRecords =\n  [];\n\nlet dopplerOverlayCollection =\n  null;'
NEW_STATE = 'let hybridDopplerFrameStates =\n  [];\n\nlet dopplerHistories =\n  new Map();\n\nlet dopplerPalettes =\n  new Map();\n\nlet dopplerFrameCache =\n  new Map();\n\nlet dopplerOverlayCollection =\n  null;'
DOPPLER_START = 'async function loadOneDopplerRecord(\n  radarId\n) {'
DOPPLER_END = 'function formatSignedKmh(\n  value\n) {'
OLD_TRACK_SUMMARY = '      const dopplerSummary =\n        primaryDoppler\n          ? (\n              `Doppler ${primaryDoppler.radar_id}: ` +\n              `${formatSignedKmh(primaryDoppler.strongest_toward_kmh)} toward / ` +\n              `${formatSignedKmh(primaryDoppler.strongest_away_kmh)} away; ` +\n              `span ${\n                primaryDoppler.radial_span_kmh == null\n                  ? "—"\n                  : `${primaryDoppler.radial_span_kmh.toFixed(0)} km/h`\n              }; ${primaryDoppler.sample_count} footprint samples`\n            )\n          : (\n              index === hybridFrames.length - 1\n                ? "Doppler — no time-matched non-zero samples in this measured footprint"\n                : "Doppler — latest frame only"\n            );'
NEW_TRACK_SUMMARY = '      const dopplerSummary =\n        primaryDoppler\n          ? (\n              `Doppler ${primaryDoppler.radar_id}: ` +\n              `${formatSignedKmh(primaryDoppler.strongest_toward_kmh)} toward / ` +\n              `${formatSignedKmh(primaryDoppler.strongest_away_kmh)} away; ` +\n              `span ${\n                primaryDoppler.radial_span_kmh == null\n                  ? "—"\n                  : `${primaryDoppler.radial_span_kmh.toFixed(0)} km/h`\n              }; ${primaryDoppler.sample_count} footprint samples`\n            )\n          : "Doppler — no time-matched non-zero samples in this measured footprint";'
OLD_SHOW = '  renderHybridTracks(\n    hybridFrameIndex\n  );\n\n  renderDopplerOverlay();\n\n  updateHybridSourceMetrics('
NEW_SHOW = '  renderHybridTracks(\n    hybridFrameIndex\n  );\n\n  updateDopplerUiForFrame(\n    hybridFrameIndex\n  );\n\n  updateHybridSourceMetrics('
OLD_RESET = '  hybridDopplerContext =\n    null;\n\n  hybridDopplerLoadedForFrame =\n    null;\n\n  latestDopplerRecords =\n    [];\n\n  clearDopplerOverlay();'
NEW_RESET = '  hybridDopplerFrameStates =\n    [];\n\n  dopplerHistories =\n    new Map();\n\n  dopplerPalettes =\n    new Map();\n\n  dopplerFrameCache =\n    new Map();\n\n  clearDopplerOverlay();'
OLD_LOAD = '  setStatus(\n    "Tracking complete. Loading current public Doppler from 66 / 50 / 08 and matching it to the latest measured storm footprints…"\n  );\n\n  try {\n    await loadLatestTrackDopplerContext();\n  } catch (error) {\n    console.warn(\n      "Doppler track context unavailable",\n      error\n    );\n\n    hybridDopplerContext =\n      null;\n\n    hybridDopplerLoadedForFrame =\n      null;\n\n    $("dopplerRadarsLoaded").textContent =\n      "0";\n\n    $("dopplerRadarsMatched").textContent =\n      "0";\n\n    $("dopplerTracksMatched").textContent =\n      "0";\n\n    $("dopplerFailures").textContent =\n      "3";\n  }'
NEW_LOAD = '  setStatus(\n    "Tracking complete. Loading timestamped BOM Doppler history for 66 / 50 / 08 and pairing every reflectivity frame independently…"\n  );\n\n  try {\n    await buildDopplerSequence();\n  } catch (error) {\n    console.warn(\n      "Per-frame Doppler sequence unavailable",\n      error\n    );\n\n    hybridDopplerFrameStates =\n      [];\n\n    $("dopplerRadarsLoaded").textContent =\n      "0";\n\n    $("dopplerRadarsMatched").textContent =\n      "0";\n\n    $("dopplerTracksMatched").textContent =\n      "0";\n\n    $("dopplerFailures").textContent =\n      "3";\n  }'
OLD_FINAL = '    `Latest-frame Doppler is footprint-matched radial-velocity context only and does not create or move ST tracks.`,\n    "ok"\n  );'
NEW_FINAL = '    `Each reflectivity frame is independently paired to the nearest available Doppler frame for 66 / 50 / 08; ` +\n    `Doppler remains footprint-matched radial-velocity context only and does not create or move ST tracks.`,\n    "ok"\n  );'
OLD_NOTE = '        The visible overlay is display-only and shows exact decoded non-zero\n        radial-velocity palette pixels. Analysis remains restricted to pixels\n        intersecting measured ST reflectivity footprints.'
NEW_NOTE = '        The visible overlay follows the selected reflectivity sequence frame.\n        Each radar is independently paired to its nearest timestamped BOM Doppler\n        frame and rejected when the nearest scan is more than 8 minutes away.\n        Analysis remains restricted to pixels intersecting measured ST footprints.'
OLD_PLACEHOLDER = '          Load the hybrid sequence to retrieve product timestamps for\n          radars 66, 50 and 08.'
NEW_PLACEHOLDER = '          Load the hybrid sequence to retrieve timestamped Doppler history\n          for radars 66, 50 and 08.'

def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"ERROR: expected exactly one {label}; found {count}. "
            "No Core V8 files were written."
        )
    return text.replace(old, new, 1)

def replace_between_keep_end(text, start_marker, end_marker, replacement, label):
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(
            f"ERROR: missing start marker for {label}. "
            "No Core V8 files were written."
        )

    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(
            f"ERROR: missing end marker for {label}. "
            "No Core V8 files were written."
        )

    return text[:start] + replacement + text[end:]

required = [
    V7_JS,
    V7_HTML,
    CAMERA,
    SRC / "bom-doppler-decoder-v1.js",
    SRC / "bom-doppler-georef-v1.js",
    SRC / "track-doppler-context-v1.js",
    RELAY / "doppler-time-v1.js",
    PAYLOADS / "relay/doppler-history-v1.js",
    PAYLOADS / "relay/worker.js",
    PAYLOADS / "frontend/src/bom-doppler-intake-v3.js",
    PAYLOADS / "frontend/src/bom-doppler-history-spatial-v1.js",
    PAYLOADS / "frontend/tests/run-doppler-history-v1-tests.mjs",
    PAYLOADS / "frontend/tests/run-doppler-history-spatial-v1-tests.mjs",
    PAYLOADS / "core-doppler-block-v8.js",
]

for path in required:
    if not path.exists():
        raise SystemExit(f"ERROR: missing required file: {path}")

print("StormTracker — clean Core V8 per-frame Doppler pairing")
print("Building V8 from known-good V7; camera file will not be modified.")
print()

camera_hash_before = sha256(CAMERA)

js = V7_JS.read_text(encoding="utf-8")
html = V7_HTML.read_text(encoding="utf-8")
doppler_block = (PAYLOADS / "core-doppler-block-v8.js").read_text(encoding="utf-8")

js = replace_once(js, OLD_IMPORT_INTAKE, NEW_IMPORT_INTAKE, "V7 Doppler intake import")
js = replace_once(js, OLD_IMPORT_SPATIAL, NEW_IMPORT_SPATIAL, "V7 Doppler spatial import")
js = replace_once(js, OLD_STATE, NEW_STATE, "V7 Doppler state")

js = replace_between_keep_end(
    js,
    DOPPLER_START,
    DOPPLER_END,
    doppler_block,
    "V7 latest-only Doppler implementation"
)

js = replace_once(js, OLD_TRACK_SUMMARY, NEW_TRACK_SUMMARY, "V7 track Doppler summary")
js = replace_once(js, OLD_SHOW, NEW_SHOW, "V7 per-frame Doppler display call")
js = replace_once(js, OLD_RESET, NEW_RESET, "V7 Doppler sequence reset")
js = replace_once(js, OLD_LOAD, NEW_LOAD, "V7 latest-only Doppler loader")
js = replace_once(js, OLD_FINAL, NEW_FINAL, "V7 completion status")

html = replace_once(
    html,
    "StormTracker — Hybrid Storm Volume Core V7",
    "StormTracker — Hybrid Storm Volume Core V8",
    "V7 page title"
)
html = replace_once(
    html,
    "Live Doppler track context",
    "Per-frame Doppler track context",
    "V7 Doppler heading"
)
html = replace_once(
    html,
    "Show latest Doppler overlay",
    "Show time-matched Doppler overlay",
    "V7 overlay label"
)
html = replace_once(html, OLD_NOTE, NEW_NOTE, "V7 Doppler note")
html = replace_once(html, OLD_PLACEHOLDER, NEW_PLACEHOLDER, "V7 Doppler placeholder")
html = replace_once(
    html,
    'src="./src/live3d-core-v7.js"',
    'src="./src/live3d-core-v8.js"',
    "V7 script reference"
)

if './stormtracker-camera-v1.js?v=camera-v1.1-wheel' not in js:
    raise SystemExit(
        "ERROR: validated shared camera import missing. "
        "No Core V8 files were written."
    )

for forbidden in [
    "latest sequence frame only",
    "Doppler — latest frame only",
    "loadLatestTrackDopplerContext",
    "latestDopplerRecords",
    "hybridDopplerLoadedForFrame",
]:
    if forbidden in js:
        raise SystemExit(
            f"ERROR: generated V8 still contains latest-only logic: {forbidden}. "
            "No Core V8 files were written."
        )

for required_name in [
    "hybridDopplerFrameStates",
    "buildDopplerSequence",
    "nearestDopplerFrameForTime",
    "updateDopplerUiForFrame",
    "decodeHistoricalDopplerFrame",
]:
    if required_name not in js:
        raise SystemExit(
            f"ERROR: generated V8 is missing {required_name}. "
            "No Core V8 files were written."
        )

if js.count("function formatSignedKmh(") != 1:
    raise SystemExit(
        "ERROR: generated V8 has an invalid formatSignedKmh() count. "
        "No Core V8 files were written."
    )

# Validate generated V8 JS before writing it.
with tempfile.NamedTemporaryFile(
    mode="w",
    suffix=".mjs",
    encoding="utf-8",
    delete=False
) as tmp:
    tmp.write(js)
    staged_core = Path(tmp.name)

try:
    subprocess.run(["node", "--check", str(staged_core)], check=True)
finally:
    staged_core.unlink(missing_ok=True)

print("Generated Core V8 JavaScript syntax: PASS")

# Validate replacement/new payload JS.
for relative in [
    "relay/doppler-history-v1.js",
    "relay/worker.js",
    "frontend/src/bom-doppler-intake-v3.js",
    "frontend/src/bom-doppler-history-spatial-v1.js",
]:
    subprocess.run(
        ["node", "--check", str(PAYLOADS / relative)],
        check=True
    )

print("Payload JavaScript syntax: PASS")

# Only now write repository files.
RELAY.mkdir(parents=True, exist_ok=True)
SRC.mkdir(parents=True, exist_ok=True)
TESTS.mkdir(parents=True, exist_ok=True)

copy_pairs = [
    ("relay/doppler-history-v1.js", RELAY / "doppler-history-v1.js"),
    ("relay/worker.js", RELAY / "worker.js"),
    ("frontend/src/bom-doppler-intake-v3.js", SRC / "bom-doppler-intake-v3.js"),
    ("frontend/src/bom-doppler-history-spatial-v1.js", SRC / "bom-doppler-history-spatial-v1.js"),
    ("frontend/tests/run-doppler-history-v1-tests.mjs", TESTS / "run-doppler-history-v1-tests.mjs"),
    ("frontend/tests/run-doppler-history-spatial-v1-tests.mjs", TESTS / "run-doppler-history-spatial-v1-tests.mjs"),
]

for relative, destination in copy_pairs:
    shutil.copy2(PAYLOADS / relative, destination)

V8_JS.write_text(js, encoding="utf-8")
V8_HTML.write_text(html, encoding="utf-8")

if sha256(CAMERA) != camera_hash_before:
    raise SystemExit(
        "ERROR: stormtracker-camera-v1.js changed unexpectedly."
    )

print("Shared camera SHA-256 unchanged: PASS")
print()

subprocess.run(
    ["node", "frontend/tests/run-doppler-history-v1-tests.mjs"],
    cwd=ROOT,
    check=True
)
subprocess.run(
    ["node", "frontend/tests/run-doppler-history-spatial-v1-tests.mjs"],
    cwd=ROOT,
    check=True
)
subprocess.run(
    ["node", "frontend/tests/run-track-doppler-context-v1-tests.mjs"],
    cwd=ROOT,
    check=True
)
subprocess.run(
    ["node", "frontend/tests/run-stormtracker-camera-v1-tests.mjs"],
    cwd=ROOT,
    check=True
)
subprocess.run(
    ["node", "frontend/tests/run-node-tests.mjs"],
    cwd=ROOT,
    check=True
)

print()
print("SUCCESS — Core V8 generated and validated.")
print()
print("Expected:")
print("  9 Doppler history/frame-pairing tests passed.")
print("  4 historical Doppler spatial-layout tests passed.")
print("  11 Doppler-to-track context tests passed.")
print("  11 shared camera controller tests passed.")
print("  14 tests passed.")
print()
print("DEPLOY RELAY:")
print("  cd /workspaces/StormTracker/relay")
print("  npx wrangler deploy")
print("  cd /workspaces/StormTracker")
print()
print("COMMIT/PUSH:")
print(
    "git add "
    "relay/worker.js "
    "relay/doppler-history-v1.js "
    "frontend/src/bom-doppler-intake-v3.js "
    "frontend/src/bom-doppler-history-spatial-v1.js "
    "frontend/src/live3d-core-v8.js "
    "frontend/live3d-core-v8.html "
    "frontend/tests/run-doppler-history-v1-tests.mjs "
    "frontend/tests/run-doppler-history-spatial-v1-tests.mjs"
)
print('git commit -m "Pair Doppler history to every reflectivity frame"')
print("git push")
print()
print("OPEN:")
print(
    "https://blakesmith-intel.github.io/StormTracker/"
    "live3d-core-v8.html"
)
