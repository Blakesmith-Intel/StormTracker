#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

echo "StormTracker — public BOM Doppler intake diagnostic v1"
echo

mkdir -p relay frontend/tests

cat > relay/worker.js <<'EOF'
const BOM_WMTS =
  "https://api.bom.gov.au/apikey/v1/mapping/timeseries/wmts";

const BOM_RADAR_BASE =
  "https://www.bom.gov.au/radar/";

const ALLOWED_ORIGINS = new Set([
  "https://blakesmith-intel.github.io",
]);

const ALLOWED_LAYERS = new Set([
  "atm_surf_air_precip_reflectivity_dbz",
]);

const ALLOWED_DOPPLER_PRODUCTS = new Set([
  "IDR08I",
  "IDR50I",
  "IDR66I",
]);

const ALLOWED_PARAMS = new Set([
  "SERVICE",
  "REQUEST",
  "VERSION",
  "LAYER",
  "STYLE",
  "FORMAT",
  "TILEMATRIXSET",
  "TILEMATRIX",
  "TILEROW",
  "TILECOL",
  "time",
]);

function corsHeaders(origin) {
  const headers = new Headers();

  if (ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  headers.set(
    "Access-Control-Allow-Methods",
    "GET,HEAD,OPTIONS"
  );

  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  headers.set(
    "Access-Control-Expose-Headers",
    "Content-Type,Last-Modified,ETag,X-StormTracker-Product"
  );

  headers.set(
    "Access-Control-Max-Age",
    "86400"
  );

  return headers;
}

function errorResponse(
  message,
  status,
  origin
) {
  const headers =
    corsHeaders(origin);

  headers.set(
    "Content-Type",
    "text/plain; charset=utf-8"
  );

  headers.set(
    "Cache-Control",
    "no-store"
  );

  return new Response(
    message,
    {
      status,
      headers
    }
  );
}

async function relayWmts(
  request,
  incoming,
  origin
) {
  const layer =
    incoming.searchParams.get(
      "LAYER"
    );

  if (
    !ALLOWED_LAYERS.has(layer)
  ) {
    return errorResponse(
      "Layer not allowed",
      403,
      origin
    );
  }

  const target =
    new URL(BOM_WMTS);

  for (
    const [key, value]
    of incoming
      .searchParams
      .entries()
  ) {
    if (
      ALLOWED_PARAMS.has(key)
    ) {
      target.searchParams.append(
        key,
        value
      );
    }
  }

  let upstream;

  try {
    upstream =
      await fetch(
        target.toString(),
        {
          method:
            request.method,

          headers: {
            Accept:
              "image/png",
          },

          cf: {
            cacheEverything:
              true,

            cacheTtl:
              300,
          },
        }
      );
  } catch (error) {
    return errorResponse(
      `BOM WMTS fetch failed: ${
        error?.message
        || String(error)
      }`,
      502,
      origin
    );
  }

  const headers =
    new Headers(
      upstream.headers
    );

  const cors =
    corsHeaders(origin);

  for (
    const [key, value]
    of cors.entries()
  ) {
    headers.set(
      key,
      value
    );
  }

  headers.set(
    "Cross-Origin-Resource-Policy",
    "cross-origin"
  );

  headers.set(
    "Cache-Control",
    "public, max-age=300"
  );

  return new Response(
    upstream.body,
    {
      status:
        upstream.status,

      statusText:
        upstream.statusText,

      headers
    }
  );
}

async function relayDoppler(
  request,
  incoming,
  origin
) {
  const product =
    String(
      incoming
        .searchParams
        .get("product")
      || ""
    ).toUpperCase();

  if (
    !ALLOWED_DOPPLER_PRODUCTS
      .has(product)
  ) {
    return errorResponse(
      "Doppler product not allowed",
      403,
      origin
    );
  }

  const target =
    new URL(
      `${product}.gif`,
      BOM_RADAR_BASE
    );

  let upstream;

  try {
    upstream =
      await fetch(
        target.toString(),
        {
          method:
            request.method,

          headers: {
            Accept:
              "image/gif,image/*",
          },

          cf: {
            cacheEverything:
              true,

            cacheTtl:
              60,
          },
        }
      );
  } catch (error) {
    return errorResponse(
      `BOM Doppler fetch failed: ${
        error?.message
        || String(error)
      }`,
      502,
      origin
    );
  }

  const headers =
    new Headers(
      upstream.headers
    );

  const cors =
    corsHeaders(origin);

  for (
    const [key, value]
    of cors.entries()
  ) {
    headers.set(
      key,
      value
    );
  }

  headers.set(
    "Cross-Origin-Resource-Policy",
    "cross-origin"
  );

  headers.set(
    "Cache-Control",
    "public, max-age=60"
  );

  headers.set(
    "X-StormTracker-Product",
    product
  );

  return new Response(
    upstream.body,
    {
      status:
        upstream.status,

      statusText:
        upstream.statusText,

      headers
    }
  );
}

export default {
  async fetch(request) {
    const incoming =
      new URL(request.url);

    const origin =
      request.headers
        .get("Origin")
      || "";

    if (
      request.method
      === "OPTIONS"
    ) {
      return new Response(
        null,
        {
          status:
            204,

          headers:
            corsHeaders(
              origin
            ),
        }
      );
    }

    if (
      request.method !== "GET"
      && request.method !== "HEAD"
    ) {
      return errorResponse(
        "Method not allowed",
        405,
        origin
      );
    }

    if (
      origin
      && !ALLOWED_ORIGINS
        .has(origin)
    ) {
      return errorResponse(
        "Origin not allowed",
        403,
        origin
      );
    }

    if (
      incoming.pathname
      === "/wmts"
    ) {
      return relayWmts(
        request,
        incoming,
        origin
      );
    }

    if (
      incoming.pathname
      === "/radar"
    ) {
      return relayDoppler(
        request,
        incoming,
        origin
      );
    }

    return errorResponse(
      "Not found",
      404,
      origin
    );
  },
};
EOF

cat > relay/wrangler.jsonc <<'EOF'
{
  "name": "stormtracker-bom-relay",
  "main": "worker.js",
  "compatibility_date": "2026-10-03"
}
EOF

cat > frontend/src/bom-doppler-intake-v1.js <<'JS'
const RELAY_BASE =
  "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/radar";

export const DOPPLER_PRODUCTS =
  Object.freeze({
    "08":
      "IDR08I",

    "50":
      "IDR50I",

    "66":
      "IDR66I",
  });

export function buildDopplerRelayUrl(
  radarId
) {
  const product =
    DOPPLER_PRODUCTS[
      String(radarId)
    ];

  if (!product) {
    throw new Error(
      `Unsupported Doppler radar: ${radarId}`
    );
  }

  const url =
    new URL(
      RELAY_BASE
    );

  url.searchParams.set(
    "product",
    product
  );

  return url.toString();
}

function createCanvas(
  width,
  height
) {
  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    width;

  canvas.height =
    height;

  return canvas;
}

async function responseToImageData(
  response
) {
  const blob =
    await response.blob();

  const bitmap =
    await createImageBitmap(
      blob
    );

  const canvas =
    createCanvas(
      bitmap.width,
      bitmap.height
    );

  const context =
    canvas.getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    );

  context.drawImage(
    bitmap,
    0,
    0
  );

  return {
    canvas,

    imageData:
      context.getImageData(
        0,
        0,
        bitmap.width,
        bitmap.height
      )
  };
}

