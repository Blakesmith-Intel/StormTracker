// Source-faithful Doppler display: preserve BoM's native RGB raster and
// original scan clock. Geometric inverse mapping is display-only; no velocity
// measurements or temporal frames are estimated, and no colours are redrawn.
import { historicalPanelLayout } from "./bom-doppler-history-spatial-v1.js";
import { nearestPaletteMatch } from "./bom-doppler-display-v2.js";
import { dopplerMapCoordinateToLonLat, lonLatToDopplerMapCoordinate } from "./bom-doppler-georef-v1.js";

export const NATIVE_DOPPLER_PANEL_SIZE = 512;
export const NATIVE_DOPPLER_DISPLAY_SIZE = 1024;

// Accept only Bureau velocity palette pixels. Preserve their exact original
// RGBA (not the nearest palette swatch), and exclude GUI text/background/legend.
// This crop accepts both original 524 × 564 GIFs and bare 512 × 512 panels.
export function extractNativeDopplerPanel(imageData, palette, { includeZero = false } = {}) {
  const layout = historicalPanelLayout(imageData.width, imageData.height);
  const size = layout.panelSize;
  const data = new Uint8ClampedArray(size * size * 4);
  let nativePixelCount = 0;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const from = ((row + layout.panelY) * imageData.width + col + layout.panelX) * 4;
      const alpha = imageData.data[from + 3];
      if (!alpha) continue;
      const rgb = [imageData.data[from], imageData.data[from + 1], imageData.data[from + 2]];
      const swatch = nearestPaletteMatch(rgb, palette);
      if (!swatch || (!includeZero && swatch.velocity_kmh === 0)) continue;
      const to = (row * size + col) * 4;
      data[to] = rgb[0];
      data[to + 1] = rgb[1];
      data[to + 2] = rgb[2];
      data[to + 3] = alpha;
      nativePixelCount++;
    }
  }
  return {width:size, height:size, data, nativePixelCount};
}

export function nativeDopplerBounds(radarId) {
  const size = NATIVE_DOPPLER_PANEL_SIZE;
  const boundary = [0,128,256,384,size].flatMap(t => [
    dopplerMapCoordinateToLonLat(radarId,0,t),
    dopplerMapCoordinateToLonLat(radarId,size,t),
    dopplerMapCoordinateToLonLat(radarId,t,0),
    dopplerMapCoordinateToLonLat(radarId,t,size)
  ]);
  const longitudes = boundary.map(p => p.longitude);
  const latitudes = boundary.map(p => p.latitude);
  return {
    west: Math.min(...longitudes), east: Math.max(...longitudes),
    south: Math.min(...latitudes), north: Math.max(...latitudes)
  };
}

// Project output geographic pixels back into the original Gnomonic source
// panel. Bilinear *coordinate* interpolation over small 32px blocks speeds up
// the browser, but source pixels are sampled nearest-neighbour only: no colour
// averaging, smoothing, or invented intermediate velocity values.
export function reprojectNativeDopplerPanel(radarId, panel, {
  resolution = NATIVE_DOPPLER_DISPLAY_SIZE,
  gridStep = 32
} = {}) {
  if (panel?.width !== 512 || panel?.height !== 512 ||
      panel.data?.length !== 512 * 512 * 4) {
    throw new TypeError("Expected a native 512 × 512 Doppler image panel");
  }
  if (!Number.isInteger(resolution) || resolution < 64 || resolution > 2048 ||
      !Number.isInteger(gridStep) || gridStep < 1 || gridStep > resolution) {
    throw new RangeError("Invalid native Doppler geographic raster settings");
  }
  const bounds = nativeDopplerBounds(radarId);
  const gridWidth = Math.ceil(resolution / gridStep) + 1;
  const gridHeight = gridWidth;
  const grid = new Array(gridWidth * gridHeight);
  for (let gy = 0; gy < gridHeight; gy++) {
    const pixelY = Math.min(resolution, gy * gridStep);
    const latitude = bounds.north - pixelY / resolution * (bounds.north - bounds.south);
    for (let gx = 0; gx < gridWidth; gx++) {
      const pixelX = Math.min(resolution, gx * gridStep);
      const longitude = bounds.west + pixelX / resolution * (bounds.east - bounds.west);
      grid[gy * gridWidth + gx] =
        lonLatToDopplerMapCoordinate(radarId, longitude, latitude);
    }
  }
  const data = new Uint8ClampedArray(resolution * resolution * 4);
  let displayedPixels = 0;
  for (let y = 0; y < resolution; y++) {
    const gy = Math.min(gridHeight - 2, Math.floor(y / gridStep));
    const y0 = gy * gridStep;
    const fy = (y + 0.5 - y0) /
      (Math.min(resolution,(gy + 1) * gridStep) - y0);
    for (let x = 0; x < resolution; x++) {
      const gx = Math.min(gridWidth - 2, Math.floor(x / gridStep));
      const x0 = gx * gridStep;
      const fx = (x + 0.5 - x0) /
        (Math.min(resolution,(gx + 1) * gridStep) - x0);
      const tl = grid[gy * gridWidth + gx];
      const tr = grid[gy * gridWidth + gx + 1];
      const bl = grid[(gy + 1) * gridWidth + gx];
      const br = grid[(gy + 1) * gridWidth + gx + 1];
      const column = (tl.column * (1-fx) + tr.column * fx) * (1-fy) +
        (bl.column * (1-fx) + br.column * fx) * fy;
      const row = (tl.row * (1-fx) + tr.row * fx) * (1-fy) +
        (bl.row * (1-fx) + br.row * fx) * fy;
      const sx = Math.floor(column), sy = Math.floor(row);
      if (sx < 0 || sy < 0 || sx >= 512 || sy >= 512) continue;
      const src = (sy * 512 + sx) * 4;
      if (!panel.data[src + 3]) continue;
      const dst = (y * resolution + x) * 4;
      data[dst] = panel.data[src];
      data[dst + 1] = panel.data[src + 1];
      data[dst + 2] = panel.data[src + 2];
      data[dst + 3] = panel.data[src + 3];
      displayedPixels++;
    }
  }
  return {width:resolution,height:resolution,data,bounds,
    displayedPixels, nativePixelCount:panel.nativePixelCount};
}
