#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

MODEL_SOURCE="data/aura/cross_event_v1/candidate_vertical_profile_model_v2.json"
VALIDATION_SOURCE="data/aura/cross_event_v1/leave_one_event_out_validation.json"

echo "StormTracker — hybrid core v1"
echo

for f in \
  "$MODEL_SOURCE" \
  "$VALIDATION_SOURCE" \
  frontend/live3d.html \
  frontend/src/live3d-v1.js \
  frontend/src/worker-client.js \
  frontend/src/bom-wmts-loop-v1.js
do
  if [ ! -f "$f" ]; then
    echo "ERROR: Missing required file: $f"
    exit 1
  fi
done

mkdir -p frontend/3d-models

cp "$MODEL_SOURCE" \
  frontend/3d-models/inferred_vertical_profile_model_v2.json

cp "$VALIDATION_SOURCE" \
  frontend/3d-models/leave_one_event_out_validation_v2.json

cp frontend/src/live3d-v1.js \
  frontend/src/live3d-hybrid-v1.js

cp frontend/live3d.html \
  frontend/live3d-hybrid.html

python3 - <<'PY'
from pathlib import Path

# ---------------------------------------------------------------
# JavaScript hybrid core
# ---------------------------------------------------------------
p = Path("frontend/src/live3d-hybrid-v1.js")
text = p.read_text(encoding="utf-8")

old = '''import {
  loadLatestBomReflectivityMosaic
} from "./bom-wmts-diagnostics-v1.js?v=live3d-v1";'''

new = '''import {
  loadLatestBomReflectivityMosaic,
  loadRecentBomReflectivityMosaics
} from "./bom-wmts-loop-v1.js?v=hybrid-v1";

import {
  RadarWorkerClient
} from "./worker-client.js?v=hybrid-v1";'''

if old not in text:
    raise SystemExit("ERROR: BOM import not found.")
text = text.replace(old, new, 1)

text = text.replace(
    './3d-models/inferred_vertical_profile_model_v1.json',
    './3d-models/inferred_vertical_profile_model_v2.json',
    1
)

text = text.replace(
    './3d-models/inferred_volume_validation_v1.json',
    './3d-models/leave_one_event_out_validation_v2.json',
    1
)

state_marker = 'let restoringCamera = false;'

state_add = '''let restoringCamera = false;

const hybridWorker =
  new RadarWorkerClient();

const hybridSource =
  new Cesium.CustomDataSource(
    "hybrid-2d-tracks"
  );

viewer.dataSources.add(
  hybridSource
);

let hybridFrames = [];
let hybridResults = [];
let hybridFrameIndex = 0;
let hybridHistory = new Map();
let hybridPlaying = false;'''

if state_marker not in text:
    raise SystemExit("ERROR: state marker not found.")
text = text.replace(state_marker, state_add, 1)

old_validation = '''  if (
    model.format
    !== "StormTrackerEmpiricalVerticalReflectivityModelV1"
  ) {
    throw new Error(
      "Unexpected inferred vertical model format."
    );
  }

  const aggregate =
    validation.aggregate;

  $("validationMae").textContent =
    `${aggregate.mean_intensity_mae_dbz.toFixed(2)} dBZ`;

  $("validationIou40").textContent =
    aggregate.thresholds["40"]
      .mean_iou
      .toFixed(3);

  $("validationTop40").textContent =
    `${(
      aggregate.thresholds["40"]
        .median_echo_top_absolute_error_m
      / 1000
    ).toFixed(2)} km`;'''

new_validation = '''  if (
    model.format
    !== "StormTrackerEmpiricalVerticalReflectivityModelV2"
  ) {
    throw new Error(
      "Unexpected multi-event inferred model format."
    );
  }

  const aggregate =
    validation.overall;

  $("validationMae").textContent =
    `${aggregate.mean_event_intensity_mae_dbz.toFixed(2)} dBZ`;

  $("validationIou40").textContent =
    aggregate.thresholds["40"]
      .mean_iou
      .toFixed(3);

  $("validationTop40").textContent =
    `${(
      aggregate.thresholds["40"]
        .median_event_echo_top_absolute_error_m
      / 1000
    ).toFixed(2)} km`;'''

if old_validation not in text:
    raise SystemExit("ERROR: validation block not found.")
text = text.replace(old_validation, new_validation, 1)

insert_before = 'async function loadLatest() {'

