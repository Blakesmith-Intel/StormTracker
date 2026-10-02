export const REFLECTIVITY_CLASSES = Object.freeze({
  1: [12, 23], 2: [23, 28], 3: [28, 31], 4: [31, 34], 5: [34, 37],
  6: [37, 40], 7: [40, 43], 8: [43, 46], 9: [46, 49], 10: [49, 52],
  11: [52, 55], 12: [55, 58], 13: [58, 61], 14: [61, 64], 15: [64, null]
});

// The exact final source-image RGB tables from the lost repository were not fully recoverable.
// Keep them explicit. Populate these arrays from verified Bureau source frames rather than guessing.
export const SOURCE_PALETTES = {
  reflectivityRgb: [], // entries: { rgb:[r,g,b], value: category 1..15 }
  dopplerRgb: []       // entries: { rgb:[r,g,b], value: signed categorical km/h }
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
