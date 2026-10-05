#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

mkdir -p relay

cat > relay/worker.js <<'EOF'
const BOM_WMTS =
  "https://api.bom.gov.au/apikey/v1/mapping/timeseries/wmts";

const ALLOWED_ORIGINS = new Set([
  "https://blakesmith-intel.github.io",
]);

const ALLOWED_LAYERS = new Set([
  "atm_surf_air_precip_reflectivity_dbz",
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

  headers.set("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "86400");

  return headers;
}

function errorResponse(message, status, origin) {
  const headers = corsHeaders(origin);
  headers.set("Content-Type", "text/plain; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(message, { status, headers });
}

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return errorResponse("Method not allowed", 405, origin);
    }

    if (incoming.pathname !== "/wmts") {
      return errorResponse("Not found", 404, origin);
    }

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return errorResponse("Origin not allowed", 403, origin);
    }

    const layer = incoming.searchParams.get("LAYER");

    if (!ALLOWED_LAYERS.has(layer)) {
      return errorResponse("Layer not allowed", 403, origin);
    }

    const target = new URL(BOM_WMTS);

    for (const [key, value] of incoming.searchParams.entries()) {
      if (ALLOWED_PARAMS.has(key)) {
        target.searchParams.append(key, value);
      }
    }

    let upstream;

    try {
      upstream = await fetch(target.toString(), {
        method: request.method,
        headers: {
          Accept: "image/png",
        },
        cf: {
          cacheEverything: true,
          cacheTtl: 300,
        },
      });
    } catch (error) {
      return errorResponse(
        `BOM upstream fetch failed: ${error?.message || String(error)}`,
        502,
        origin,
      );
    }

    const headers = new Headers(upstream.headers);
    const cors = corsHeaders(origin);

    for (const [key, value] of cors.entries()) {
      headers.set(key, value);
    }

    headers.set("Cross-Origin-Resource-Policy", "cross-origin");
    headers.set("Cache-Control", "public, max-age=300");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
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

cat > relay/README.md <<'EOF'
# StormTracker BOM relay

This Worker is a deliberately narrow transport relay.

It:
- accepts only GET/HEAD/OPTIONS;
- accepts only `/wmts`;
- accepts only the BOM reflectivity layer currently used by StormTracker;
- accepts browser requests only from `https://blakesmith-intel.github.io`;
- fetches the public BOM WMTS tile server-side;
- adds CORS headers so StormTracker can read the PNG pixels in-browser.

It does **not** perform storm segmentation, tracking, modelling, inference or 3-D processing.
All science remains in the StormTracker browser application.
EOF

echo
echo "StormTracker BOM relay files created:"
echo "  relay/worker.js"
echo "  relay/wrangler.jsonc"
echo "  relay/README.md"
echo
echo "Next steps:"
echo "  cd /workspaces/StormTracker/relay"
echo "  npx wrangler login"
echo "  npx wrangler deploy"
echo
echo "After deploy, copy the workers.dev URL shown by Wrangler and send it back here."
