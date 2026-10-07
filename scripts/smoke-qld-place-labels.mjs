import assert from "node:assert/strict";

const service =
  "https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Location/Places/MapServer";

const origin =
  "https://blakesmith-intel.github.io";

async function fetchChecked(
  url,
  options = {}
) {
  const response =
    await fetch(
      url,
      {
        ...options,
        headers: {
          Origin:
            origin,
          ...(
            options.headers
            ?? {}
          )
        },

        signal:
          AbortSignal.timeout(
            20000
          )
      }
    );

  assert.equal(
    response.ok,
    true,
    `${url} returned HTTP ${response.status}`
  );

  return response;
}

const metadataResponse =
  await fetchChecked(
    `${service}?f=json`
  );

const metadata =
  await metadataResponse.json();

assert.equal(
  metadata.mapName,
  "Places"
);

assert.match(
  metadata.serviceDescription
    ?? metadata.description
    ?? "",
  /places within Queensland/i
);

const layerIds =
  new Set(
    (
      metadata.layers
      ?? []
    ).map(
      layer =>
        Number(
          layer.id
        )
    )
  );

for (
  const layerId
  of [
    20,
    10,
    11,
    12,
    13,
    16,
    17,
    18,
    19
  ]
) {
  assert.equal(
    layerIds.has(
      layerId
    ),
    true,
    `Queensland Places layer ${layerId} is unavailable.`
  );
}

const exportUrl =
  new URL(
    `${service}/export`
  );

exportUrl.search =
  new URLSearchParams({
    bbox:
      "148,-29,154,-23",
    bboxSR:
      "4326",
    imageSR:
      "3857",
    size:
      "640,480",
    format:
      "png32",
    transparent:
      "true",
    layers:
      "show:20,10,11,12,13,16,17,18,19",
    f:
      "image"
  }).toString();

const imageResponse =
  await fetchChecked(
    exportUrl
  );

assert.match(
  imageResponse.headers
    .get(
      "content-type"
    )
    ?? "",
  /image\/(png|octet-stream)/i
);

const imageBytes =
  new Uint8Array(
    await imageResponse
      .arrayBuffer()
  );

assert.ok(
  imageBytes.length
  > 1000,
  "Queensland Places export returned an unexpectedly small image."
);

const cors =
  metadataResponse.headers
    .get(
      "access-control-allow-origin"
    )
  ?? imageResponse.headers
    .get(
      "access-control-allow-origin"
    )
  ?? "";

assert.ok(
  cors === "*"
  || cors.includes(
    "blakesmith-intel.github.io"
  ),
  `Queensland Places did not advertise browser CORS access: ${cors || "none"}`
);

console.log(
  `Queensland Places live smoke passed: ${metadata.layers.length} service layer(s), ${imageBytes.length} byte transparent map export, browser CORS available.`
);
