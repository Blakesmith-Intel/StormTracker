#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

echo "StormTracker — measured-track-anchored inferred 3-D volumes v1"
echo

for f in \
  frontend/src/workers/radar-worker.js \
  frontend/src/inferred-volume-v1.js \
  frontend/src/inferred-confidence-v1.js \
  frontend/src/live3d-hybrid-confidence-v1.js \
  frontend/live3d-hybrid-confidence.html
do
  if [ ! -f "$f" ]; then
    echo "ERROR: Missing required file:"
    echo "  $f"
    exit 1
  fi
done

BACKUP_DIR="/tmp/stormtracker-track-volume-v1-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"

cp frontend/src/workers/radar-worker.js \
  "$BACKUP_DIR/radar-worker.js"

cp frontend/src/live3d-hybrid-confidence-v1.js \
  "$BACKUP_DIR/live3d-hybrid-confidence-v1.js"

cp frontend/live3d-hybrid-confidence.html \
  "$BACKUP_DIR/live3d-hybrid-confidence.html"

python3 - <<'PY'
from pathlib import Path

p = Path("frontend/src/workers/radar-worker.js")
text = p.read_text(encoding="utf-8")

old = '''function cleanSegmentation(seg) {
  const { labels, ...rest } = seg;
  return rest;
}'''

new = '''function cleanSegmentation(
  seg,
  includeLabels = false
) {
  const {
    labels,
    ...rest
  } = seg;

  return includeLabels
    ? {
        ...rest,
        labels
      }
    : rest;
}'''

if old not in text:
    if new not in text:
        raise SystemExit(
            "ERROR: cleanSegmentation block not found."
        )
else:
    text = text.replace(old, new, 1)

old_call = '''    segmentations.push(cleanSegmentation(segmentation));'''

new_call = '''    segmentations.push(
      cleanSegmentation(
        segmentation,
        Boolean(
          payload.includeSegmentationLabels
        )
      )
    );'''

if old_call not in text:
    if new_call not in text:
        raise SystemExit(
            "ERROR: segmentation push call not found."
        )
else:
    text = text.replace(
        old_call,
        new_call,
        1
    )

p.write_text(
    text,
    encoding="utf-8"
)

print(
    "radar-worker.js: optional measured-cell label raster enabled"
)
PY

cat > frontend/src/measured-track-volume-v1.js <<'JS'
import {
  inferColumn,
  pixelCentreMercator,
  representativeDbzForCategory,
  webMercatorToDegrees
} from "./inferred-volume-v1.js?v=track-volume-v1";

import {
  styleForInferredPoint
} from "./inferred-confidence-v1.js?v=track-volume-v1";

function median(values) {
  if (!values.length) {
    return null;
  }

  const sorted =
    [...values].sort(
      (a, b) => a - b
    );

  const middle =
    Math.floor(
      sorted.length / 2
    );

  return (
    sorted.length % 2
      ? sorted[middle]
      : 0.5
        * (
          sorted[middle - 1]
          + sorted[middle]
        )
  );
}

function altitudeSpacing(model) {
  const altitudes =
    [
      ...new Set(
        (model?.profiles ?? [])
          .flatMap(
            profile =>
              profile.levels ?? []
          )
          .map(
            level =>
              Number(
                level.altitude_m_amsl
              )
          )
          .filter(
            Number.isFinite
          )
      )
    ].sort(
      (a, b) => a - b
    );

  if (altitudes.length < 2) {
    return 500;
  }

  const differences = [];

  for (
    let index = 1;
    index < altitudes.length;
    index++
  ) {
    const difference =
      altitudes[index]
      - altitudes[index - 1];

    if (difference > 0) {
      differences.push(
        difference
      );
    }
  }

  return (
    median(differences)
    ?? 500
  );
}

