#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

echo "StormTracker live BOM reflectivity v1"
echo

for f in frontend/src/cesium-view.js frontend/app.css; do
  if [ ! -f "$f" ]; then
    echo "ERROR: Missing expected file: $f"
    exit 1
  fi
done

BACKUP_DIR="/tmp/stormtracker-live-bom-v1-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
cp -a frontend "$BACKUP_DIR/frontend"

echo "Temporary frontend backup created:"
echo "  $BACKUP_DIR/frontend"
echo

cat > frontend/src/palette.js <<'STORMTRACKER_FRONTEND_SRC_PALETTE_JS'
export const REFLECTIVITY_CLASSES = Object.freeze({
  1: [12, 23], 2: [23, 28], 3: [28, 31], 4: [31, 34], 5: [34, 37],
  6: [37, 40], 7: [40, 43], 8: [43, 46], 9: [46, 49], 10: [49, 52],
  11: [52, 55], 12: [55, 58], 13: [58, 61], 14: [61, 64], 15: [64, null]
});

// Current BOM public reflectivity colour table. The 15 RGB bands align exactly
// with StormTracker's recovered dBZ category boundaries.
export const BOM_REFLECTIVITY_RGB = Object.freeze([
  { rgb:[245,245,255], value:1 },
  { rgb:[180,180,255], value:2 },
  { rgb:[120,120,255], value:3 },
  { rgb:[20,20,255], value:4 },
  { rgb:[0,216,195], value:5 },
  { rgb:[0,150,144], value:6 },
  { rgb:[0,102,102], value:7 },
  { rgb:[255,255,0], value:8 },
  { rgb:[255,200,0], value:9 },
  { rgb:[255,150,0], value:10 },
  { rgb:[255,100,0], value:11 },
  { rgb:[255,0,0], value:12 },
  { rgb:[200,0,0], value:13 },
  { rgb:[120,0,0], value:14 },
  { rgb:[40,0,0], value:15 }
]);

export const SOURCE_PALETTES = {
  reflectivityRgb: BOM_REFLECTIVITY_RGB,
  dopplerRgb: [] // Restore only from a verified public Doppler source.
};

function distanceSq(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

export function classifyRgb(rgb, entries, tolerance = 0) {
  if (!entries?.length) return null;
  let best = null;
  let bestD = Infinity;
  for (const entry of entries) {
    const d = distanceSq(rgb, entry.rgb);
    if (d < bestD) { bestD = d; best = entry; }
  }
  return bestD <= tolerance * tolerance ? best.value : null;
}

export function decodeReflectivityImageData(imageData, entries = SOURCE_PALETTES.reflectivityRgb, tolerance = 0) {
  if (!entries.length) throw new Error("Reflectivity RGB palette is not calibrated yet.");
  const out = new Uint8Array(imageData.width * imageData.height);
  const d = imageData.data;
  for (let p = 0, i = 0; p < out.length; p++, i += 4) {
    if (d[i + 3] === 0) continue;
    const value = classifyRgb([d[i], d[i + 1], d[i + 2]], entries, tolerance);
    out[p] = value == null ? 0 : value;
  }
  return out;
}

export function decodeDopplerImageData(imageData, entries = SOURCE_PALETTES.dopplerRgb, tolerance = 0) {
  if (!entries.length) throw new Error("Doppler RGB palette is not calibrated yet.");
  const out = new Int16Array(imageData.width * imageData.height);
  out.fill(-32768);
  const d = imageData.data;
  for (let p = 0, i = 0; p < out.length; p++, i += 4) {
    if (d[i + 3] === 0) continue;
    const value = classifyRgb([d[i], d[i + 1], d[i + 2]], entries, tolerance);
    if (value != null) out[p] = value;
  }
  return out;
}
STORMTRACKER_FRONTEND_SRC_PALETTE_JS

cat > frontend/src/radar-source.js <<'STORMTRACKER_FRONTEND_SRC_RADAR_SOURCE_JS'
import { decodeReflectivityImageData, decodeDopplerImageData } from "./palette.js?v=live-bom-v1";

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

async function blobToImageData(blob) {
  let source;

  if (typeof createImageBitmap === "function") {
    source = await createImageBitmap(blob);
  } else if (typeof document !== "undefined") {
    source = await new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(blob);

      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Unable to decode browser image."));
      };

      image.src = objectUrl;
    });
  } else {
    throw new Error("This browser cannot decode radar image blobs.");
  }

  const width = source.width ?? source.naturalWidth;
  const height = source.height ?? source.naturalHeight;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) throw new Error("Unable to create image decode canvas.");

  ctx.drawImage(source, 0, 0);
  return ctx.getImageData(0, 0, width, height);
}

export async function fetchReadableImage(url) {
  let response;

  try {
    response = await fetch(url, {
      mode: "cors",
      cache: "no-store"
    });
  } catch (error) {
    throw new Error(
      `Browser could not fetch readable radar pixels (network/CORS): ${error.message}`
    );
  }

  if (!response.ok) {
    throw new Error(`Image request failed: HTTP ${response.status}`);
  }

  return blobToImageData(await response.blob());
}

export async function fileToImageData(file) {
  return blobToImageData(file);
}

export async function reflectivityFromUrl(url, palette, tolerance = 0) {
  const imageData = await fetchReadableImage(url);
  return {
    width: imageData.width,
    height: imageData.height,
    categories: decodeReflectivityImageData(imageData, palette, tolerance)
  };
}

