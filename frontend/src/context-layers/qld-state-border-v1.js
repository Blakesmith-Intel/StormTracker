// Authoritative Queensland cadastral interstate border. Geometry comes from
// the State of Queensland's State border FEATURE LAYER (MapServer/50).
// Never substitute the satellite imagery rectangle or hand-drawn latitudes.
export const QLD_STATE_BORDER_SERVICE =
  "https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Boundaries/AdministrativeBoundaries/MapServer/50";
export const QLD_STATE_BORDER_QUERY = QLD_STATE_BORDER_SERVICE + "/query";
export const QLD_STATE_BORDER_PAGE_SIZE = 1000;

export function stateBorderQueryUrl({
  baseUrl = QLD_STATE_BORDER_QUERY,
  offset = 0,
  pageSize = QLD_STATE_BORDER_PAGE_SIZE
} = {}) {
  const params = new URLSearchParams({
    where: "feature_type = 'State Border'",
    outFields: "objectid,feature_type",
    returnGeometry: "true",
    outSR: "4326",
    orderByFields: "objectid ASC",
    resultOffset: String(offset),
    resultRecordCount: String(pageSize),
    f: "geojson"
  });
  return `${baseUrl}?${params.toString()}`;
}

export function validateStateBorderGeoJson(payload) {
  if (payload?.error) throw new Error(payload.error.message || "State border ArcGIS query error");
  if (payload?.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
    throw new Error("State border did not return a GeoJSON FeatureCollection");
  }
  return payload.features.map(feature => {
    if (!["LineString", "MultiLineString"].includes(feature?.geometry?.type)) {
      throw new Error("Official state border contains a non-line geometry");
    }
    const lines = feature.geometry.type === "LineString"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
    if (!Array.isArray(lines) || !lines.length || lines.some(line =>
      !Array.isArray(line) || line.length < 2 || line.some(coord =>
        !Array.isArray(coord) || coord.length < 2 ||
        !Number.isFinite(coord[0]) || !Number.isFinite(coord[1]) ||
        coord[0] < 137 || coord[0] > 154.5 ||
        coord[1] < -30.5 || coord[1] > -9
      ))) {
      throw new Error("Official state border coordinates missing or outside Queensland bounds");
    }
    return feature; // Preserve every authoritative vertex, unchanged.
  });
}

export async function fetchOfficialQueenslandStateBorder({
  fetchImpl = globalThis.fetch,
  baseUrl = QLD_STATE_BORDER_QUERY,
  pageSize = QLD_STATE_BORDER_PAGE_SIZE,
  maxPages = 10,
  timeoutMs = 24000
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("State border fetch unavailable");
  const features = [];
  let finished = false;
  for (let page = 0; page < maxPages; page += 1) {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    let payload;
    try {
      const response = await fetchImpl(stateBorderQueryUrl({
        baseUrl, offset: page * pageSize, pageSize
      }), {
        headers: { Accept: "application/geo+json,application/json" },
        signal: controller?.signal
      });
      if (!response.ok) throw new Error(`State border service HTTP ${response.status}`);
      payload = await response.json();
    } finally {
      if (timeout != null) clearTimeout(timeout);
    }
    features.push(...validateStateBorderGeoJson(payload));
    if (payload.features.length < pageSize || payload.exceededTransferLimit === false) {
      finished = true;
      break;
    }
  }
  if (!finished || !features.length) throw new Error(
    "Incomplete or empty official Queensland state border feed"
  );
  return { type: "FeatureCollection", features };
}

export function createQueenslandStateBorderLayer({
  viewer,
  CesiumRef = globalThis.Cesium,
  fetchImpl = globalThis.fetch,
  mode = "street",
  onStatus = () => {}
} = {}) {
  if (!viewer?.dataSources || !CesiumRef?.GeoJsonDataSource?.load) {
    throw new TypeError("Queensland border requires Cesium GeoJSON and viewer data sources");
  }
  let currentMode = mode;
  let dataSource = null;
  let pending = null;
  let destroyed = false;
  let count = 0;

  async function start() {
    if (pending) return pending;
    pending = (async () => {
      try {
        const geojson = await fetchOfficialQueenslandStateBorder({ fetchImpl });
        if (destroyed) return 0;
        const source = await CesiumRef.GeoJsonDataSource.load(geojson, {
          clampToGround: true,
          stroke: CesiumRef.Color.WHITE,
          strokeWidth: 3
        });
        if (destroyed) return 0;
        // A dark outline keeps the surveyed line legible across dark/bright
        // satellite imagery. This NEVER affects the geospatial coordinates.
        for (const entity of source.entities?.values ?? []) {
          if (!entity.polyline) continue;
          entity.polyline.clampToGround = true;
          entity.polyline.width = 3;
          entity.polyline.material = new CesiumRef.PolylineOutlineMaterialProperty({
            color: CesiumRef.Color.WHITE,
            outlineColor: CesiumRef.Color.BLACK,
            outlineWidth: 2
          });
        }
        source.show = currentMode === "qld-imagery";
        await viewer.dataSources.add(source);
        if (destroyed) {
          viewer.dataSources.remove(source, true);
          return 0;
        }
        dataSource = source;
        count = geojson.features.length;
        viewer.scene?.requestRender?.();
        onStatus({ kind: "ok", message: "Official Queensland interstate boundary displayed" });
        return count;
      } catch (error) {
        if (!destroyed) onStatus({
          kind: "warning",
          message: `State border unavailable: ${error?.message || error}`
        });
        // Allow explicit retries when the government service is temporarily down.
        pending = null;
        throw error;
      }
    })();
    return pending;
  }

  function setMode(nextMode) {
    if (destroyed) return;
    currentMode = nextMode === "qld-imagery" ? "qld-imagery" : "street";
    if (dataSource) dataSource.show = currentMode === "qld-imagery";
    viewer.scene?.requestRender?.();
    if (currentMode === "qld-imagery" && !dataSource) {
      void start().catch(error => console.warn("State border load:", error));
    }
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (dataSource) viewer.dataSources.remove(dataSource, true);
    dataSource = null;
  }
  return {
    start, setMode, destroy,
    get count() { return count; },
    get mode() { return currentMode; },
    get visible() { return Boolean(dataSource?.show); }
  };
}