function localCellIdForObservation(
  observation,
  segmentation
) {
  const sourceId =
    String(
      segmentation?.radar_id
      ?? ""
    );

  const sourceCell =
    observation
      ?.source_cells
      ?.find(
        pair =>
          String(pair?.[0])
          === sourceId
      );

  if (!sourceCell) {
    return null;
  }

  const value =
    Number(
      sourceCell[1]
    );

  return (
    Number.isInteger(value)
      && value > 0
  )
    ? value
    : null;
}

function groundPixelAreaM2(
  frame,
  latitude
) {
  const dx =
    Math.abs(
      (
        frame.georef.maxX
        - frame.georef.minX
      )
      / frame.width
    );

  const dy =
    Math.abs(
      (
        frame.georef.maxY
        - frame.georef.minY
      )
      / frame.height
    );

  const cosLatitude =
    Math.cos(
      Number(latitude)
      * Math.PI
      / 180
    );

  return (
    dx
    * dy
    * cosLatitude
    * cosLatitude
  );
}

export function buildMeasuredTrackVolume(
  frame,
  segmentation,
  observation,
  model,
  {
    occupancyThreshold = 0.35,
    minimumOutputDbz = 20,
    displayThresholdDbz = 30,
    basePointSize = 3
  } = {}
) {
  if (
    frame?.georef?.projection
    !== "EPSG:3857"
  ) {
    throw new Error(
      "Track-specific volume requires an EPSG:3857 BOM frame."
    );
  }

  const labels =
    segmentation?.labels;

  if (
    !labels
    || labels.length
      !== frame.width
        * frame.height
  ) {
    throw new Error(
      "Measured segmentation labels were not returned by the radar worker."
    );
  }

  const localCellId =
    localCellIdForObservation(
      observation,
      segmentation
    );

  if (localCellId == null) {
    return null;
  }

  const dzM =
    altitudeSpacing(model);

  const points = [];

  let measuredPixelCount = 0;
  let inferredColumnCount = 0;

  let highSupportPoints = 0;
  let mediumSupportPoints = 0;
  let lowSupportPoints = 0;

  let maximumDbzh = null;
  let inferredTop40 = null;
  let inferredTop50 = null;
  let highSupportTop40 = null;
  let highSupportTop50 = null;

  let confidenceSum = 0;
  let sampledVolumeM3 = 0;
  let highSupportVolumeM3 = 0;

  for (
    let index = 0;
    index < labels.length;
    index++
  ) {
    if (
      Number(labels[index])
      !== localCellId
    ) {
      continue;
    }

    measuredPixelCount++;

    const row =
      Math.floor(
        index
        / frame.width
      );

    const column =
      index
      - row
        * frame.width;

    const inputDbz =
      representativeDbzForCategory(
        frame.categories[index]
      );

    if (inputDbz == null) {
      continue;
    }

    const inferred =
      inferColumn(
        model,
        inputDbz,
        {
          occupancyThreshold,
          minimumOutputDbz
        }
      );

    if (!inferred.length) {
      continue;
    }

    inferredColumnCount++;

    const mercator =
      pixelCentreMercator(
        frame,
        column,
        row
      );

    const geographic =
      webMercatorToDegrees(
        mercator.x,
        mercator.y
      );

    const pixelAreaM2 =
      groundPixelAreaM2(
        frame,
        geographic.latitude
      );

    for (const point of inferred) {
      const style =
        styleForInferredPoint(
          point,
          {
            displayThresholdDbz,
            basePointSize
          }
        );

      const volumeM3 =
        pixelAreaM2
        * dzM;

      sampledVolumeM3 +=
        volumeM3;

      confidenceSum +=
        Number(
          point.confidence
        );

      if (
        style.band
        === "high"
      ) {
        highSupportPoints++;
        highSupportVolumeM3 +=
          volumeM3;
      } else if (
        style.band
        === "medium"
      ) {
        mediumSupportPoints++;
      } else {
        lowSupportPoints++;
      }

      maximumDbzh =
        maximumDbzh == null
          ? point.dbzh
          : Math.max(
              maximumDbzh,
              point.dbzh
            );

      if (
        point.dbzh >= 40
        && (
          inferredTop40 == null
          || point.altitude_m_amsl
            > inferredTop40
        )
      ) {
        inferredTop40 =
          point.altitude_m_amsl;
      }

      if (
        point.dbzh >= 50
        && (
          inferredTop50 == null
          || point.altitude_m_amsl
            > inferredTop50
        )
      ) {
        inferredTop50 =
          point.altitude_m_amsl;
      }

      if (
        style.band === "high"
        && point.dbzh >= 40
        && (
          highSupportTop40 == null
          || point.altitude_m_amsl
            > highSupportTop40
        )
      ) {
        highSupportTop40 =
          point.altitude_m_amsl;
      }

      if (
        style.band === "high"
        && point.dbzh >= 50
        && (
          highSupportTop50 == null
          || point.altitude_m_amsl
            > highSupportTop50
        )
      ) {
        highSupportTop50 =
          point.altitude_m_amsl;
      }

      points.push({
        longitude:
          geographic.longitude,

        latitude:
          geographic.latitude,

        altitude_m_amsl:
          point.altitude_m_amsl,

        dbzh:
          point.dbzh,

        occupancy:
          point.confidence,

        p25_dbzh:
          point.p25_dbzh,

        p75_dbzh:
          point.p75_dbzh,

        support_band:
          style.band,

        alpha:
          style.alpha,

        pixel_size:
          style.pixelSize
      });
    }
  }

  return {
    local_cell_id:
      localCellId,

    measured_pixel_count:
      measuredPixelCount,

    inferred_column_count:
      inferredColumnCount,

    inferred_point_count:
      points.length,

    maximum_inferred_dbzh:
      maximumDbzh,

    inferred_top_40_m_amsl:
      inferredTop40,

    inferred_top_50_m_amsl:
      inferredTop50,

    high_support_top_40_m_amsl:
      highSupportTop40,

    high_support_top_50_m_amsl:
      highSupportTop50,

    mean_profile_occupancy:
      points.length
        ? confidenceSum
          / points.length
        : null,

    high_support_points:
      highSupportPoints,

    medium_support_points:
      mediumSupportPoints,

    low_support_points:
      lowSupportPoints,

    sampled_volume_km3:
      sampledVolumeM3
      / 1_000_000_000,

    high_support_volume_km3:
      highSupportVolumeM3
      / 1_000_000_000,

    altitude_spacing_m:
      dzM,

    points
  };
}