export async function reflectivityFromFile(file, palette, tolerance = 0) {
  const imageData = await fileToImageData(file);
  return {
    width: imageData.width,
    height: imageData.height,
    categories: decodeReflectivityImageData(imageData, palette, tolerance)
  };
}

export async function dopplerFromUrl(url, palette, tolerance = 0) {
  const imageData = await fetchReadableImage(url);
  return {
    width: imageData.width,
    height: imageData.height,
    velocities: decodeDopplerImageData(imageData, palette, tolerance)
  };
}
STORMTRACKER_FRONTEND_SRC_RADAR_SOURCE_JS

cat > frontend/src/bom-wmts.js <<'STORMTRACKER_FRONTEND_SRC_BOM_WMTS_JS'
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
STORMTRACKER_FRONTEND_SRC_BOM_WMTS_JS

cat > frontend/src/segmentation.js <<'STORMTRACKER_FRONTEND_SRC_SEGMENTATION_JS'
import { gnomonicPixelToLonLat, pixelAreaM2 } from "./geo.js";
import { REFLECTIVITY_CLASSES } from "./palette.js?v=live-bom-v1";

const EARTH_RADIUS_M = 6378137;

function neighbourOffsets(connectivity) {
  if (connectivity === 4) return [[-1,0],[1,0],[0,-1],[0,1]];
  if (connectivity === 8) return [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
  throw new Error("connectivity must be 4 or 8");
}

export function connectedComponents(mask, width, height, connectivity = 8) {
  if (mask.length !== width * height) throw new Error("mask size does not match width*height");
  const labels = new Uint32Array(mask.length);
  const components = [];
  const offsets = neighbourOffsets(connectivity);
  const queue = new Int32Array(mask.length);
  let nextLabel = 1;

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start] !== 0) continue;
    let head = 0, tail = 0;
    queue[tail++] = start;
    labels[start] = nextLabel;
    const pixels = [];

    while (head < tail) {
      const index = queue[head++];
      pixels.push(index);
      const row = Math.floor(index / width);
      const col = index - row * width;
      for (const [dr, dc] of offsets) {
        const rr = row + dr, cc = col + dc;
        if (rr < 0 || rr >= height || cc < 0 || cc >= width) continue;
        const ni = rr * width + cc;
        if (!mask[ni] || labels[ni] !== 0) continue;
        labels[ni] = nextLabel;
        queue[tail++] = ni;
      }
    }

    components.push(pixels);
    nextLabel++;
  }

  return { labels, components };
}

function thresholdCounts(values) {
  let d50 = 0, p50 = 0, d55 = 0, p55 = 0, d60 = 0, p60 = 0;

  for (const c of values) {
    if (c >= 11) d50++;
    if (c >= 10) p50++;
    if (c >= 12) d55++;
    if (c >= 11) p55++;
    if (c >= 14) d60++;
    if (c >= 13) p60++;
  }

  return {
    definite_ge_50_pixel_count: d50,
    possible_ge_50_pixel_count: p50,
    definite_ge_55_pixel_count: d55,
    possible_ge_55_pixel_count: p55,
    definite_ge_60_pixel_count: d60,
    possible_ge_60_pixel_count: p60
  };
}

function buildSegmentation({
  categories,
  width,
  height,
  sourceId,
  thresholdCategory,
  minPixels,
  connectivity,
  pixelPosition,
  rowAreaM2,
  limitations
}) {
  if (!(categories instanceof Uint8Array)) categories = Uint8Array.from(categories);
  if (categories.length !== width * height) {
    throw new Error("categories size does not match width*height");
  }

  const mask = new Uint8Array(categories.length);

  for (let i = 0; i < categories.length; i++) {
    mask[i] = categories[i] >= thresholdCategory ? 1 : 0;
  }

  const raw = connectedComponents(mask, width, height, connectivity);
  const labels = new Uint16Array(categories.length);
  const cells = [];
  let nextCellId = 1;

  for (const pixels of raw.components) {
    if (pixels.length < minPixels) continue;

    let totalArea = 0;
    let lonWeighted = 0;
    let latWeighted = 0;
    let maxCategory = 0;
    let sumCategory = 0;
    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    const cellCategories = new Uint8Array(pixels.length);

    for (let k = 0; k < pixels.length; k++) {
      const index = pixels[k];
      const row = Math.floor(index / width);
      const col = index - row * width;
      const category = categories[index];
      const pos = pixelPosition(row, col);
      const area = rowAreaM2(row);

      totalArea += area;
      lonWeighted += pos.longitude * area;
      latWeighted += pos.latitude * area;

      maxCategory = Math.max(maxCategory, category);
      sumCategory += category;

      minLon = Math.min(minLon, pos.longitude);
      maxLon = Math.max(maxLon, pos.longitude);
      minLat = Math.min(minLat, pos.latitude);
      maxLat = Math.max(maxLat, pos.latitude);

      cellCategories[k] = category;
      labels[index] = nextCellId;
    }

    const [dbzLower, dbzUpper] =
      REFLECTIVITY_CLASSES[maxCategory] ?? [null, null];

    cells.push({
      local_cell_id: nextCellId,
      pixel_count: pixels.length,
      sampled_area_km2: totalArea / 1_000_000,
      centroid_longitude:
        totalArea > 0 ? lonWeighted / totalArea : (minLon + maxLon) / 2,
      centroid_latitude:
        totalArea > 0 ? latWeighted / totalArea : (minLat + maxLat) / 2,
      maximum_category: maxCategory,
      maximum_dbzh_lower_bound: dbzLower,
      maximum_dbzh_upper_bound: dbzUpper,
      mean_category: sumCategory / pixels.length,
      min_longitude: minLon,
      max_longitude: maxLon,
      min_latitude: minLat,
      max_latitude: maxLat,
      ...thresholdCounts(cellCategories)
    });

    nextCellId++;
  }

  cells.sort(
    (a, b) =>
      b.maximum_category - a.maximum_category ||
      b.sampled_area_km2 - a.sampled_area_km2 ||
      a.local_cell_id - b.local_cell_id
  );

  return {
    format: "StormTrackerBrowserSegmentationV1",
    width,
    height,
    radar_id: sourceId,
    configuration: {
      threshold_category: thresholdCategory,
      threshold_interpretation: "Category 7 and above: definite >=40 dBZ.",
      min_pixels: minPixels,
      connectivity
    },
    raw_component_count: raw.components.length,
    retained_cell_count: cells.length,
    cells,
    labels,
    limitations
  };
}

