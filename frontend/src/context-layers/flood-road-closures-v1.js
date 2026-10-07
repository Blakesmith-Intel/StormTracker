import {
  filterFloodRoadClosures,
  firstFloodRoadClosureCoordinate,
  floodRoadClosureSummary,
  floodRoadGeometryParts
} from "./flood-road-closure-filter-v1.js";

export const QLD_TRAFFIC_ATTRIBUTION =
  "QLDTraffic · Queensland Department of Transport and Main Roads";

export const DEFAULT_FLOOD_ROAD_CLOSURE_RELAY_URL =
  "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/flood-road-closures";

function linePositions(CesiumRef, coordinates) {
  const flattened = [];

  for (const coordinate of coordinates ?? []) {
    if (!Array.isArray(coordinate) || coordinate.length < 2) continue;
    flattened.push(Number(coordinate[0]), Number(coordinate[1]));
  }

  return flattened.length >= 4
    ? CesiumRef.Cartesian3.fromDegreesArray(flattened)
    : [];
}

async function fetchJson(fetchImpl, url, timeoutMs = 12000) {
  const controller =
    typeof AbortController === "function"
      ? new AbortController()
      : null;

  const timeout = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/geo+json,application/json" },
      signal: controller?.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function loadFloodRoadClosures({
  fetchImpl = globalThis.fetch,
  relayUrl = DEFAULT_FLOOD_ROAD_CLOSURE_RELAY_URL
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Flood-road closure fetch is unavailable.");
  }

  const payload = await fetchJson(fetchImpl, relayUrl);

  return {
    payload: filterFloodRoadClosures(payload),
    transport: "StormTracker relay"
  };
}

export function createFloodRoadClosureLayer({
  viewer,
  CesiumRef = globalThis.Cesium,
  fetchImpl = globalThis.fetch,
  relayUrl = DEFAULT_FLOOD_ROAD_CLOSURE_RELAY_URL,
  refreshMs = 5 * 60 * 1000,
  visible = true,
  onStatus = () => {},
  onUpdate = () => {}
} = {}) {
  if (!viewer) {
    throw new Error("Flood-road closure layer requires a Cesium viewer.");
  }

  if (!CesiumRef) {
    throw new Error("Flood-road closure layer requires Cesium.");
  }

  const dataSource =
    new CesiumRef.CustomDataSource("flood-road-closures");

  dataSource.show = Boolean(visible);
  viewer.dataSources.add(dataSource);

  const closureColour =
    CesiumRef.Color.fromCssColorString("#28c5f5");
  const closureOutline = CesiumRef.Color.WHITE;

  let currentFeatures = [];
  let loading = null;
  let timer = null;
  let lastLoadedAt = 0;

  function addEntityMarker(summary, coordinate, key) {
    if (!coordinate) return;

    const entity = dataSource.entities.add({
      id: `flood-road-${summary.id ?? key}-marker-${key}`,
      name:
        `${summary.roadName}${
          summary.locality ? ` · ${summary.locality}` : ""
        }`,
      position: CesiumRef.Cartesian3.fromDegrees(
        coordinate[0],
        coordinate[1],
        0
      ),
      point: {
        pixelSize: 11,
        color: closureColour,
        outlineColor: closureOutline,
        outlineWidth: 2,
        heightReference:
          CesiumRef.HeightReference?.CLAMP_TO_GROUND ?? undefined,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });

    entity.stormTrackerFloodClosureId =
      String(summary.id ?? key);
  }

  function addLine(summary, coordinates, key) {
    const positions = linePositions(CesiumRef, coordinates);
    if (!positions.length) return;

    const entity = dataSource.entities.add({
      id: `flood-road-${summary.id ?? key}-line-${key}`,
      name:
        `${summary.roadName}${
          summary.locality ? ` · ${summary.locality}` : ""
        }`,
      polyline: {
        positions,
        width: 5,
        clampToGround: true,
        material: closureColour.withAlpha(0.92)
      }
    });

    entity.stormTrackerFloodClosureId =
      String(summary.id ?? key);
  }

  function render(payload) {
    const filtered = filterFloodRoadClosures(payload);
    currentFeatures = filtered.features;

    dataSource.entities.suspendEvents();
    dataSource.entities.removeAll();

    currentFeatures.forEach((feature, featureIndex) => {
      const summary = floodRoadClosureSummary(feature);
      const parts = floodRoadGeometryParts(feature);
      let lineIndex = 0;

      for (const geometry of parts) {
        if (geometry.type === "LineString") {
          addLine(
            summary,
            geometry.coordinates,
            `${featureIndex}-${lineIndex++}`
          );
        } else if (geometry.type === "MultiLineString") {
          for (const coordinates of geometry.coordinates ?? []) {
            addLine(
              summary,
              coordinates,
              `${featureIndex}-${lineIndex++}`
            );
          }
        }
      }

      addEntityMarker(
        summary,
        firstFloodRoadClosureCoordinate(feature),
        featureIndex
      );
    });

    dataSource.entities.resumeEvents();
    viewer.scene.requestRender();
    onUpdate(currentFeatures.slice());
  }

  async function refresh({ force = false } = {}) {
    if (!dataSource.show && !force) return currentFeatures;
    if (loading) return loading;

    loading = (async () => {
      onStatus({
        kind: "loading",
        message: "Checking QLDTraffic flood closures…"
      });

      const result = await loadFloodRoadClosures({
        fetchImpl,
        relayUrl
      });

      render(result.payload);
      lastLoadedAt = Date.now();

      onStatus({
        kind: "ok",
        message:
          `${currentFeatures.length} active flood closure${
            currentFeatures.length === 1 ? "" : "s"
          }`,
        count: currentFeatures.length,
        transport: result.transport,
        loadedAt: lastLoadedAt
      });

      return currentFeatures;
    })();

    try {
      return await loading;
    } catch (error) {
      onStatus({
        kind: "error",
        message: error?.message ?? String(error)
      });
      throw error;
    } finally {
      loading = null;
    }
  }

  function setVisible(nextVisible) {
    dataSource.show = Boolean(nextVisible);
    viewer.scene.requestRender();

    if (dataSource.show) {
      const stale =
        !lastLoadedAt || (Date.now() - lastLoadedAt) >= refreshMs;

      if (stale) refresh().catch(() => {});
    }
  }

  function start() {
    if (timer) return;

    if (dataSource.show) refresh().catch(() => {});

    timer = setInterval(() => {
      if (
        typeof document !== "undefined"
        && document.hidden
      ) return;

      refresh().catch(() => {});
    }, refreshMs);
  }

  function stop() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  }

  function featureById(id) {
    const wanted = String(id ?? "");

    return currentFeatures.find(feature =>
      String(feature?.properties?.id ?? "") === wanted
    ) ?? null;
  }

  return {
    dataSource,
    refresh,
    setVisible,
    start,
    stop,
    featureById,
    get features() {
      return currentFeatures.slice();
    },
    get lastLoadedAt() {
      return lastLoadedAt;
    }
  };
}