export function highSupportTop40Trend(
  previousVolume,
  previousObservedUtc,
  currentVolume,
  currentObservedUtc
) {
  const previous =
    Number(
      previousVolume
        ?.high_support_top_40_m_amsl
    );

  const current =
    Number(
      currentVolume
        ?.high_support_top_40_m_amsl
    );

  if (
    !Number.isFinite(previous)
    || !Number.isFinite(current)
  ) {
    return null;
  }

  const elapsedMinutes =
    (
      Date.parse(currentObservedUtc)
      - Date.parse(previousObservedUtc)
    )
    / 60000;

  if (!(elapsedMinutes > 0)) {
    return null;
  }

  const changeM =
    current
    - previous;

  return {
    change_m:
      changeM,

    elapsed_minutes:
      elapsedMinutes,

    metres_per_10_min:
      changeM
      / elapsedMinutes
      * 10
  };
}
JS

cp frontend/src/live3d-hybrid-confidence-v1.js \
  frontend/src/live3d-core-v3.js

cp frontend/live3d-hybrid-confidence.html \
  frontend/live3d-core-v3.html

python3 - <<'PY'
from pathlib import Path

p = Path("frontend/src/live3d-core-v3.js")
text = p.read_text(encoding="utf-8")

import_marker = '''import {
  styleForInferredPoint
} from "./inferred-confidence-v1.js?v=confidence-v1";'''

