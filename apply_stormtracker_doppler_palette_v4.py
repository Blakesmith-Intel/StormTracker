from pathlib import Path
import subprocess

ROOT = Path("/workspaces/StormTracker")
FRONTEND = ROOT / "frontend"
SRC = FRONTEND / "src"
TESTS = FRONTEND / "tests"

required = [
    SRC / "bom-doppler-intake-v1.js",
]

for path in required:
    if not path.exists():
        raise SystemExit(f"ERROR: missing required file: {path}")

print("StormTracker — Doppler full-palette diagnostic V4")
print()

(SRC / "doppler-palette-full-v4.js").write_text(
r'''function rgbAt(
  data,
  width,
  x,
  y
) {
  const i =
    (
      y * width
      + x
    ) * 4;

  return [
    data[i],
    data[i + 1],
    data[i + 2],
    data[i + 3]
  ];
}

function sameRgb(
  a,
  b
) {
  return (
    a[0] === b[0]
    && a[1] === b[1]
    && a[2] === b[2]
  );
}

function rowRuns(
  imageData,
  y
) {
  const {
    width,
    data
  } = imageData;

  const runs = [];

  let start = 0;
  let previous =
    rgbAt(
      data,
      width,
      0,
      y
    );

  for (
    let x = 1;
    x <= width;
    x++
  ) {
    const current =
      x < width
        ? rgbAt(
            data,
            width,
            x,
            y
          )
        : null;

    if (
      current
      && sameRgb(
        previous,
        current
      )
    ) {
      continue;
    }

    runs.push({
      start,
      end:
        x - 1,
      width:
        x - start,
      rgb:
        previous.slice(
          0,
          3
        ),
      alpha:
        previous[3]
    });

    start =
      x;

    previous =
      current;
  }

  return runs;
}

function chroma(
  rgb
) {
  return (
    Math.max(
      ...rgb
    )
    - Math.min(
      ...rgb
    )
  );
}

function isBlue(
  rgb
) {
  const [
    r,
    g,
    b
  ] = rgb;

  return (
    b >= 70
    && b >= r + 25
    && b >= g
  );
}

function isWarm(
  rgb
) {
  const [
    r,
    g,
    b
  ] = rgb;

  return (
    (
      r >= 110
      && r >= b + 30
    )
    || (
      r >= 170
      && g >= 120
      && b <= 120
    )
  );
}

function isNeutral(
  rgb
) {
  return (
    Math.min(
      ...rgb
    ) >= 175
    && chroma(
      rgb
    ) <= 45
  );
}

function candidateRuns(
  imageData,
  y
) {
  return rowRuns(
    imageData,
    y
  ).filter(
    run =>
      run.alpha > 0
      && run.width >= 4
      && run.width <= 60
      && (
        isBlue(
          run.rgb
        )
        || isWarm(
          run.rgb
        )
        || isNeutral(
          run.rgb
        )
      )
  );
}

function clusterByGap(
  runs,
  {
    maxGap = 3
  } = {}
) {
  if (!runs.length) {
    return [];
  }

  const clusters = [];
  let current = [
    runs[0]
  ];

  for (
    let index = 1;
    index < runs.length;
    index++
  ) {
    const previous =
      current.at(-1);

    const next =
      runs[index];

    const gap =
      next.start
      - previous.end
      - 1;

    if (gap <= maxGap) {
      current.push(
        next
      );
    } else {
      clusters.push(
        current
      );

      current = [
        next
      ];
    }
  }

  clusters.push(
    current
  );

  return clusters;
}

function clusterScore(
  cluster
) {
  if (
    cluster.length < 3
  ) {
    return -Infinity;
  }

  const span =
    cluster.at(-1).end
    - cluster[0].start
    + 1;

  return (
    cluster.length
    * 100
    + span
  );
}

function directionScore(
  cluster,
  predicate
) {
  return cluster.reduce(
    (
      total,
      run
    ) =>
      total
      + (
        predicate(
          run.rgb
        )
          ? 1
          : 0
      ),
    0
  );
}

export function locateFullVelocityPalette(
  imageData
) {
  const {
    width,
    height
  } = imageData;

  const footerStart =
    Math.min(
      width,
      height
    );

  if (
    height <= footerStart
  ) {
    throw new Error(
      `No Bureau footer detected in ${width}x${height} image.`
    );
  }

  let bestRow = null;

  function selectDirectionalCluster(
    clusters,
    predicate
  ) {
    return (
      clusters
        .map(
          cluster => {
            const selected =
              cluster.filter(
                run =>
                  predicate(
                    run.rgb
                  )
              );

            return {
              cluster:
                selected,

              score:
                selected.length >= 3
                  ? clusterScore(
                      selected
                    )
                  : -Infinity
            };
          }
        )
        .filter(
          item =>
            item.cluster.length >= 3
        )
        .sort(
          (a, b) =>
            b.score
            - a.score
        )[0]
      ?? null
    );
  }

  for (
    let y = footerStart;
    y < height;
    y++
  ) {
    const runs =
      candidateRuns(
        imageData,
        y
      );

    const clusters =
      clusterByGap(
        runs
      );

    const blue =
      selectDirectionalCluster(
        clusters,
        isBlue
      );

    const warm =
      selectDirectionalCluster(
        clusters,
        isWarm
      );

    const neutrals =
      runs.filter(
        run =>
          isNeutral(
            run.rgb
          )
      );

    const score =
      (
        blue
          ?.score
        ?? 0
      )
      + (
        warm
          ?.score
        ?? 0
      )
      + neutrals.length
        * 50;

    if (
      !bestRow
      || score
        > bestRow.score
    ) {
      bestRow = {
        y,
        footerStart,
        score,

        towards:
          blue
            ?.cluster
          ?? [],

        away:
          warm
            ?.cluster
          ?? [],

        neutral:
          neutrals
      };
    }
  }

  return bestRow;
}

function createCrop(
  sourceCanvas,
  {
    x0,
    x1,
    y0,
    y1,
    scale = 1
  }
) {
  const sourceX0 =
    Math.max(
      0,
      Math.floor(
        x0
      )
    );

  const sourceX1 =
    Math.min(
      sourceCanvas.width - 1,
      Math.ceil(
        x1
      )
    );

  const sourceY0 =
    Math.max(
      0,
      Math.floor(
        y0
      )
    );

  const sourceY1 =
    Math.min(
      sourceCanvas.height - 1,
      Math.ceil(
        y1
      )
    );

  const width =
    sourceX1
    - sourceX0
    + 1;

  const height =
    sourceY1
    - sourceY0
    + 1;

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    width
    * scale;

  canvas.height =
    height
    * scale;

  const context =
    canvas.getContext(
      "2d"
    );

  context.imageSmoothingEnabled =
    false;

  context.drawImage(
    sourceCanvas,
    sourceX0,
    sourceY0,
    width,
    height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas;
}

function boundsForRuns(
  runs
) {
  if (!runs.length) {
    return null;
  }

  return {
    minX:
      Math.min(
        ...runs.map(
          run =>
            run.start
        )
      ),

    maxX:
      Math.max(
        ...runs.map(
          run =>
            run.end
        )
      )
  };
}

export function buildPaletteDiagnostic(
  sourceCanvas
) {
  const context =
    sourceCanvas.getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    );

  const imageData =
    context.getImageData(
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height
    );

  const palette =
    locateFullVelocityPalette(
      imageData
    );

  if (!palette) {
    throw new Error(
      "Unable to locate Bureau Doppler palette in footer."
    );
  }

  const footerOverview =
    createCrop(
      sourceCanvas,
      {
        x0:
          0,

        x1:
          sourceCanvas.width - 1,

        y0:
          palette.footerStart,

        y1:
          sourceCanvas.height - 1,

        scale:
          2
      }
    );

  const towardsBounds =
    boundsForRuns(
      palette.towards
    );

  const awayBounds =
    boundsForRuns(
      palette.away
    );

  const towardsCrop =
    towardsBounds
      ? createCrop(
          sourceCanvas,
          {
            x0:
              towardsBounds.minX - 12,

            x1:
              towardsBounds.maxX + 12,

            y0:
              palette.y - 4,

            y1:
              sourceCanvas.height - 1,

            scale:
              8
          }
        )
      : null;

  const awayCrop =
    awayBounds
      ? createCrop(
          sourceCanvas,
          {
            x0:
              awayBounds.minX - 12,

            x1:
              awayBounds.maxX + 12,

            y0:
              palette.y - 4,

            y1:
              sourceCanvas.height - 1,

            scale:
              8
          }
        )
      : null;

  return {
    palette,
    footerOverview,
    towardsCrop,
    awayCrop
  };
}
''',
encoding="utf-8"
)

