import { QLD_DOPPLER_PRODUCTS } from "../frontend/src/qld-radar-sites-v1.js";
export function radarTimestampToIso(timestamp) {
  const value = String(timestamp ?? "");

  if (!/^\d{12}$/.test(value)) {
    return null;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const hour = Number(value.slice(8, 10));
  const minute = Number(value.slice(10, 12));

  const date = new Date(
    Date.UTC(year, month - 1, day, hour, minute, 0, 0)
  );

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
    || date.getUTCHours() !== hour
    || date.getUTCMinutes() !== minute
  ) {
    return null;
  }

  return date.toISOString();
}

export function parseBomRadarLoopFrames(html, product) {
  const safeProduct = String(product ?? "").toUpperCase();

  if (!Object.values(QLD_DOPPLER_PRODUCTS).includes(safeProduct)) {
    throw new Error(`Unsupported Doppler product: ${product}`);
  }

  const escaped = safeProduct.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  const expression = new RegExp(
    `(${escaped}\\.T\\.(\\d{12})\\.png)`,
    "gi"
  );

  const frames = new Map();

  for (const match of String(html ?? "").matchAll(expression)) {
    const filename = match[1];
    const timestamp = match[2];
    const observedUtc = radarTimestampToIso(timestamp);

    if (!observedUtc) {
      continue;
    }

    frames.set(filename, {
      filename,
      timestamp,
      observedUtc
    });
  }

  return [...frames.values()].sort(
    (a, b) =>
      Date.parse(a.observedUtc) - Date.parse(b.observedUtc)
  );
}
