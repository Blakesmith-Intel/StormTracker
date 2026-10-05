const RELAY_ROOT =
  "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev";

export const DOPPLER_PRODUCTS =
  Object.freeze({
    "08":
      "IDR08I",

    "50":
      "IDR50I",

    "66":
      "IDR66I",
  });

function productForRadar(
  radarId
) {
  const product =
    DOPPLER_PRODUCTS[
      String(
        radarId
      )
    ];

  if (!product) {
    throw new Error(
      `Unsupported Doppler radar: ${radarId}`
    );
  }

  return product;
}

function relayUrl(
  path,
  radarId
) {
  const url =
    new URL(
      `${RELAY_ROOT}${path}`
    );

  url.searchParams.set(
    "product",
    productForRadar(
      radarId
    )
  );

  return url;
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
  const bitmap =
    await createImageBitmap(
      await response.blob()
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

  for (
    let i = 0;
    i < imageData.data.length;
    i += 4
  ) {
    const alpha =
      imageData.data[
        i + 3
      ];

    if (
      alpha === 0
    ) {
      transparent++;
      continue;
    }

    opaque++;

    const key =
      `${imageData.data[i]},${imageData.data[i + 1]},${imageData.data[i + 2]}`;

    counts.set(
      key,
      (
        counts.get(
          key
        )
        || 0
      ) + 1
    );
  }

  const colours =
    [...counts.entries()]
      .map(
        (
          [
            rgb,
            count
          ]
        ) => ({
          rgb:
            rgb
              .split(
                ","
              )
              .map(
                Number
              ),

          count
        })
      )
      .sort(
        (
          a,
          b
        ) =>
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

async function loadImageResponse(
  radarId,
  response,
  url
) {
  const {
    canvas,
    imageData
  } =
    await responseToImageData(
      response
    );

  return {
    radarId:
      String(
        radarId
      ),

    product:
      response.headers.get(
        "X-StormTracker-Product"
      ),

    observedUtc:
      response.headers.get(
        "X-StormTracker-Observed-UTC"
      ),

    timeSource:
      response.headers.get(
        "X-StormTracker-Time-Source"
      ),

    lastModified:
      response.headers.get(
        "Last-Modified"
      ),

    contentType:
      response.headers.get(
        "Content-Type"
      ),

    url,

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

export function buildDopplerRelayUrl(
  radarId
) {
  return relayUrl(
    "/radar",
    radarId
  )
    .toString();
}

export function buildDopplerHistoryUrl(
  radarId
) {
  return relayUrl(
    "/radar-history",
    radarId
  )
    .toString();
}

export function buildDopplerFrameUrl(
  radarId,
  filename
) {
  const product =
    productForRadar(
      radarId
    );

  const value =
    String(
      filename
      ?? ""
    );

  if (
    !value.startsWith(
      `${product}.T.`
    )
  ) {
    throw new Error(
      `Doppler history frame does not belong to radar ${radarId}: ${filename}`
    );
  }

  const url =
    relayUrl(
      "/radar-frame",
      radarId
    );

  url.searchParams.set(
    "file",
    value
  );

  return url.toString();
}

export function nearestDopplerFrameForTime(
  frames,
  targetUtc,
  maxDeltaMinutes =
    8
) {
  const targetEpoch =
    Date.parse(
      targetUtc
    );

  if (
    !Number.isFinite(
      targetEpoch
    )
  ) {
    throw new Error(
      `Invalid target UTC time: ${targetUtc}`
    );
  }

  let best =
    null;

  for (
    const frame
    of frames
    ?? []
  ) {
    const epoch =
      Date.parse(
        frame.observedUtc
      );

    if (
      !Number.isFinite(
        epoch
      )
    ) {
      continue;
    }

    const deltaMinutes =
      Math.abs(
        epoch
        - targetEpoch
      )
      / 60000;

    if (
      !best
      || deltaMinutes
        < best.deltaMinutes
      || (
        deltaMinutes
        === best.deltaMinutes
        && epoch
          < best.epoch
      )
    ) {
      best = {
        frame,
        epoch,
        deltaMinutes
      };
    }
  }

  if (!best) {
    return {
      candidate:
        null,

      deltaMinutes:
        null,

      matched:
        false
    };
  }

  return {
    candidate:
      best.frame,

    deltaMinutes:
      best.deltaMinutes,

    matched:
      best.deltaMinutes
      <= maxDeltaMinutes
  };
}

export async function loadDopplerHistory(
  radarId
) {
  const url =
    buildDopplerHistoryUrl(
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
      `Doppler history relay failed: HTTP ${response.status}`
    );
  }

  const payload =
    await response.json();

  if (
    payload?.format
    !== "StormTrackerDopplerHistoryV1"
    || !Array.isArray(
      payload.frames
    )
  ) {
    throw new Error(
      "Unexpected Doppler history response."
    );
  }

  return {
    radarId:
      String(
        radarId
      ),

    product:
      payload.product,

    source:
      payload.source,

    filenameConvention:
      payload.filename_convention,

    frames:
      payload.frames
  };
}

export async function loadDopplerFrame(
  radarId,
  frameDescriptor
) {
  const filename =
    frameDescriptor
      ?.filename;

  if (!filename) {
    throw new Error(
      "Doppler history frame filename is required."
    );
  }

  const url =
    buildDopplerFrameUrl(
      radarId,
      filename
    );

  const response =
    await fetch(
      url,
      {
        cache:
          "force-cache"
      }
    );

  if (!response.ok) {
    throw new Error(
      `Doppler history frame relay failed: HTTP ${response.status}`
    );
  }

  return loadImageResponse(
    radarId,
    response,
    url
  );
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

  return loadImageResponse(
    radarId,
    response,
    url
  );
}