import_replacement = '''import {
  styleForInferredPoint
} from "./inferred-confidence-v1.js?v=confidence-v1";

import {
  buildMeasuredTrackVolume,
  highSupportTop40Trend
} from "./measured-track-volume-v1.js?v=track-volume-v1";'''

if import_marker not in text:
    raise SystemExit(
        "ERROR: confidence import marker not found."
    )

text = text.replace(
    import_marker,
    import_replacement,
    1
)

state_marker = '''let hybridPlaying = false;'''

state_replacement = '''let hybridPlaying = false;

let hybridTrackVolumes = [];
let hybridTrackVolumeCollection = null;'''

if state_marker not in text:
    raise SystemExit(
        "ERROR: hybrid state marker not found."
    )

text = text.replace(
    state_marker,
    state_replacement,
    1
)

start = text.index(
    "function renderHybridTracks(index) {"
)

end = text.index(
    "\nfunction updateHybridSourceMetrics",
    start
)

new_render = r'''function clearHybridTrackVolumeCollection() {
  if (
    hybridTrackVolumeCollection
  ) {
    scene.primitives.remove(
      hybridTrackVolumeCollection
    );

    hybridTrackVolumeCollection =
      null;
  }
}

function renderHybridTracks(index) {
  hybridSource.entities.suspendEvents();

  clearHybridTrackVolumeCollection();

  const showTrackVolumes =
    Boolean(
      $("showTrackVolumes")
        ?.checked
    );

  if (showTrackVolumes) {
    hybridTrackVolumeCollection =
      scene.primitives.add(
        new Cesium.PointPrimitiveCollection()
      );
  }

  try {
    hybridSource.entities.removeAll();

    const result =
      hybridResults[index];

    const volumeMap =
      hybridTrackVolumes[index];

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

      const volumeRecord =
        volumeMap?.get(
          track.track_id
        )
        ?? null;

      const volume =
        volumeRecord?.volume
        ?? null;

      const trend =
        volumeRecord?.trend
        ?? null;

      const colour =
        trackColour(
          track.track_id
        );

      const altitude =
        volume
          ?.high_support_top_40_m_amsl
        ?? volume
          ?.inferred_top_40_m_amsl
        ?? 1200;

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

      if (
        showTrackVolumes
        && volume
        && hybridTrackVolumeCollection
      ) {
        for (
          const point
          of volume.points
        ) {
          hybridTrackVolumeCollection.add({
            position:
              Cesium.Cartesian3
                .fromDegrees(
                  point.longitude,
                  point.latitude,
                  displayAltitude(
                    point.altitude_m_amsl
                  )
                ),

            color:
              colourForDbzh(
                point.dbzh
              ).withAlpha(
                point.alpha
              ),

            pixelSize:
              point.pixel_size,

            disableDepthTestDistance:
              0
          });
        }
      }

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

      const top40Text =
        volume
          ?.high_support_top_40_m_amsl
        != null
          ? `${(
              volume
                .high_support_top_40_m_amsl
              / 1000
            ).toFixed(1)} km`
          : "—";

      const trendText =
        trend
          ? `${
              trend.metres_per_10_min
              >= 0
                ? "+"
                : ""
            }${(
              trend.metres_per_10_min
              / 1000
            ).toFixed(1)} km/10m`
          : "—";

      const supportText =
        volume
          ? `${volume.high_support_points}/${volume.inferred_point_count}`
          : "—";

      rows.push(
        `<div class="track-volume-row">
          <div>
            <strong>${track.track_id}</strong>
            <span>${track.observation_count} obs</span>
            <span>${
              track.motion
                ? `${track.motion.speed_kmh.toFixed(0)} km/h`
                : "motion —"
            }</span>
          </div>
          <div>
            <span>high-support 40 dBZ top ${top40Text}</span>
            <span>vertical trend ${trendText}</span>
            <span>support ${supportText}</span>
          </div>
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
}'''

