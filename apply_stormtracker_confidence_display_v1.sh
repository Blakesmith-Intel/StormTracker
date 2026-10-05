#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

echo "StormTracker — confidence-aware inferred 3-D display v1"
echo

for f in \
  frontend/src/inferred-volume-v1.js \
  frontend/src/live3d-hybrid-v1.js \
  frontend/live3d-hybrid.html \
  frontend/tests/run-inferred-volume-tests.mjs
do
  if [ ! -f "$f" ]; then
    echo "ERROR: Missing required file:"
    echo "  $f"
    exit 1
  fi
done

BACKUP_DIR="/tmp/stormtracker-confidence-display-v1-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"

cp frontend/src/inferred-volume-v1.js \
  "$BACKUP_DIR/inferred-volume-v1.js"

cp frontend/src/live3d-hybrid-v1.js \
  "$BACKUP_DIR/live3d-hybrid-v1.js"

cp frontend/live3d-hybrid.html \
  "$BACKUP_DIR/live3d-hybrid.html"

python3 - <<'PY'
from pathlib import Path

p = Path("frontend/src/inferred-volume-v1.js")
text = p.read_text(encoding="utf-8")

old = '''    points.push({
      altitude_m_amsl:
        Number(level.altitude_m_amsl),

      dbzh,

      confidence:
        occupancy,

      p25_delta_dbz:
        level.p25_delta_dbz == null
          ? null
          : Number(level.p25_delta_dbz),

      p75_delta_dbz:
        level.p75_delta_dbz == null
          ? null
          : Number(level.p75_delta_dbz)
    });'''

new = '''    const p25Delta =
      level.p25_delta_dbz == null
        ? null
        : Number(level.p25_delta_dbz);

    const p75Delta =
      level.p75_delta_dbz == null
        ? null
        : Number(level.p75_delta_dbz);

    points.push({
      altitude_m_amsl:
        Number(level.altitude_m_amsl),

      dbzh,

      confidence:
        occupancy,

      median_delta_dbz:
        delta,

      p25_delta_dbz:
        p25Delta,

      p75_delta_dbz:
        p75Delta,

      p25_dbzh:
        Number.isFinite(p25Delta)
          ? inputDbz + p25Delta
          : null,

      p75_dbzh:
        Number.isFinite(p75Delta)
          ? inputDbz + p75Delta
          : null
    });'''

if old not in text:
    if new in text:
        print("inferred-volume-v1.js: already enhanced")
    else:
        raise SystemExit("ERROR: Could not locate inferred point block.")
else:
    text = text.replace(old, new, 1)
    p.write_text(text, encoding="utf-8")
    print("inferred-volume-v1.js: absolute P25/P75 added")
PY

cat > frontend/src/inferred-confidence-v1.js <<'JS'
export const SUPPORT_BANDS = Object.freeze({
  high: Object.freeze({
    label: "High support",
    alpha: 0.95,
    sizeScale: 1.00
  }),

  medium: Object.freeze({
    label: "Medium support",
    alpha: 0.58,
    sizeScale: 0.82
  }),

  low: Object.freeze({
    label: "Low support",
    alpha: 0.22,
    sizeScale: 0.62
  })
});

export function inferredIqrDbz(point) {
  const p25 =
    Number(point?.p25_dbzh);

  const p75 =
    Number(point?.p75_dbzh);

  if (
    !Number.isFinite(p25)
    || !Number.isFinite(p75)
  ) {
    return null;
  }

  return Math.max(
    0,
    p75 - p25
  );
}

export function supportBandForPoint(
  point,
  {
    displayThresholdDbz = 20
  } = {}
) {
  const occupancy =
    Number(point?.confidence);

  const median =
    Number(point?.dbzh);

  const p25 =
    Number(point?.p25_dbzh);

  const iqr =
    inferredIqrDbz(point);

  if (
    !Number.isFinite(occupancy)
    || !Number.isFinite(median)
  ) {
    return "low";
  }

  if (
    occupancy >= 0.70
    && Number.isFinite(iqr)
    && iqr <= 10
    && Number.isFinite(p25)
    && p25 >= displayThresholdDbz
  ) {
    return "high";
  }

  if (
    occupancy >= 0.50
    && (
      iqr == null
      || iqr <= 16
    )
    && median >= displayThresholdDbz
  ) {
    return "medium";
  }

  return "low";
}