export function segmentCategoryFrame({
  categories,
  width,
  height,
  radar,
  thresholdCategory = 7,
  minPixels = 8,
  connectivity = 8
}) {
  const rowAreas = new Float64Array(height);

  for (let row = 0; row < height; row++) {
    rowAreas[row] = pixelAreaM2({
      row,
      width,
      height,
      radar
    });
  }

  return buildSegmentation({
    categories,
    width,
    height,
    sourceId: radar.id,
    thresholdCategory,
    minPixels,
    connectivity,
    pixelPosition: (row, col) =>
      gnomonicPixelToLonLat({
        row,
        col,
        width,
        height,
        radar
      }),
    rowAreaM2: row => rowAreas[row],
    limitations: [
      "This is live 2-D segmentation of a radar image, not a volumetric radar object.",
      "Reflectivity is categorical; strongest dBZ is an interval bound, not a continuous measurement.",
      "Sampled area is derived from the radar projection and is an observed raster footprint, not physical cloud area."
    ]
  });
}

function inverseWebMercator(x, y) {
  return {
    longitude: x / EARTH_RADIUS_M * 180 / Math.PI,
    latitude:
      (2 * Math.atan(Math.exp(y / EARTH_RADIUS_M)) - Math.PI / 2) *
      180 / Math.PI
  };
}

export function segmentWebMercatorCategoryFrame({
  categories,
  width,
  height,
  georef,
  sourceId = "BOM-MOSAIC",
  thresholdCategory = 7,
  minPixels = 8,
  connectivity = 8
}) {
  if (georef?.projection !== "EPSG:3857") {
    throw new Error("Web Mercator segmentation requires EPSG:3857 georef.");
  }

  const { minX, maxX, minY, maxY } = georef;

  if (![minX, maxX, minY, maxY].every(Number.isFinite)) {
    throw new Error("Invalid EPSG:3857 georeference.");
  }

  const dx = (maxX - minX) / width;
  const dy = (maxY - minY) / height;
  const rowAreas = new Float64Array(height);
  const dLonRad = dx / EARTH_RADIUS_M;

  for (let row = 0; row < height; row++) {
    const yNorth = maxY - row * dy;
    const ySouth = maxY - (row + 1) * dy;
    const latNorth = inverseWebMercator(0, yNorth).latitude * Math.PI / 180;
    const latSouth = inverseWebMercator(0, ySouth).latitude * Math.PI / 180;

    rowAreas[row] =
      EARTH_RADIUS_M * EARTH_RADIUS_M *
      Math.abs(dLonRad) *
      Math.abs(Math.sin(latNorth) - Math.sin(latSouth));
  }

  return buildSegmentation({
    categories,
    width,
    height,
    sourceId,
    thresholdCategory,
    minPixels,
    connectivity,
    pixelPosition: (row, col) => {
      const x = minX + (col + 0.5) * dx;
      const y = maxY - (row + 0.5) * dy;
      return inverseWebMercator(x, y);
    },
    rowAreaM2: row => rowAreas[row],
    limitations: [
      "This is live 2-D segmentation of the Bureau public reflectivity mosaic, not a measured volumetric storm object.",
      "The Bureau mosaic may combine observations from multiple radars; BOM-MOSAIC is therefore a source label, not an individual radar identity.",
      "Reflectivity is categorical; strongest dBZ is an interval bound, not a continuous measurement.",
      "True measured 3-D mode requires volumetric radar sweeps; StormTracker keeps that separate from live 2-D processing."
    ]
  });
}

export function valuesForLabel(values, labels, wantedLabel, nodata = null) {
  const out = [];

  for (let i = 0; i < labels.length; i++) {
    if (labels[i] !== wantedLabel) continue;
    const value = values[i];
    if (nodata !== null && value === nodata) continue;
    out.push(value);
  }

  return out;
}
STORMTRACKER_FRONTEND_SRC_SEGMENTATION_JS

cat > frontend/src/workers/radar-worker.js <<'STORMTRACKER_FRONTEND_SRC_WORKERS_RADAR_WORKER_JS'
import { RADARS, SEGMENTATION_DEFAULTS, TRACKING_DEFAULTS } from "../config.js";
import {
  segmentCategoryFrame,
  segmentWebMercatorCategoryFrame,
  valuesForLabel
} from "../segmentation.js?v=live-bom-v1";
import {
  cellsToRadarObservations,
  deduplicateRadarCells,
  updateTracks,
  trackToDict,
  activeTracks
} from "../tracking.js";
import { buildTrackLikelihood } from "../lightning.js";

