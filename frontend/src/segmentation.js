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


// Link nearby measured ≥40 dBZ components across short gaps. Never add gap
// pixels to the measured footprint or attribute synthetic reflectivity to them.
// Do not join two independently sized strong cores.
export function groupNearbyComponents(raw,categories,width,height,rowAreaM2,{
  maxGapPixels=0,maxGapKm=0,strongCoreCategory=11,independentCoreMinPixels=24
}={}){
  if(!(maxGapPixels>0) || !(maxGapKm>0) || raw.components.length<2)return raw.components;
  const parents=raw.components.map((_,i)=>i);
  const strong=raw.components.map(pixels=>
    pixels.length>=independentCoreMinPixels &&
    pixels.some(index=>categories[index]>=strongCoreCategory) ? 1 : 0);
  const find=i=>{
    while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}
    return i;
  };
  const link=(a,b)=>{
    a=find(a);b=find(b);
    if(a===b || (strong[a] && strong[b]))return;
    if(strong[b] && !strong[a])[a,b]=[b,a];
    parents[b]=a;
    strong[a]+=strong[b];
  };
  const reach=Math.max(2,Math.min(3,Math.floor(maxGapPixels)+1));
  const offsets=[];
  for(let dr=0;dr<=reach;dr++)for(let dc=-reach;dc<=reach;dc++){
    if(dr===0 && dc<=1)continue;
    if(Math.max(dr,Math.abs(dc))<=1 || Math.hypot(dr,dc)>reach)continue;
    offsets.push([dr,dc]);
  }
  for(let index=0;index<raw.labels.length;index++){
    const label=raw.labels[index];
    if(!label)continue;
    const row=Math.floor(index/width),col=index-row*width;
    const kmPerPixel=Math.sqrt(rowAreaM2(row))/1000;
    for(const [dr,dc] of offsets){
      if((Math.hypot(dr,dc)-1)*kmPerPixel>maxGapKm)continue;
      const rr=row+dr,cc=col+dc;
      if(rr>=height || cc<0 || cc>=width)continue;
      const other=raw.labels[rr*width+cc];
      if(other && other!==label)link(label-1,other-1);
    }
  }
  const grouped=new Map();
  raw.components.forEach((pixels,i)=>{
    const root=find(i);
    if(!grouped.has(root))grouped.set(root,[]);
    grouped.get(root).push(...pixels);
  });
  return [...grouped.values()];
}

function buildSegmentation({
  categories,
  width,
  height,
  sourceId,
  thresholdCategory,
  minPixels,
  minAreaKm2,
  connectivity,
  maxGapPixels,
  maxGapKm,
  strongCoreCategory,
  independentCoreMinPixels,
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
  const groups = groupNearbyComponents(raw, categories, width, height, rowAreaM2, {
    maxGapPixels, maxGapKm, strongCoreCategory, independentCoreMinPixels
  });
  const labels = new Uint16Array(categories.length);
  const cells = [];
  let nextCellId = 1;

  for (const pixels of groups) {
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

    if (totalArea / 1_000_000 < minAreaKm2) {
      for (const index of pixels) labels[index] = 0;
      continue;
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
      min_area_km2: minAreaKm2,
      max_gap_pixels: maxGapPixels,
      max_gap_km: maxGapKm,
      strong_core_category: strongCoreCategory,
      connectivity
    },
    raw_component_count: raw.components.length,
    grouped_component_count: groups.length,
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
  minAreaKm2 = 0,
  connectivity = 8,
  maxGapPixels = 0,
  maxGapKm = 0,
  strongCoreCategory = 11,
  independentCoreMinPixels = 24
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
    minAreaKm2,
    connectivity,
    maxGapPixels,
    maxGapKm,
    strongCoreCategory,
    independentCoreMinPixels,
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
  minAreaKm2 = 0,
  connectivity = 8,
  maxGapPixels = 0,
  maxGapKm = 0,
  strongCoreCategory = 11,
  independentCoreMinPixels = 24
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
    minAreaKm2,
    connectivity,
    maxGapPixels,
    maxGapKm,
    strongCoreCategory,
    independentCoreMinPixels,
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
