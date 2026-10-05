#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

echo "StormTracker 30-minute live loop v1"
echo

for f in \
  frontend/src/app-radar-overlay-v2.js \
  frontend/src/bom-wmts-diagnostics-v1.js \
  frontend/index.html
do
  if [ ! -f "$f" ]; then
    echo "ERROR: Missing expected file: $f"
    exit 1
  fi
done

BACKUP_DIR="/tmp/stormtracker-live-loop-v1-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
cp frontend/src/app-radar-overlay-v2.js "$BACKUP_DIR/app-radar-overlay-v2.js"
cp frontend/src/bom-wmts-diagnostics-v1.js "$BACKUP_DIR/bom-wmts-diagnostics-v1.js"
cp frontend/index.html "$BACKUP_DIR/index.html"

cp frontend/src/app-radar-overlay-v2.js frontend/src/app-live-loop-v1.js
cp frontend/src/bom-wmts-diagnostics-v1.js frontend/src/bom-wmts-loop-v1.js

python - <<'PY'
from pathlib import Path

# ------------------------------------------------------------------
# BOM module: add exact-time loading + recent 6-frame loader.
# ------------------------------------------------------------------
p = Path("frontend/src/bom-wmts-loop-v1.js")
text = p.read_text()

old_start = 'export async function loadLatestBomReflectivityMosaic(now = Date.now()) {'
start = text.find(old_start)
if start == -1:
    raise SystemExit("ERROR: Could not locate loadLatestBomReflectivityMosaic.")

body_start = start + len(old_start)

# Find the matching function end by simple brace count.
depth = 1
i = body_start
while i < len(text) and depth:
    if text[i] == "{":
        depth += 1
    elif text[i] == "}":
        depth -= 1
    i += 1

if depth != 0:
    raise SystemExit("ERROR: Could not parse loadLatestBomReflectivityMosaic.")

old_function = text[start:i]
body = old_function[len(old_start):-1]

# Replace the first line inside the old function that discovers latest time
# with an exact-time loader, then wrap latest and recent helpers around it.
exact_body = body.replace(
    '  const observedUtc = await findLatestBomReflectivityTime(now);',
    '  if (!observedUtc) throw new Error("observedUtc is required.");',
    1
)

replacement = '''export async function loadBomReflectivityMosaicAtTime(observedUtc) {''' + exact_body + '''}

export async function loadLatestBomReflectivityMosaic(now = Date.now()) {
  const observedUtc = await findLatestBomReflectivityTime(now);
  return loadBomReflectivityMosaicAtTime(observedUtc);
}

export async function findRecentBomReflectivityTimes(
  now = Date.now(),
  count = 6
) {
  const available = [];

  for (const observedUtc of candidateBomReflectivityTimes(now, 14)) {
    try {
      if (await probeTimestamp(observedUtc)) {
        available.push(observedUtc);
      }
    } catch {
      // Missing/unreadable candidate timestamps are skipped.
    }

    if (available.length >= count) {
      break;
    }
  }

  if (!available.length) {
    throw new Error(
      "No recent readable BOM reflectivity frames were available."
    );
  }

  // Processing must be chronological for persistent storm tracking.
  return available.sort(
    (a, b) => Date.parse(a) - Date.parse(b)
  );
}

export async function loadRecentBomReflectivityMosaics(
  now = Date.now(),
  count = 6,
  onProgress = null
) {
  const times = await findRecentBomReflectivityTimes(now, count);
  const frames = [];

  for (let index = 0; index < times.length; index++) {
    const observedUtc = times[index];

    onProgress?.({
      stage: "loading",
      index,
      total: times.length,
      observedUtc
    });

    const frame =
      await loadBomReflectivityMosaicAtTime(observedUtc);

    frames.push(frame);

    onProgress?.({
      stage: "loaded",
      index,
      total: times.length,
      observedUtc,
      frame
    });
  }

  return frames;
}
'''

text = text[:start] + replacement + text[i:]
p.write_text(text)

# ------------------------------------------------------------------
# App: add recent-frame loop, process chronologically, animate once.
# ------------------------------------------------------------------
p = Path("frontend/src/app-live-loop-v1.js")
text = p.read_text()

text = text.replace(
    'import { loadLatestBomReflectivityMosaic } from "./bom-wmts-diagnostics-v1.js";',
    'import { loadLatestBomReflectivityMosaic, loadRecentBomReflectivityMosaics } from "./bom-wmts-loop-v1.js";'
)

text = text.replace(
    'const STORMTRACKER_BUILD = "radar-overlay-v2";',
    'const STORMTRACKER_BUILD = "live-loop-v1";'
)

insert_marker = '$("demoButton").addEventListener'