let tracks = [];
let nextTrackNumber = 1;

function cleanSegmentation(seg) {
  const { labels, ...rest } = seg;
  return rest;
}

function bestDopplerForTrack(trackDict, frameContexts) {
  const latest = trackDict.latest;
  if (!latest?.source_cells?.length) return [];

  let best = [];

  for (const [radarId, localCellId] of latest.source_cells) {
    const context = frameContexts.get(String(radarId));

    if (
      !context?.doppler ||
      context.doppler.length !== context.segmentation.labels.length
    ) {
      continue;
    }

    const values = valuesForLabel(
      context.doppler,
      context.segmentation.labels,
      Number(localCellId),
      -32768
    );

    if (values.length > best.length) best = values;
  }

  return best;
}

function segmentFrame(frame, categories) {
  if (frame.georef?.projection === "EPSG:3857") {
    return segmentWebMercatorCategoryFrame({
      categories,
      width: frame.width,
      height: frame.height,
      georef: frame.georef,
      sourceId: String(frame.sourceId ?? frame.radarId ?? "BOM-MOSAIC"),
      thresholdCategory:
        frame.thresholdCategory ?? SEGMENTATION_DEFAULTS.thresholdCategory,
      minPixels:
        frame.minPixels ?? SEGMENTATION_DEFAULTS.minPixels,
      connectivity:
        frame.connectivity ?? SEGMENTATION_DEFAULTS.connectivity
    });
  }

  const radar = RADARS[String(frame.radarId)];

  if (!radar) {
    throw new Error(`Unknown radar ${frame.radarId}`);
  }

  return segmentCategoryFrame({
    categories,
    width: frame.width,
    height: frame.height,
    radar,
    thresholdCategory:
      frame.thresholdCategory ?? SEGMENTATION_DEFAULTS.thresholdCategory,
    minPixels:
      frame.minPixels ?? SEGMENTATION_DEFAULTS.minPixels,
    connectivity:
      frame.connectivity ?? SEGMENTATION_DEFAULTS.connectivity
  });
}

async function processFrameBucket(payload) {
  const frames = payload.frames ?? [];

  if (!frames.length) {
    throw new Error("processFrameBucket requires at least one frame.");
  }

  const frameContexts = new Map();
  const radarObservations = [];
  const segmentations = [];

  for (const frame of frames) {
    const categories =
      frame.categories instanceof Uint8Array
        ? frame.categories
        : new Uint8Array(frame.categories);

    const segmentation = segmentFrame(frame, categories);

    const doppler = frame.doppler
      ? (
          frame.doppler instanceof Int16Array
            ? frame.doppler
            : new Int16Array(frame.doppler)
        )
      : null;

    const sourceId = String(
      frame.sourceId ?? frame.radarId ?? segmentation.radar_id
    );

    frameContexts.set(sourceId, {
      segmentation,
      doppler
    });

    segmentations.push(cleanSegmentation(segmentation));

    radarObservations.push(
      ...cellsToRadarObservations(
        sourceId,
        frame.observedUtc,
        segmentation.cells
      )
    );
  }

  const globalObservations = deduplicateRadarCells(
    radarObservations,
    payload.crossRadarTimeToleranceSeconds ??
      TRACKING_DEFAULTS.crossRadarTimeToleranceSeconds
  );

  nextTrackNumber = updateTracks(
    tracks,
    globalObservations,
    nextTrackNumber,
    payload.maximumSpeedKmh ??
      TRACKING_DEFAULTS.maximumSpeedKmh,
    payload.maximumGapMinutes ??
      TRACKING_DEFAULTS.maximumGapMinutes
  );

  const referenceTime = payload.referenceTime
    ? new Date(payload.referenceTime)
    : new Date(
        Math.max(
          ...frames.map(frame => Date.parse(frame.observedUtc))
        )
      );

  const trackDicts = tracks.map(trackToDict);

  const likelihoods = trackDicts.map(track =>
    buildTrackLikelihood(track, {
      dopplerValues:
        bestDopplerForTrack(track, frameContexts),
      referenceTime
    })
  );

  const active = activeTracks(
    tracks,
    referenceTime.toISOString(),
    payload.maximumGapMinutes ??
      TRACKING_DEFAULTS.activeMinutes
  ).map(track => track.track_id);

  return {
    format: "StormTrackerBrowserFrameBucketV1",
    observed_utc: referenceTime.toISOString(),
    segmentations,
    global_observations: globalObservations,
    tracks: trackDicts,
    active_track_ids: active,
    likelihoods,
    volume_status: {
      live_mode: "2d-reflectivity",
      measured_live_volume_available: false,
      true_3d_reference_path: "AURA Level 1/1b volumetric radar",
      live_inferred_volume_status: "not-implemented"
    },
    scientific_status:
      "Persistent algorithmic STxxxx identities derived from public 2-D radar reflectivity. These are not measured volumetric storm objects."
  };
}