(FRONTEND / "doppler-palette-v4.html").write_text(
r'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>
<title>
  StormTracker — Doppler Full Palette V4
</title>

<style>
  * {
    box-sizing:border-box;
  }

  body {
    margin:0;
    background:#0b141a;
    color:#eef5f8;
    font-family:
      Inter,
      system-ui,
      sans-serif;
  }

  main {
    max-width:1500px;
    margin:0 auto;
    padding:18px;
  }

  h1 {
    margin:0 0 5px;
  }

  .note {
    max-width:1100px;
    color:#a9bbc4;
    line-height:1.45;
  }

  button {
    padding:9px 12px;
    border:1px solid #496473;
    border-radius:6px;
    background:#1a2d38;
    color:#fff;
    cursor:pointer;
    margin:10px 0;
  }

  .card {
    margin-top:12px;
    padding:12px;
    border:1px solid #30424d;
    border-radius:8px;
    background:#111e26;
  }

  #status {
    white-space:pre-wrap;
    font:
      11px/1.45
      ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
  }

  .overview canvas {
    width:100%;
    height:auto;
    image-rendering:pixelated;
    background:#000;
  }

  .crop {
    width:100%;
    overflow:auto;
    padding:8px;
    background:#020507;
    border-radius:6px;
    margin-top:6px;
  }

  .crop canvas {
    display:block;
    max-width:none;
    image-rendering:pixelated;
  }

  .direction-grid {
    display:grid;
    grid-template-columns:
      repeat(
        2,
        minmax(
          0,
          1fr
        )
      );
    gap:10px;
  }

  @media (
    max-width:
      900px
  ) {
    .direction-grid {
      grid-template-columns:
        1fr;
    }
  }

  .runs {
    display:flex;
    flex-wrap:wrap;
    gap:6px;
    margin-top:8px;
  }

  .run {
    min-width:145px;
    display:grid;
    grid-template-columns:22px 1fr;
    gap:6px;
    align-items:center;
    font-size:10px;
    color:#b8c6ce;
  }

  .swatch {
    width:22px;
    height:14px;
    border:
      1px solid
      rgba(
        255,
        255,
        255,
        .4
      );
  }

  .meta {
    display:grid;
    grid-template-columns:170px 1fr;
    gap:4px 8px;
    font-size:12px;
    margin-bottom:8px;
  }

  .meta span:nth-child(odd) {
    color:#9fb2bc;
  }

  .warning {
    margin-top:10px;
    padding:8px;
    border-left:3px solid #d6aa3a;
    background:#182129;
    color:#d8e2e7;
    font-size:11px;
    line-height:1.45;
  }

  pre {
    overflow:auto;
    padding:8px;
    background:#071016;
    border-radius:6px;
    color:#c7d5dd;
    font-size:10px;
  }
