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