text = (
    text[:start]
    + new_render
    + text[end:]
)

old_show = '''  await renderSurface(frame);
  renderInferredVolume(frame);
  renderHybridTracks(hybridFrameIndex);
  updateHybridSourceMetrics(frame);'''

new_show = '''  await renderSurface(frame);

  renderInferredVolume(frame);

  if (
    inferredCollection
    && hybridResults.length
  ) {
    inferredCollection.show =
      !Boolean(
        $("showTrackVolumes")
          ?.checked
      );
  }

  renderHybridTracks(hybridFrameIndex);
  updateHybridSourceMetrics(frame);'''

if old_show not in text:
    raise SystemExit(
        "ERROR: showHybridFrame render block not found."
    )

text = text.replace(
    old_show,
    new_show,
    1
)

old_payload = '''    const result =
      await hybridWorker.processFrameBucket({
        frames: [frame],
        referenceTime:
          frame.observedUtc
      });

    hybridResults.push(
      result
    );'''

new_payload = '''    const result =
      await hybridWorker.processFrameBucket({
        frames: [frame],
        referenceTime:
          frame.observedUtc,

        includeSegmentationLabels:
          true
      });

    hybridResults.push(
      result
    );'''

if old_payload not in text:
    raise SystemExit(
        "ERROR: hybrid worker payload block not found."
    )

text = text.replace(
    old_payload,
    new_payload,
    1
)

history_marker = '''  hybridResults = [];
  hybridHistory = new Map();'''

history_replacement = '''  hybridResults = [];
  hybridHistory = new Map();
  hybridTrackVolumes = [];'''

if history_marker not in text:
    raise SystemExit(
        "ERROR: hybrid reset marker not found."
    )

text = text.replace(
    history_marker,
    history_replacement,
    1
)

after_loop_marker = '''  $("hybridFrameSlider").max =
    String(
      hybridFrames.length - 1
    );'''

precompute = r'''  const previousByTrack =
    new Map();

  for (
    let frameIndex = 0;
    frameIndex < hybridFrames.length;
    frameIndex++
  ) {
    const frame =
      hybridFrames[
        frameIndex
      ];

    const result =
      hybridResults[
        frameIndex
      ];

    const segmentation =
      result
        ?.segmentations
        ?.[0];

    const volumeMap =
      new Map();

    for (
      const track
      of result?.tracks ?? []
    ) {
      const observation =
        track.history?.find(
          item =>
            item.observed_utc
            === frame.observedUtc
        );

      if (!observation) {
        continue;
      }

      const volume =
        buildMeasuredTrackVolume(
          frame,
          segmentation,
          observation,
          model,
          {
            occupancyThreshold:
              Number(
                $("occupancyThreshold").value
              ),

            minimumOutputDbz:
              20,

            displayThresholdDbz:
              Number(
                $("minimumDbzh").value
              ),

            basePointSize:
              Number(
                $("pointSize").value
              )
          }
        );

      if (!volume) {
        continue;
      }

      const previous =
        previousByTrack.get(
          track.track_id
        );

      const trend =
        previous
          ? highSupportTop40Trend(
              previous.volume,
              previous.observedUtc,
              volume,
              frame.observedUtc
            )
          : null;

      const record = {
        volume,
        trend,
        observedUtc:
          frame.observedUtc
      };

      volumeMap.set(
        track.track_id,
        record
      );

      previousByTrack.set(
        track.track_id,
        record
      );
    }

    hybridTrackVolumes.push(
      volumeMap
    );
  }

'''

if after_loop_marker not in text:
    raise SystemExit(
        "ERROR: frame slider marker not found."
    )

text = text.replace(
    after_loop_marker,
    precompute
    + after_loop_marker,
    1
)

listener_marker = '''$("hybridPlayButton").addEventListener(
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
);'''