export function styleForInferredPoint(
  point,
  {
    displayThresholdDbz = 20,
    basePointSize = 3
  } = {}
) {
  const band =
    supportBandForPoint(
      point,
      {
        displayThresholdDbz
      }
    );

  const definition =
    SUPPORT_BANDS[band];

  return {
    band,

    alpha:
      definition.alpha,

    pixelSize:
      Math.max(
        1.5,
        Number(basePointSize)
        * definition.sizeScale
      ),

    iqr_dbz:
      inferredIqrDbz(point)
  };
}
JS

cp frontend/src/live3d-hybrid-v1.js \
  frontend/src/live3d-hybrid-confidence-v1.js

cp frontend/live3d-hybrid.html \
  frontend/live3d-hybrid-confidence.html

python3 - <<'PY'
from pathlib import Path

p = Path("frontend/src/live3d-hybrid-confidence-v1.js")
text = p.read_text(encoding="utf-8")

import_marker = '''import {
  DEFAULT_OCCUPANCY_THRESHOLD,
  inferColumn,
  pixelCentreMercator,
  representativeDbzForCategory,
  webMercatorToDegrees
} from "./inferred-volume-v1.js?v=live3d-v1";'''

replacement_import = '''import {
  DEFAULT_OCCUPANCY_THRESHOLD,
  inferColumn,
  pixelCentreMercator,
  representativeDbzForCategory,
  webMercatorToDegrees
} from "./inferred-volume-v1.js?v=confidence-v1";

import {
  styleForInferredPoint
} from "./inferred-confidence-v1.js?v=confidence-v1";'''

if import_marker not in text:
    raise SystemExit("ERROR: inferred-volume import block not found.")

text = text.replace(
    import_marker,
    replacement_import,
    1
)

old_declarations = '''  let maxDbzh = null;
  let confidenceSum = 0;'''

new_declarations = '''  let maxDbzh = null;
  let confidenceSum = 0;

  let highSupportPoints = 0;
  let mediumSupportPoints = 0;
  let lowSupportPoints = 0;

  let highSupportTop40 = null;
  let highSupportTop50 = null;'''

if old_declarations not in text:
    raise SystemExit("ERROR: inferred volume declarations not found.")

text = text.replace(
    old_declarations,
    new_declarations,
    1
)

old_colour = '''      for (const point of inferred) {
        const colour =
          colourForDbzh(
            point.dbzh
          ).withAlpha(
            Math.min(
              0.95,
              0.30
              + 0.70
              * point.confidence
            )
          );

        inferredCollection.add({
          position:
            Cesium.Cartesian3
              .fromDegrees(
                geographic.longitude,
                geographic.latitude,
                displayAltitude(
                  point.altitude_m_amsl
                )
              ),

          color:
            colour,

          pixelSize:
            pointSize,

          disableDepthTestDistance:
            0
        });

        renderedPoints++;
        confidenceSum +=
          point.confidence;'''

new_colour = '''      for (const point of inferred) {
        const supportStyle =
          styleForInferredPoint(
            point,
            {
              displayThresholdDbz:
                minimumDbzh,

              basePointSize:
                pointSize
            }
          );

        const colour =
          colourForDbzh(
            point.dbzh
          ).withAlpha(
            supportStyle.alpha
          );

        inferredCollection.add({
          position:
            Cesium.Cartesian3
              .fromDegrees(
                geographic.longitude,
                geographic.latitude,
                displayAltitude(
                  point.altitude_m_amsl
                )
              ),

          color:
            colour,

          pixelSize:
            supportStyle.pixelSize,

          disableDepthTestDistance:
            0
        });

        renderedPoints++;
        confidenceSum +=
          point.confidence;

        if (
          supportStyle.band
          === "high"
        ) {
          highSupportPoints++;
        } else if (
          supportStyle.band
          === "medium"
        ) {
          mediumSupportPoints++;
        } else {
          lowSupportPoints++;
        }

        if (
          supportStyle.band
          === "high"
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
          supportStyle.band
          === "high"
          && point.dbzh >= 50
          && (
            highSupportTop50 == null
            || point.altitude_m_amsl
              > highSupportTop50
          )
        ) {
          highSupportTop50 =
            point.altitude_m_amsl;
        }'''

