from pathlib import Path
import subprocess
import tempfile

ROOT = Path("/workspaces/StormTracker")
FRONTEND = ROOT / "frontend"
SRC = FRONTEND / "src"
TESTS = FRONTEND / "tests"
V8_JS = SRC / "live3d-core-v8.js"
V8_HTML = FRONTEND / "live3d-core-v8.html"
V81_JS = SRC / "live3d-core-v8-1.js"
V81_HTML = FRONTEND / "live3d-core-v8-1.html"

OLD_STATE = 'let dopplerPalettes =\n  new Map();\n\nlet dopplerFrameCache =\n  new Map();'
NEW_STATE = 'let dopplerPalettes =\n  new Map();\n\nlet dopplerLatestRecords =\n  new Map();\n\nlet dopplerFrameCache =\n  new Map();'
LOAD_START = 'async function loadDopplerHistoriesAndPalettes() {'
LOAD_END = 'async function buildDopplerStateForFrame(\n  frameIndex\n) {'
NEW_LOADER = 'async function loadDopplerHistoriesAndPalettes() {\n  const radarIds =\n    [\n      "66",\n      "50",\n      "08"\n    ];\n\n  const settled =\n    await Promise.allSettled(\n      radarIds.map(\n        async radarId => {\n          const [\n            history,\n            latest\n          ] =\n            await Promise.all([\n              loadDopplerHistory(\n                radarId\n              ),\n\n              loadDopplerDiagnostic(\n                radarId\n              )\n            ]);\n\n          const latestImageData =\n            canvasImageData(\n              latest.canvas\n            );\n\n          const palette =\n            paletteFromLatestDopplerImage(\n              latestImageData\n            );\n\n          const decodedLatest =\n            geolocatedHistoricalDopplerSamples(\n              radarId,\n              latestImageData,\n              palette,\n              {\n                stride:\n                  1,\n\n                includeZero:\n                  false\n              }\n            );\n\n          return {\n            radarId,\n\n            history,\n\n            palette,\n\n            latestRecord: {\n              radarId:\n                String(\n                  radarId\n                ),\n\n              product:\n                latest.product,\n\n              observedUtc:\n                latest.observedUtc,\n\n              timeBasis:\n                latest.timeSource\n                ?? "bom-product-page-received-at",\n\n              filename:\n                `${latest.product}.gif`,\n\n              validPixelCount:\n                decodedLatest.validPixelCount,\n\n              nonZeroPixelCount:\n                decodedLatest.nonZeroPixelCount,\n\n              samples:\n                decodedLatest.samples\n            }\n          };\n        }\n      )\n    );\n\n  dopplerHistories =\n    new Map();\n\n  dopplerPalettes =\n    new Map();\n\n  dopplerLatestRecords =\n    new Map();\n\n  for (\n    const result\n    of settled\n  ) {\n    if (\n      result.status\n      !== "fulfilled"\n    ) {\n      continue;\n    }\n\n    dopplerHistories.set(\n      result.value.radarId,\n      result.value.history\n    );\n\n    dopplerPalettes.set(\n      result.value.radarId,\n      result.value.palette\n    );\n\n    if (\n      result.value.latestRecord\n        ?.observedUtc\n    ) {\n      dopplerLatestRecords.set(\n        result.value.radarId,\n        result.value.latestRecord\n      );\n    }\n  }\n}\n\n'
OLD_PAIRING = '        return {\n          radarId,\n\n          ...nearestDopplerFrameForTime(\n            history?.frames\n            ?? [],\n            frame.observedUtc,\n            8\n          )\n        };'
NEW_PAIRING = '        const latestRecord =\n          dopplerLatestRecords\n            .get(\n              radarId\n            );\n\n        const candidates =\n          [\n            ...(\n              history?.frames\n              ?? []\n            ).map(\n              candidate => ({\n                ...candidate,\n                source_kind:\n                  "history"\n              })\n            )\n          ];\n\n        if (\n          frameIndex\n          === hybridFrames.length - 1\n          && latestRecord\n            ?.observedUtc\n        ) {\n          candidates.push({\n            filename:\n              latestRecord.filename,\n\n            observedUtc:\n              latestRecord.observedUtc,\n\n            source_kind:\n              "latest"\n          });\n        }\n\n        return {\n          radarId,\n\n          ...nearestDopplerFrameForTime(\n            candidates,\n            frame.observedUtc,\n            8\n          )\n        };'
OLD_LOAD_BRANCH = '          return decodeHistoricalDopplerFrame(\n            pairing.radarId,\n            pairing.candidate\n          );'
NEW_LOAD_BRANCH = '          if (\n            pairing.candidate\n              .source_kind\n            === "latest"\n          ) {\n            const latestRecord =\n              dopplerLatestRecords\n                .get(\n                  pairing.radarId\n                );\n\n            if (!latestRecord) {\n              throw new Error(\n                `Latest BOM Doppler unavailable for radar ${pairing.radarId}.`\n              );\n            }\n\n            return Promise.resolve(\n              latestRecord\n            );\n          }\n\n          return decodeHistoricalDopplerFrame(\n            pairing.radarId,\n            pairing.candidate\n          );'
RESET_OLD = '  dopplerPalettes =\n    new Map();\n\n  dopplerFrameCache =\n    new Map();'
RESET_NEW = '  dopplerPalettes =\n    new Map();\n\n  dopplerLatestRecords =\n    new Map();\n\n  dopplerFrameCache =\n    new Map();'
SOURCE_OLD = '                  `<span>timestamp: BOM history filename UTC</span>` +'
SOURCE_NEW = '                  `<span>${\n                    candidate?.source_kind === "latest"\n                      ? "source: BOM current IDRnnnI.gif"\n                      : "source: BOM timestamped history PNG"\n                  }</span>` +'

