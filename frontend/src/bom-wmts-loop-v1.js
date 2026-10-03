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

async function probeTimestamp(observedUtc) {
  const url = buildBomReflectivityTileUrl(34, 15, observedUtc);
  const image = await fetchReadableImage(url);
  return image.width > 0 && image.height > 0;
}

export async function findLatestBomReflectivityTime(now = Date.now()) {
  let lastError = null;

  for (const observedUtc of candidateBomReflectivityTimes(now, 10)) {
    try {
      if (await probeTimestamp(observedUtc)) return observedUtc;
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

export async function loadBomReflectivityMosaicAtTime(observedUtc) {
  if (!observedUtc) throw new Error("observedUtc is required.");

  const columns = SEQ_WINDOW.colEnd - SEQ_WINDOW.colStart + 1;
  const rows = SEQ_WINDOW.rowEnd - SEQ_WINDOW.rowStart + 1;
  const tileSize = 256;
  const width = columns * tileSize;
  const height = rows * tileSize;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) throw new Error("Unable to create a 2-D canvas context.");

  const jobs = [];

  for (let row = SEQ_WINDOW.rowStart; row <= SEQ_WINDOW.rowEnd; row++) {
    for (let col = SEQ_WINDOW.colStart; col <= SEQ_WINDOW.colEnd; col++) {
      jobs.push((async () => {
        const image = await fetchReadableImage(
          buildBomReflectivityTileUrl(col, row, observedUtc)
        );

        return {
          image,
          x: (col - SEQ_WINDOW.colStart) * tileSize,
          y: (row - SEQ_WINDOW.rowStart) * tileSize
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

  const minX = MATRIX.tlx + SEQ_WINDOW.colStart * span;
  const maxX = MATRIX.tlx + (SEQ_WINDOW.colEnd + 1) * span;
  const maxY = MATRIX.tly - SEQ_WINDOW.rowStart * span;
  const minY = MATRIX.tly - (SEQ_WINDOW.rowEnd + 1) * span;

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
      tileWindow: { ...SEQ_WINDOW },
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

export async function loadLatestBomReflectivityMosaic(now = Date.now()) {
  const observedUtc = await findLatestBomReflectivityTime(now);
  return loadBomReflectivityMosaicAtTime(observedUtc);
}

export async function findRecentBomReflectivityTimes(
  now = Date.now(),
  count = 6
) {
  const available = [];

  for (const observedUtc of candidateBomReflectivityTimes(now, 14)) {
    try {
      if (await probeTimestamp(observedUtc)) {
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
  onProgress = null
) {
  const times = await findRecentBomReflectivityTimes(now, count);
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
      await loadBomReflectivityMosaicAtTime(observedUtc);

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