if old_colour not in text:
    raise SystemExit("ERROR: inferred point rendering block not found.")

text = text.replace(
    old_colour,
    new_colour,
    1
)

metric_marker = '''  $("meanConfidence").textContent =
    renderedPoints
      ? (
          confidenceSum
          / renderedPoints
        ).toFixed(2)
      : "—";

  scene.requestRender();'''

metric_replacement = '''  $("meanConfidence").textContent =
    renderedPoints
      ? (
          confidenceSum
          / renderedPoints
        ).toFixed(2)
      : "—";

  $("highSupportPoints").textContent =
    highSupportPoints
      .toLocaleString();

  $("mediumSupportPoints").textContent =
    mediumSupportPoints
      .toLocaleString();

  $("lowSupportPoints").textContent =
    lowSupportPoints
      .toLocaleString();

  $("highSupportTop40").textContent =
    highSupportTop40 == null
      ? "none"
      : `${(
          highSupportTop40
          / 1000
        ).toFixed(1)} km`;

  $("highSupportTop50").textContent =
    highSupportTop50 == null
      ? "none"
      : `${(
          highSupportTop50
          / 1000
        ).toFixed(1)} km`;

  scene.requestRender();'''

if metric_marker not in text:
    raise SystemExit("ERROR: mean-confidence metric block not found.")

text = text.replace(
    metric_marker,
    metric_replacement,
    1
)

p.write_text(
    text,
    encoding="utf-8"
)
PY

python3 - <<'PY'
from pathlib import Path

p = Path("frontend/live3d-hybrid-confidence.html")
text = p.read_text(encoding="utf-8")

text = text.replace(
    "StormTracker — Hybrid Live 3-D",
    "StormTracker — Hybrid Live 3-D Confidence"
)

text = text.replace(
    "measured 2-D storm tracking • five-event inferred vertical intensity • hybrid prototype V1",
    "measured 2-D tracking • five-event inferred vertical intensity • confidence-aware prototype V2"
)

text = text.replace(
    'src="./src/live3d-hybrid-v1.js"',
    'src="./src/live3d-hybrid-confidence-v1.js"'
)

marker = '''        <span>Mean profile confidence</span>
        <strong id="meanConfidence">—</strong>
      </div>
    </section>'''

replacement = '''        <span>Mean profile occupancy</span>
        <strong id="meanConfidence">—</strong>

        <span>High-support points</span>
        <strong id="highSupportPoints">—</strong>

        <span>Medium-support points</span>
        <strong id="mediumSupportPoints">—</strong>

        <span>Low-support points</span>
        <strong id="lowSupportPoints">—</strong>

        <span>High-support 40 dBZ top</span>
        <strong id="highSupportTop40">—</strong>

        <span>High-support 50 dBZ top</span>
        <strong id="highSupportTop50">—</strong>
      </div>
    </section>

    <section class="card">
      <h2>
        Vertical uncertainty display
      </h2>

      <div class="support-legend-row">
        <span class="support-dot support-high"></span>
        <strong>High support</strong>
        <span>solid — occupancy ≥0.70, IQR ≤10 dBZ, lower quartile still above display threshold</span>
      </div>

      <div class="support-legend-row">
        <span class="support-dot support-medium"></span>
        <strong>Medium support</strong>
        <span>partly transparent — occupancy ≥0.50 with moderate empirical spread</span>
      </div>

      <div class="support-legend-row">
        <span class="support-dot support-low"></span>
        <strong>Low support</strong>
        <span>faded — weak historical occupancy and/or broad P25–P75 spread</span>
      </div>

      <div class="uncertainty-note">
        These bands are display support classes derived from historical
        occupancy and P25–P75 reflectivity spread. They are not calibrated
        probabilities or formal confidence intervals.
      </div>
    </section>'''

if marker not in text:
    raise SystemExit(
        "ERROR: Current inferred volume metric block not found."
    )

text = text.replace(
    marker,
    replacement,
    1
)

style_marker = '''    .hybrid-muted {
      color:#91a3ad;
    }'''

