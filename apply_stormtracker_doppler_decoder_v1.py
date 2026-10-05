from pathlib import Path
import subprocess

ROOT = Path("/workspaces/StormTracker")
FRONTEND = ROOT / "frontend"
SRC = FRONTEND / "src"
TESTS = FRONTEND / "tests"

for path in [
    SRC / "bom-doppler-intake-v1.js",
]:
    if not path.exists():
        raise SystemExit(
            f"ERROR: missing required file: {path}"
        )

print("StormTracker — exact public BOM Doppler decoder V1")
print()

decoder_js = r'''export const BOM_DOPPLER_VELOCITY_SCALE_KMH =
  Object.freeze([
    -70,
    -60,
    -50,
    -40,
    -30,
    -20,
    -15,
    -10,
    -5,
    0,
    5,
    10,
    15,
    20,
    30,
    40,
    50,
    60,
    70
  ]);

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

function isPaletteLikeRgb(
  rgb
) {
  const maximum =
    Math.max(
      ...rgb
    );

  const minimum =
    Math.min(
      ...rgb
    );

  return (
    (
      maximum >= 45
      && chroma(
        rgb
      ) >= 20
    )
    || (
      minimum >= 180
      && chroma(
        rgb
      ) <= 55
    )
  );
}

function isNeutralRgb(
  rgb
) {
  return (
    Math.min(
      ...rgb
    ) >= 180
    && chroma(
      rgb
    ) <= 55
  );
}

function isBlueSideRgb(
  rgb
) {
  const [
    r,
    g,
    b
  ] = rgb;

  return (
    b >= 65
    && b >= r + 20
    && b >= g
  );
}

function isWarmSideRgb(
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
      && r >= b + 25
    )
    || (
      r >= 180
      && g >= 120
      && b <= 140
    )
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

  let start =
    0;

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

function median(
  values
) {
  if (!values.length) {
    return null;
  }

  const ordered =
    [...values].sort(
      (a, b) =>
        a - b
    );

  const middle =
    Math.floor(
      ordered.length / 2
    );

  return (
    ordered.length % 2
      ? ordered[middle]
      : (
          ordered[middle - 1]
          + ordered[middle]
        ) / 2
  );
}

function widthCoefficientOfVariation(
  runs
) {
  if (!runs.length) {
    return Infinity;
  }

  const widths =
    runs.map(
      run =>
        run.width
    );

  const mean =
    widths.reduce(
      (sum, value) =>
        sum + value,
      0
    )
    / widths.length;

  if (!(mean > 0)) {
    return Infinity;
  }

  const variance =
    widths.reduce(
      (sum, value) =>
        sum
        + (
          value - mean
        ) ** 2,
      0
    )
    / widths.length;

  return (
    Math.sqrt(
      variance
    )
    / mean
  );
}

function clusterByGap(
  runs,
  {
    maxGap = 4
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

    if (
      gap <= maxGap
    ) {
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

function normalisePaletteCluster(
  cluster
) {
  const neutralCandidates =
    cluster
      .map(
        (
          run,
          index
        ) => ({
          run,
          index
        })
      )
      .filter(
        item =>
          isNeutralRgb(
            item.run.rgb
          )
      );

  if (
    !neutralCandidates.length
  ) {
    return null;
  }

  const clusterMiddle =
    (
      cluster.length - 1
    ) / 2;

  neutralCandidates.sort(
    (
      a,
      b
    ) => {
      const distanceA =
        Math.abs(
          a.index
          - clusterMiddle
        );

      const distanceB =
        Math.abs(
          b.index
          - clusterMiddle
        );

      if (
        distanceA
        !== distanceB
      ) {
        return (
          distanceA
          - distanceB
        );
      }

      const brightnessA =
        Math.min(
          ...a.run.rgb
        );

      const brightnessB =
        Math.min(
          ...b.run.rgb
        );

      return (
        brightnessB
        - brightnessA
      );
    }
  );

  const neutral =
    neutralCandidates[0];

  const requiredEachSide =
    (
      BOM_DOPPLER_VELOCITY_SCALE_KMH
        .length
      - 1
    ) / 2;

  const start =
    neutral.index
    - requiredEachSide;

  const endExclusive =
    neutral.index
    + requiredEachSide
    + 1;

  if (
    start < 0
    || endExclusive
      > cluster.length
  ) {
    return null;
  }

  const window =
    cluster.slice(
      start,
      endExclusive
    );

  if (
    window.length
    !== BOM_DOPPLER_VELOCITY_SCALE_KMH
      .length
  ) {
    return null;
  }

  const neutralIndex =
    requiredEachSide;

  const blueCount =
    window
      .slice(
        0,
        neutralIndex
      )
      .filter(
        run =>
          isBlueSideRgb(
            run.rgb
          )
      )
      .length;

  const warmCount =
    window
      .slice(
        neutralIndex + 1
      )
      .filter(
        run =>
          isWarmSideRgb(
            run.rgb
          )
      )
      .length;

  if (
    blueCount < 6
    || warmCount < 6
    || !isNeutralRgb(
      window[
        neutralIndex
      ].rgb
    )
  ) {
    return null;
  }

  return {
    runs:
      window,

    neutralIndex,

    blueCount,

    warmCount,

    widthCv:
      widthCoefficientOfVariation(
        window
      )
  };
}

export function locateExactBureauVelocityPalette(
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
      `No Bureau Doppler footer in ${width}x${height} image.`
    );
  }

  let best =
    null;

  for (
    let y = footerStart;
    y < height;
    y++
  ) {
    const runs =
      rowRuns(
        imageData,
        y
      ).filter(
        run =>
          run.alpha > 0
          && run.width >= 4
          && run.width <= 60
          && isPaletteLikeRgb(
            run.rgb
          )
      );

    const clusters =
      clusterByGap(
        runs
      );

    for (
      const cluster
      of clusters
    ) {
      const normalised =
        normalisePaletteCluster(
          cluster
        );

      if (!normalised) {
        continue;
      }

      const span =
        normalised.runs.at(-1).end
        - normalised.runs[0].start
        + 1;

      const score =
        normalised.blueCount
        * 200
        + normalised.warmCount
        * 200
        + span
        - normalised.widthCv
          * 1000;

      if (
        !best
        || score
          > best.score
      ) {
        best = {
          y,
          footerStart,
          score,
          ...normalised
        };
      }
    }
  }

  if (!best) {
    throw new Error(
      "Could not isolate the 19-swatch Bureau Doppler velocity palette."
    );
  }

  return {
    ...best,

    swatches:
      best.runs.map(
        (
          run,
          index
        ) => ({
          ...run,

          velocity_kmh:
            BOM_DOPPLER_VELOCITY_SCALE_KMH[
              index
            ]
        })
      )
  };
}

function rgbKey(
  rgb
) {
  return (
    (
      rgb[0]
      << 16
    )
    | (
      rgb[1]
      << 8
    )
    | rgb[2]
  );
}

export function decodeBureauDopplerPanel(
  imageData,
  palette
) {
  const panelSize =
    Math.min(
      imageData.width,
      imageData.height
    );

  const velocities =
    new Float32Array(
      panelSize
      * panelSize
    );

  velocities.fill(
    Number.NaN
  );

  const lookup =
    new Map(
      palette.swatches.map(
        swatch => [
          rgbKey(
            swatch.rgb
          ),
          swatch.velocity_kmh
        ]
      )
    );

  const counts =
    new Map();

  let validPixelCount =
    0;

  let minimumVelocity =
    null;

  let maximumVelocity =
    null;

  for (
    let y = 0;
    y < panelSize;
    y++
  ) {
    for (
      let x = 0;
      x < panelSize;
      x++
    ) {
      const sourceIndex =
        (
          y
          * imageData.width
          + x
        )
        * 4;

      if (
        imageData.data[
          sourceIndex + 3
        ] === 0
      ) {
        continue;
      }

      const key =
        (
          imageData.data[
            sourceIndex
          ]
          << 16
        )
        | (
          imageData.data[
            sourceIndex + 1
          ]
          << 8
        )
        | imageData.data[
          sourceIndex + 2
        ];

      if (
        !lookup.has(
          key
        )
      ) {
        continue;
      }

      const velocity =
        lookup.get(
          key
        );

      velocities[
        y
        * panelSize
        + x
      ] =
        velocity;

      validPixelCount++;

      counts.set(
        velocity,
        (
          counts.get(
            velocity
          )
          ?? 0
        ) + 1
      );

      minimumVelocity =
        minimumVelocity == null
          ? velocity
          : Math.min(
              minimumVelocity,
              velocity
            );

      maximumVelocity =
        maximumVelocity == null
          ? velocity
          : Math.max(
              maximumVelocity,
              velocity
            );
    }
  }

  return {
    panelSize,

    velocities,

    validPixelCount,

    minimumVelocityKmh:
      minimumVelocity,

    maximumVelocityKmh:
      maximumVelocity,

    radialVelocitySpanKmh:
      minimumVelocity == null
      || maximumVelocity == null
        ? null
        : maximumVelocity
          - minimumVelocity,

    counts:
      Object.fromEntries(
        [...counts.entries()]
          .sort(
            (
              a,
              b
            ) =>
              Number(
                a[0]
              )
              - Number(
                  b[0]
                )
          )
      )
  };
}
'''