loop_function = r'''
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loadLiveBomLoop() {
  setStatus("Finding and loading the latest 6 BOM reflectivity frames…");

  await worker.reset();
  sourceMode = "bom-loop";

  const frames = await loadRecentBomReflectivityMosaics(
    Date.now(),
    6,
    progress => {
      if (progress.stage === "loading") {
        setStatus(
          `Loading BOM frame ${progress.index + 1}/${progress.total}: ` +
          `${progress.observedUtc}`
        );
      }
    }
  );

  let result = null;
  let strongestCategory = 0;
  let strongestDbz = null;
  let totalStrongPixels = 0;

  for (let index = 0; index < frames.length; index++) {
    const frame = frames[index];

    result = await worker.processFrameBucket({
      frames: [frame],
      referenceTime: frame.observedUtc
    });

    await view.renderReflectivity(frame);
    renderPanels(result);

    const meta = frame.sourceMetadata ?? {};

    if ((meta.maxCategory ?? 0) > strongestCategory) {
      strongestCategory = meta.maxCategory ?? 0;
      strongestDbz = meta.maxDbzLowerBound ?? null;
    }

    totalStrongPixels += meta.strongPixelCount ?? 0;

    setStatus(
      `Loop frame ${index + 1}/${frames.length}: ${frame.observedUtc}; ` +
      `${meta.strongPixelCount ?? 0} pixels at >=40 dBZ; ` +
      `${result.active_track_ids?.length ?? 0} active tracks.`
    );

    await delay(450);
  }

  const firstTime = frames[0]?.observedUtc ?? "—";
  const lastTime = frames.at(-1)?.observedUtc ?? "—";
  const tracks = result?.tracks ?? [];
  const active = result?.active_track_ids ?? [];

  setStatus(
    `Loaded ${frames.length}-frame BOM loop ${firstTime} to ${lastTime}; ` +
    `strongest category ${strongestCategory || "none"}` +
    `${strongestDbz == null ? "" : ` (>=${strongestDbz} dBZ)`}; ` +
    `${totalStrongPixels} total >=40 dBZ pixels across loop; ` +
    `${active.length} active tracks; ${tracks.length} total tracked identities.`,
    "ok"
  );
}

'''

if 'async function loadLiveBomLoop()' not in text:
    if insert_marker not in text:
        raise SystemExit("ERROR: Could not locate event-listener insertion point.")
    text = text.replace(insert_marker, loop_function + insert_marker, 1)

listener_marker = '$("liveBomButton").addEventListener("click", () => loadLiveBomReflectivity().catch(e => setStatus(e.message,"error")));'
loop_listener = '$("loopBomButton").addEventListener("click", () => loadLiveBomLoop().catch(e => setStatus(e.message,"error")));'

if listener_marker not in text:
    raise SystemExit("ERROR: Could not locate live BOM button listener.")

if loop_listener not in text:
    text = text.replace(
        listener_marker,
        listener_marker + "\n" + loop_listener,
        1
    )

p.write_text(text)

# ------------------------------------------------------------------
# HTML: add loop button and unique entry-point filename.
# ------------------------------------------------------------------
p = Path("frontend/index.html")
text = p.read_text()

old_button = '<button id="liveBomButton">Load latest SEQ reflectivity — HIGH CONTRAST</button>'

new_buttons = '''<div class="controls">
        <button id="liveBomButton">Load latest SEQ reflectivity</button>
        <button id="loopBomButton">Load 30-min loop (6 frames)</button>
      </div>'''

if old_button not in text:
    raise SystemExit("ERROR: Could not locate current live reflectivity button.")

text = text.replace(old_button, new_buttons, 1)

old_script = '<script type="module" src="./src/app-radar-overlay-v2.js"></script>'
if old_script not in text:
    raise SystemExit("ERROR: Could not locate radar-overlay-v2 app entry point.")

text = text.replace(
    old_script,
    '<script type="module" src="./src/app-live-loop-v1.js"></script>',
    1
)

text = text.replace(
    'Browser-native reconstruction • 08 / 50 / 66 • RADAR OVERLAY V2',
    'Browser-native reconstruction • 08 / 50 / 66 • LIVE LOOP V1'
)

p.write_text(text)
PY

echo
echo "Running regression tests..."
node frontend/tests/run-node-tests.mjs

echo
echo "Checking JavaScript syntax..."
find frontend -type f -name '*.js' -print0 | xargs -0 -n1 node --check

echo
echo "Verification:"
grep -n "LIVE LOOP V1" frontend/index.html
grep -n "loopBomButton" frontend/index.html
grep -n "loadRecentBomReflectivityMosaics" frontend/src/app-live-loop-v1.js
grep -n "loadBomReflectivityMosaicAtTime" frontend/src/bom-wmts-loop-v1.js

echo
echo "SUCCESS"
echo "Expected regression result: 14 tests passed."
echo
echo "Commit and push:"
echo 'git add frontend/index.html frontend/src/app-live-loop-v1.js frontend/src/bom-wmts-loop-v1.js'
echo 'git commit -m "Add recent BOM loop and persistent live tracking"'
echo 'git push'
echo
echo "After Pages deploys:"
echo "  1. Confirm LIVE LOOP V1 is visible."
echo "  2. Press 'Load 30-min loop (6 frames)'."
echo "  3. Send back the final green status line and a screenshot."
