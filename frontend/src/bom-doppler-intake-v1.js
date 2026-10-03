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
