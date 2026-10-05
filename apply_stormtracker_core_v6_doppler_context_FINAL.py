from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT = Path("/workspaces/StormTracker")
FRONTEND = ROOT / "frontend"
SRC = FRONTEND / "src"
TESTS = FRONTEND / "tests"

CORE5_JS = SRC / "live3d-core-v5.js"
CORE5_HTML = FRONTEND / "live3d-core-v5.html"
CORE6_JS = SRC / "live3d-core-v6.js"
CORE6_HTML = FRONTEND / "live3d-core-v6.html"
CONTEXT_JS = SRC / "track-doppler-context-v1.js"
CONTEXT_TEST = TESTS / "run-track-doppler-context-v1-tests.mjs"

for required in [
    CORE5_JS,
    CORE5_HTML,
    SRC / "stormtracker-camera-v1.js",
    SRC / "bom-doppler-intake-v1.js",
    SRC / "bom-doppler-spatial-v1.js",
    SRC / "bom-doppler-decoder-v1.js",
]:
    if not required.exists():
        raise SystemExit(
            f"ERROR: missing required file: {required}"
        )

print("StormTracker — Core V6 Doppler-to-ST integration")
print("Scope:")
print("  • exact Doppler sampling inside measured >=40 dBZ ST footprints")
print("  • same-radar radial velocity metrics only")
print("  • shared StormTracker mouse camera")
print("  • Doppler does NOT create/move ST identities")
print()

def replace_once(text, old, new, label):
    count = text.count(old)

    if count != 1:
        raise SystemExit(
            f"ERROR: expected exactly one {label}, found {count}. "
            "No V6 files have been committed."
        )

    return text.replace(old, new, 1)

def replace_span(text, start_marker, end_marker, replacement, label):
    start = text.find(start_marker)

    if start < 0:
        raise SystemExit(
            f"ERROR: start marker missing for {label}."
        )

    end = text.find(
        end_marker,
        start
    )

    if end < 0:
        raise SystemExit(
            f"ERROR: end marker missing for {label}."
        )

    return (
        text[:start]
        + replacement
        + text[end:]
    )

