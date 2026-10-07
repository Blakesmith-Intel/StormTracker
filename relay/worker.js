import { QLD_DOPPLER_PRODUCTS } from "../frontend/src/qld-radar-sites-v1.js";
import {
  parseBomReceivedAtUtc
} from "./doppler-time-v1.js";

import {
  parseBomRadarLoopFrames,
  radarTimestampToIso
} from "./doppler-history-v1.js";

const BOM_WMTS =
  "https://api.bom.gov.au/apikey/v1/mapping/timeseries/wmts";

const BOM_RADAR_BASE =
  "https://www.bom.gov.au/radar/";

const BOM_PRODUCT_BASE =
  "https://www.bom.gov.au/products/";

const QLD_TRAFFIC_EVENTS =
  "https://api.qldtraffic.qld.gov.au/v2/events";

const ALLOWED_ORIGINS = new Set([
  "https://blakesmith-intel.github.io",
]);

const ALLOWED_LAYERS = new Set([
  "atm_surf_air_precip_reflectivity_dbz",
]);

const ALLOWED_DOPPLER_PRODUCTS = new Set(Object.values(QLD_DOPPLER_PRODUCTS));

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
    [
      "Content-Type",
      "Last-Modified",
      "ETag",
      "X-StormTracker-Product",
      "X-StormTracker-Observed-UTC",
      "X-StormTracker-Time-Source"
    ].join(",")
  );

  headers.set(
    "Access-Control-Max-Age",
    "86400"
  );

  return headers;
}