self.onmessage = async event => {
  const { id, type, payload } = event.data ?? {};

  try {
    if (type === "reset") {
      tracks = [];
      nextTrackNumber = 1;

      self.postMessage({
        id,
        ok: true,
        result: { reset: true }
      });

      return;
    }

    if (type === "processFrameBucket") {
      const result =
        await processFrameBucket(payload ?? {});

      self.postMessage({
        id,
        ok: true,
        result
      });

      return;
    }

    if (type === "state") {
      self.postMessage({
        id,
        ok: true,
        result: {
          tracks: tracks.map(trackToDict),
          nextTrackNumber
        }
      });

      return;
    }

    throw new Error(`Unknown worker message type: ${type}`);
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error:
        error?.stack ||
        error?.message ||
        String(error)
    });
  }
};
STORMTRACKER_FRONTEND_SRC_WORKERS_RADAR_WORKER_JS

cat > frontend/src/worker-client.js <<'STORMTRACKER_FRONTEND_SRC_WORKER_CLIENT_JS'
export class RadarWorkerClient {
  constructor() {
    this.worker = new Worker(new URL("./workers/radar-worker.js?v=live-bom-v1", import.meta.url), { type: "module" });
    this.nextId = 1;
    this.pending = new Map();
    this.worker.onmessage = event => {
      const message = event.data ?? {};
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      message.ok ? pending.resolve(message.result) : pending.reject(new Error(message.error));
    };
    this.worker.onerror = event => console.error("StormTracker worker error", event);
  }
  call(type,payload={}) {
    const id = this.nextId++;
    return new Promise((resolve,reject) => {
      this.pending.set(id,{resolve,reject});
      this.worker.postMessage({id,type,payload});
    });
  }
  reset() { return this.call("reset"); }
  processFrameBucket(payload) { return this.call("processFrameBucket",payload); }
  state() { return this.call("state"); }
}
STORMTRACKER_FRONTEND_SRC_WORKER_CLIENT_JS

cat > frontend/src/app.js <<'STORMTRACKER_FRONTEND_SRC_APP_JS'
import { RadarWorkerClient } from "./worker-client.js?v=live-bom-v1";
import { createCesiumView } from "./cesium-view.js?v=camera-lock-v3";
import { SOURCE_PALETTES } from "./palette.js?v=live-bom-v1";
import { reflectivityFromFile, reflectivityFromUrl } from "./radar-source.js?v=live-bom-v1";
import { loadLatestBomReflectivityMosaic } from "./bom-wmts.js?v=live-bom-v1";
import { putState, getState, clearAll } from "./storage.js";

const worker = new RadarWorkerClient();
const view = createCesiumView("cesiumContainer");
const $ = id => document.getElementById(id);
let latestResult = null;
let sourceMode = "none";

function setStatus(text, kind="") {
  const el = $("status");
  el.textContent = text;
  el.dataset.kind = kind;
}

function fmt(value, digits=1) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";
}

function renderPanels(result) {
  latestResult = result;
  view.render(result);
  const active = new Set(result.active_track_ids ?? []);
  const likelihoodById = new Map((result.likelihoods ?? []).map(x => [x.track_id,x]));
  const tracks = (result.tracks ?? []).slice().sort((a,b) => (active.has(b.track_id)?1:0)-(active.has(a.track_id)?1:0) || b.observation_count-a.observation_count);

  $("trackRows").innerHTML = tracks.length ? tracks.map(track => {
    const o = track.latest;
    const l = likelihoodById.get(track.track_id);
    return `<tr class="${active.has(track.track_id)?"active":""}">
      <td><strong>${track.track_id}</strong></td>
      <td>${track.observation_count}</td>
      <td>≥${fmt(o.maximum_dbzh_lower_bound,0)} dBZ</td>
      <td>${track.motion ? `${fmt(track.motion.speed_kmh)} km/h @ ${fmt(track.motion.heading_degrees,0)}°` : "—"}</td>
      <td>${track.algorithmic_confidence}</td>
      <td>${l ? `${l.display_category} (${fmt(l.score,0)})` : "—"}</td>
    </tr>`;
  }).join("") : `<tr><td colspan="6" class="muted">No tracks yet.</td></tr>`;

  const segmentations = result.segmentations ?? [];
  $("segmentationSummary").innerHTML = segmentations.map(s =>
    `<div><strong>Radar ${s.radar_id}</strong>: ${s.retained_cell_count} retained cell${s.retained_cell_count===1?"":"s"} from ${s.raw_component_count} raw components</div>`
  ).join("") || "No frame processed.";

  const liveCount = (result.active_track_ids ?? []).length;
  setStatus(`${liveCount} active ST track${liveCount===1?"":"s"}; ${tracks.length} total in worker state.`, "ok");
  putState("lastResult", result).catch(console.warn);
}

function syntheticFrame(step, observedUtc) {
  const width = 128, height = 128;
  const categories = new Uint8Array(width*height);
  const doppler = new Int16Array(width*height); doppler.fill(-32768);
  const cx = 48 + step*2;
  const cy = 72 - step;
  for (let row=0; row<height; row++) for (let col=0; col<width; col++) {
    const dx=col-cx, dy=row-cy, r=Math.hypot(dx,dy), i=row*width+col;
    if (r <= 6) categories[i]=10;
    if (r <= 4) categories[i]=12;
    if (r <= 2) categories[i]=14;
    if (r <= 6) doppler[i] = dx < 0 ? -60 : 60;
  }
  // Add small noise fragments that should be rejected by the 8-pixel minimum.
  categories[10*width+10]=12; categories[10*width+11]=12; categories[11*width+10]=12;
  return { radarId:"66", observedUtc, width, height, categories, doppler };
}