# ---------------------------------------------------------------------
# 1. Pure Doppler -> reflectivity-footprint association module.
# ---------------------------------------------------------------------
CONTEXT_JS.write_text(
r'''const WEB_MERCATOR_RADIUS =
  6378137;

function clampLatitude(
  latitude
) {
  return Math.max(
    -85.05112878,
    Math.min(
      85.05112878,
      Number(
        latitude
      )
    )
  );
}

export function lonLatToWebMercator(
  longitude,
  latitude
) {
  const lon =
    Number(
      longitude
    );

  const lat =
    clampLatitude(
      latitude
    );

  return {
    x:
      WEB_MERCATOR_RADIUS
      * lon
      * Math.PI
      / 180,

    y:
      WEB_MERCATOR_RADIUS
      * Math.log(
          Math.tan(
            Math.PI / 4
            + lat
              * Math.PI
              / 360
          )
        )
  };
}

export function webMercatorToLonLat(
  x,
  y
) {
  return {
    longitude:
      Number(
        x
      )
      / WEB_MERCATOR_RADIUS
      * 180
      / Math.PI,

    latitude:
      (
        2
        * Math.atan(
            Math.exp(
              Number(
                y
              )
              / WEB_MERCATOR_RADIUS
            )
          )
        - Math.PI / 2
      )
      * 180
      / Math.PI
  };
}

export function framePixelForLonLat(
  frame,
  longitude,
  latitude
) {
  if (
    frame?.georef?.projection
    !== "EPSG:3857"
  ) {
    throw new Error(
      "Doppler/track association requires an EPSG:3857 reflectivity frame."
    );
  }

  const projected =
    lonLatToWebMercator(
      longitude,
      latitude
    );

  const {
    minX,
    maxX,
    minY,
    maxY
  } =
    frame.georef;

  const dx =
    (
      maxX
      - minX
    )
    / frame.width;

  const dy =
    (
      maxY
      - minY
    )
    / frame.height;

  const column =
    Math.floor(
      (
        projected.x
        - minX
      )
      / dx
    );

  const row =
    Math.floor(
      (
        maxY
        - projected.y
      )
      / dy
    );

  if (
    column < 0
    || column >= frame.width
    || row < 0
    || row >= frame.height
  ) {
    return null;
  }

  return {
    column,
    row,
    index:
      row
      * frame.width
      + column
  };
}

export function pixelCentreLonLat(
  frame,
  column,
  row
) {
  const dx =
    (
      frame.georef.maxX
      - frame.georef.minX
    )
    / frame.width;

  const dy =
    (
      frame.georef.maxY
      - frame.georef.minY
    )
    / frame.height;

  const x =
    frame.georef.minX
    + (
        Number(
          column
        )
        + 0.5
      )
      * dx;

  const y =
    frame.georef.maxY
    - (
        Number(
          row
        )
        + 0.5
      )
      * dy;

  return webMercatorToLonLat(
    x,
    y
  );
}

export function localCellIdForObservation(
  observation,
  sourceId =
    "BOM-MOSAIC"
) {
  for (
    const entry
    of observation?.source_cells
    ?? []
  ) {
    const [
      source,
      localCellId
    ] =
      entry;

    if (
      String(
        source
      )
      === String(
        sourceId
      )
    ) {
      const value =
        Number(
          localCellId
        );

      return Number.isFinite(
        value
      )
        ? value
        : null;
    }
  }

  return null;
}

export function summariseRadialVelocities(
  values,
  {
    minimumSamples =
      3
  } = {}
) {
  const valid =
    Array.from(
      values
      ?? []
    )
      .map(
        Number
      )
      .filter(
        value =>
          Number.isFinite(
            value
          )
          && value !== 0
      );

  if (
    valid.length
    < minimumSamples
  ) {
    return null;
  }

  const negative =
    valid.filter(
      value =>
        value < 0
    );

  const positive =
    valid.filter(
      value =>
        value > 0
    );

  const strongestToward =
    negative.length
      ? Math.min(
          ...negative
        )
      : null;

  const strongestAway =
    positive.length
      ? Math.max(
          ...positive
        )
      : null;

  const span =
    strongestToward != null
    && strongestAway != null
      ? strongestAway
        - strongestToward
      : null;

  return {
    sample_count:
      valid.length,

    strongest_toward_kmh:
      strongestToward,

    strongest_away_kmh:
      strongestAway,

    radial_span_kmh:
      span,

    maximum_absolute_kmh:
      Math.max(
        ...valid.map(
          value =>
            Math.abs(
              value
            )
        )
      )
  };
}

function parsedEpochMs(
  value
) {
  if (!value) {
    return null;
  }

  const epoch =
    Date.parse(
      value
    );

  return Number.isFinite(
    epoch
  )
    ? epoch
    : null;
}

function observationForFrame(
  track,
  observedUtc
) {
  return (
    track?.history
      ?.find(
        observation =>
          observation.observed_utc
          === observedUtc
      )
    ?? null
  );
}

export function buildTrackDopplerContexts({
  frame,
  segmentation,
  tracks,
  dopplerRecords,
  maxTimeDeltaMinutes =
    8,
  minimumSamples =
    3
}) {
  if (
    !segmentation?.labels
    || segmentation.labels.length
      !== frame.width
        * frame.height
  ) {
    throw new Error(
      "Reflectivity segmentation labels are required for exact Doppler footprint matching."
    );
  }

  const labelToTrack =
    new Map();

  const contextByTrack =
    new Map();

  for (
    const track
    of tracks
    ?? []
  ) {
    const observation =
      observationForFrame(
        track,
        frame.observedUtc
      );

    if (!observation) {
      continue;
    }

    const localCellId =
      localCellIdForObservation(
        observation
      );

    if (
      localCellId == null
    ) {
      continue;
    }

    labelToTrack.set(
      localCellId,
      track.track_id
    );

    contextByTrack.set(
      track.track_id,
      {
        track_id:
          track.track_id,

        observed_utc:
          frame.observedUtc,

        local_cell_id:
          localCellId,

        radars:
          new Map(),

        primary:
          null
      }
    );
  }

  const sourceStatus =
    [];

  const frameEpoch =
    parsedEpochMs(
      frame.observedUtc
    );

  for (
    const record
    of dopplerRecords
    ?? []
  ) {
    const radarId =
      String(
        record.radarId
      );

    const sourceEpoch =
      parsedEpochMs(
        record.observedUtc
      );

    const timeDeltaMinutes =
      frameEpoch != null
      && sourceEpoch != null
        ? Math.abs(
            sourceEpoch
            - frameEpoch
          )
          / 60000
        : null;

    const timeMatched =
      timeDeltaMinutes != null
      && timeDeltaMinutes
        <= maxTimeDeltaMinutes;

    sourceStatus.push({
      radar_id:
        radarId,

      source_time_utc:
        record.observedUtc
        ?? null,

      time_delta_minutes:
        timeDeltaMinutes,

      time_matched:
        timeMatched,

      sample_count:
        record.samples
          ?.length
        ?? 0,

      time_basis:
        record.timeBasis
        ?? "unknown"
    });

    if (
      !timeMatched
    ) {
      continue;
    }

    const valuesByTrack =
      new Map();

    for (
      const sample
      of record.samples
      ?? []
    ) {
      const velocity =
        Number(
          sample.velocity_kmh
        );

      if (
        !Number.isFinite(
          velocity
        )
        || velocity === 0
      ) {
        continue;
      }

      const pixel =
        framePixelForLonLat(
          frame,
          sample.longitude,
          sample.latitude
        );

      if (!pixel) {
        continue;
      }

      const localCellId =
        Number(
          segmentation.labels[
            pixel.index
          ]
        );

      if (
        !localCellId
      ) {
        continue;
      }

      const trackId =
        labelToTrack.get(
          localCellId
        );

      if (!trackId) {
        continue;
      }

      if (
        !valuesByTrack.has(
          trackId
        )
      ) {
        valuesByTrack.set(
          trackId,
          []
        );
      }

      valuesByTrack
        .get(
          trackId
        )
        .push(
          velocity
        );
    }

    for (
      const [
        trackId,
        values
      ]
      of valuesByTrack
    ) {
      const summary =
        summariseRadialVelocities(
          values,
          {
            minimumSamples
          }
        );

      if (!summary) {
        continue;
      }

      const context =
        contextByTrack.get(
          trackId
        );

      if (!context) {
        continue;
      }

      context.radars.set(
        radarId,
        {
          radar_id:
            radarId,

          source_time_utc:
            record.observedUtc,

          time_delta_minutes:
            timeDeltaMinutes,

          time_basis:
            record.timeBasis
            ?? "unknown",

          ...summary
        }
      );
    }
  }

  for (
    const context
    of contextByTrack.values()
  ) {
    const candidates =
      [...context.radars.values()]
        .sort(
          (
            a,
            b
          ) =>
            b.sample_count
            - a.sample_count
            || a.time_delta_minutes
              - b.time_delta_minutes
            || a.radar_id
              .localeCompare(
                b.radar_id
              )
        );

    context.primary =
      candidates[0]
      ?? null;

    context.radar_count =
      candidates.length;

    context.radars =
      candidates;
  }

  return {
    contextByTrack,

    sourceStatus,

    tracks_with_doppler:
      [...contextByTrack.values()]
        .filter(
          context =>
            context.primary
        )
        .length,

    interpretation:
      "Doppler is sampled only where exact geolocated non-zero radial-velocity pixels intersect the measured >=40 dBZ reflectivity component for the same ST track. Radial spans are calculated within one radar only and are not horizontal storm-motion vectors or rotation diagnoses."
  };
}
''',
encoding="utf-8"
)