hybrid_code = r'''
function trackColour(trackId) {
  const number =
    Number(
      String(trackId).replace(/\D/g, "")
    ) || 1;

  return Cesium.Color.fromHsl(
    (number * 0.61803398875) % 1,
    0.78,
    0.58,
    1
  );
}

function renderHybridTracks(index) {
  hybridSource.entities.suspendEvents();

  try {
    hybridSource.entities.removeAll();

    const result =
      hybridResults[index];

    if (!result) {
      return;
    }

    const active =
      new Set(
        result.active_track_ids ?? []
      );

    const rows = [];

    for (const track of result.tracks ?? []) {
      const observation =
        track.history?.find(
          item =>
            item.observed_utc
            === hybridFrames[index].observedUtc
        );

      if (!observation) {
        continue;
      }

      const colour =
        trackColour(
          track.track_id
        );

      const altitude =
        1200;

      const position =
        Cesium.Cartesian3.fromDegrees(
          observation.centroid_longitude,
          observation.centroid_latitude,
          displayAltitude(altitude)
        );

      hybridSource.entities.add({
        id:
          `hybrid-${index}-${track.track_id}`,

        position,

        point: {
          pixelSize:
            active.has(track.track_id)
              ? 12
              : 8,

          color:
            colour,

          outlineColor:
            Cesium.Color.WHITE,

          outlineWidth:
            1
        },

        label: {
          text:
            `${track.track_id}  ≥${Number(observation.maximum_dbzh_lower_bound).toFixed(0)} dBZ`,

          font:
            "12px sans-serif",

          pixelOffset:
            new Cesium.Cartesian2(
              0,
              -18
            ),

          fillColor:
            Cesium.Color.WHITE,

          showBackground:
            true,

          backgroundColor:
            Cesium.Color.BLACK
              .withAlpha(0.62)
        }
      });

      if (!hybridHistory.has(track.track_id)) {
        hybridHistory.set(
          track.track_id,
          []
        );
      }

      const history =
        hybridHistory.get(
          track.track_id
        );

      if (
        !history.some(
          item =>
            item.frameIndex
            === index
        )
      ) {
        history.push({
          frameIndex:
            index,

          longitude:
            observation.centroid_longitude,

          latitude:
            observation.centroid_latitude,

          altitude
        });
      }

      const trail =
        history
          .filter(
            item =>
              item.frameIndex
              <= index
          )
          .sort(
            (a, b) =>
              a.frameIndex
              - b.frameIndex
          );

      if (trail.length >= 2) {
        hybridSource.entities.add({
          id:
            `hybrid-trail-${track.track_id}`,

          polyline: {
            positions:
              trail.map(
                item =>
                  Cesium.Cartesian3.fromDegrees(
                    item.longitude,
                    item.latitude,
                    displayAltitude(
                      item.altitude
                    )
                  )
              ),

            width:
              active.has(track.track_id)
                ? 3
                : 1.5,

            material:
              colour.withAlpha(
                active.has(track.track_id)
                  ? 0.9
                  : 0.35
              ),

            clampToGround:
              false
          }
        });
      }

      rows.push(
        `<div class="hybrid-row">
          <strong>${track.track_id}</strong>
          <span>${track.observation_count} obs</span>
          <span>${
            track.motion
              ? `${track.motion.speed_kmh.toFixed(0)} km/h`
              : "motion —"
          }</span>
          <span>${track.algorithmic_confidence}</span>
        </div>`
      );
    }

    $("hybridTrackCount").textContent =
      String(rows.length);

    $("hybridPersistentCount").textContent =
      String(
        (result.tracks ?? [])
          .filter(
            track =>
              track.observation_count >= 3
          )
          .length
      );

    $("hybridRows").innerHTML =
      rows.length
        ? rows.join("")
        : '<div class="hybrid-muted">No measured ≥40 dBZ 2-D storm tracks in this frame.</div>';

  } finally {
    hybridSource.entities.resumeEvents();
  }

  scene.requestRender();
}

function updateHybridSourceMetrics(frame) {
  $("sourceTime").textContent =
    frame.observedUtc
      .replace("T", " ")
      .replace("Z", " UTC");

  $("decodedPixels").textContent =
    (
      frame.sourceMetadata
        ?.colouredPixelCount
      ?? 0
    ).toLocaleString();

  const category =
    frame.sourceMetadata
      ?.maxCategory
    ?? 0;

  const lower =
    frame.sourceMetadata
      ?.maxDbzLowerBound;

  $("sourceMaximum").textContent =
    category
      ? (
          lower == null
            ? `category ${category}`
            : `category ${category} (>=${lower} dBZ)`
        )
      : "none";
}

async function showHybridFrame(index) {
  hybridFrameIndex =
    Math.max(
      0,
      Math.min(
        hybridFrames.length - 1,
        Number(index)
      )
    );

  const frame =
    hybridFrames[
      hybridFrameIndex
    ];

  latestFrame =
    frame;

  $("hybridFrameSlider").value =
    String(
      hybridFrameIndex
    );

  $("hybridFrameLabel").textContent =
    `${hybridFrameIndex + 1}/${hybridFrames.length}`;

  await renderSurface(frame);
  renderInferredVolume(frame);
  renderHybridTracks(hybridFrameIndex);
  updateHybridSourceMetrics(frame);

  setStatus(
    `HYBRID frame ${hybridFrameIndex + 1}/${hybridFrames.length}: ` +
    `${frame.observedUtc}; ST identities and horizontal motion are measured-2D-derived; ` +
    `vertical intensity is multi-event inferred.`,
    "ok"
  );
}

function hybridDelay(ms) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}

async function playHybridOnce() {
  if (
    hybridPlaying
    || !hybridFrames.length
  ) {
    return;
  }

  hybridPlaying = true;
  $("hybridPlayButton").disabled = true;

  try {
    for (
      let index = 0;
      index < hybridFrames.length;
      index++
    ) {
      await showHybridFrame(index);
      await hybridDelay(650);
    }
  } finally {
    hybridPlaying = false;
    $("hybridPlayButton").disabled = false;
  }
}

async function loadHybridSequence() {
  setStatus(
    "Loading six BOM frames for measured-2D tracking + inferred-3D volume…"
  );

  await hybridWorker.reset();

  hybridFrames =
    await loadRecentBomReflectivityMosaics(
      Date.now(),
      6,
      progress => {
        if (
          progress.stage
          === "loading"
        ) {
          setStatus(
            `Loading BOM frame ${progress.index + 1}/${progress.total}: ${progress.observedUtc}`
          );
        }
      }
    );

  hybridResults = [];
  hybridHistory = new Map();

  for (
    let index = 0;
    index < hybridFrames.length;
    index++
  ) {
    const frame =
      hybridFrames[index];

    const result =
      await hybridWorker.processFrameBucket({
        frames: [frame],
        referenceTime:
          frame.observedUtc
      });

    hybridResults.push(
      result
    );
  }

  $("hybridFrameSlider").max =
    String(
      hybridFrames.length - 1
    );

  $("hybridFrameSlider").disabled =
    false;

  $("hybridPlayButton").disabled =
    false;

  await playHybridOnce();

  const finalResult =
    hybridResults.at(-1);

  setStatus(
    `HYBRID CORE COMPLETE: ${hybridFrames.length} frames; ` +
    `${finalResult?.active_track_ids?.length ?? 0} active measured-2D ST tracks; ` +
    `${(finalResult?.tracks ?? []).length} total ST identities. ` +
    `Vertical intensity uses the five-event model; inferred geometry does not create track identity.`,
    "ok"
  );
}

'''