async function runSyntheticDemo() {
  sourceMode = "synthetic";
  setStatus("Running reconstructed browser regression demo…");
  await worker.reset();
  const end = Date.now();
  let result;
  for (let step=0; step<4; step++) {
    const observedUtc = new Date(end - (3-step)*5*60000).toISOString();
    result = await worker.processFrameBucket({ frames:[syntheticFrame(step,observedUtc)], referenceTime: observedUtc });
  }
  renderPanels(result);
}

async function loadCategoryJson(file) {
  sourceMode = "manual";
  const data = JSON.parse(await file.text());
  if (!data.radarId || !data.observedUtc || !data.width || !data.height || !data.categories) {
    throw new Error("Category JSON requires radarId, observedUtc, width, height and categories.");
  }
  const frame = {
    radarId: String(data.radarId), observedUtc: data.observedUtc,
    width: Number(data.width), height: Number(data.height),
    categories: Uint8Array.from(data.categories),
    doppler: data.doppler ? Int16Array.from(data.doppler) : null
  };
  const result = await worker.processFrameBucket({ frames:[frame], referenceTime: frame.observedUtc });
  renderPanels(result);
}

async function loadImageFile(file) {
  sourceMode = "manual";
  if (!SOURCE_PALETTES.reflectivityRgb.length) throw new Error("The exact Bureau reflectivity RGB table still needs calibration from a verified source frame. Use category JSON or the synthetic demo until that table is restored.");
  const decoded = await reflectivityFromFile(file,SOURCE_PALETTES.reflectivityRgb,0);
  const frame = {
    radarId: $("radarSelect").value,
    observedUtc: new Date().toISOString(),
    width: decoded.width, height: decoded.height, categories: decoded.categories
  };
  renderPanels(await worker.processFrameBucket({frames:[frame],referenceTime:frame.observedUtc}));
}

async function loadImageUrl() {
  sourceMode = "manual";
  const url = $("imageUrl").value.trim();
  if (!url) throw new Error("Enter an HTTPS image URL.");
  if (!SOURCE_PALETTES.reflectivityRgb.length) throw new Error("Palette calibration is required before decoding live image pixels.");
  const decoded = await reflectivityFromUrl(url,SOURCE_PALETTES.reflectivityRgb,0);
  const frame = { radarId: $("radarSelect").value, observedUtc:new Date().toISOString(), width:decoded.width,height:decoded.height,categories:decoded.categories };
  renderPanels(await worker.processFrameBucket({frames:[frame],referenceTime:frame.observedUtc}));
}

async function loadLiveBomReflectivity() {
  setStatus("Loading latest public BOM reflectivity mosaic…");

  if (sourceMode !== "bom-live") {
    await worker.reset();
    sourceMode = "bom-live";
  }

  const frame = await loadLatestBomReflectivityMosaic();

  const result = await worker.processFrameBucket({
    frames: [frame],
    referenceTime: frame.observedUtc
  });

  renderPanels(result);

  const meta = frame.sourceMetadata ?? {};
  setStatus(
    `Live BOM reflectivity ${frame.observedUtc}; ` +
    `${meta.strongPixelCount ?? 0} pixels at ≥40 dBZ; ` +
    `${result.active_track_ids?.length ?? 0} active storm tracks. ` +
    `Source is the public 2-D BOM mosaic; true volumetric mode remains separate.`,
    "ok"
  );
}

$("demoButton").addEventListener("click", () => runSyntheticDemo().catch(e => setStatus(e.message,"error")));
$("liveBomButton").addEventListener("click", () => loadLiveBomReflectivity().catch(e => setStatus(e.message,"error")));
$("resetButton").addEventListener("click", async () => {
  await worker.reset(); await clearAll().catch(()=>{}); latestResult=null; sourceMode="none";
  view.render({tracks:[],active_track_ids:[]});
  $("trackRows").innerHTML=`<tr><td colspan="6" class="muted">No tracks yet.</td></tr>`;
  $("segmentationSummary").textContent="No frame processed.";
  setStatus("Worker state reset.","ok");
});
$("categoryFile").addEventListener("change", event => {
  const file=event.target.files?.[0]; if(file) loadCategoryJson(file).catch(e=>setStatus(e.message,"error"));
});
$("imageFile").addEventListener("change", event => {
  const file=event.target.files?.[0]; if(file) loadImageFile(file).catch(e=>setStatus(e.message,"error"));
});
$("loadUrlButton").addEventListener("click", () => loadImageUrl().catch(e=>setStatus(e.message,"error")));

getState("lastResult").then(result => {
  if (result?.tracks) {
    // Saved display is restored for convenience; worker tracking state deliberately starts clean.
    renderPanels(result);
    setStatus("Restored previous display. Run a demo or load a frame to rebuild live worker state.","ok");
  } else runSyntheticDemo().catch(e=>setStatus(e.message,"error"));
}).catch(() => runSyntheticDemo().catch(e=>setStatus(e.message,"error")));
STORMTRACKER_FRONTEND_SRC_APP_JS

cat > frontend/index.html <<'STORMTRACKER_FRONTEND_INDEX_HTML'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>StormTracker — Browser Reconstruction</title>
  <link rel="stylesheet" href="https://unpkg.com/cesium@1.145.0/Build/Cesium/Widgets/widgets.css">
  <link rel="stylesheet" href="./app.css?v=camera-lock-v3">
  <script>window.CESIUM_BASE_URL="https://unpkg.com/cesium@1.145.0/Build/Cesium/";</script>
  <script src="https://unpkg.com/cesium@1.145.0/Build/Cesium/Cesium.js"></script>