</style>
</head>

<body>
<main>
  <h1>
    StormTracker Doppler full-palette V4
  </h1>

  <p class="note">
    V3 proved the Bureau footer can be isolated cleanly. V4 keeps the entire
    footer visible at once, then separately extracts the blue towards-radar
    side and the warm away-from-radar side. No numeric velocity values are
    invented here.
  </p>

  <button id="loadAll">
    Load full palette for 66 / 50 / 08
  </button>

  <section class="card">
    <strong>Status</strong>
    <div id="status">
      Ready.
    </div>
  </section>

  <div id="results"></div>
</main>

<script type="module">
import {
  loadDopplerDiagnostic
} from "./src/bom-doppler-intake-v1.js?v=full-palette-v4";

import {
  buildPaletteDiagnostic
} from "./src/doppler-palette-full-v4.js?v=full-palette-v4";

const status =
  document.getElementById(
    "status"
  );

const results =
  document.getElementById(
    "results"
  );

function rgbCss(
  rgb
) {
  return `rgb(${rgb.join(",")})`;
}

function addRuns(
  container,
  runs
) {
  for (
    const [
      index,
      run
    ]
    of runs.entries()
  ) {
    const item =
      document.createElement(
        "div"
      );

    item.className =
      "run";

    const swatch =
      document.createElement(
        "span"
      );

    swatch.className =
      "swatch";

    swatch.style.background =
      rgbCss(
        run.rgb
      );

    const label =
      document.createElement(
        "span"
      );

    label.textContent =
      `${String(index + 1).padStart(2,"0")}: ` +
      `${run.rgb.join(",")}  x=${run.start}…${run.end}`;

    item.append(
      swatch,
      label
    );

    container.appendChild(
      item
    );
  }
}

