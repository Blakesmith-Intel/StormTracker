import {
  parseBomReceivedAtUtc
} from "./doppler-time-v1.js";

const BOM_WMTS =
  "https://api.bom.gov.au/apikey/v1/mapping/timeseries/wmts";

const BOM_RADAR_BASE =
  "https://www.bom.gov.au/radar/";

const BOM_PRODUCT_BASE =
  "https://www.bom.gov.au/products/";

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

function corsHeaders(
  origin
) {
  const headers =
    new Headers();

  if (
    ALLOWED_ORIGINS
      .has(
        origin
      )
  ) {
    headers.set(
      "Access-Control-Allow-Origin",
      origin
    );

    headers.set(
      "Vary",
      "Origin"
    );
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

function errorResponse(
  message,
  status,
  origin
) {
  const headers =
    corsHeaders(
      origin
    );

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
    incoming.searchParams
      .get(
        "LAYER"
      );

  if (
    !ALLOWED_LAYERS
      .has(
        layer
      )
  ) {
    return errorResponse(
      "Layer not allowed",
      403,
      origin
    );
  }

  const target =
    new URL(
      BOM_WMTS
    );

  for (
    const [
      key,
      value
    ]
    of incoming
      .searchParams
      .entries()
  ) {
    if (
      ALLOWED_PARAMS
        .has(
          key
        )
    ) {
      target.searchParams
        .append(
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
        || String(
          error
        )
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
    corsHeaders(
      origin
    );

  for (
    const [
      key,
      value
    ]
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

async function fetchDopplerObservedUtc(
  product
) {
  const target =
    new URL(
      `${product}.shtml`,
      BOM_PRODUCT_BASE
    );

  const response =
    await fetch(
      target.toString(),
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
            30
        }
      }
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `BOM Doppler product page HTTP ${response.status}`
    );
  }

  const html =
    await response.text();

  const observedUtc =
    parseBomReceivedAtUtc(
      html
    );

  if (
    !observedUtc
  ) {
    throw new Error(
      "BOM Doppler product page did not contain a parseable Received at UTC timestamp."
    );
  }

  return observedUtc;
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
        .get(
          "product"
        )
      || ""
    )
      .toUpperCase();

  if (
    !ALLOWED_DOPPLER_PRODUCTS
      .has(
        product
      )
  ) {
    return errorResponse(
      "Doppler product not allowed",
      403,
      origin
    );
  }

  const imageTarget =
    new URL(
      `${product}.gif`,
      BOM_RADAR_BASE
    );

  const imagePromise =
    fetch(
      imageTarget.toString(),
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

  const metadataPromise =
    fetchDopplerObservedUtc(
      product
    );

  const [
    imageResult,
    metadataResult
  ] =
    await Promise.allSettled([
      imagePromise,
      metadataPromise
    ]);

  if (
    imageResult.status
    !== "fulfilled"
  ) {
    return errorResponse(
      `BOM Doppler fetch failed: ${
        imageResult.reason?.message
        || String(
          imageResult.reason
        )
      }`,
      502,
      origin
    );
  }

  const upstream =
    imageResult.value;

  const observedUtc =
    metadataResult.status
    === "fulfilled"
      ? metadataResult.value
      : null;

  const headers =
    new Headers(
      upstream.headers
    );

  const cors =
    corsHeaders(
      origin
    );

  for (
    const [
      key,
      value
    ]
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

  if (
    observedUtc
  ) {
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
      status:
        upstream.status,

      statusText:
        upstream.statusText,

      headers
    }
  );
}

export default {
  async fetch(
    request
  ) {
    const incoming =
      new URL(
        request.url
      );

    const origin =
      request.headers
        .get(
          "Origin"
        )
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
      request.method
      !== "GET"
      && request.method
        !== "HEAD"
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
        .has(
          origin
        )
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
