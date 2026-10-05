#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

echo "StormTracker — Doppler palette recovery diagnostic v1"
echo

for f in \
  frontend/doppler-intake-v1.html \
  frontend/src/bom-doppler-intake-v1.js
do
  if [ ! -f "$f" ]; then
    echo "ERROR: Missing required file:"
    echo "  $f"
    exit 1
  fi
done

cat > frontend/src/doppler-palette-recovery-v1.js <<'JS'
function rgbAt(
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

function isColourCandidate(
  rgba
) {
  const [
    r,
    g,
    b,
    a
  ] = rgba;

  if (a === 0) {
    return false;
  }

  const maximum =
    Math.max(
      r,
      g,
      b
    );

  const minimum =
    Math.min(
      r,
      g,
      b
    );

  const spread =
    maximum
    - minimum;

  // Reject black/white/grey map text and footer background.
  return (
    maximum >= 80
    && spread >= 35
  );
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

  const raw = [];

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

    raw.push({
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
      rgba:
        previous
    });

    start =
      x;

    previous =
      current;
  }

  return raw;
}

export function locateEmbeddedLegend(
  imageData
) {
  const {
    width,
    height
  } = imageData;

  const searchStart =
    Math.max(
      0,
      height - 100
    );

  let best = null;

  for (
    let y = searchStart;
    y < height;
    y++
  ) {
    const runs =
      rowRuns(
        imageData,
        y
      );

    const candidates =
      runs.filter(
        run =>
          run.width >= 3
          && isColourCandidate(
            run.rgba
          )
      );

    if (!candidates.length) {
      continue;
    }

    const colourWidth =
      candidates.reduce(
        (
          sum,
          run
        ) =>
          sum + run.width,
        0
      );

    const longRuns =
      candidates.filter(
        run =>
          run.width >= 8
      );

    // The embedded BOM velocity bar is the strongest sequence of
    // long, saturated horizontal runs in the footer.
    const score =
      colourWidth
      + longRuns.length * 25;

    if (
      !best
      || score > best.score
    ) {
      best = {
        y,
        score,
        runs:
          candidates
      };
    }
  }

  if (!best) {
    return null;
  }

  // Keep only meaningful swatches around the long colour bar.
  const substantial =
    best.runs.filter(
      run =>
        run.width >= 5
    );

  if (!substantial.length) {
    return best;
  }

  const minX =
    Math.max(
      0,
      Math.min(
        ...substantial.map(
          run => run.start
        )
      ) - 18
    );

  const maxX =
    Math.min(
      width - 1,
      Math.max(
        ...substantial.map(
          run => run.end
        )
      ) + 18
    );

  return {
    ...best,
    minX,
    maxX,
    runs:
      substantial
  };
}