function colourAudit(
  imageData
) {
  const counts =
    new Map();

  let transparent =
    0;

  let opaque =
    0;

  const data =
    imageData.data;

  for (
    let i = 0;
    i < data.length;
    i += 4
  ) {
    const alpha =
      data[i + 3];

    if (
      alpha === 0
    ) {
      transparent++;
      continue;
    }

    opaque++;

    const key =
      `${data[i]},${data[i + 1]},${data[i + 2]}`;

    counts.set(
      key,
      (
        counts.get(key)
        || 0
      ) + 1
    );
  }

  const colours =
    [...counts.entries()]
      .map(
        ([rgb, count]) => ({
          rgb:
            rgb
              .split(",")
              .map(Number),

          count
        })
      )
      .sort(
        (a, b) =>
          b.count
          - a.count
      );

  return {
    transparent,
    opaque,
    uniqueOpaqueColours:
      colours.length,

    colours
  };
}

export async function loadDopplerDiagnostic(
  radarId
) {
  const url =
    buildDopplerRelayUrl(
      radarId
    );

  const response =
    await fetch(
      url,
      {
        cache:
          "no-store"
      }
    );

  if (!response.ok) {
    throw new Error(
      `Doppler relay failed: HTTP ${response.status}`
    );
  }

  const lastModified =
    response.headers.get(
      "Last-Modified"
    );

  const product =
    response.headers.get(
      "X-StormTracker-Product"
    );

  const contentType =
    response.headers.get(
      "Content-Type"
    );

  const {
    canvas,
    imageData
  } =
    await responseToImageData(
      response
    );

  return {
    radarId:
      String(radarId),

    product,

    url,

    contentType,

    lastModified,

    width:
      imageData.width,

    height:
      imageData.height,

    canvas,

    audit:
      colourAudit(
        imageData
      )
  };
}
JS