style_add = '''    .hybrid-muted {
      color:#91a3ad;
    }

    .support-legend-row {
      display:grid;
      grid-template-columns:14px 84px 1fr;
      gap:6px;
      align-items:start;
      padding:4px 0;
      font-size:10px;
      line-height:1.35;
    }

    .support-legend-row span:last-child {
      color:#aebdc6;
    }

    .support-dot {
      width:10px;
      height:10px;
      border-radius:50%;
      margin-top:2px;
      background:#d7e4ea;
    }

    .support-high {
      opacity:0.95;
    }

    .support-medium {
      opacity:0.58;
    }

    .support-low {
      opacity:0.22;
    }

    .uncertainty-note {
      margin-top:7px;
      color:#91a3ad;
      font-size:10px;
      line-height:1.4;
    }'''

if style_marker not in text:
    raise SystemExit(
        "ERROR: Hybrid CSS marker not found."
    )

text = text.replace(
    style_marker,
    style_add,
    1
)

p.write_text(
    text,
    encoding="utf-8"
)
PY

cat > frontend/tests/run-inferred-confidence-tests.mjs <<'JS'
import assert from "node:assert/strict";

import {
  inferredIqrDbz,
  styleForInferredPoint,
  supportBandForPoint
} from "../src/inferred-confidence-v1.js";

const high = {
  dbzh: 45,
  confidence: 0.80,
  p25_dbzh: 42,
  p75_dbzh: 49
};

assert.equal(
  inferredIqrDbz(high),
  7
);

assert.equal(
  supportBandForPoint(
    high,
    {
      displayThresholdDbz: 40
    }
  ),
  "high"
);

const medium = {
  dbzh: 44,
  confidence: 0.60,
  p25_dbzh: 35,
  p75_dbzh: 48
};

assert.equal(
  supportBandForPoint(
    medium,
    {
      displayThresholdDbz: 40
    }
  ),
  "medium"
);

const low = {
  dbzh: 43,
  confidence: 0.38,
  p25_dbzh: 29,
  p75_dbzh: 49
};

assert.equal(
  supportBandForPoint(
    low,
    {
      displayThresholdDbz: 40
    }
  ),
  "low"
);

const styledHigh =
  styleForInferredPoint(
    high,
    {
      displayThresholdDbz: 40,
      basePointSize: 4
    }
  );

const styledLow =
  styleForInferredPoint(
    low,
    {
      displayThresholdDbz: 40,
      basePointSize: 4
    }
  );

assert.ok(
  styledHigh.alpha
  > styledLow.alpha
);

assert.ok(
  styledHigh.pixelSize
  > styledLow.pixelSize
);

console.log(
  "5 inferred-confidence tests passed."
);
JS

echo
echo "Checking JavaScript syntax..."
node --check frontend/src/inferred-volume-v1.js
node --check frontend/src/inferred-confidence-v1.js
node --check frontend/src/live3d-hybrid-confidence-v1.js

echo
echo "Running confidence-display tests..."
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
  frontend/live3d-hybrid-confidence.html \
  frontend/src/live3d-hybrid-confidence-v1.js \
  frontend/src/inferred-confidence-v1.js

echo
echo "SUCCESS"
echo "Expected:"
echo "  5 inferred-confidence tests passed."
echo "  4 inferred-volume tests passed."
echo "  14 tests passed."
echo
echo "Commit and push:"
echo 'git add frontend/src/inferred-volume-v1.js frontend/src/inferred-confidence-v1.js frontend/src/live3d-hybrid-confidence-v1.js frontend/live3d-hybrid-confidence.html frontend/tests/run-inferred-confidence-tests.mjs'
echo 'git commit -m "Add confidence-aware inferred 3-D display"'
echo 'git push'
echo
echo "After Pages deploys, open:"
echo "https://blakesmith-intel.github.io/StormTracker/live3d-hybrid-confidence.html"
echo
echo "Press:"
echo "  Load latest inferred 3-D"
echo
echo "Then send back one screenshot plus:"
echo "  High-support points"
echo "  Medium-support points"
echo "  Low-support points"
echo "  High-support 40 dBZ top"
echo "  High-support 50 dBZ top"