if insert_before not in text:
    raise SystemExit("ERROR: loadLatest marker not found.")
text = text.replace(
    insert_before,
    hybrid_code + insert_before,
    1
)

listener_marker = '$("loadButton").addEventListener('

hybrid_listeners = r'''
$("loadHybridButton").addEventListener(
  "click",
  () =>
    loadHybridSequence()
      .catch(
        error => {
          console.error(error);

          setStatus(
            error.message,
            "error"
          );
        }
      )
);

$("hybridFrameSlider").addEventListener(
  "input",
  event =>
    showHybridFrame(
      Number(
        event.target.value
      )
    ).catch(
      error =>
        setStatus(
          error.message,
          "error"
        )
    )
);

$("hybridPlayButton").addEventListener(
  "click",
  () =>
    playHybridOnce()
      .catch(
        error =>
          setStatus(
            error.message,
            "error"
          )
      )
);

'''

if listener_marker not in text:
    raise SystemExit("ERROR: listener marker not found.")
text = text.replace(
    listener_marker,
    hybrid_listeners + listener_marker,
    1
)

p.write_text(
    text,
    encoding="utf-8"
)

# ---------------------------------------------------------------
# HTML hybrid page
# ---------------------------------------------------------------
p = Path("frontend/live3d-hybrid.html")
text = p.read_text(encoding="utf-8")

text = text.replace(
    "StormTracker — Live Inferred 3-D",
    "StormTracker — Hybrid Live 3-D"
)

text = text.replace(
    "public BOM reflectivity • empirical vertical reconstruction • prototype V1",
    "measured 2-D storm tracking • five-event inferred vertical intensity • hybrid prototype V1"
)

text = text.replace(
    "INFERRED VOLUMETRIC INTENSITY — NOT MEASURED VOLUMETRIC RADAR.",
    "HYBRID PRODUCT — TRACK IDENTITY FROM MEASURED 2-D RADAR; VERTICAL INTENSITY INFERRED."
)

