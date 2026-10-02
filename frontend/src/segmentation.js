import { gnomonicPixelToLonLat, pixelAreaM2 } from "./geo.js";
import { REFLECTIVITY_CLASSES } from "./palette.js";

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

export function segmentCategoryFrame({
  categories,
  width,
  height,
  radar,
  thresholdCategory = 7,
  minPixels = 8,
  connectivity = 8
}) {
  if (!(categories instanceof Uint8Array)) categories = Uint8Array.from(categories);
  if (categories.length !== width * height) throw new Error("categories size does not match width*height");

  const mask = new Uint8Array(categories.length);
  for (let i = 0; i < categories.length; i++) mask[i] = categories[i] >= thresholdCategory ? 1 : 0;
  const raw = connectedComponents(mask, width, height, connectivity);
  const labels = new Uint16Array(categories.length);
  const rowAreas = new Float64Array(height);
  for (let row = 0; row < height; row++) rowAreas[row] = pixelAreaM2({ row, width, height, radar });

  const cells = [];
  let nextCellId = 1;

  for (const pixels of raw.components) {
    if (pixels.length < minPixels) continue;
    let totalArea = 0, lonWeighted = 0, latWeighted = 0;
    let maxCategory = 0, sumCategory = 0;
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    const cellCategories = new Uint8Array(pixels.length);

    for (let k = 0; k < pixels.length; k++) {
      const index = pixels[k];
      const row = Math.floor(index / width);
      const col = index - row * width;
      const category = categories[index];
      const pos = gnomonicPixelToLonLat({ row, col, width, height, radar });
      const area = rowAreas[row];
      totalArea += area;
      lonWeighted += pos.longitude * area;
      latWeighted += pos.latitude * area;
      maxCategory = Math.max(maxCategory, category);
      sumCategory += category;
      minLon = Math.min(minLon, pos.longitude); maxLon = Math.max(maxLon, pos.longitude);
      minLat = Math.min(minLat, pos.latitude); maxLat = Math.max(maxLat, pos.latitude);
      cellCategories[k] = category;
      labels[index] = nextCellId;
    }

    const [dbzLower, dbzUpper] = REFLECTIVITY_CLASSES[maxCategory] ?? [null, null];
    cells.push({
      local_cell_id: nextCellId,
      pixel_count: pixels.length,
      sampled_area_km2: totalArea / 1_000_000,
      centroid_longitude: totalArea > 0 ? lonWeighted / totalArea : (minLon + maxLon) / 2,
      centroid_latitude: totalArea > 0 ? latWeighted / totalArea : (minLat + maxLat) / 2,
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

  cells.sort((a, b) => b.maximum_category - a.maximum_category || b.sampled_area_km2 - a.sampled_area_km2 || a.local_cell_id - b.local_cell_id);

  return {
    format: "StormTrackerBrowserSegmentationV1",
    width,
    height,
    radar_id: radar.id,
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
    limitations: [
      "This is live 2-D segmentation of a radar image, not a volumetric radar object.",
      "Reflectivity is categorical; strongest dBZ is an interval bound, not a continuous measurement.",
      "Sampled area is derived from the radar projection and is an observed raster footprint, not physical cloud area."
    ]
  };
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