async function inspect(
  radarId
) {
  status.textContent =
    `Loading radar ${radarId}…`;

  const source =
    await loadDopplerDiagnostic(
      radarId
    );

  const diagnostic =
    buildPaletteDiagnostic(
      source.canvas
    );

  const card =
    document.createElement(
      "section"
    );

  card.className =
    "card";

  const heading =
    document.createElement(
      "h2"
    );

  heading.textContent =
    `${radarId} — ${source.product}`;

  card.appendChild(
    heading
  );

  const meta =
    document.createElement(
      "div"
    );

  meta.className =
    "meta";

  meta.innerHTML = `
    <span>Image</span>
    <strong>${source.width} × ${source.height}</strong>

    <span>Palette row</span>
    <strong>source y=${diagnostic.palette.y}</strong>

    <span>Towards swatches</span>
    <strong>${diagnostic.palette.towards.length}</strong>

    <span>Away swatches</span>
    <strong>${diagnostic.palette.away.length}</strong>

    <span>Neutral candidates</span>
    <strong>${diagnostic.palette.neutral.length}</strong>
  `;

  card.appendChild(
    meta
  );

  const overviewTitle =
    document.createElement(
      "h3"
    );

  overviewTitle.textContent =
    "Entire Bureau footer — fitted to page";

  card.appendChild(
    overviewTitle
  );

  const overview =
    document.createElement(
      "div"
    );

  overview.className =
    "overview";

  overview.appendChild(
    diagnostic.footerOverview
  );

  card.appendChild(
    overview
  );

  const grid =
    document.createElement(
      "div"
    );

  grid.className =
    "direction-grid";

  for (
    const direction
    of [
      {
        label:
          "Towards radar",

        runs:
          diagnostic.palette.towards,

        canvas:
          diagnostic.towardsCrop
      },

      {
        label:
          "Away from radar",

        runs:
          diagnostic.palette.away,

        canvas:
          diagnostic.awayCrop
      }
    ]
  ) {
    const panel =
      document.createElement(
        "div"
      );

    const title =
      document.createElement(
        "h3"
      );

    title.textContent =
      `${direction.label} — 8× crop`;

    panel.appendChild(
      title
    );

    if (
      direction.canvas
    ) {
      const crop =
        document.createElement(
          "div"
        );

      crop.className =
        "crop";

      crop.appendChild(
        direction.canvas
      );

      panel.appendChild(
        crop
      );
    }

    const runs =
      document.createElement(
        "div"
      );

    runs.className =
      "runs";

    addRuns(
      runs,
      direction.runs
    );

    panel.appendChild(
      runs
    );

    grid.appendChild(
      panel
    );
  }

  card.appendChild(
    grid
  );

  const machineTitle =
    document.createElement(
      "h3"
    );

  machineTitle.textContent =
    "Machine-readable RGB order";

  card.appendChild(
    machineTitle
  );

  const pre =
    document.createElement(
      "pre"
    );

  pre.textContent =
    JSON.stringify(
      {
        radar:
          radarId,

        product:
          source.product,

        towards:
          diagnostic.palette.towards.map(
            run =>
              run.rgb
          ),

        neutral:
          diagnostic.palette.neutral.map(
            run =>
              run.rgb
          ),

        away:
          diagnostic.palette.away.map(
            run =>
              run.rgb
          )
      },
      null,
      2
    );

  card.appendChild(
    pre
  );

  const warning =
    document.createElement(
      "div"
    );

  warning.className =
    "warning";

  warning.textContent =
    "This establishes exact colour order only. BOM documents blue as toward " +
    "the radar and yellow/orange/red as away from the radar, but the exact " +
    "numeric velocity scale must still be verified before km/h values are " +
    "used in StormTracker.";

  card.appendChild(
    warning
  );

  results.appendChild(
    card
  );

  return diagnostic;
}

document
  .getElementById(
    "loadAll"
  )
  .addEventListener(
    "click",
    async () => {
      try {
        results.innerHTML =
          "";

        const summary = [];

        for (
          const radarId
          of ["66","50","08"]
        ) {
          const diagnostic =
            await inspect(
              radarId
            );

          summary.push(
            `${radarId}:` +
            `${diagnostic.palette.towards.length}/` +
            `${diagnostic.palette.neutral.length}/` +
            `${diagnostic.palette.away.length}`
          );
        }

        status.textContent =
          "DOPPLER FULL PALETTE V4: PASS — " +
          summary.join(" | ") +
          ". Exact RGB order recovered; numeric velocity mapping remains unset.";
      } catch (error) {
        console.error(
          error
        );

        status.textContent =
          `ERROR — ${error.message}`;
      }
    }
  );