text = text.replace(
'''      Vertical structure is reconstructed from live 2-D reflectivity using
      empirical profiles calibrated against the historical measured AURA
      volume sequence. It must not be interpreted as the actual current
      vertical radar scan.''',
'''      STxxxx identities and horizontal motion come from the public measured
      2-D reflectivity segmentation/tracking engine. Vertical intensity is
      reconstructed using a five-event AURA-calibrated model. Inferred 3-D
      geometry does not create or preserve storm-track identity.''',
1
)

card_marker = '''    <section class="card">
      <h2>
        Historical validation
      </h2>'''

hybrid_card = '''    <section class="card">
      <h2>
        Hybrid storm sequence
      </h2>

      <button
        id="loadHybridButton"
        style="width:100%"
      >
        Load 30-min hybrid storm sequence
      </button>

      <label>
        Sequence frame:
        <strong>
          <span id="hybridFrameLabel">—</span>
        </strong>
      </label>

      <input
        id="hybridFrameSlider"
        type="range"
        min="0"
        max="5"
        value="0"
        step="1"
        disabled
      >

      <button
        id="hybridPlayButton"
        disabled
        style="width:100%;margin-top:7px"
      >
        Play once
      </button>

      <div
        class="metric"
        style="margin-top:8px"
      >
        <span>Current measured-2D tracks</span>
        <strong id="hybridTrackCount">0</strong>

        <span>Persistent tracks ≥3 scans</span>
        <strong id="hybridPersistentCount">0</strong>
      </div>

      <div
        id="hybridRows"
        style="margin-top:8px;font-size:10px"
      >
        <div class="hybrid-muted">
          Load the sequence to build measured-2D ST identities.
        </div>
      </div>
    </section>

'''

if card_marker not in text:
    raise SystemExit(
        "ERROR: historical validation card not found."
    )

text = text.replace(
    card_marker,
    hybrid_card + card_marker,
    1
)

text = text.replace(
    "Historical validation",
    "Five-event cross-validation",
    1
)

text = text.replace(
'''        Validation is leave-one-frame-out within a single historical event
        and is therefore not independent out-of-event validation.''',
'''        Validation is leave-one-entire-event-out across five historical
        Mt Stapylton event sequences. The inferred geometry remains
        uncertainty-qualified and is not used to establish ST identity.''',
1
)

style_marker = '''    #status[data-kind="ok"] {
      color:
        #99e2b7;
    }'''

style_add = '''    #status[data-kind="ok"] {
      color:
        #99e2b7;
    }

    .hybrid-row {
      display:grid;
      grid-template-columns:60px 50px 70px 1fr;
      gap:5px;
      padding:4px 0;
      border-top:1px solid #2a3942;
      align-items:center;
    }

    .hybrid-row:first-child {
      border-top:0;
    }

    .hybrid-row span {
      color:#b8c6ce;
    }

    .hybrid-muted {
      color:#91a3ad;
    }'''

if style_marker not in text:
    raise SystemExit(
        "ERROR: status style marker not found."
    )

text = text.replace(
    style_marker,
    style_add,
    1
)

text = text.replace(
    'src="./src/live3d-v1.js"',
    'src="./src/live3d-hybrid-v1.js"'
)

p.write_text(
    text,
    encoding="utf-8"
)
PY

echo
echo "Checking JavaScript syntax..."
node --check frontend/src/live3d-hybrid-v1.js

echo
echo "Running inferred-volume tests..."
node frontend/tests/run-inferred-volume-tests.mjs

echo
echo "Running existing StormTracker tests..."
node frontend/tests/run-node-tests.mjs

echo
echo "Files ready:"
ls -lh \
  frontend/live3d-hybrid.html \
  frontend/src/live3d-hybrid-v1.js \
  frontend/3d-models/inferred_vertical_profile_model_v2.json \
  frontend/3d-models/leave_one_event_out_validation_v2.json

echo
echo "SUCCESS"
echo "Expected:"
echo "  4 inferred-volume tests passed."
echo "  14 tests passed."
echo
echo "Commit and push:"
echo 'git add frontend/live3d-hybrid.html frontend/src/live3d-hybrid-v1.js frontend/3d-models/inferred_vertical_profile_model_v2.json frontend/3d-models/leave_one_event_out_validation_v2.json'
echo 'git commit -m "Add hybrid measured-2D tracking with multi-event inferred-3D intensity"'
echo 'git push'
echo
echo "After Pages deploys, open:"
echo "https://blakesmith-intel.github.io/StormTracker/live3d-hybrid.html"
echo
echo "Then press:"
echo "  Load 30-min hybrid storm sequence"
echo
echo "Send back the final green status line and one screenshot."