listener_replacement = listener_marker + r'''

$("showTrackVolumes").addEventListener(
  "change",
  () => {
    if (
      inferredCollection
      && hybridResults.length
    ) {
      inferredCollection.show =
        !Boolean(
          $("showTrackVolumes")
            .checked
        );
    }

    renderHybridTracks(
      hybridFrameIndex
    );
  }
);'''

if listener_marker not in text:
    raise SystemExit(
        "ERROR: hybrid play listener not found."
    )

text = text.replace(
    listener_marker,
    listener_replacement,
    1
)

p.write_text(
    text,
    encoding="utf-8"
)
PY

python3 - <<'PY'
from pathlib import Path

p = Path("frontend/live3d-core-v3.html")
text = p.read_text(encoding="utf-8")

text = text.replace(
    "StormTracker — Hybrid Live 3-D Confidence",
    "StormTracker — Hybrid Storm Volume Core V3"
)

text = text.replace(
    "measured 2-D tracking • five-event inferred vertical intensity • confidence-aware prototype V2",
    "measured 2-D storm masks • persistent ST identities • track-specific inferred vertical volumes • core V3"
)

text = text.replace(
    'src="./src/live3d-hybrid-confidence-v1.js"',
    'src="./src/live3d-core-v3.js"'
)

checkbox_marker = '''      <button
        id="hybridPlayButton"
        disabled
        style="width:100%;margin-top:7px"
      >
        Play once
      </button>'''

checkbox_replacement = checkbox_marker + '''

      <label
        style="
          display:flex;
          gap:7px;
          align-items:center
        "
      >
        <input
          id="showTrackVolumes"
          type="checkbox"
          checked
        >
        Show only track-specific inferred 3-D volumes during sequence
      </label>'''

if checkbox_marker not in text:
    raise SystemExit(
        "ERROR: hybrid play button not found."
    )

text = text.replace(
    checkbox_marker,
    checkbox_replacement,
    1
)

old_note = '''        <div class="hybrid-muted">
          Load the sequence to build measured-2D ST identities.
        </div>'''

new_note = '''        <div class="hybrid-muted">
          Load the sequence to build measured-2D ST identities and constrain
          each inferred 3-D storm volume to that measured component mask.
        </div>'''

if old_note not in text:
    raise SystemExit(
        "ERROR: hybrid empty-row note not found."
    )

text = text.replace(
    old_note,
    new_note,
    1
)

style_marker = '''    .hybrid-muted {
      color:#91a3ad;
    }'''

style_replacement = '''    .hybrid-muted {
      color:#91a3ad;
    }

    .track-volume-row {
      padding:6px 0;
      border-top:1px solid #2a3942;
      font-size:10px;
      line-height:1.35;
    }

    .track-volume-row:first-child {
      border-top:0;
    }

    .track-volume-row > div {
      display:flex;
      flex-wrap:wrap;
      gap:5px 10px;
    }

    .track-volume-row > div + div {
      margin-top:2px;
      color:#aebdc6;
    }'''

if style_marker not in text:
    raise SystemExit(
        "ERROR: hybrid-muted style not found."
    )

text = text.replace(
    style_marker,
    style_replacement,
    1
)

p.write_text(
    text,
    encoding="utf-8"
)
PY

cat > frontend/tests/run-measured-track-volume-tests.mjs <<'JS'
import assert from "node:assert/strict";

import {
  buildMeasuredTrackVolume,
  highSupportTop40Trend
} from "../src/measured-track-volume-v1.js";

const model = {
  profiles: [
    {
      low_level_dbz_min: 40,
      low_level_dbz_max: 45,
      levels: [
        {
          altitude_m_amsl: 500,
          occupancy_probability: 0.82,
          median_delta_dbz: 0,
          p25_delta_dbz: -1,
          p75_delta_dbz: 2
        },
        {
          altitude_m_amsl: 1500,
          occupancy_probability: 0.76,
          median_delta_dbz: -1,
          p25_delta_dbz: -2,
          p75_delta_dbz: 2
        },
        {
          altitude_m_amsl: 2500,
          occupancy_probability: 0.45,
          median_delta_dbz: -2,
          p25_delta_dbz: -8,
          p75_delta_dbz: 4
        }
      ]
    }
  ]
};