# ---------------------------------------------------------------------
# 2. Tests for exact label intersection, time gating and same-radar spans.
# ---------------------------------------------------------------------
CONTEXT_TEST.write_text(
r'''import assert from "node:assert/strict";

import {
  buildTrackDopplerContexts,
  framePixelForLonLat,
  pixelCentreLonLat,
  summariseRadialVelocities
} from "../src/track-doppler-context-v1.js";

const frame = {
  observedUtc:
    "2026-10-04T01:00:00Z",

  width:
    4,

  height:
    4,

  georef: {
    projection:
      "EPSG:3857",

    minX:
      17000000,

    maxX:
      17004000,

    minY:
      -3204000,

    maxY:
      -3200000
  }
};

const labels =
  new Uint16Array(
    16
  );

labels[
  1 * 4 + 1
] =
  2;

labels[
  1 * 4 + 2
] =
  2;

labels[
  2 * 4 + 1
] =
  2;

const segmentation = {
  labels
};

const track = {
  track_id:
    "ST0001",

  history: [
    {
      observed_utc:
        frame.observedUtc,

      source_cells: [
        [
          "BOM-MOSAIC",
          2
        ]
      ]
    }
  ]
};

const p11 =
  pixelCentreLonLat(
    frame,
    1,
    1
  );

const p12 =
  pixelCentreLonLat(
    frame,
    2,
    1
  );

const p21 =
  pixelCentreLonLat(
    frame,
    1,
    2
  );

const outside =
  pixelCentreLonLat(
    frame,
    3,
    3
  );

assert.deepEqual(
  framePixelForLonLat(
    frame,
    p11.longitude,
    p11.latitude
  ),
  {
    column:1,
    row:1,
    index:5
  }
);

assert.deepEqual(
  summariseRadialVelocities(
    [
      -40,
      -20,
      30
    ]
  ),
  {
    sample_count:3,
    strongest_toward_kmh:-40,
    strongest_away_kmh:30,
    radial_span_kmh:70,
    maximum_absolute_kmh:40
  }
);

const result =
  buildTrackDopplerContexts({
    frame,

    segmentation,

    tracks: [
      track
    ],

    dopplerRecords: [
      {
        radarId:
          "66",

        observedUtc:
          "2026-10-04T01:04:00Z",

        timeBasis:
          "test",

        samples: [
          {
            ...p11,
            velocity_kmh:-40
          },
          {
            ...p12,
            velocity_kmh:-20
          },
          {
            ...p21,
            velocity_kmh:30
          },
          {
            ...outside,
            velocity_kmh:70
          }
        ]
      },

      {
        radarId:
          "50",

        observedUtc:
          "2026-10-04T01:30:00Z",

        timeBasis:
          "test",

        samples: [
          {
            ...p11,
            velocity_kmh:-70
          },
          {
            ...p12,
            velocity_kmh:70
          },
          {
            ...p21,
            velocity_kmh:70
          }
        ]
      }
    ]
  });

assert.equal(
  result.tracks_with_doppler,
  1
);

assert.equal(
  result.sourceStatus.length,
  2
);

assert.equal(
  result.sourceStatus[0].time_matched,
  true
);

assert.equal(
  result.sourceStatus[1].time_matched,
  false
);

const context =
  result.contextByTrack.get(
    "ST0001"
  );

assert.ok(
  context
);

assert.equal(
  context.radar_count,
  1
);

assert.equal(
  context.primary.radar_id,
  "66"
);

assert.equal(
  context.primary.sample_count,
  3
);

assert.equal(
  context.primary.strongest_toward_kmh,
  -40
);

assert.equal(
  context.primary.strongest_away_kmh,
  30
);

assert.equal(
  context.primary.radial_span_kmh,
  70
);

console.log(
  "11 Doppler-to-track context tests passed."
);
''',
encoding="utf-8"
)