cat > frontend/doppler-intake-v1.html <<'HTML'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>
<title>
  StormTracker — Doppler Intake Diagnostic
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
    max-width:1100px;
    margin:0 auto;
    padding:18px;
  }

  h1 {
    margin:0 0 4px;
  }

  .note {
    color:#a9bbc4;
    line-height:1.45;
    margin-bottom:14px;
  }

  .controls {
    display:flex;
    gap:8px;
    flex-wrap:wrap;
    margin-bottom:14px;
  }

  button {
    padding:9px 12px;
    border:1px solid #496473;
    border-radius:6px;
    background:#1a2d38;
    color:#fff;
    cursor:pointer;
  }

  .card {
    margin-bottom:12px;
    border:1px solid #30424d;
    border-radius:8px;
    background:#111e26;
    padding:12px;
  }

  #images {
    display:grid;
    grid-template-columns:
      repeat(
        auto-fit,
        minmax(290px,1fr)
      );
    gap:12px;
  }

  .image-card canvas {
    width:100%;
    height:auto;
    image-rendering:pixelated;
    background:#000;
  }

  .metrics {
    display:grid;
    grid-template-columns:
      150px 1fr;
    gap:3px 8px;
    font-size:12px;
    margin-top:8px;
  }

  .metrics span:nth-child(odd) {
    color:#9fb2bc;
  }

  .palette {
    display:grid;
    grid-template-columns:
      repeat(
        auto-fill,
        minmax(150px,1fr)
      );
    gap:5px;
    margin-top:8px;
  }

  .swatch {
    display:flex;
    align-items:center;
    gap:6px;
    font-size:10px;
  }

  .colour {
    width:18px;
    height:12px;
    border:1px solid rgba(255,255,255,.35);
  }

  #status {
    white-space:pre-wrap;
    font-family:
      ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
    font-size:11px;
    line-height:1.45;
  }
</style>
</head>

<body>
<main>
  <h1>
    StormTracker Doppler intake diagnostic
  </h1>

  <div class="note">
    Raw public Bureau Doppler imagery only. This page does not yet assign
    velocity values to colours and does not feed Doppler into storm identity,
    motion or the inferred 3-D model.
  </div>

  <div class="controls">
    <button data-radar="08">
      Load Gympie 08
    </button>

    <button data-radar="50">
      Load Marburg 50
    </button>

    <button data-radar="66">
      Load Mt Stapylton 66
    </button>

    <button id="loadAll">
      Load all three
    </button>
  </div>

  <div class="card">
    <strong>Status</strong>
    <div id="status">
      Ready.
    </div>
  </div>

  <div id="images"></div>
</main>

<script type="module">
import {
  loadDopplerDiagnostic
} from "./src/bom-doppler-intake-v1.js";

const images =
  document.getElementById(
    "images"
  );

const status =
  document.getElementById(
    "status"
  );

