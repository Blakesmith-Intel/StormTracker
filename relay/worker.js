import { QLD_DOPPLER_PRODUCTS } from "../frontend/src/qld-radar-sites-v1.js";
import {
  parseBomReceivedAtUtc
} from "./doppler-time-v1.js";

import {
  parseBomRadarLoopFrames,
  radarTimestampToIso
} from "./doppler-history-v1.js";

import {
  filterFloodRoadClosures,
  filterLegacyFloodRoadClosures
} from "../frontend/src/context-layers/flood-road-closure-filter-v1.js";

import {
  parseRiverHeightBulletin
} from "../frontend/src/context-layers/river-height-bulletin-v1.js";

import {
  BOM_RIVER_TIDE_GAUGE_QUERY_URL
} from "../frontend/src/context-layers/river-gauges-v1.js";

import {parseBomRecentWaterLevels} from "../frontend/src/context-layers/bom-recent-river-history-v1.js";

const BOM_WMTS =
  "https://api.bom.gov.au/apikey/v1/mapping/timeseries/wmts";

const BOM_RADAR_BASE =
  "https://www.bom.gov.au/radar/";

const BOM_PRODUCT_BASE =
  "https://www.bom.gov.au/products/";

const QLD_TRAFFIC_EVENTS =
  "https://data.qldtraffic.qld.gov.au/events_v2.geojson";

const ESSENTIAL_ENERGY_OUTAGES =
  "https://www.essentialenergy.com.au/Assets/kmz/current.kml";

const QLD_RIVER_HEIGHT_PRODUCTS =
  Object.freeze([
    "IDQ60285",
    "IDQ60286",
    "IDQ60287",
    "IDQ60288",
    "IDQ60289",
    "IDQ60290",
    "IDQ60291",
    "IDQ60292",
    "IDQ60293",
    "IDQ60294",
    "IDQ60295",
    "IDQ60296"
  ]);

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

const FLOOD_ROAD_CACHE_URL =
  "https://stormtracker.internal/flood-road-closures-cache-v4";
const V915_ROAD_CACHE_URL =
  "https://stormtracker.internal/flood-road-closures-cache-v5";

const FLOOD_ROAD_FRESH_MS =
  5 * 60 * 1000;

const FLOOD_ROAD_STALE_MS =
  2 * 60 * 60 * 1000;