# ---------------------------------------------------------------------
# 3. Create Core V6 from V5.
# ---------------------------------------------------------------------
shutil.copy2(
    CORE5_JS,
    CORE6_JS
)

shutil.copy2(
    CORE5_HTML,
    CORE6_HTML
)

js = CORE6_JS.read_text(
    encoding="utf-8"
)

# Imports.
import_anchor = '''import {
  reprojectWebMercatorRgbaToGeographic
} from "./webmercator-raster-reproject-v1.js?v=mercator-fix-v1";'''

new_imports = import_anchor + '''

import {
  createStormTrackerCameraController
} from "./stormtracker-camera-v1.js?v=camera-v1.1-wheel";

import {
  loadDopplerDiagnostic
} from "./bom-doppler-intake-v1.js?v=track-context-v1";

import {
  decodeGeoreferencedDoppler,
  geolocatedDopplerSamples
} from "./bom-doppler-spatial-v1.js?v=track-context-v1";

import {
  buildTrackDopplerContexts
} from "./track-doppler-context-v1.js?v=track-context-v1";'''

js = replace_once(
    js,
    import_anchor,
    new_imports,
    "Core V6 imports"
)

# Replace old lock/inertia camera setup with shared suite controller.
camera_start = '''const scene = viewer.scene;
const controller =
  scene.screenSpaceCameraController;'''

