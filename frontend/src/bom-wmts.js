import { decodeReflectivityImageData, SOURCE_PALETTES } from "./palette.js?v=live-bom-v1";
import { fetchReadableImage } from "./radar-source.js?v=live-bom-v1";

const BOM_WMTS_BASE = "https://api.bom.gov.au/apikey/v1/mapping/timeseries/wmts";
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
      `Unable to read BOM reflectivity WMTS from this browser. ${lastError.message}`
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

export async function loadLatestBomReflectivityMosaic(now = Date.now()) {
  const observedUtc = await findLatestBomReflectivityTime(now);

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

  for (const value of categories) {
    if (value > 0) colouredPixelCount++;
    if (value >= 7) strongPixelCount++;
  }

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
      product: "Public observed rain reflectivity WMTS",
      layer: REFLECTIVITY_LAYER,
      tileMatrixSet: TILE_MATRIX_SET,
      zoom: ZOOM,
      tileWindow: { ...SEQ_WINDOW },
      colouredPixelCount,
      strongPixelCount,
      volumeStatus: "live-2d-only"
    }
  };
}
