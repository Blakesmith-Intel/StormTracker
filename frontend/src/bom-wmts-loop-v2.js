import { QLD_RADAR_SITES } from "./qld-radar-sites-v1.js";
import { decodeReflectivityImageData, SOURCE_PALETTES, REFLECTIVITY_CLASSES } from "./palette.js?v=diagnostics-v1";
import { fetchReadableImage } from "./radar-source.js?v=diagnostics-v1";

const BOM_WMTS_BASE = "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/wmts";
const REFLECTIVITY_LAYER = "atm_surf_air_precip_reflectivity_dbz";
const TILE_MATRIX_SET = "GoogleMapsCompatible_BoM";
const ZOOM = 8;
const WORLD_EXTENT_M = 40075016.68557849;

// Current BOM observed-weather WMTS matrix metadata for native zoom 8.
const MATRIX = Object.freeze({
  tlx: 11584952,
  tly: -740105.880375,
  width: 43,
  height: 33
});

// SEQ window covering Gympie/Mt Kanigan, Marburg and Mt Stapylton plus
// surrounding storm approach/departure area.
const SEQ_WINDOW = Object.freeze({
  colStart: 33,
  colEnd: 35,
  rowStart: 13,
  rowEnd: 16
});

export function reflectivityWindowForRegion(region = 'SEQ') {
  if (region === 'SEQ') return SEQ_WINDOW;
  const site = QLD_RADAR_SITES[region];
  if (!site) throw new Error(`Unknown Queensland radar site: ${region}`);
  const R = 6378137, span = tileSpanM();
  const x = R * site.longitude * Math.PI / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + site.latitude * Math.PI / 360));
  const radius = 160000 / Math.cos(site.latitude * Math.PI / 180);
  return Object.freeze({
    colStart: Math.max(0, Math.floor((x - radius - MATRIX.tlx) / span)),
    colEnd: Math.min(MATRIX.width - 1, Math.floor((x + radius - MATRIX.tlx) / span)),
    rowStart: Math.max(0, Math.floor((MATRIX.tly - y - radius) / span)),
    rowEnd: Math.min(MATRIX.height - 1, Math.floor((MATRIX.tly - y + radius) / span))
  });
}

function tileSpanM() {
  return WORLD_EXTENT_M / (2 ** ZOOM);
}

export function buildBomReflectivityTileUrl(col, row, observedUtc) {
  if (!Number.isInteger(col) || !Number.isInteger(row)) {
    throw new TypeError("BOM WMTS col and row must be integers.");
  }
  if (col < 0 || col >= MATRIX.width || row < 0 || row >= MATRIX.height) {
    throw new RangeError(`BOM WMTS tile outside matrix: col=${col}, row=${row}`);
  }

  const params = new URLSearchParams({
    SERVICE: "WMTS",
    REQUEST: "GetTile",
    VERSION: "1.0.0",
    LAYER: REFLECTIVITY_LAYER,
    STYLE: "default",
    FORMAT: "image/png",
    TILEMATRIXSET: TILE_MATRIX_SET,
    TILEMATRIX: String(ZOOM),
    TILEROW: String(row),
    TILECOL: String(col),
    time: observedUtc
  });

  return `${BOM_WMTS_BASE}?${params.toString()}`;
}

function floorToFiveMinutes(epochMs) {
  return Math.floor(epochMs / 300000) * 300000;
}

export function candidateBomReflectivityTimes(now = Date.now(), count = 8) {
  const base = floorToFiveMinutes(Number(now)) - 10 * 60 * 1000;
  return Array.from({ length: count }, (_, index) =>
    new Date(base - index * 5 * 60 * 1000)
      .toISOString()
      .replace(".000Z", "Z")
  );
}

async function probeTimestamp(observedUtc, region = 'SEQ') {
  const window = reflectivityWindowForRegion(region);
  const col = region === "SEQ" ? 34 : Math.floor((window.colStart + window.colEnd) / 2);
  const row = region === "SEQ" ? 15 : Math.floor((window.rowStart + window.rowEnd) / 2);
  const url = buildBomReflectivityTileUrl(col, row, observedUtc);
  const image = await fetchReadableImage(url);
  return image.width > 0 && image.height > 0;
}