function colourCss(rgb) {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

async function loadOne(
  radarId
) {
  status.textContent =
    `Loading radar ${radarId}…`;

  const result =
    await loadDopplerDiagnostic(
      radarId
    );

  const existing =
    document.getElementById(
      `radar-${radarId}`
    );

  if (existing) {
    existing.remove();
  }

  const card =
    document.createElement(
      "section"
    );

  card.className =
    "card image-card";

  card.id =
    `radar-${radarId}`;

  const heading =
    document.createElement(
      "h2"
    );

  heading.textContent =
    `${radarId} — ${result.product}`;

  card.appendChild(
    heading
  );

  card.appendChild(
    result.canvas
  );

  const metrics =
    document.createElement(
      "div"
    );

  metrics.className =
    "metrics";

  metrics.innerHTML = `
    <span>Image size</span>
    <strong>${result.width} × ${result.height}</strong>

    <span>Content type</span>
    <strong>${result.contentType ?? "—"}</strong>

    <span>Last-Modified</span>
    <strong>${result.lastModified ?? "not supplied"}</strong>

    <span>Opaque pixels</span>
    <strong>${result.audit.opaque.toLocaleString()}</strong>

    <span>Transparent pixels</span>
    <strong>${result.audit.transparent.toLocaleString()}</strong>

    <span>Unique opaque RGBs</span>
    <strong>${result.audit.uniqueOpaqueColours.toLocaleString()}</strong>
  `;

  card.appendChild(
    metrics
  );

  const paletteTitle =
    document.createElement(
      "h3"
    );

  paletteTitle.textContent =
    "Most common raw RGB values";

  card.appendChild(
    paletteTitle
  );

  const palette =
    document.createElement(
      "div"
    );

  palette.className =
    "palette";

  for (
    const item
    of result.audit.colours.slice(
      0,
      40
    )
  ) {
    const swatch =
      document.createElement(
        "div"
      );

    swatch.className =
      "swatch";

    const colour =
      document.createElement(
        "span"
      );

    colour.className =
      "colour";

    colour.style.background =
      colourCss(
        item.rgb
      );

    const label =
      document.createElement(
        "span"
      );

    label.textContent =
      `${item.rgb.join(",")} — ${item.count}`;

    swatch.append(
      colour,
      label
    );

    palette.appendChild(
      swatch
    );
  }

  card.appendChild(
    palette
  );

  images.prepend(
    card
  );

  status.textContent =
    `DOPPLER RAW INTAKE PASS — radar ${radarId}; ` +
    `${result.width}x${result.height}; ` +
    `${result.audit.uniqueOpaqueColours} opaque RGB values.`;

  return result;
}

for (
  const button
  of document.querySelectorAll(
    "[data-radar]"
  )
) {
  button.addEventListener(
    "click",
    () =>
      loadOne(
        button.dataset.radar
      ).catch(
        error => {
          console.error(
            error
          );

          status.textContent =
            `ERROR — ${error.message}`;
        }
      )
  );
}

document
  .getElementById(
    "loadAll"
  )
  .addEventListener(
    "click",
    async () => {
      try {
        for (
          const radarId
          of ["08","50","66"]
        ) {
          await loadOne(
            radarId
          );
        }

        status.textContent =
          "DOPPLER RAW INTAKE PASS — all three active StormTracker radars loaded.";
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

cat > frontend/tests/run-doppler-intake-tests.mjs <<'JS'
import assert from "node:assert/strict";

import {
  buildDopplerRelayUrl,
  DOPPLER_PRODUCTS
} from "../src/bom-doppler-intake-v1.js";

assert.equal(
  DOPPLER_PRODUCTS["08"],
  "IDR08I"
);

assert.equal(
  DOPPLER_PRODUCTS["50"],
  "IDR50I"
);

assert.equal(
  DOPPLER_PRODUCTS["66"],
  "IDR66I"
);

assert.equal(
  new URL(
    buildDopplerRelayUrl(
      "66"
    )
  ).searchParams.get(
    "product"
  ),
  "IDR66I"
);

assert.throws(
  () =>
    buildDopplerRelayUrl(
      "108"
    )
);

console.log(
  "5 Doppler intake tests passed."
);
JS

echo
echo "Checking syntax..."
node --check frontend/src/bom-doppler-intake-v1.js

echo
echo "Running Doppler intake tests..."
node frontend/tests/run-doppler-intake-tests.mjs

echo
echo "Running existing StormTracker tests..."
node frontend/tests/run-node-tests.mjs

echo
echo "Files ready:"
ls -lh \
  relay/worker.js \
  frontend/doppler-intake-v1.html \
  frontend/src/bom-doppler-intake-v1.js

echo
echo "LOCAL BUILD PASS"
echo
echo "Next deploy the updated relay:"
echo "  cd /workspaces/StormTracker/relay"
echo "  npx wrangler deploy"
echo
echo "Then return to the repository root:"
echo "  cd /workspaces/StormTracker"
echo
echo "Commit the browser diagnostic:"
echo '  git add frontend/doppler-intake-v1.html frontend/src/bom-doppler-intake-v1.js frontend/tests/run-doppler-intake-tests.mjs'
echo '  git commit -m "Add public BOM Doppler intake diagnostic"'
echo '  git push'
echo
echo "After Pages deploys, open:"
echo "  https://blakesmith-intel.github.io/StormTracker/doppler-intake-v1.html"
echo
echo "Press:"
echo "  Load all three"
echo
echo "Send back:"
echo "  • the final status line"
echo "  • one screenshot showing the three Doppler images and RGB summaries"