camera_end = '''try {
  viewer.imageryLayers.addImageryProvider('''

shared_camera = r'''const scene = viewer.scene;

scene.fog.enabled = false;
scene.globe.enableLighting = false;
scene.globe.maximumScreenSpaceError = 4;

const CORE_HOME =
  Object.freeze({
    longitude:
      153.05,

    latitude:
      -27.25,

    targetHeight:
      5000,

    range:
      175000,

    heading:
      Cesium.Math.toRadians(
        345
      ),

    pitch:
      Cesium.Math.toRadians(
        -28
      )
  });

const mapCamera =
  createStormTrackerCameraController({
    viewer,

    container:
      document.getElementById(
        "cesiumContainer"
      ),

    home:
      CORE_HOME,

    onUnexpectedCorrection:
      count => {
        const output =
          document.getElementById(
            "cameraCorrections"
          );

        if (output) {
          output.textContent =
            String(
              count
            );
        }
      }
  });

'''

js = replace_span(
    js,
    camera_start,
    camera_end,
    shared_camera,
    "Core V6 camera setup"
)

# Remove old camera state.
js = replace_once(
    js,
    '''let navigationLocked = true;
let lockedCamera = null;
let restoringCamera = false;
''',
    '',
    "old camera state"
)

# Replace all old camera helper functions/listeners with shared reset helper.
old_helpers_start = '''function takeCameraSnapshot() {'''
old_helpers_end = '''function displayRgb(category) {'''

new_helpers = r'''function resetView() {
  mapCamera.reset();
}

function displayRgb(category) {'''

js = replace_span(
    js,
    old_helpers_start,
    old_helpers_end,
    new_helpers,
    "old camera helper block"
)

# Add Doppler state after hybrid volume state.
state_anchor = '''let hybridTrackVolumes = [];
let hybridTrackVolumeCollection = null;'''

state_new = state_anchor + '''

let hybridDopplerContext =
  null;

let hybridDopplerLoadedForFrame =
  null;'''

js = replace_once(
    js,
    state_anchor,
    state_new,
    "Doppler state"
)

# Add Doppler loader + association helpers before renderHybridTracks.
render_marker = '''function renderHybridTracks(index) {'''

doppler_helpers = r'''function canvasImageData(
  canvas
) {
  return canvas
    .getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    )
    .getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );
}

async function loadOneDopplerRecord(
  radarId
) {
  const source =
    await loadDopplerDiagnostic(
      radarId
    );

  const decoded =
    decodeGeoreferencedDoppler(
      radarId,
      canvasImageData(
        source.canvas
      )
    );

  const samples =
    geolocatedDopplerSamples(
      decoded,
      {
        stride:
          1,

        includeZero:
          false
      }
    );

  let observedUtc =
    null;

  if (
    source.lastModified
  ) {
    const epoch =
      Date.parse(
        source.lastModified
      );

    if (
      Number.isFinite(
        epoch
      )
    ) {
      observedUtc =
        new Date(
          epoch
        ).toISOString();
    }
  }

  return {
    radarId:
      String(
        radarId
      ),

    observedUtc,

    timeBasis:
      "HTTP Last-Modified from public BOM radar relay",

    samples
  };
}

async function loadLatestTrackDopplerContext() {
  const frameIndex =
    hybridFrames.length
    - 1;

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

  if (
    !frame
    || !segmentation
  ) {
    hybridDopplerContext =
      null;

    return;
  }

  const settled =
    await Promise.allSettled(
      [
        "66",
        "50",
        "08"
      ].map(
        radarId =>
          loadOneDopplerRecord(
            radarId
          )
      )
    );

  const records =
    settled
      .filter(
        item =>
          item.status
          === "fulfilled"
      )
      .map(
        item =>
          item.value
      );

  hybridDopplerContext =
    buildTrackDopplerContexts({
      frame,

      segmentation,

      tracks:
        result?.tracks
        ?? [],

      dopplerRecords:
        records,

      maxTimeDeltaMinutes:
        8,

      minimumSamples:
        3
    });

  hybridDopplerLoadedForFrame =
    frame.observedUtc;

  const loaded =
    records.length;

  const matched =
    hybridDopplerContext
      .sourceStatus
      .filter(
        source =>
          source.time_matched
      )
      .length;

  const failed =
    settled.length
    - loaded;

  const tracksWithDoppler =
    hybridDopplerContext
      .tracks_with_doppler;

  $("dopplerRadarsLoaded")
    .textContent =
      String(
        loaded
      );

  $("dopplerRadarsMatched")
    .textContent =
      String(
        matched
      );

  $("dopplerTracksMatched")
    .textContent =
      String(
        tracksWithDoppler
      );

  $("dopplerFrameTime")
    .textContent =
      frame.observedUtc
        .replace(
          "T",
          " "
        )
        .replace(
          "Z",
          " UTC"
        );

  $("dopplerFailures")
    .textContent =
      String(
        failed
      );
}

function dopplerContextForTrack(
  index,
  trackId
) {
  if (
    index
    !== hybridFrames.length - 1
    || !hybridDopplerContext
    || hybridDopplerLoadedForFrame
      !== hybridFrames[index]
        ?.observedUtc
  ) {
    return null;
  }

  return (
    hybridDopplerContext
      .contextByTrack
      .get(
        trackId
      )
    ?? null
  );
}

function formatSignedKmh(
  value
) {
  if (
    value == null
  ) {
    return "—";
  }

  return `${
    value > 0
      ? "+"
      : ""
  }${Number(value).toFixed(0)} km/h`;
}

function renderHybridTracks(index) {'''

