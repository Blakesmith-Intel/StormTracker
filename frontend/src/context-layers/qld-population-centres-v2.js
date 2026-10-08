// Fixed-geographic-label replacement for the raster Queensland Globe map export.
// Town text belongs to a stable world position, not a terrain-reprojected image tile.
export const QUEENSLAND_POPULATION_CENTRES_QUERY_URL =
  "https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Location/Places/MapServer/20/query";

export const POPULATION_CENTRE_PAGE_SIZE = 1000;
export const POPULATION_CENTRE_MAX_PAGES = 8;

export function populationCentreQueryUrl({
  offset = 0,
  pageSize = POPULATION_CENTRE_PAGE_SIZE,
  baseUrl = QUEENSLAND_POPULATION_CENTRES_QUERY_URL
} = {}) {
  const query = new URLSearchParams({
    where: "name IS NOT NULL",
    outFields: "objectid,name,population,upper_scale",
    returnGeometry: "true",
    outSR: "4326",
    orderByFields: "objectid ASC",
    resultOffset: String(offset),
    resultRecordCount: String(pageSize),
    f: "geojson"
  });
  return `${baseUrl}?${query.toString()}`;
}

export function normaliseQueenslandPopulationCentres(payload) {
  if (payload?.error) {
    throw new Error(payload.error.message || "Population-centre query error");
  }
  if (!Array.isArray(payload?.features)) {
    throw new Error("Population-centre feed did not return GeoJSON features");
  }

  const result = [];
  for (const feature of payload.features) {
    const name = String(feature?.properties?.name ?? "").trim();
    if (feature?.geometry?.type !== "Point") continue;
    const coordinates = feature?.geometry?.coordinates;
    const lon = Number(coordinates?.[0]);
    const lat = Number(coordinates?.[1]);
    const id = String(feature?.properties?.objectid ?? feature?.id ?? "").trim();
    if (!name || !id || !Number.isFinite(lon) || !Number.isFinite(lat)
        || lon < 137 || lon > 154.5 || lat < -30 || lat > -9) continue;

    const pop = Number(feature?.properties?.population);
    const scale = Number(feature?.properties?.upper_scale);
    result.push({
      id,
      name,
      longitude: lon,
      latitude: lat,
      population: Number.isFinite(pop) && pop > 0 ? Math.round(pop) : 0,
      upperScale: Number.isFinite(scale) && scale > 0 ? scale : null
    });
  }
  return result;
}

export async function fetchQueenslandPopulationCentres({
  fetchImpl = globalThis.fetch,
  baseUrl = QUEENSLAND_POPULATION_CENTRES_QUERY_URL,
  pageSize = POPULATION_CENTRE_PAGE_SIZE,
  maxPages = POPULATION_CENTRE_MAX_PAGES,
  timeoutMs = 18000
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Population-centre fetch unavailable");
  }
  const features = new Map();
  let complete = false;
  for (let page = 0; page < maxPages; page += 1) {
    const controller = typeof AbortController === "function"
      ? new AbortController() : null;
    const timeout = controller
      ? setTimeout(() => controller.abort(), timeoutMs) : null;
    let payload;
    try {
      const response = await fetchImpl(populationCentreQueryUrl({
        baseUrl, offset: page * pageSize, pageSize
      }), {
        headers: { Accept: "application/geo+json,application/json" },
        signal: controller?.signal
      });
      if (!response.ok) {
        throw new Error(`Population-centre feed HTTP ${response.status}`);
      }
      payload = await response.json();
    } finally {
      if (timeout !== null) clearTimeout(timeout);
    }

    const pageFeatures = normaliseQueenslandPopulationCentres(payload);
    for (const item of pageFeatures) features.set(item.id, item);
    if (payload.features.length < pageSize || payload.exceededTransferLimit === false) {
      complete = true;
      break;
    }
  }
  if (features.size === 0) {
    throw new Error("Queensland population-centre query returned no named towns");
  }
  if (!complete) {
    throw new Error("Queensland population-centre page limit reached; refusing an incomplete map");
  }
  return [...features.values()].sort((a, b) =>
    b.population - a.population || a.name.localeCompare(b.name)
  );
}