</head>
<body>
<div id="app">
  <aside class="sidebar">
    <h1>StormTracker</h1>
    <div class="subtitle">Browser-native reconstruction • 08 / 50 / 66</div>

    <section class="card notice">
      <strong>Scientific status:</strong> live/public tracks are 2-D radar-footprint-derived algorithmic identities. They are not measured volumetric storm objects. Lightning likelihood is inferred, not a direct strike feed.
    </section>

    <section class="card">
      <h2>Reconstruction test</h2>
      <div class="controls">
        <button id="demoButton">Run synthetic regression</button>
        <button id="resetButton">Reset</button>
      </div>
      <div id="status" style="margin-top:9px">Initialising…</div>
    </section>

    <section class="card">
      <h2>Live public BOM reflectivity</h2>
      <button id="liveBomButton">Load latest SEQ reflectivity</button>
      <div class="small muted" style="margin-top:8px">
        Uses the Bureau public observed reflectivity mosaic around Gympie, Marburg and Mt Stapylton.
        This is live 2-D dBZ data. It is not a measured volumetric radar scan.
      </div>
    </section>

    <section class="card">
      <h2>Frame input</h2>
      <label>Radar</label>
      <select id="radarSelect">
        <option value="66">66 — Mt Stapylton</option>
        <option value="50">50 — Marburg</option>
        <option value="08">08 — Mt Kanigan</option>
      </select>
      <label>Category JSON (works now)</label>
      <input id="categoryFile" type="file" accept="application/json,.json">
      <label>Raw reflectivity image</label>
      <input id="imageFile" type="file" accept="image/png,image/gif,image/webp">
      <label>HTTPS reflectivity image URL (requires CORS)</label>
      <input id="imageUrl" type="url" placeholder="https://…">
      <button id="loadUrlButton" style="margin-top:7px">Load URL</button>
      <div class="small muted" style="margin-top:8px">The current BOM reflectivity colour table is restored. Doppler colours remain deliberately unset until verified from a current public source.</div>
    </section>

    <section class="card">
      <h2>Segmentation</h2>
      <div id="segmentationSummary" class="small muted">No frame processed.</div>
    </section>

    <section class="card">
      <h2>Tracked storms</h2>
      <div style="overflow:auto;max-height:310px">
        <table>
          <thead><tr><th>ID</th><th>Obs</th><th>Core</th><th>Motion</th><th>Track</th><th>Lightning</th></tr></thead>
          <tbody id="trackRows"><tr><td colspan="6" class="muted">No tracks yet.</td></tr></tbody>
        </table>
      </div>
      <div class="small muted" style="margin-top:7px">Dashed line = 10-minute straight-line extrapolation of observed centroid motion, not a forecast.</div>
    </section>
  </aside>
  <main class="map"><div id="cesiumContainer"></div></main>
</div>
<script type="module" src="./src/app.js?v=live-bom-v1"></script>
</body>
</html>
STORMTRACKER_FRONTEND_INDEX_HTML

cat > frontend/tests/run-node-tests.mjs <<'STORMTRACKER_FRONTEND_TESTS_RUN_NODE_TESTS_MJS'
import assert from "node:assert/strict";
import { connectedComponents, segmentCategoryFrame, segmentWebMercatorCategoryFrame } from "../src/segmentation.js";
import { RADARS } from "../src/config.js";
import { deduplicateRadarCells, updateTracks } from "../src/tracking.js";
import { category, dopplerComponent, freshness, growthComponents, reflectivityComponent } from "../src/lightning.js";
import { SOURCE_PALETTES, classifyRgb } from "../src/palette.js";

let passed = 0;
function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); passed++; }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}

test("8-connectivity joins diagonal pixels", () => {
  const {components}=connectedComponents(Uint8Array.from([1,0,0,1]),2,2,8);
  assert.equal(components.length,1);
});

test("4-connectivity separates diagonal pixels", () => {
  const {components}=connectedComponents(Uint8Array.from([1,0,0,1]),2,2,4);
  assert.equal(components.length,2);
});

test("segmentation keeps strong component and rejects fragment", () => {
  const width=12,height=12,c=new Uint8Array(width*height);
  for(let r=4;r<7;r++) for(let col=4;col<7;col++) c[r*width+col]=12;
  c[1*width+1]=14;c[1*width+2]=14;c[2*width+1]=14;
  const result=segmentCategoryFrame({categories:c,width,height,radar:RADARS["66"],thresholdCategory:7,minPixels:8,connectivity:8});
  assert.equal(result.retained_cell_count,1);
  assert.equal(result.cells[0].pixel_count,9);
  assert.equal(result.cells[0].maximum_category,12);
});