js = replace_once(
    js,
    render_marker,
    doppler_helpers,
    "Doppler helper insertion"
)

# Insert Doppler text before rows.push().
support_anchor = '''      const supportText =
        volume
          ? `${volume.high_support_points}/${volume.inferred_point_count}`
          : "—";

      rows.push('''

support_new = '''      const supportText =
        volume
          ? `${volume.high_support_points}/${volume.inferred_point_count}`
          : "—";

      const dopplerContext =
        dopplerContextForTrack(
          index,
          track.track_id
        );

      const primaryDoppler =
        dopplerContext
          ?.primary
        ?? null;

      const dopplerSummary =
        primaryDoppler
          ? (
              `Doppler ${primaryDoppler.radar_id}: ` +
              `${formatSignedKmh(primaryDoppler.strongest_toward_kmh)} toward / ` +
              `${formatSignedKmh(primaryDoppler.strongest_away_kmh)} away; ` +
              `span ${
                primaryDoppler.radial_span_kmh == null
                  ? "—"
                  : `${primaryDoppler.radial_span_kmh.toFixed(0)} km/h`
              }; ${primaryDoppler.sample_count} footprint samples`
            )
          : (
              index === hybridFrames.length - 1
                ? "Doppler — no time-matched non-zero samples in this measured footprint"
                : "Doppler — latest frame only"
            );

      rows.push('''

js = replace_once(
    js,
    support_anchor,
    support_new,
    "track Doppler row data"
)

# Add summary line in track row second div.
row_anchor = '''            <span>support ${supportText}</span>
          </div>'''

row_new = '''            <span>support ${supportText}</span>
            <span>${dopplerSummary}</span>
          </div>'''

js = replace_once(
    js,
    row_anchor,
    row_new,
    "track Doppler row display"
)

# Load current Doppler after all sequence tracking/volumes have been built,
# before playback starts.
slider_anchor = '''  $("hybridFrameSlider").max =
    String(
      hybridFrames.length - 1
    );'''

slider_new = '''  setStatus(
    "Tracking complete. Loading current public Doppler from 66 / 50 / 08 and matching it to the latest measured storm footprints…"
  );

  try {
    await loadLatestTrackDopplerContext();
  } catch (error) {
    console.warn(
      "Doppler track context unavailable",
      error
    );

    hybridDopplerContext =
      null;

    hybridDopplerLoadedForFrame =
      null;

    $("dopplerRadarsLoaded").textContent =
      "0";

    $("dopplerRadarsMatched").textContent =
      "0";

    $("dopplerTracksMatched").textContent =
      "0";

    $("dopplerFailures").textContent =
      "3";
  }

  $("hybridFrameSlider").max =
    String(
      hybridFrames.length - 1
    );'''