export async function findLatestBomReflectivityTime(now = Date.now(), region = 'SEQ') {
  let lastError = null;

  for (const observedUtc of candidateBomReflectivityTimes(now, 10)) {
    try {
      if (await probeTimestamp(observedUtc, region)) return observedUtc;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw new Error(
      `RELAY V3 ACTIVE — unable to fetch readable BOM reflectivity via ` +
      `stormtracker-bom-relay.stormtracker-bom-relay.workers.dev. ` +
      `${lastError.message}`
    );
  }

  throw new Error("No recent BOM reflectivity WMTS frame was available.");
}

function createCanvas(width, height) {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  throw new Error("No browser canvas implementation is available.");
}

export async function loadBomReflectivityMosaicAtTime(observedUtc, region = 'SEQ') {
  if (!observedUtc) throw new Error("observedUtc is required.");

  const window = reflectivityWindowForRegion(region);
  const columns = window.colEnd - window.colStart + 1;
  const rows = window.rowEnd - window.rowStart + 1;
  const tileSize = 256;
  const width = columns * tileSize;
  const height = rows * tileSize;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) throw new Error("Unable to create a 2-D canvas context.");

  const jobs = [];

  for (let row = window.rowStart; row <= window.rowEnd; row++) {
    for (let col = window.colStart; col <= window.colEnd; col++) {
      jobs.push((async () => {
        const image = await fetchReadableImage(
          buildBomReflectivityTileUrl(col, row, observedUtc)
        );

        return {
          image,
          x: (col - window.colStart) * tileSize,
          y: (row - window.rowStart) * tileSize
        };
      })());
    }
  }

  const tiles = await Promise.all(jobs);

  for (const tile of tiles) {
    ctx.putImageData(tile.image, tile.x, tile.y);
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const categories = decodeReflectivityImageData(
    imageData,
    SOURCE_PALETTES.reflectivityRgb,
    2
  );

  const span = tileSpanM();

  const minX = MATRIX.tlx + window.colStart * span;
  const maxX = MATRIX.tlx + (window.colEnd + 1) * span;
  const maxY = MATRIX.tly - window.rowStart * span;
  const minY = MATRIX.tly - (window.rowEnd + 1) * span;

  let colouredPixelCount = 0;
  let strongPixelCount = 0;
  let maxCategory = 0;
  const categoryHistogram = Array(16).fill(0);

  for (const value of categories) {
    if (value > 0) {
      colouredPixelCount++;
      categoryHistogram[value]++;
      if (value > maxCategory) maxCategory = value;
    }
    if (value >= 7) strongPixelCount++;
  }

  const [maxDbzLowerBound, maxDbzUpperBound] =
    REFLECTIVITY_CLASSES[maxCategory] ?? [null, null];

  return {
    radarId: "BOM-MOSAIC",
    sourceId: "BOM-MOSAIC",
    observedUtc,
    width,
    height,
    categories,
    georef: {
      projection: "EPSG:3857",
      minX,
      maxX,
      minY,
      maxY
    },
    sourceMetadata: {
      provider: "Australian Bureau of Meteorology",
      transport: "StormTracker Cloudflare relay",
      relay: "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev",
      product: "Public observed rain reflectivity WMTS",
      layer: REFLECTIVITY_LAYER,
      tileMatrixSet: TILE_MATRIX_SET,
      zoom: ZOOM,
      tileWindow: { ...window },
      region,
      colouredPixelCount,
      strongPixelCount,
      maxCategory,
      maxDbzLowerBound,
      maxDbzUpperBound,
      categoryHistogram,
      volumeStatus: "live-2d-only"
    }
  };
}

export async function loadLatestBomReflectivityMosaic(now = Date.now(), region = 'SEQ') {
  const observedUtc = await findLatestBomReflectivityTime(now, region);
  return loadBomReflectivityMosaicAtTime(observedUtc, region);
}

export async function discoverBomReflectivityHistory(
  now = Date.now(),
  horizonMinutes = 180,
  region = 'SEQ'
) {
  const horizon = Math.max(
    30,
    Math.min(180, Number(horizonMinutes) || 180)
  );

  // Probe beyond the target horizon to absorb normal publication delay before
  // the newest readable WMTS image. Unlike V9.8.2, discovery does not stop at
  // the first history gap: older readable observations can still anchor a
  // longer display window.
  const candidates =
    candidateBomReflectivityTimes(
      now,
      Math.ceil((horizon + 60) / 5)
    );

  const readable = [];

  // Small batches avoid hammering the Bureau/relay while keeping the complete
  // three-hour scan materially faster than serial probing.
  for (
    let offset = 0;
    offset < candidates.length;
    offset += 6
  ) {
    const batch =
      candidates.slice(offset, offset + 6);

    const results =
      await Promise.all(
        batch.map(
          async observedUtc => {
            try {
              return await probeTimestamp(
                observedUtc,
                region
              )
                ? observedUtc
                : null;
            } catch {
              return null;
            }
          }
        )
      );

    readable.push(
      ...results.filter(Boolean)
    );
  }

  if (!readable.length) {
    throw new Error(
      "No recent readable BOM reflectivity frames were available."
    );
  }

  const ordered =
    [...new Set(readable)]
      .sort(
        (a, b) =>
          Date.parse(a) - Date.parse(b)
      );

  const newestEpoch =
    Date.parse(ordered.at(-1));

  const earliestEpoch =
    newestEpoch - horizon * 60000;

  return ordered.filter(
    observedUtc =>
      Date.parse(observedUtc)
      >= earliestEpoch
  );
}

export async function findRecentBomReflectivityTimes(
  now = Date.now(),
  count = 6,
  region = 'SEQ'
) {
  const available = [];

  const probeCount =
    Math.max(
      14,
      Number(count) + 8
    );

  for (
    const observedUtc
    of candidateBomReflectivityTimes(
      now,
      probeCount
    )
  ) {
    try {
      if (await probeTimestamp(observedUtc, region)) {
        available.push(observedUtc);
      }
    } catch {
      // Missing/unreadable candidate timestamps are skipped.
    }

    if (available.length >= count) {
      break;
    }
  }

  if (!available.length) {
    throw new Error(
      "No recent readable BOM reflectivity frames were available."
    );
  }

  // Processing must be chronological for persistent storm tracking.
  return available.sort(
    (a, b) => Date.parse(a) - Date.parse(b)
  );
}

export async function loadRecentBomReflectivityMosaics(
  now = Date.now(),
  count = 6,
  onProgress = null,
  region = 'SEQ'
) {
  const times = await findRecentBomReflectivityTimes(now, count, region);
  const frames = [];

  for (let index = 0; index < times.length; index++) {
    const observedUtc = times[index];

    onProgress?.({
      stage: "loading",
      index,
      total: times.length,
      observedUtc
    });

    const frame =
      await loadBomReflectivityMosaicAtTime(observedUtc, region);

    frames.push(frame);

    onProgress?.({
      stage: "loaded",
      index,
      total: times.length,
      observedUtc,
      frame
    });
  }

  return frames;
}