for required in [
    V8_JS,
    V8_HTML,
    SRC / "stormtracker-camera-v1.js",
    SRC / "bom-doppler-intake-v3.js",
    SRC / "bom-doppler-history-spatial-v1.js",
]:
    if not required.exists():
        raise SystemExit(
            f"ERROR: missing required file: {required}"
        )

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"ERROR: expected exactly one {label}, found {count}. "
            "No V8.1 files were written."
        )
    return text.replace(old, new, 1)

print("StormTracker — V8.1 current BOM Doppler correction")
print("Current GIF is used only on the latest reflectivity frame.")
print("Older frames remain timestamped-history only.")
print("Shared camera controller is untouched.")
print()

js = V8_JS.read_text(encoding="utf-8")
html = V8_HTML.read_text(encoding="utf-8")

# State: keep decoded current product separately.
js = replace_once(
    js,
    OLD_STATE,
    NEW_STATE,
    "latest Doppler state"
)

# Replace the source loader so the current IDRnnnI.gif is decoded and retained,
# rather than being used only to calibrate the palette.
start = js.find(LOAD_START)
end = js.find(LOAD_END, start)

if start < 0 or end < 0:
    raise SystemExit(
        "ERROR: could not locate V8 Doppler source loader. "
        "No V8.1 files were written."
    )

js = js[:start] + NEW_LOADER + js[end:]

# Per reflectivity frame: old frames see history candidates only.
# The latest reflectivity frame also sees the current GIF candidate.
js = replace_once(
    js,
    OLD_PAIRING,
    NEW_PAIRING,
    "Doppler candidate selection"
)

# If the current GIF wins, use its already-decoded live samples.
js = replace_once(
    js,
    OLD_LOAD_BRANCH,
    NEW_LOAD_BRANCH,
    "current Doppler load branch"
)

# Reset the live record cache for each new sequence.
js = replace_once(
    js,
    RESET_OLD,
    RESET_NEW,
    "latest Doppler reset"
)

# Make the selected source explicit in the UI.
js = replace_once(
    js,
    SOURCE_OLD,
    SOURCE_NEW,
    "Doppler source label"
)

html = replace_once(
    html,
    "StormTracker — Hybrid Storm Volume Core V8",
    "StormTracker — Hybrid Storm Volume Core V8.1",
    "page title"
)

html = replace_once(
    html,
    'src="./src/live3d-core-v8.js"',
    'src="./src/live3d-core-v8-1.js"',
    "script reference"
)

if './stormtracker-camera-v1.js?v=camera-v1.1-wheel' not in js:
    raise SystemExit(
        "ERROR: shared camera import changed unexpectedly."
    )

for required_text in [
    "dopplerLatestRecords",
    "source_kind",
    "BOM current IDRnnnI.gif",
]:
    if required_text not in js:
        raise SystemExit(
            f"ERROR: generated V8.1 missing {required_text}."
        )

# Check the ACTUAL generated V8.1 JS before writing it.
with tempfile.NamedTemporaryFile(
    mode="w",
    suffix=".mjs",
    encoding="utf-8",
    delete=False
) as tmp:
    tmp.write(js)
    temp_js = Path(tmp.name)

try:
    subprocess.run(
        ["node", "--check", str(temp_js)],
        check=True
    )
finally:
    temp_js.unlink(missing_ok=True)

print("Generated Core V8.1 JavaScript syntax: PASS")

V81_JS.write_text(js, encoding="utf-8")
V81_HTML.write_text(html, encoding="utf-8")

# Existing regression suite.
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
print("SUCCESS")
print("No relay redeploy is required.")
print()
print("Commit/push:")
print(
    "git add "
    "frontend/src/live3d-core-v8-1.js "
    "frontend/live3d-core-v8-1.html"
)
print(
    'git commit -m "Use current BOM Doppler on latest reflectivity frame"'
)
print("git push")
print()
print("Open:")
print(
    "https://blakesmith-intel.github.io/StormTracker/"
    "live3d-core-v8-1.html"
)
print()
print("Expected:")
print("  • frames 1-5: timestamped BOM history only")
print("  • frame 6/latest: history + current IDRnnnI.gif are compared; nearest <=8 min wins")
print("  • UI says whether source is current GIF or history PNG")
print("  • current GIF is never reused on older reflectivity frames")