export function createEnlargedLegendCanvas(
  sourceCanvas,
  legend,
  {
    scale = 4
  } = {}
) {
  if (!legend) {
    return null;
  }

  const sourceWidth =
    sourceCanvas.width;

  const sourceHeight =
    sourceCanvas.height;

  const x0 =
    legend.minX
    ?? 0;

  const x1 =
    legend.maxX
    ?? (
      sourceWidth - 1
    );

  const y0 =
    Math.max(
      0,
      legend.y - 12
    );

  const y1 =
    sourceHeight - 1;

  const cropWidth =
    x1 - x0 + 1;

  const cropHeight =
    y1 - y0 + 1;

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    cropWidth * scale;

  canvas.height =
    cropHeight * scale;

  const context =
    canvas.getContext(
      "2d"
    );

  context.imageSmoothingEnabled =
    false;

  context.drawImage(
    sourceCanvas,
    x0,
    y0,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas;
}

export function analyseDopplerLegend(
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

  const legend =
    locateEmbeddedLegend(
      imageData
    );

  return {
    legend,

    enlargedCanvas:
      createEnlargedLegendCanvas(
        sourceCanvas,
        legend
      )
  };
}
JS

cat > frontend/doppler-palette-v1.html <<'HTML'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>
<title>
  StormTracker — Doppler Palette Recovery
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
    max-width:1300px;
    margin:0 auto;
    padding:18px;
  }

  h1 {
    margin:0 0 4px;
  }

  .note {
    color:#a9bbc4;
    line-height:1.45;
    max-width:1000px;
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
    border:1px solid #30424d;
    border-radius:8px;
    background:#111e26;
    padding:12px;
  }

  #status {
    white-space:pre-wrap;
    font-family:
      ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
    font-size:11px;
  }

  .legend-scroll {
    width:100%;
    overflow-x:auto;
    padding:8px;
    background:#05090c;
    border-radius:6px;
    margin-top:8px;
  }

  .legend-scroll canvas {
    display:block;
    max-width:none;
    image-rendering:pixelated;
  }

  .runs {
    display:flex;
    flex-wrap:wrap;
    gap:6px;
    margin-top:10px;
  }

  .run {
    display:grid;
    grid-template-columns:20px 1fr;
    gap:5px;
    align-items:center;
    min-width:145px;
    font-size:10px;
    color:#b8c6ce;
  }

  .swatch {
    width:20px;
    height:14px;
    border:1px solid rgba(255,255,255,.35);
  }

  .meta {
    display:grid;
    grid-template-columns:150px 1fr;
    gap:4px 8px;
    font-size:12px;
  }

  .meta span:nth-child(odd) {
    color:#9fb2bc;
  }

  .instruction {
    margin-top:9px;
    padding:8px;
    border-left:3px solid #d6aa3a;
    background:#182129;
    color:#d5e0e5;
    font-size:11px;
    line-height:1.45;
  }
</style>
</head>

<body>
<main>
  <h1>
    StormTracker Doppler palette recovery
  </h1>

  <p class="note">
    This page reads the live public Bureau Doppler GIFs through the existing
    relay, finds the embedded horizontal velocity legend, enlarges it without
    smoothing, and lists the exact RGB runs from left to right. No velocity
    values are assigned automatically.
  </p>

  <button id="loadAll">
    Load and inspect all three Doppler legends
  </button>

  <div class="card">
    <strong>Status</strong>
    <div id="status">
      Ready.
    </div>
  </div>

  <div id="results"></div>
</main>

<script type="module">
import {
  loadDopplerDiagnostic
} from "./src/bom-doppler-intake-v1.js?v=palette-recovery-v1";

import {
  analyseDopplerLegend
} from "./src/doppler-palette-recovery-v1.js?v=palette-recovery-v1";

const results =
  document.getElementById(
    "results"
  );

const status =
  document.getElementById(
    "status"
  );

function rgbCss(rgb) {
  return `rgb(${rgb.join(",")})`;
}