function floodRoadResponse(
  payload,
  origin,
  {
    cacheStatus = "fresh",
    upstreamStatus = 200,
    storedAt = new Date().toISOString()
  } = {}
) {
  const headers =
    corsHeaders(origin);

  headers.set(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  headers.set(
    "Cache-Control",
    "public, max-age=60"
  );

  headers.set(
    "X-StormTracker-Road-Cache",
    cacheStatus
  );

  headers.set(
    "X-StormTracker-Road-Upstream-Status",
    String(upstreamStatus)
  );

  return new Response(
    JSON.stringify({
      ...payload,
      stormtracker: {
        ...(payload?.stormtracker ?? {}),
        cache_status:
          cacheStatus,
        stored_at:
          storedAt,
        upstream_status:
          upstreamStatus
      }
    }),
    {
      status: 200,
      headers
    }
  );
}

async function cachedFloodRoadSnapshot(preview=false) {
  try {
    const cache =
      caches.default;

    const cached =
      await cache.match(
        preview ? V915_ROAD_CACHE_URL : FLOOD_ROAD_CACHE_URL
      );

    if (!cached) {
      return null;
    }

    const wrapper =
      await cached.json();

    const storedAtMs =
      Date.parse(
        wrapper?.stored_at
        ?? ""
      );

    if (
      !Number.isFinite(storedAtMs)
      || !wrapper?.payload
    ) {
      return null;
    }

    return {
      payload:
        wrapper.payload,
      storedAt:
        wrapper.stored_at,
      ageMs:
        Date.now()
        - storedAtMs
    };
  } catch {
    return null;
  }
}

async function storeFloodRoadSnapshot(
  payload, preview=false
) {
  try {
    const cache =
      caches.default;

    const storedAt =
      new Date().toISOString();

    const response =
      new Response(
        JSON.stringify({
          stored_at:
            storedAt,
          payload
        }),
        {
          headers: {
            "Content-Type":
              "application/json; charset=utf-8",
            "Cache-Control":
              "public, max-age=7200"
          }
        }
      );

    await cache.put(
      preview ? V915_ROAD_CACHE_URL : FLOOD_ROAD_CACHE_URL,
      response
    );

    return storedAt;
  } catch {
    return new Date().toISOString();
  }
}

async function relayFloodRoadClosures(
  origin, preview=false
) {
  const cached =
    await cachedFloodRoadSnapshot(preview);

  if (
    cached
    && cached.ageMs
      <= FLOOD_ROAD_FRESH_MS
  ) {
    return floodRoadResponse(
      cached.payload,
      origin,
      {
        cacheStatus:
          "fresh-cache",
        upstreamStatus:
          200,
        storedAt:
          cached.storedAt
      }
    );
  }

  const target =
    new URL(QLD_TRAFFIC_EVENTS);

  let upstream;

  try {
    upstream = await fetch(
      target.toString(),
      {
        method: "GET",
        headers: {
          Accept:
            "application/geo+json,application/json"
        }
      }
    );
  } catch (error) {
    if (
      cached
      && cached.ageMs
        <= FLOOD_ROAD_STALE_MS
    ) {
      return floodRoadResponse(
        cached.payload,
        origin,
        {
          cacheStatus:
            "stale-upstream-error",
          upstreamStatus:
            502,
          storedAt:
            cached.storedAt
        }
      );
    }

    return errorResponse(
      `QLDTraffic fetch failed: ${
        error?.message || String(error)
      }`,
      502,
      origin
    );
  }

  if (!upstream.ok) {
    if (
      cached
      && cached.ageMs
        <= FLOOD_ROAD_STALE_MS
    ) {
      return floodRoadResponse(
        cached.payload,
        origin,
        {
          cacheStatus:
            `stale-upstream-${upstream.status}`,
          upstreamStatus:
            upstream.status,
          storedAt:
            cached.storedAt
        }
      );
    }

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
  } catch {
    if (
      cached
      && cached.ageMs
        <= FLOOD_ROAD_STALE_MS
    ) {
      return floodRoadResponse(
        cached.payload,
        origin,
        {
          cacheStatus:
            "stale-invalid-json",
          upstreamStatus:
            upstream.status,
          storedAt:
            cached.storedAt
        }
      );
    }

    return errorResponse(
      "QLDTraffic response was not valid JSON",
      502,
      origin
    );
  }

  const filtered =
    preview ? filterFloodRoadClosures(payload)
            : filterLegacyFloodRoadClosures(payload);

  const filteredPayload = {
    type:
      "FeatureCollection",
    features:
      filtered.features,
    stormtracker: {
      filter:
        preview
          ? "published + current + closed to all traffic + Flash flooding/Long-term flooding/Earlier flooding/Heavy rain"
          : "published + flood-related + closures",
      source:
        "Queensland Department of Transport and Main Roads · QLDTraffic",
      upstream:
        QLD_TRAFFIC_EVENTS
    }
  };

  const storedAt =
    await storeFloodRoadSnapshot(
      filteredPayload, preview
    );

  return floodRoadResponse(
    filteredPayload,
    origin,
    {
      cacheStatus:
        "fresh-upstream",
      upstreamStatus:
        upstream.status,
      storedAt
    }
  );
}

async function relayEssentialEnergyOutages(
  request,
  origin
) {
  let upstream;

  try {
    upstream =
      await fetch(
        ESSENTIAL_ENERGY_OUTAGES,
        {
          method:
            request.method,

          headers: {
            Accept:
              "application/vnd.google-earth.kml+xml,application/xml,text/xml,text/plain"
          },

          cf: {
            cacheEverything:
              true,
            cacheTtl:
              300
          }
        }
      );
  } catch (error) {
    return errorResponse(
      `Essential Energy outage fetch failed: ${error?.message || String(error)}`,
      502,
      origin
    );
  }

  if (!upstream.ok) {
    return errorResponse(
      `Essential Energy outage feed HTTP ${upstream.status}`,
      502,
      origin
    );
  }

  const headers =
    new Headers(
      upstream.headers
    );

  for (
    const [key, value]
    of corsHeaders(origin)
      .entries()
  ) {
    headers.set(
      key,
      value
    );
  }

  headers.set(
    "Content-Type",
    "application/vnd.google-earth.kml+xml; charset=utf-8"
  );

  headers.set(
    "Cross-Origin-Resource-Policy",
    "cross-origin"
  );

  headers.set(
    "Cache-Control",
    "public, max-age=300"
  );

  return new Response(
    request.method === "HEAD"
      ? null
      : upstream.body,
    {
      status:
        upstream.status,
      statusText:
        upstream.statusText,
      headers
    }
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

async function relayRiverGaugeMetadata(
  request,
  origin
) {
  let upstream;

  try {
    upstream =
      await fetch(
        BOM_RIVER_TIDE_GAUGE_QUERY_URL,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/geo+json,application/json"
          },

          cf: {
            cacheEverything:
              true,
            cacheTtl:
              300
          }
        }
      );
  } catch (error) {
    return errorResponse(
      `BoM river-gauge metadata fetch failed: ${error?.message || String(error)}`,
      502,
      origin
    );
  }

  if (!upstream.ok) {
    return errorResponse(
      `BoM river-gauge metadata HTTP ${upstream.status}`,
      502,
      origin
    );
  }

  const headers =
    new Headers(
      upstream.headers
    );

  for (
    const [
      key,
      value
    ]
    of corsHeaders(
      origin
    ).entries()
  ) {
    headers.set(
      key,
      value
    );
  }

  headers.set(
    "Content-Type",
    "application/geo+json; charset=utf-8"
  );

  headers.set(
    "Cross-Origin-Resource-Policy",
    "cross-origin"
  );

  headers.set(
    "Cache-Control",
    "public, max-age=300"
  );

  return new Response(
    request.method
    === "HEAD"
      ? null
      : upstream.body,
    {
      status:
        upstream.status,
      statusText:
        upstream.statusText,
      headers
    }
  );
}

function riverHeightProductUrls(
  product
) {
  return [
    `https://www.bom.gov.au/fwo/${product}.html`,
    `https://www.bom.gov.au/cgi-bin/wrap_fwo.pl?${product}.html`
  ];
}

async function fetchRiverHeightProduct(
  product
) {
  const failures = [];

  for (
    const url
    of riverHeightProductUrls(
      product
    )
  ) {
    let response;

    try {
      response =
        await fetch(
          url,
          {
            method:
              "GET",

            headers: {
              Accept:
                "text/html"
            },

            cf: {
              cacheEverything:
                true,
              cacheTtl:
                300
            }
          }
        );
    } catch (error) {
      failures.push(
        `${url}: ${error?.message || String(error)}`
      );

      continue;
    }

    if (!response.ok) {
      failures.push(
        `${url}: HTTP ${response.status}`
      );

      continue;
    }

    const html =
      await response.text();

    const observations =
      parseRiverHeightBulletin({
        html,
        sourceProduct:
          product
      });

    if (!observations.length) {
      failures.push(
        `${url}: no river-height observations parsed`
      );

      continue;
    }

    return {
      product,
      source:
        url,
      observations
    };
  }

  throw new Error(
    failures.join(
      " | "
    )
    || `${product}: no usable BoM river-height source`
  );
}

function riverHeightResponse(
  payload,
  origin,
  method = "GET"
) {
  const headers =
    corsHeaders(
      origin
    );

  headers.set(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  headers.set(
    "Cache-Control",
    "public, max-age=300"
  );

  return new Response(
    method === "HEAD"
      ? null
      : JSON.stringify(
          payload
        ),
    {
      status:
        200,
      headers
    }
  );
}

async function relayRiverHeightBulletins(
  request,
  origin
) {
  const settled =
    await Promise.allSettled(
      QLD_RIVER_HEIGHT_PRODUCTS
        .map(
          fetchRiverHeightProduct
        )
    );

  const products = [];
  const failed = [];

  settled.forEach(
    (
      result,
      index
    ) => {
      const product =
        QLD_RIVER_HEIGHT_PRODUCTS[
          index
        ];

      if (
        result.status
        === "fulfilled"
      ) {
        products.push(
          result.value
        );

        return;
      }

      failed.push({
        product,

        message:
          result.reason
            ?.message
          ?? String(
            result.reason
          )
      });
    }
  );

  if (!products.length) {
    return errorResponse(
      failed
        .map(
          item =>
            `${item.product}: ${item.message}`
        )
        .join(
          " | "
        )
      || "BoM river-height bulletins unavailable",
      502,
      origin
    );
  }

  return riverHeightResponse(
    {
      format:
        "StormTrackerRiverHeightBulletinsV1",

      loaded_at:
        new Date()
          .toISOString(),

      partial:
        failed.length > 0,

      source_products:
        QLD_RIVER_HEIGHT_PRODUCTS,

      products,

      failed
    },
    origin,
    request.method
  );
}


const QLD_RECENT_PRODUCT_IDS = new Set(
  Array.from({length:12},(_,i)=>"IDQ"+(65388+i))
);
// The existing relay handles CORS. No new server, storage or infrastructure.
async function relayRiverRecentHistory(request,incoming,origin){
  const product=String(incoming.searchParams.get("product")??"").toUpperCase();
  const station=String(incoming.searchParams.get("station")??"");
  if(!QLD_RECENT_PRODUCT_IDS.has(product)||!new RegExp("^\\d{5,7}$").test(station))
    return errorResponse("Invalid QLD BoM recent-history station",400,origin);
  const url="https://www.bom.gov.au/fwo/"+product+"/"+product+"."+station+".tbl.shtml";
  let response;
  try {
    response=await fetch(url,{headers:{Accept:"text/html"},
      cf:{cacheEverything:true,cacheTtl:300}});
  }catch {
    return errorResponse("BoM recent-data source unavailable",502,origin);
  }
  if(!response.ok)return errorResponse(
    "BoM recent-data HTTP "+response.status,502,origin);
  const html=await response.text();
  if(html.length>1200000)return errorResponse("BoM recent-data response too large",502,origin);
  const samples=parseBomRecentWaterLevels(html,{nowMs:Date.now(),maxAgeHours:48});
  if(!samples.length)return errorResponse("BoM station has no usable recent observations",502,origin);
  const headers=corsHeaders(origin);
  headers.set("Content-Type","application/json; charset=utf-8");
  headers.set("Cache-Control","public, max-age=300");
  return new Response(request.method==="HEAD"?null:JSON.stringify({
    format:"StormTrackerBomRecentRiverHistoryV1",product,station,samples
  }),{status:200,headers});
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
      return relayFloodRoadClosures(origin,false);
    }

    if (incoming.pathname === "/flood-road-closures-v9-15") {
      return relayFloodRoadClosures(origin,true);
    }

    if (incoming.pathname === "/essential-energy-outages") {
      return relayEssentialEnergyOutages(
        request,
        origin
      );
    }

    if (incoming.pathname === "/river-gauge-metadata") {
      return relayRiverGaugeMetadata(
        request,
        origin
      );
    }

    if (incoming.pathname === "/river-height-bulletins") {
      return relayRiverHeightBulletins(
        request,
        origin
      );
    }

    if (incoming.pathname === "/river-recent-history") {
      return relayRiverRecentHistory(request,incoming,origin);
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