</script>
</body>
</html>
''',
encoding="utf-8"
)

(TESTS / "run-doppler-palette-v4-tests.mjs").write_text(
r'''import assert from "node:assert/strict";

import {
  locateFullVelocityPalette
} from "../src/doppler-palette-full-v4.js";

function fixture() {
  const width =
    120;

  const height =
    150;

  const data =
    new Uint8ClampedArray(
      width
      * height
      * 4
    );

  function setPixel(
    x,
    y,
    rgb
  ) {
    const i =
      (
        y
        * width
        + x
      )
      * 4;

    data[i] =
      rgb[0];

    data[i + 1] =
      rgb[1];

    data[i + 2] =
      rgb[2];

    data[i + 3] =
      255;
  }

  for (
    let y = 0;
    y < height;
    y++
  ) {
    for (
      let x = 0;
      x < width;
      x++
    ) {
      setPixel(
        x,
        y,
        [8,8,8]
      );
    }
  }

  const barY =
    132;

  const towards = [
    [0,0,120],
    [0,0,180],
    [0,60,220],
    [0,130,250]
  ];

  const away = [
    [255,245,0],
    [255,170,0],
    [255,90,0],
    [210,0,0]
  ];

  let x =
    8;

  for (
    const rgb
    of towards
  ) {
    for (
      let n = 0;
      n < 10;
      n++
    ) {
      setPixel(
        x + n,
        barY,
        rgb
      );
    }

    x +=
      10;
  }

  for (
    let n = 0;
    n < 8;
    n++
  ) {
    setPixel(
      x + n,
      barY,
      [240,240,240]
    );
  }

  x +=
    10;

  for (
    const rgb
    of away
  ) {
    for (
      let n = 0;
      n < 10;
      n++
    ) {
      setPixel(
        x + n,
        barY,
        rgb
      );
    }

    x +=
      10;
  }

  return {
    width,
    height,
    data
  };
}

const result =
  locateFullVelocityPalette(
    fixture()
  );

assert.ok(
  result
);

assert.equal(
  result.y,
  132
);

assert.equal(
  result.towards.length,
  4
);

assert.equal(
  result.away.length,
  4
);

assert.ok(
  result.neutral.length
  >= 1
);

assert.deepEqual(
  result.towards[0].rgb,
  [0,0,120]
);

assert.deepEqual(
  result.away.at(-1).rgb,
  [210,0,0]
);

console.log(
  "7 Doppler full-palette V4 tests passed."
);
''',
encoding="utf-8"
)

print("Checking JavaScript syntax...")

subprocess.run(
    [
        "node",
        "--check",
        "frontend/src/doppler-palette-full-v4.js"
    ],
    cwd=ROOT,
    check=True,
)

print()
print("Running Doppler palette V4 tests...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-doppler-palette-v4-tests.mjs"
    ],
    cwd=ROOT,
    check=True,
)

print()
print("Running Doppler intake tests...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-doppler-intake-tests.mjs"
    ],
    cwd=ROOT,
    check=True,
)

print()
print("Running existing StormTracker tests...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-node-tests.mjs"
    ],
    cwd=ROOT,
    check=True,
)

print()
print("SUCCESS")
print("Expected:")
print("  7 Doppler full-palette V4 tests passed.")
print("  5 Doppler intake tests passed.")
print("  14 tests passed.")
print()
print("Commit and push:")
print(
    'git add '
    'frontend/doppler-palette-v4.html '
    'frontend/src/doppler-palette-full-v4.js '
    'frontend/tests/run-doppler-palette-v4-tests.mjs'
)
print(
    'git commit -m "Recover full public BOM Doppler palette"'
)
print("git push")
print()
print("After Pages deploys, open:")
print(
    "https://blakesmith-intel.github.io/StormTracker/"
    "doppler-palette-v4.html"
)
print()
print("Press:")
print("  Load full palette for 66 / 50 / 08")
print()
print(
    "Send one screenshot showing the fitted full footer and both "
    "towards/away crops for radar 66."
)