const BASE=Date.parse("2026-08-27T06:00:00Z");
function radarCell(radar,minute,lon,lat,cellId=1,area=100,cat=12){return{
  radar_id:radar,observed_utc:new Date(BASE+minute*60000).toISOString(),local_cell_id:cellId,
  centroid_longitude:lon,centroid_latitude:lat,sampled_area_km2:area,maximum_category:cat,
  maximum_dbzh_lower_bound:55,maximum_dbzh_upper_bound:58,min_longitude:lon-.03,max_longitude:lon+.03,min_latitude:lat-.03,max_latitude:lat+.03
};}
function globalObs(minute,lon,lat){return{
  observed_utc:new Date(BASE+minute*60000).toISOString(),centroid_longitude:lon,centroid_latitude:lat,sampled_area_km2:100,
  maximum_category:12,maximum_dbzh_lower_bound:55,maximum_dbzh_upper_bound:58,min_longitude:lon-.03,max_longitude:lon+.03,min_latitude:lat-.03,max_latitude:lat+.03,
  source_radars:["66"],source_cells:[["66",1]],multi_radar_confirmed:false,merge_method:"single-radar"
};}

test("nearby cells from different radars merge",()=>{
  const merged=deduplicateRadarCells([radarCell("50",0,153.10,-27.60),radarCell("66",1,153.12,-27.61)]);
  assert.equal(merged.length,1); assert.equal(merged[0].multi_radar_confirmed,true); assert.deepEqual(merged[0].source_radars,["50","66"]);
});

test("same-radar cells do not merge",()=>{
  const merged=deduplicateRadarCells([radarCell("66",0,153.10,-27.60,1),radarCell("66",0,153.11,-27.61,2)]);
  assert.equal(merged.length,2);
});

test("plausible motion preserves ST0001",()=>{
  const tracks=[]; let next=updateTracks(tracks,[globalObs(0,153.10,-27.60)],1); next=updateTracks(tracks,[globalObs(5,153.13,-27.59)],next);
  assert.equal(tracks.length,1);assert.equal(tracks[0].track_id,"ST0001");assert.equal(tracks[0].observations.length,2);
});

test("impossible jump creates ST0002",()=>{
  const tracks=[]; let next=updateTracks(tracks,[globalObs(0,153.10,-27.60)],1); updateTracks(tracks,[globalObs(5,154.50,-27.60)],next);
  assert.equal(tracks.length,2);assert.equal(tracks[0].track_id,"ST0001");assert.equal(tracks[1].track_id,"ST0002");
});

test("stronger reflectivity scores higher",()=>assert.ok(reflectivityComponent(14).score>reflectivityComponent(7).score));

test("growth and intensification score",()=>{
  const [area,intensity]=growthComponents([
    {observed_utc:"2026-08-31T10:00:00Z",sampled_area_km2:40,maximum_category:10},
    {observed_utc:"2026-08-31T10:05:00Z",sampled_area_km2:80,maximum_category:12}
  ]);
  assert.ok(area.score>0);assert.ok(intensity.score>0);
});

test("Doppler toward/away span contributes",()=>assert.ok(dopplerComponent([-80,-60,-20,20,60,80,-32768]).score>=10));

test("stale data is not operationally live",()=>{
  const result=freshness("2026-08-31T10:00:00Z",new Date("2026-08-31T10:45:00Z"));
  assert.equal(result.state,"stale");assert.equal(result.operational_live,false);
});

test("lightning likelihood categories match recovered thresholds",()=>{
  assert.equal(category(10),"LOW");assert.equal(category(30),"MODERATE");assert.equal(category(50),"HIGH");assert.equal(category(70),"VERY HIGH");
});


test("current BOM reflectivity palette has all 15 recovered classes",()=>{
  assert.equal(SOURCE_PALETTES.reflectivityRgb.length,15);
  assert.equal(classifyRgb([0,102,102],SOURCE_PALETTES.reflectivityRgb,0),7);
  assert.equal(classifyRgb([40,0,0],SOURCE_PALETTES.reflectivityRgb,0),15);
});

test("Web Mercator segmentation georeferences a strong cell",()=>{
  const width=12,height=12,c=new Uint8Array(width*height);
  for(let r=4;r<7;r++) for(let col=4;col<7;col++) c[r*width+col]=12;
  const result=segmentWebMercatorCategoryFrame({
    categories:c,width,height,sourceId:"BOM-MOSAIC",
    georef:{projection:"EPSG:3857",minX:16900000,maxX:17100000,minY:-3300000,maxY:-3100000},
    thresholdCategory:7,minPixels:8,connectivity:8
  });
  assert.equal(result.retained_cell_count,1);
  assert.equal(result.cells[0].maximum_category,12);
  assert.ok(Number.isFinite(result.cells[0].centroid_longitude));
  assert.ok(Number.isFinite(result.cells[0].centroid_latitude));
  assert.ok(result.cells[0].sampled_area_km2>0);
});

console.log(`\n${passed} tests passed.`);
STORMTRACKER_FRONTEND_TESTS_RUN_NODE_TESTS_MJS

echo
echo "Running StormTracker regression tests..."
node frontend/tests/run-node-tests.mjs

echo
echo "Checking JavaScript syntax..."
find frontend -type f -name '*.js' -print0 | xargs -0 -n1 node --check

echo
echo "Changed files:"
git status --short frontend

echo
echo "SUCCESS"
echo "Expected result above: 14 tests passed."
echo
echo "Commit and push with:"
echo 'git add frontend'
echo 'git commit -m "Add live BOM reflectivity ingestion and georeferenced segmentation"'
echo 'git push'
echo
echo "After GitHub Pages redeploys:"
echo "  1. Open StormTracker."
echo "  2. Confirm MAP LOCK v3 is still visible."
echo "  3. Press 'Load latest SEQ reflectivity'."
echo "  4. Send back the status message shown in StormTracker."