js = replace_once(
    js,
    slider_anchor,
    slider_new,
    "Doppler loading point"
)

# Reset Doppler state at start of sequence.
reset_state_anchor = '''  hybridResults = [];
  hybridHistory = new Map();
  hybridTrackVolumes = [];'''

reset_state_new = '''  hybridResults = [];
  hybridHistory = new Map();
  hybridTrackVolumes = [];

  hybridDopplerContext =
    null;

  hybridDopplerLoadedForFrame =
    null;'''

js = replace_once(
    js,
    reset_state_anchor,
    reset_state_new,
    "Doppler reset state"
)

# Status at end mentions context, without making it part of identity/motion.
final_status_old = '''    `Vertical intensity uses the five-event model; inferred geometry does not create track identity.`,
    "ok"
  );'''

final_status_new = '''    `Vertical intensity uses the five-event model; inferred geometry does not create track identity. ` +
    `Latest-frame Doppler is footprint-matched radial-velocity context only and does not create or move ST tracks.`,
    "ok"
  );'''

js = replace_once(
    js,
    final_status_old,
    final_status_new,
    "Core completion status"
)

# Initialisation: old reset+lock becomes shared-camera reset only.
initialise_old = '''  resetView();

  navigationLocked = true;
  applyNavigationLock();

  setStatus('''

initialise_new = '''  resetView();

  setStatus('''

js = replace_once(
    js,
    initialise_old,
    initialise_new,
    "initial camera activation"
)

# Remove old lock-button listener entirely and simplify reset.
lock_listener = '''$("lockButton").addEventListener(
  "click",
  () => {
    navigationLocked =
      !navigationLocked;

    applyNavigationLock();
  }
);

'''

js = replace_once(
    js,
    lock_listener,
    '',
    "lock listener removal"
)

reset_listener_old = '''$("resetButton").addEventListener(
  "click",
  () => {
    resetView();

    navigationLocked = true;

    applyNavigationLock();
  }
);'''

reset_listener_new = '''$("resetButton").addEventListener(
  "click",
  () => {
    resetView();
  }
);'''

js = replace_once(
    js,
    reset_listener_old,
    reset_listener_new,
    "reset listener"
)

# Cache-bust worker client import so current browser gets current code.
js = js.replace(
    '"./worker-client.js?v=hybrid-v1"',
    '"./worker-client.js?v=core-v6"',
    1
)

CORE6_JS.write_text(
    js,
    encoding="utf-8"
)

# ---------------------------------------------------------------------
# 4. Core V6 HTML: shared camera, no lock, Doppler status card.
# ---------------------------------------------------------------------
html = CORE6_HTML.read_text(
    encoding="utf-8"
)

html = replace_once(
    html,
    "StormTracker — Hybrid Storm Volume Core V5",
    "StormTracker — Hybrid Storm Volume Core V6",
    "Core V6 title"
)

html = html.replace(
    "same-frame rendering • core V4",
    "same-frame rendering • exact Doppler footprint context • shared mouse camera • core V6",
    1
)

# Make canvas gesture policy explicit; shared controller owns input.
html = replace_once(
    html,
    '''    #cesiumContainer {
      width:
        100%;

      height:
        100%;
    }''',
    '''    #cesiumContainer {
      width:
        100%;

      height:
        100%;

      touch-action:
        none;

      overscroll-behavior:
        none;
    }''',
    "Core V6 canvas CSS"
)

# Remove obsolete input shield element; leaving old CSS is harmless.
html = replace_once(
    html,
    '''    <div id="inputShield"></div>

''',
    '',
    "input shield element"
)

# Remove lock control and keep reset + correction count.
nav_old = '''    <div id="nav">
      <button id="lockButton">
        Unlock 3-D view
      </button>

      <button id="resetButton">
        Reset view
      </button>
    </div>'''

nav_new = '''    <div id="nav">
      <button id="resetButton">
        Reset view
      </button>

      <span
        style="
          align-self:center;
          color:#aebdc6;
          font-size:10px;
          padding:0 4px
        "
      >
        camera corrections:
        <strong id="cameraCorrections">0</strong>
      </span>
    </div>'''

