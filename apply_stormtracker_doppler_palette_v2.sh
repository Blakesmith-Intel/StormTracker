#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

echo "StormTracker — Doppler palette isolation V2"
echo

for f in \
  frontend/src/bom-doppler-intake-v1.js \
  frontend/src/doppler-palette-recovery-v1.js \
  frontend/doppler-palette-v1.html
do
  if [ ! -f "$f" ]; then
    echo "ERROR: Missing required file:"
    echo "  $f"
    exit 1
  fi
done

cat > frontend/src/doppler-palette-recovery-v2.js <<'JS'
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

function isChromatic(
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

  return (
    maximum >= 70
    && maximum - minimum >= 30
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
        current,
        previous
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
      rgba:
        previous
    });

    start =
      x;

    previous =
      current;
  }

  return runs;
}

function coefficientOfVariation(
  values
) {
  if (
    !values.length
  ) {
    return Infinity;
  }

  const mean =
    values.reduce(
      (a, b) =>
        a + b,
      0
    )
    / values.length;

  if (!(mean > 0)) {
    return Infinity;
  }

  const variance =
    values.reduce(
      (sum, value) =>
        sum
        + (
          value - mean
        ) ** 2,
      0
    )
    / values.length;

  return (
    Math.sqrt(
      variance
    )
    / mean
  );
}