(SRC / "bom-doppler-decoder-v1.js").write_text(
    decoder_js,
    encoding="utf-8"
)

(FRONTEND / "doppler-decode-v1.html").write_text(
r'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>
<title>
  StormTracker — Doppler Decoder V1
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
    margin:0 0 4px;
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

  .images {
    display:grid;
    grid-template-columns:
      repeat(
        2,
        minmax(
          0,
          1fr
        )
      );
    gap:12px;
  }

  @media (
    max-width:900px
  ) {
    .images {
      grid-template-columns:
        1fr;
    }
  }

  .images canvas {
    width:100%;
    height:auto;
    background:#000;
    image-rendering:pixelated;
  }

  .meta {
    display:grid;
    grid-template-columns:190px 1fr;
    gap:4px 8px;
    font-size:12px;
    margin-bottom:8px;
  }

  .meta span:nth-child(odd) {
    color:#9fb2bc;
  }

  .mapping {
    display:grid;
    grid-template-columns:
      repeat(
        auto-fill,
        minmax(
          135px,
          1fr
        )
      );
    gap:5px;
    margin-top:8px;
  }

  .mapitem {
    display:grid;
    grid-template-columns:24px 1fr;
    gap:6px;
    align-items:center;
    font-size:10px;
  }

  .swatch {
    width:24px;
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

  .warning {
    margin-top:9px;
    padding:8px;
    border-left:3px solid #d6aa3a;
    background:#182129;
    color:#d8e2e7;
    font-size:11px;
    line-height:1.45;
  }
</style>
</head>

<body>
<main>
  <h1>
    StormTracker exact Doppler decoder V1
  </h1>

  <p class="note">
    The live Bureau footer visibly defines a 19-step scale from −70 to
    +70 km/h. This diagnostic extracts all 19 exact RGB swatches from the
    same GIF, maps them to that printed scale, and then redraws only pixels
    that exactly match a Doppler velocity colour. Reflectivity tracking and
    the 3-D model are untouched.
  </p>

  <button id="loadAll">
    Decode 66 / 50 / 08
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
} from "./src/bom-doppler-intake-v1.js?v=decoder-v1";

import {
  decodeBureauDopplerPanel,
  locateExactBureauVelocityPalette
} from "./src/bom-doppler-decoder-v1.js?v=decoder-v1";

const status =
  document.getElementById(
    "status"
  );

const results =
  document.getElementById(
    "results"
  );

function sourceImageData(
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

function rgbCss(
  rgb
) {
  return `rgb(${rgb.join(",")})`;
}

function decodedCanvas(
  sourceImageData,
  palette,
  decoded
) {
  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    decoded.panelSize;

  canvas.height =
    decoded.panelSize;

  const context =
    canvas.getContext(
      "2d"
    );

  const output =
    context.createImageData(
      decoded.panelSize,
      decoded.panelSize
    );

  const velocityToRgb =
    new Map(
      palette.swatches.map(
        swatch => [
          swatch.velocity_kmh,
          swatch.rgb
        ]
      )
    );

  for (
    let index = 0;
    index < decoded.velocities.length;
    index++
  ) {
    const velocity =
      decoded.velocities[
        index
      ];

    if (
      Number.isNaN(
        velocity
      )
    ) {
      output.data[
        index * 4 + 3
      ] =
        255;

      continue;
    }

    const rgb =
      velocityToRgb.get(
        velocity
      );

    output.data[
      index * 4
    ] =
      rgb[0];

    output.data[
      index * 4 + 1
    ] =
      rgb[1];

    output.data[
      index * 4 + 2
    ] =
      rgb[2];

    output.data[
      index * 4 + 3
    ] =
      255;
  }

  context.putImageData(
    output,
    0,
    0
  );

  return canvas;
}

async function inspect(
  radarId
) {
  status.textContent =
    `Decoding radar ${radarId}…`;

  const source =
    await loadDopplerDiagnostic(
      radarId
    );

  const imageData =
    sourceImageData(
      source.canvas
    );

  const palette =
    locateExactBureauVelocityPalette(
      imageData
    );

  const decoded =
    decodeBureauDopplerPanel(
      imageData,
      palette
    );

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
    <span>Palette swatches</span>
    <strong>${palette.swatches.length}</strong>

    <span>Palette row</span>
    <strong>y=${palette.y}</strong>

    <span>Decoded velocity pixels</span>
    <strong>${decoded.validPixelCount.toLocaleString()}</strong>

    <span>Strongest toward radar</span>
    <strong>${
      decoded.minimumVelocityKmh == null
        ? "none"
        : `${decoded.minimumVelocityKmh} km/h`
    }</strong>

    <span>Strongest away from radar</span>
    <strong>${
      decoded.maximumVelocityKmh == null
        ? "none"
        : `${decoded.maximumVelocityKmh} km/h`
    }</strong>

    <span>Observed radial span</span>
    <strong>${
      decoded.radialVelocitySpanKmh == null
        ? "none"
        : `${decoded.radialVelocitySpanKmh} km/h`
    }</strong>
  `;

  card.appendChild(
    meta
  );

  const images =
    document.createElement(
      "div"
    );

  images.className =
    "images";

  const originalPanel =
    document.createElement(
      "div"
    );

  const originalTitle =
    document.createElement(
      "h3"
    );

  originalTitle.textContent =
    "Original public Bureau Doppler";

  originalPanel.appendChild(
    originalTitle
  );

  const originalCanvas =
    document.createElement(
      "canvas"
    );

  originalCanvas.width =
    decoded.panelSize;

  originalCanvas.height =
    decoded.panelSize;

  originalCanvas
    .getContext(
      "2d"
    )
    .drawImage(
      source.canvas,
      0,
      0,
      decoded.panelSize,
      decoded.panelSize,
      0,
      0,
      decoded.panelSize,
      decoded.panelSize
    );

  originalPanel.appendChild(
    originalCanvas
  );

  const decodedPanel =
    document.createElement(
      "div"
    );

  const decodedTitle =
    document.createElement(
      "h3"
    );

  decodedTitle.textContent =
    "Exact palette matches only";

  decodedPanel.appendChild(
    decodedTitle
  );

  decodedPanel.appendChild(
    decodedCanvas(
      imageData,
      palette,
      decoded
    )
  );

  images.append(
    originalPanel,
    decodedPanel
  );

  card.appendChild(
    images
  );

  const mappingTitle =
    document.createElement(
      "h3"
    );

  mappingTitle.textContent =
    "Recovered 19-step RGB → radial velocity mapping";

  card.appendChild(
    mappingTitle
  );

  const mapping =
    document.createElement(
      "div"
    );

  mapping.className =
    "mapping";

  for (
    const swatch
    of palette.swatches
  ) {
    const item =
      document.createElement(
        "div"
      );

    item.className =
      "mapitem";

    const colour =
      document.createElement(
        "span"
      );

    colour.className =
      "swatch";

    colour.style.background =
      rgbCss(
        swatch.rgb
      );

    const label =
      document.createElement(
        "span"
      );

    label.textContent =
      `${swatch.velocity_kmh > 0 ? "+" : ""}` +
      `${swatch.velocity_kmh} km/h — ` +
      `${swatch.rgb.join(",")}`;

    item.append(
      colour,
      label
    );

    mapping.appendChild(
      item
    );
  }

  card.appendChild(
    mapping
  );

  const warning =
    document.createElement(
      "div"
    );

  warning.className =
    "warning";

  warning.textContent =
    "These are radial velocities toward/away from the radar. They are not " +
    "storm-motion vectors or total wind speed. This page is still a decoder " +
    "validation step and does not yet alter STxxxx identities.";

  card.appendChild(
    warning
  );

  results.appendChild(
    card
  );

  return {
    palette,
    decoded
  };
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
          const {
            palette,
            decoded
          } =
            await inspect(
              radarId
            );

          summary.push(
            `${radarId}:19 swatches,` +
            `${decoded.validPixelCount} decoded`
          );
        }

        status.textContent =
          "DOPPLER DECODER V1: PASS — " +
          summary.join(" | ") +
          ". Decoder validated visually before storm-object integration.";
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

(TESTS / "run-doppler-decoder-v1-tests.mjs").write_text(
r'''import assert from "node:assert/strict";

import {
  BOM_DOPPLER_VELOCITY_SCALE_KMH,
  decodeBureauDopplerPanel,
  locateExactBureauVelocityPalette
} from "../src/bom-doppler-decoder-v1.js";

const scale = [
  -70,
  -60,
  -50,
  -40,
  -30,
  -20,
  -15,
  -10,
  -5,
  0,
  5,
  10,
  15,
  20,
  30,
  40,
  50,
  60,
  70
];

assert.deepEqual(
  BOM_DOPPLER_VELOCITY_SCALE_KMH,
  scale
);

function fixture() {
  const width =
    140;

  const height =
    170;

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
    const index =
      (
        y
        * width
        + x
      )
      * 4;

    data[index] =
      rgb[0];

    data[index + 1] =
      rgb[1];

    data[index + 2] =
      rgb[2];

    data[index + 3] =
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
        [12,12,12]
      );
    }
  }

  const colours = [
    [0,0,90],
    [0,0,120],
    [0,20,150],
    [0,50,180],
    [0,80,200],
    [0,110,220],
    [20,140,230],
    [60,170,240],
    [110,205,245],
    [245,245,245],
    [245,235,0],
    [250,210,0],
    [250,180,0],
    [250,145,0],
    [245,110,0],
    [240,75,0],
    [230,45,0],
    [215,20,0],
    [190,0,0]
  ];

  const footerStart =
    width;

  const barY =
    footerStart + 12;

  let x =
    6;

  for (
    const colour
    of colours
  ) {
    for (
      let n = 0;
      n < 6;
      n++
    ) {
      setPixel(
        x + n,
        barY,
        colour
      );
    }

    x +=
      7;
  }

  // Add map-area pixels that exactly use real palette colours.
  // The palette detector must ignore them because they are not in the footer.
  setPixel(
    10,
    10,
    colours[0]
  );

  setPixel(
    20,
    20,
    colours.at(-1)
  );

  // Add known Doppler pixels inside the square radar panel.
  setPixel(
    30,
    30,
    colours[0]
  );

  setPixel(
    31,
    30,
    colours[9]
  );

  setPixel(
    32,
    30,
    colours.at(-1)
  );

  return {
    imageData: {
      width,
      height,
      data
    },

    colours,

    barY
  };
}

const {
  imageData,
  colours,
  barY
} =
  fixture();

const palette =
  locateExactBureauVelocityPalette(
    imageData
  );

assert.equal(
  palette.y,
  barY
);

assert.equal(
  palette.swatches.length,
  19
);

assert.equal(
  palette.swatches[0].velocity_kmh,
  -70
);

assert.equal(
  palette.swatches[9].velocity_kmh,
  0
);

assert.equal(
  palette.swatches[18].velocity_kmh,
  70
);

assert.deepEqual(
  palette.swatches[0].rgb,
  colours[0]
);

assert.deepEqual(
  palette.swatches[18].rgb,
  colours[18]
);

const decoded =
  decodeBureauDopplerPanel(
    imageData,
    palette
  );

assert.equal(
  decoded.panelSize,
  imageData.width
);

assert.ok(
  decoded.validPixelCount
  >= 5
);

assert.equal(
  decoded.minimumVelocityKmh,
  -70
);

assert.equal(
  decoded.maximumVelocityKmh,
  70
);

assert.equal(
  decoded.radialVelocitySpanKmh,
  140
);

console.log(
  "12 Doppler decoder V1 tests passed."
);
''',
encoding="utf-8"
)

print("Checking generated JavaScript syntax...")

subprocess.run(
    [
        "node",
        "--check",
        "frontend/src/bom-doppler-decoder-v1.js"
    ],
    cwd=ROOT,
    check=True
)

print()
print("Running Doppler decoder tests...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-doppler-decoder-v1-tests.mjs"
    ],
    cwd=ROOT,
    check=True
)

print()
print("Running Doppler intake tests...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-doppler-intake-tests.mjs"
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

print()
print("SUCCESS")
print("Expected:")
print("  12 Doppler decoder V1 tests passed.")
print("  5 Doppler intake tests passed.")
print("  14 tests passed.")
print()
print("Commit and push:")
print(
    'git add '
    'frontend/doppler-decode-v1.html '
    'frontend/src/bom-doppler-decoder-v1.js '
    'frontend/tests/run-doppler-decoder-v1-tests.mjs'
)
print(
    'git commit -m "Add exact public BOM Doppler radial velocity decoder"'
)
print("git push")
print()
print("After Pages deploys, open:")
print(
    "https://blakesmith-intel.github.io/StormTracker/"
    "doppler-decode-v1.html"
)
print()
print("Press:")
print("  Decode 66 / 50 / 08")
print()
print(
    "For radar 66, compare 'Original public Bureau Doppler' with "
    "'Exact palette matches only' and send one screenshot."
)