function errorResponse(message, status, origin) {
  const headers = corsHeaders(origin);

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

function jsonResponse(payload, origin) {
  const headers = corsHeaders(origin);

  headers.set(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  headers.set(
    "Cache-Control",
    "public, max-age=30"
  );

  return new Response(
    JSON.stringify(payload),
    {
      status: 200,
      headers
    }
  );
}

function normaliseRoadField(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function isFloodRoadClosureFeature(feature) {
  const properties =
    feature?.properties ?? {};

  const eventType =
    normaliseRoadField(
      properties.event_type
    );

  const eventSubtype =
    normaliseRoadField(
      properties.event_subtype
    );

  const eventDueTo =
    normaliseRoadField(
      properties.event_due_to
    );

  const impactType =
    normaliseRoadField(
      properties.impact?.impact_type
    );

  const status =
    normaliseRoadField(
      properties.status
    );

  const floodRelated =
    eventType === "flooding"
    || eventSubtype === "flash flooding"
    || eventSubtype === "long-term flooding"
    || eventDueTo === "earlier flooding"
    || eventDueTo === "earlier flash flooding"
    || eventDueTo === "water over road"
    || eventDueTo === "flooding of river";

  return (
    status === "published"
    && floodRelated
    && impactType === "closures"
  );
}

async function relayFloodRoadClosures(
  origin,
  env
) {
  const apiKey =
    env?.QLDTRAFFIC_API_KEY;

  if (!apiKey) {
    return errorResponse(
      "QLDTraffic API key is not configured",
      503,
      origin
    );
  }

  const target =
    new URL(QLD_TRAFFIC_EVENTS);

  target.searchParams.set(
    "apikey",
    apiKey
  );

  let upstream;

  try {
    upstream = await fetch(
      target.toString(),
      {
        method: "GET",
        headers: {
          Accept:
            "application/geo+json,application/json"
        },
        cf: {
          cacheEverything: true,
          cacheTtl: 120
        }
      }
    );
  } catch (error) {
    return errorResponse(
      `QLDTraffic fetch failed: ${
        error?.message || String(error)
      }`,
      502,
      origin
    );
  }

  if (!upstream.ok) {
    return errorResponse(
      `QLDTraffic HTTP ${upstream.status}`,
      502,
      origin
    );
  }

  let payload;

  try {
    payload =
      await upstream.json();
  } catch (error) {
    return errorResponse(
      "QLDTraffic response was not valid JSON",
      502,
      origin
    );
  }

  const features =
    Array.isArray(payload?.features)
      ? payload.features.filter(
          isFloodRoadClosureFeature
        )
      : [];

  return jsonResponse(
    {
      type:
        "FeatureCollection",
      features,
      stormtracker: {
        filter:
          "published + flood-related + closures",
        source:
          "Queensland Department of Transport and Main Roads · QLDTraffic"
      }
    },
    origin
  );
}

function dopplerProduct(incoming) {
  const product = String(
    incoming.searchParams.get("product") || ""
  ).toUpperCase();

  return ALLOWED_DOPPLER_PRODUCTS.has(product)
    ? product
    : null;
}

async function relayWmts(request, incoming, origin) {
  const layer =
    incoming.searchParams.get("LAYER");

  if (!ALLOWED_LAYERS.has(layer)) {
    return errorResponse(
      "Layer not allowed",
      403,
      origin
    );
  }

  const target = new URL(BOM_WMTS);

  for (const [key, value] of incoming.searchParams.entries()) {
    if (ALLOWED_PARAMS.has(key)) {
      target.searchParams.append(key, value);
    }
  }

  let upstream;

  try {
    upstream = await fetch(
      target.toString(),
      {
        method: request.method,

        headers: {
          Accept: "image/png"
        },

        cf: {
          cacheEverything: true,
          cacheTtl: 300
        }
      }
    );
  } catch (error) {
    return errorResponse(
      `BOM WMTS fetch failed: ${error?.message || String(error)}`,
      502,
      origin
    );
  }

  const headers = new Headers(upstream.headers);

  for (const [key, value] of corsHeaders(origin).entries()) {
    headers.set(key, value);
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
      status: upstream.status,
      statusText: upstream.statusText,
      headers
    }
  );
}

async function fetchDopplerObservedUtc(product) {
  const target = new URL(
    `${product}.shtml`,
    BOM_PRODUCT_BASE
  );

  const response = await fetch(
    target.toString(),
    {
      method: "GET",

      headers: {
        Accept: "text/html"
      },

      cf: {
        cacheEverything: true,
        cacheTtl: 30
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `BOM Doppler product page HTTP ${response.status}`
    );
  }

  const observedUtc =
    parseBomReceivedAtUtc(
      await response.text()
    );

  if (!observedUtc) {
    throw new Error(
      "BOM Doppler product page did not contain a parseable Received at UTC timestamp."
    );
  }

  return observedUtc;
}

async function relayDopplerLatest(
  request,
  incoming,
  origin
) {
  const product = dopplerProduct(incoming);

  if (!product) {
    return errorResponse(
      "Doppler product not allowed",
      403,
      origin
    );
  }

  const target = new URL(
    `${product}.gif`,
    BOM_RADAR_BASE
  );

  const [imageResult, metadataResult] =
    await Promise.allSettled([
      fetch(
        target.toString(),
        {
          method: request.method,

          headers: {
            Accept: "image/gif,image/*"
          },

          cf: {
            cacheEverything: true,
            cacheTtl: 60
          }
        }
      ),

      fetchDopplerObservedUtc(product)
    ]);

  if (imageResult.status !== "fulfilled") {
    return errorResponse(
      `BOM Doppler fetch failed: ${
        imageResult.reason?.message || String(imageResult.reason)
      }`,
      502,
      origin
    );
  }

  const upstream = imageResult.value;

  const observedUtc =
    metadataResult.status === "fulfilled"
      ? metadataResult.value
      : null;

  const headers = new Headers(upstream.headers);

  for (const [key, value] of corsHeaders(origin).entries()) {
    headers.set(key, value);
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

  if (observedUtc) {
    headers.set(
      "X-StormTracker-Observed-UTC",
      observedUtc
    );

    headers.set(
      "X-StormTracker-Time-Source",
      "bom-product-page-received-at"
    );
  }

  return new Response(
    upstream.body,
    {
      status: upstream.status,
      statusText: upstream.statusText,
      headers
    }
  );
}

async function relayDopplerHistory(
  incoming,
  origin
) {
  const product = dopplerProduct(incoming);

  if (!product) {
    return errorResponse(
      "Doppler product not allowed",
      403,
      origin
    );
  }

  const target = new URL(
    `${product}.loop.shtml`,
    BOM_PRODUCT_BASE
  );

  let upstream;

  try {
    upstream = await fetch(
      target.toString(),
      {
        method: "GET",

        headers: {
          Accept: "text/html"
        },

        cf: {
          cacheEverything: true,
          cacheTtl: 30
        }
      }
    );
  } catch (error) {
    return errorResponse(
      `BOM Doppler loop fetch failed: ${
        error?.message || String(error)
      }`,
      502,
      origin
    );
  }

  if (!upstream.ok) {
    return errorResponse(
      `BOM Doppler loop HTTP ${upstream.status}`,
      502,
      origin
    );
  }

  const frames =
    parseBomRadarLoopFrames(
      await upstream.text(),
      product
    );

  if (!frames.length) {
    return errorResponse(
      "BOM Doppler loop page contained no timestamped PNG radar frames.",
      502,
      origin
    );
  }

  return jsonResponse(
    {
      format:
        "StormTrackerDopplerHistoryV1",

      product,

      source:
        target.toString(),

      filename_convention:
        "IDRnnnx.T.yyyymmddhhmm.png",

      frames
    },
    origin
  );
}

async function relayDopplerFrame(
  request,
  incoming,
  origin
) {
  const product = dopplerProduct(incoming);

  if (!product) {
    return errorResponse(
      "Doppler product not allowed",
      403,
      origin
    );
  }

  const filename = String(
    incoming.searchParams.get("file") || ""
  );

  const escaped = product.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const match = filename.match(
    new RegExp(
      `^${escaped}\\.T\\.(\\d{12})\\.png$`,
      "i"
    )
  );

  if (!match) {
    return errorResponse(
      "Invalid Doppler history filename",
      400,
      origin
    );
  }

  const observedUtc =
    radarTimestampToIso(match[1]);

  if (!observedUtc) {
    return errorResponse(
      "Invalid Doppler history timestamp",
      400,
      origin
    );
  }

  const target = new URL(
    filename,
    BOM_RADAR_BASE
  );

  let upstream;

  try {
    upstream = await fetch(
      target.toString(),
      {
        method: request.method,

        headers: {
          Accept: "image/png,image/*"
        },

        cf: {
          cacheEverything: true,
          cacheTtl: 300
        }
      }
    );
  } catch (error) {
    return errorResponse(
      `BOM Doppler frame fetch failed: ${
        error?.message || String(error)
      }`,
      502,
      origin
    );
  }

  if (!upstream.ok) {
    return errorResponse(
      `BOM Doppler frame HTTP ${upstream.status}`,
      502,
      origin
    );
  }

  const headers = new Headers(upstream.headers);

  for (const [key, value] of corsHeaders(origin).entries()) {
    headers.set(key, value);
  }

  headers.set(
    "Cross-Origin-Resource-Policy",
    "cross-origin"
  );

  headers.set(
    "Cache-Control",
    "public, max-age=300"
  );

  headers.set(
    "X-StormTracker-Product",
    product
  );

  headers.set(
    "X-StormTracker-Observed-UTC",
    observedUtc
  );

  headers.set(
    "X-StormTracker-Time-Source",
    "bom-history-filename-utc"
  );

  return new Response(
    upstream.body,
    {
      status: upstream.status,
      statusText: upstream.statusText,
      headers
    }
  );
}

export default {
  async fetch(request, env) {
    const incoming =
      new URL(request.url);

    const origin =
      request.headers.get("Origin")
      || "";

    if (request.method === "OPTIONS") {
      return new Response(
        null,
        {
          status: 204,
          headers: corsHeaders(origin)
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
      && !ALLOWED_ORIGINS.has(origin)
    ) {
      return errorResponse(
        "Origin not allowed",
        403,
        origin
      );
    }

    if (incoming.pathname === "/flood-road-closures") {
      return relayFloodRoadClosures(
        origin,
        env
      );
    }

    if (incoming.pathname === "/wmts") {
      return relayWmts(
        request,
        incoming,
        origin
      );
    }

    if (incoming.pathname === "/radar") {
      return relayDopplerLatest(
        request,
        incoming,
        origin
      );
    }

    if (incoming.pathname === "/radar-history") {
      return relayDopplerHistory(
        incoming,
        origin
      );
    }

    if (incoming.pathname === "/radar-frame") {
      return relayDopplerFrame(
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
  }
};