async function inspectRadar(
  radarId
) {
  status.textContent =
    `Loading Doppler radar ${radarId}…`;

  const source =
    await loadDopplerDiagnostic(
      radarId
    );

  const analysis =
    analyseDopplerLegend(
      source.canvas
    );

  if (!analysis.legend) {
    throw new Error(
      `Could not locate embedded velocity legend for radar ${radarId}.`
    );
  }

  const card =
    document.createElement(
      "section"
    );

  card.className =
    "card";

  const title =
    document.createElement(
      "h2"
    );

  title.textContent =
    `${radarId} — ${source.product}`;

  card.appendChild(
    title
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

    <span>Last-Modified</span>
    <strong>${source.lastModified ?? "not supplied"}</strong>

    <span>Detected legend row</span>
    <strong>y=${analysis.legend.y}</strong>

    <span>Detected long colour runs</span>
    <strong>${analysis.legend.runs.length}</strong>
  `;

  card.appendChild(
    meta
  );

  const cropTitle =
    document.createElement(
      "h3"
    );

  cropTitle.textContent =
    "4× enlarged embedded Bureau velocity legend";

  card.appendChild(
    cropTitle
  );

  const scroll =
    document.createElement(
      "div"
    );

  scroll.className =
    "legend-scroll";

  scroll.appendChild(
    analysis.enlargedCanvas
  );

  card.appendChild(
    scroll
  );

  const runTitle =
    document.createElement(
      "h3"
    );

  runTitle.textContent =
    "Detected exact RGB runs — left to right";

  card.appendChild(
    runTitle
  );

  const runs =
    document.createElement(
      "div"
    );

  runs.className =
    "runs";

  for (
    const [
      index,
      run
    ]
    of analysis.legend.runs.entries()
  ) {
    const row =
      document.createElement(
        "div"
      );

    row.className =
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
      `${run.rgb.join(",")}  (${run.width}px)`;

    row.append(
      swatch,
      label
    );

    runs.appendChild(
      row
    );
  }

  card.appendChild(
    runs
  );

  const instruction =
    document.createElement(
      "div"
    );

  instruction.className =
    "instruction";

  instruction.textContent =
    "The enlarged strip is intentionally the authoritative next check. " +
    "We will read the Bureau's printed velocity labels and map them to these " +
    "exact RGB runs before Doppler is allowed into StormTracker analysis.";

  card.appendChild(
    instruction
  );

  results.appendChild(
    card
  );

  return analysis.legend.runs;
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

        const summaries = [];

        for (
          const radarId
          of ["66","50","08"]
        ) {
          const runs =
            await inspectRadar(
              radarId
            );

          summaries.push(
            `${radarId}:${runs.length}`
          );
        }

        status.textContent =
          "DOPPLER PALETTE INTAKE: PASS — " +
          summaries.join(" | ") +
          ". No velocity mapping has been assumed.";
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
HTML

cat > frontend/tests/run-doppler-palette-recovery-tests.mjs <<'JS'
import assert from "node:assert/strict";

import {
  locateEmbeddedLegend
} from "../src/doppler-palette-recovery-v1.js";

function fakeImageData() {
  const width =
    120;

  const height =
    40;

  const data =
    new Uint8ClampedArray(
      width * height * 4
    );

  function setPixel(
    x,
    y,
    rgb
  ) {
    const i =
      (
        y * width
        + x
      ) * 4;

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
        [10,10,10]
      );
    }
  }

  const colours = [
    [0,40,220],
    [0,180,255],
    [255,255,0],
    [255,120,0],
    [255,0,0]
  ];

  let x =
    20;

  for (
    const colour
    of colours
  ) {
    for (
      let i = 0;
      i < 12;
      i++
    ) {
      setPixel(
        x + i,
        32,
        colour
      );
    }

    x +=
      12;
  }

  return {
    width,
    height,
    data
  };
}

const legend =
  locateEmbeddedLegend(
    fakeImageData()
  );

assert.ok(
  legend
);

assert.equal(
  legend.y,
  32
);

assert.equal(
  legend.runs.length,
  5
);

assert.deepEqual(
  legend.runs[0].rgb,
  [0,40,220]
);

assert.deepEqual(
  legend.runs.at(-1).rgb,
  [255,0,0]
);

console.log(
  "5 Doppler palette-recovery tests passed."
);
JS

echo
echo "Checking syntax..."
node --check frontend/src/doppler-palette-recovery-v1.js

echo
echo "Running palette-recovery tests..."
node frontend/tests/run-doppler-palette-recovery-tests.mjs

echo
echo "Running Doppler intake tests..."
node frontend/tests/run-doppler-intake-tests.mjs

echo
echo "Running existing StormTracker tests..."
node frontend/tests/run-node-tests.mjs

echo
echo "SUCCESS"
echo "Expected:"
echo "  5 Doppler palette-recovery tests passed."
echo "  5 Doppler intake tests passed."
echo "  14 tests passed."
echo
echo "Commit and push:"
echo 'git add frontend/doppler-palette-v1.html frontend/src/doppler-palette-recovery-v1.js frontend/tests/run-doppler-palette-recovery-tests.mjs'
echo 'git commit -m "Add exact Doppler palette recovery diagnostic"'
echo 'git push'
echo
echo "After Pages deploys, open:"
echo "https://blakesmith-intel.github.io/StormTracker/doppler-palette-v1.html"
echo
echo "Press:"
echo "  Load and inspect all three Doppler legends"
echo
echo "Send back one screenshot showing the enlarged legends and RGB runs."