function candidateClusters(
  runs
) {
  const eligible =
    runs.filter(
      run =>
        run.width >= 4
        && run.width <= 40
        && isChromatic(
          run.rgba
        )
    );

  if (!eligible.length) {
    return [];
  }

  const clusters = [];

  let current = [
    eligible[0]
  ];

  for (
    let index = 1;
    index < eligible.length;
    index++
  ) {
    const previous =
      current.at(-1);

    const next =
      eligible[index];

    const gap =
      next.start
      - previous.end
      - 1;

    // The Bureau palette is a contiguous chain of rectangular swatches.
    // Allow only tiny separator/border gaps.
    if (gap <= 3) {
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

function scoreCluster(
  cluster
) {
  if (
    cluster.length < 6
  ) {
    return -Infinity;
  }

  const widths =
    cluster.map(
      run =>
        run.width
    );

  const widthCv =
    coefficientOfVariation(
      widths
    );

  const span =
    cluster.at(-1).end
    - cluster[0].start
    + 1;

  const directionalColours =
    cluster.filter(
      run => {
        const [
          r,
          g,
          b
        ] = run.rgb;

        return (
          b > r + 25
          || r > b + 25
          || (
            r > 180
            && g > 130
            && b < 120
          )
        );
      }
    ).length;

  return (
    cluster.length * 120
    + span
    + directionalColours * 35
    - widthCv * 350
  );
}

export function locateVelocityBar(
  imageData
) {
  const {
    height
  } = imageData;

  const searchStart =
    Math.max(
      0,
      height - 95
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

    for (
      const cluster
      of candidateClusters(
        runs
      )
    ) {
      const score =
        scoreCluster(
          cluster
        );

      if (
        !best
        || score > best.score
      ) {
        best = {
          y,
          score,
          runs:
            cluster,
          minX:
            cluster[0].start,
          maxX:
            cluster.at(-1).end
        };
      }
    }
  }

  return best;
}

export function createFooterCrop(
  sourceCanvas,
  bar,
  {
    scale = 8
  } = {}
) {
  if (!bar) {
    return null;
  }

  const x0 =
    Math.max(
      0,
      bar.minX - 12
    );

  const x1 =
    Math.min(
      sourceCanvas.width - 1,
      bar.maxX + 12
    );

  // Include both the bar and all Bureau text beneath it.
  const y0 =
    Math.max(
      0,
      bar.y - 18
    );

  const y1 =
    Math.min(
      sourceCanvas.height - 1,
      bar.y + 52
    );

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

  return {
    canvas,
    crop: {
      x0,
      x1,
      y0,
      y1,
      scale
    }
  };
}

export function analyseVelocityPalette(
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

  const bar =
    locateVelocityBar(
      imageData
    );

  if (!bar) {
    return {
      bar: null,
      footer: null
    };
  }

  return {
    bar,
    footer:
      createFooterCrop(
        sourceCanvas,
        bar
      )
  };
}
JS

cat > frontend/doppler-palette-v2.html <<'HTML'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>
<title>
  StormTracker — Doppler Palette Isolation V2
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
    max-width:1400px;
    margin:0 auto;
    padding:18px;
  }

  h1 {
    margin:0 0 5px;
  }

  .note {
    max-width:1050px;
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
    font-family:
      ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
    font-size:11px;
  }

  .footer-scroll {
    overflow:auto;
    width:100%;
    padding:8px;
    background:#020507;
    border-radius:6px;
  }

  .footer-scroll canvas {
    display:block;
    max-width:none;
    image-rendering:pixelated;
  }

  .runs {
    display:flex;
    flex-wrap:wrap;
    gap:7px;
    margin-top:8px;
  }

  .run {
    min-width:150px;
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
    border:1px solid rgba(255,255,255,.4);
  }

  .meta {
    display:grid;
    grid-template-columns:150px 1fr;
    gap:4px 8px;
    font-size:12px;
    margin-bottom:8px;
  }

  .meta span:nth-child(odd) {
    color:#9fb2bc;
  }

  .warning {
    border-left:3px solid #d6aa3a;
    padding:8px;
    background:#182129;
    color:#d8e2e7;
    font-size:11px;
    line-height:1.45;
    margin-top:8px;
  }
</style>
</head>

<body>
<main>
  <h1>
    StormTracker Doppler palette isolation V2
  </h1>

  <p class="note">
    V1 successfully found the footer area, but its RGB list was contaminated
    by coloured map pixels. V2 looks specifically for the contiguous chain of
    equal-width chromatic swatches that forms the Bureau Doppler velocity bar.
    The full footer around that bar is enlarged 8× so any printed velocity
    labels can be read directly.
  </p>

  <button id="loadAll">
    Load and isolate all three velocity bars
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
} from "./src/bom-doppler-intake-v1.js?v=palette-v2";

import {
  analyseVelocityPalette
} from "./src/doppler-palette-recovery-v2.js?v=palette-v2";

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

async function inspect(
  radarId
) {
  status.textContent =
    `Loading radar ${radarId}…`;

  const source =
    await loadDopplerDiagnostic(
      radarId
    );

  const analysis =
    analyseVelocityPalette(
      source.canvas
    );

  if (!analysis.bar) {
    throw new Error(
      `Velocity bar not isolated for radar ${radarId}.`
    );
  }

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

    <span>Detected bar row</span>
    <strong>y=${analysis.bar.y}</strong>

    <span>Velocity swatches</span>
    <strong>${analysis.bar.runs.length}</strong>

    <span>Bar span</span>
    <strong>x=${analysis.bar.minX}…${analysis.bar.maxX}</strong>
  `;

  card.appendChild(
    meta
  );

  const cropTitle =
    document.createElement(
      "h3"
    );

  cropTitle.textContent =
    "8× pixel-perfect footer crop";

  card.appendChild(
    cropTitle
  );

  const scroll =
    document.createElement(
      "div"
    );

  scroll.className =
    "footer-scroll";

  scroll.appendChild(
    analysis.footer.canvas
  );

  card.appendChild(
    scroll
  );

  const runTitle =
    document.createElement(
      "h3"
    );

  runTitle.textContent =
    "Isolated swatches — exact RGB, left to right";

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
    of analysis.bar.runs.entries()
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
      `${run.rgb.join(",")} (${run.width}px)`;

    item.append(
      swatch,
      label
    );

    runs.appendChild(
      item
    );
  }

  card.appendChild(
    runs
  );

  const warning =
    document.createElement(
      "div"
    );

  warning.className =
    "warning";

  warning.textContent =
    "Do not infer the numeric velocities from colour order alone. " +
    "The next decoder will only be created after the Bureau's printed scale " +
    "or another authoritative value mapping is confirmed.";

  card.appendChild(
    warning
  );

  results.appendChild(
    card
  );

  return analysis;
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
          const analysis =
            await inspect(
              radarId
            );

          summaries.push(
            `${radarId}:${analysis.bar.runs.length}`
          );
        }

        status.textContent =
          "DOPPLER PALETTE ISOLATION V2: PASS — " +
          summaries.join(" | ") +
          ". Numeric velocity mapping still deliberately unset.";
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

cat > frontend/tests/run-doppler-palette-v2-tests.mjs <<'JS'
import assert from "node:assert/strict";

import {
  locateVelocityBar
} from "../src/doppler-palette-recovery-v2.js";

function createFixture() {
  const width = 180;
  const height = 80;

  const data =
    new Uint8ClampedArray(
      width * height * 4
    );

  function pixel(
    x,
    y,
    rgb
  ) {
    const i =
      (
        y * width
        + x
      ) * 4;

    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
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
      pixel(
        x,
        y,
        [12,12,12]
      );
    }
  }

  // Noise elsewhere in footer.
  for (
    let x = 15;
    x < 28;
    x++
  ) {
    pixel(
      x,
      58,
      [255,120,0]
    );
  }

  const colours = [
    [0,0,180],
    [0,70,220],
    [0,140,255],
    [70,190,255],
    [150,230,255],
    [255,255,0],
    [255,190,0],
    [255,120,0],
    [255,50,0],
    [190,0,0]
  ];

  let x = 35;

  for (
    const colour
    of colours
  ) {
    for (
      let n = 0;
      n < 10;
      n++
    ) {
      pixel(
        x + n,
        64,
        colour
      );
    }

    x += 10;
  }

  return {
    width,
    height,
    data
  };
}

const bar =
  locateVelocityBar(
    createFixture()
  );

assert.ok(bar);

assert.equal(
  bar.y,
  64
);

assert.equal(
  bar.runs.length,
  10
);

assert.deepEqual(
  bar.runs[0].rgb,
  [0,0,180]
);

assert.deepEqual(
  bar.runs.at(-1).rgb,
  [190,0,0]
);

assert.ok(
  bar.maxX
  > bar.minX
);

console.log(
  "6 Doppler palette V2 tests passed."
);
JS

echo
echo "Checking syntax..."
node --check frontend/src/doppler-palette-recovery-v2.js

echo
echo "Running V2 palette tests..."
node frontend/tests/run-doppler-palette-v2-tests.mjs

echo
echo "Running Doppler intake tests..."
node frontend/tests/run-doppler-intake-tests.mjs

echo
echo "Running existing StormTracker tests..."
node frontend/tests/run-node-tests.mjs

echo
echo "SUCCESS"
echo "Expected:"
echo "  6 Doppler palette V2 tests passed."
echo "  5 Doppler intake tests passed."
echo "  14 tests passed."
echo
echo "Commit and push:"
echo 'git add frontend/doppler-palette-v2.html frontend/src/doppler-palette-recovery-v2.js frontend/tests/run-doppler-palette-v2-tests.mjs'
echo 'git commit -m "Isolate exact Bureau Doppler velocity colour bar"'
echo 'git push'
echo
echo "After Pages deploys, open:"
echo "https://blakesmith-intel.github.io/StormTracker/doppler-palette-v2.html"
echo
echo "Press:"
echo "  Load and isolate all three velocity bars"
echo
echo "Send back one screenshot showing the 8x footer crops and isolated swatches."