const frame = {
  observedUtc:
    "2026-10-03T00:00:00Z",

  width: 4,
  height: 4,

  georef: {
    projection:
      "EPSG:3857",

    minX: 0,
    maxX: 4000,
    minY: 0,
    maxY: 4000
  },

  categories:
    new Uint8Array([
      0,0,0,0,
      0,7,7,0,
      0,7,7,0,
      0,0,0,0
    ])
};

const segmentation = {
  radar_id:
    "BOM-MOSAIC",

  labels:
    new Uint16Array([
      0,0,0,0,
      0,1,1,0,
      0,1,1,0,
      0,0,0,0
    ])
};

const observation = {
  source_cells: [
    [
      "BOM-MOSAIC",
      1
    ]
  ]
};

const volume =
  buildMeasuredTrackVolume(
    frame,
    segmentation,
    observation,
    model,
    {
      occupancyThreshold: 0.35,
      minimumOutputDbz: 20,
      displayThresholdDbz: 30,
      basePointSize: 3
    }
  );

assert.ok(volume);
assert.equal(volume.measured_pixel_count, 4);
assert.equal(volume.inferred_column_count, 4);
assert.equal(volume.inferred_point_count, 12);
assert.equal(volume.high_support_points, 8);
assert.equal(volume.low_support_points, 4);
assert.equal(volume.high_support_top_40_m_amsl, 1500);

const later = {
  ...volume,
  high_support_top_40_m_amsl:
    2500
};

const trend =
  highSupportTop40Trend(
    volume,
    "2026-10-03T00:00:00Z",
    later,
    "2026-10-03T00:05:00Z"
  );

assert.ok(trend);
assert.equal(trend.change_m, 1000);
assert.equal(trend.metres_per_10_min, 2000);

console.log(
  "8 measured-track-volume tests passed."
);
JS

echo
echo "Checking JavaScript syntax..."
node --check frontend/src/workers/radar-worker.js
node --check frontend/src/measured-track-volume-v1.js
node --check frontend/src/live3d-core-v3.js

echo
echo "Running measured-track-volume tests..."
node frontend/tests/run-measured-track-volume-tests.mjs

echo
echo "Running confidence tests..."
node frontend/tests/run-inferred-confidence-tests.mjs

echo
echo "Running inferred-volume tests..."
node frontend/tests/run-inferred-volume-tests.mjs

echo
echo "Running existing StormTracker tests..."
node frontend/tests/run-node-tests.mjs

echo
echo "Files ready:"
ls -lh \
  frontend/live3d-core-v3.html \
  frontend/src/live3d-core-v3.js \
  frontend/src/measured-track-volume-v1.js

echo
echo "SUCCESS"
echo "Expected:"
echo "  8 measured-track-volume tests passed."
echo "  5 inferred-confidence tests passed."
echo "  4 inferred-volume tests passed."
echo "  14 tests passed."
echo
echo "Commit and push:"
echo 'git add frontend/src/workers/radar-worker.js frontend/src/measured-track-volume-v1.js frontend/src/live3d-core-v3.js frontend/live3d-core-v3.html frontend/tests/run-measured-track-volume-tests.mjs'
echo 'git commit -m "Anchor inferred 3-D storm volumes to measured 2-D track masks"'
echo 'git push'
echo
echo "After Pages deploys, open:"
echo "https://blakesmith-intel.github.io/StormTracker/live3d-core-v3.html"
echo
echo "Press:"
echo "  Load 30-min hybrid storm sequence"
echo
echo "On today's quiet radar, zero tracks may still be correct."
echo "Send back the final green status and a screenshot."