html = replace_once(
    html,
    nav_old,
    nav_new,
    "Core V6 navigation"
)

# Add Doppler source status card immediately after hybrid sequence card.
validation_card = '''    <section class="card">
      <h2>
        Five-event cross-validation
      </h2>'''

doppler_card = '''    <section class="card">
      <h2>
        Live Doppler track context
      </h2>

      <div class="metric">
        <span>Radars loaded</span>
        <strong id="dopplerRadarsLoaded">0</strong>

        <span>Time-matched radars</span>
        <strong id="dopplerRadarsMatched">0</strong>

        <span>ST tracks with Doppler</span>
        <strong id="dopplerTracksMatched">0</strong>

        <span>Source failures</span>
        <strong id="dopplerFailures">0</strong>

        <span>Reflectivity frame</span>
        <strong id="dopplerFrameTime">—</strong>
      </div>

      <div class="uncertainty-note">
        Doppler is sampled only where exact geolocated non-zero radial-velocity
        pixels intersect the measured ≥40 dBZ component for an ST track.
        Toward/away span is calculated within one radar only. Doppler does not
        create storm identity, move the centroid, or diagnose rotation by itself.
      </div>
    </section>

'''

if html.count(validation_card) != 1:
    raise SystemExit(
        "ERROR: validation card anchor changed."
    )

html = html.replace(
    validation_card,
    doppler_card
    + validation_card,
    1
)

html = replace_once(
    html,
    'src="./src/live3d-core-v5.js"',
    'src="./src/live3d-core-v6.js"',
    "Core V6 script"
)

CORE6_HTML.write_text(
    html,
    encoding="utf-8"
)

# ---------------------------------------------------------------------
# 5. Syntax + regression checks.
# ---------------------------------------------------------------------
print("Checking generated JavaScript syntax...")

for file in [
    "frontend/src/track-doppler-context-v1.js",
    "frontend/src/live3d-core-v6.js",
]:
    subprocess.run(
        [
            "node",
            "--check",
            file
        ],
        cwd=ROOT,
        check=True
    )

print()
print("Running Doppler-to-track tests...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-track-doppler-context-v1-tests.mjs"
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

# Guardrails: V6 must not contain old lock logic.
generated_js = CORE6_JS.read_text(
    encoding="utf-8"
)

generated_html = CORE6_HTML.read_text(
    encoding="utf-8"
)

for forbidden in [
    "navigationLocked",
    "applyNavigationLock",
    'id="lockButton"',
    'id="inputShield"'
]:
    if (
      forbidden in generated_js
      or forbidden in generated_html
    ):
        raise SystemExit(
            f"ERROR: V6 still contains obsolete camera-lock artifact: {forbidden}"
        )

print()
print("SUCCESS")
print("Expected:")
print("  11 Doppler-to-track context tests passed.")
print("  11 shared camera controller tests passed.")
print("  14 tests passed.")
print()
print("Commit and push:")
print(
    "git add "
    "frontend/src/track-doppler-context-v1.js "
    "frontend/tests/run-track-doppler-context-v1-tests.mjs "
    "frontend/src/live3d-core-v6.js "
    "frontend/live3d-core-v6.html"
)
print(
    'git commit -m "Integrate footprint-matched Doppler context into Core V6"'
)
print("git push")
print()
print("After Pages deploys:")
print(
    "https://blakesmith-intel.github.io/StormTracker/"
    "live3d-core-v6.html"
)
print()
print("Then press:")
print("  Load 30-min hybrid storm sequence")
print()
print("What to check:")
print("  • shared mouse camera behaves exactly like the validated Doppler V5 page")
print("  • camera corrections remain 0 when untouched")
print("  • latest-frame ST rows show Doppler 66/50/08 context when time matched")
print("  • earlier sequence frames say Doppler latest-frame only")
print("  • no ST identity or motion is created from Doppler")
print()
print(
    "If there are no measured >=40 dBZ tracks at the time of testing, "
    "the Doppler source card should still report loaded/time-matched radars; "
    "track context will correctly remain zero."
)
