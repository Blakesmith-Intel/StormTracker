import {MAX_CONTEXT_SNAPSHOT_AGE_MS,sourceSnapshotState,sourceFailureStatus,checkedAtAest} from "./source-freshness-v1.js?v=9.14.0";
import {
  filterFloodRoadClosures,
  floodRoadClosureSummary,
  floodRoadGeometryParts
} from "./flood-road-closure-filter-v1.js?v=9.10.3";

export const QLD_TRAFFIC_ATTRIBUTION =
  "QLDTraffic · Queensland Department of Transport and Main Roads";

export const DEFAULT_FLOOD_ROAD_CLOSURE_RELAY_URL =
  "https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/flood-road-closures";

function linePositions(CesiumRef, coordinates) {
  const flattened = [];

  for (const coordinate of coordinates ?? []) {
    if (!Array.isArray(coordinate) || coordinate.length < 2) continue;

    const longitude =
      Number(coordinate[0]);

    const latitude =
      Number(coordinate[1]);

    if (
      !Number.isFinite(longitude)
      || !Number.isFinite(latitude)
    ) continue;

    flattened.push(
      longitude,
      latitude
    );
  }

  return flattened.length >= 4
    ? CesiumRef.Cartesian3.fromDegreesArray(flattened)
    : [];
}

function validCoordinate(coordinate) {
  if (
    !Array.isArray(coordinate)
    || coordinate.length < 2
  ) {
    return null;
  }

  const longitude =
    Number(coordinate[0]);

  const latitude =
    Number(coordinate[1]);

  if (
    !Number.isFinite(longitude)
    || !Number.isFinite(latitude)
  ) {
    return null;
  }

  return [
    longitude,
    latitude
  ];
}

function middleCoordinate(coordinates) {
  const valid =
    (coordinates ?? [])
      .map(validCoordinate)
      .filter(Boolean);

  if (!valid.length) {
    return null;
  }

  return valid[
    Math.floor(
      (valid.length - 1) / 2
    )
  ];
}

export function floodRoadClosureMarkerCoordinate(
  feature
) {
  const parts =
    floodRoadGeometryParts(
      feature
    );

  for (const geometry of parts) {
    if (geometry.type === "Point") {
      const coordinate =
        validCoordinate(
          geometry.coordinates
        );

      if (coordinate) {
        return coordinate;
      }
    }
  }

  let longestLine = [];

  for (const geometry of parts) {
    if (
      geometry.type === "LineString"
      && (
        geometry.coordinates?.length
        ?? 0
      ) > longestLine.length
    ) {
      longestLine =
        geometry.coordinates;
    }

    if (
      geometry.type === "MultiLineString"
    ) {
      for (
        const coordinates
        of geometry.coordinates ?? []
      ) {
        if (
          (coordinates?.length ?? 0)
          > longestLine.length
        ) {
          longestLine =
            coordinates;
        }
      }
    }
  }

  return middleCoordinate(
    longestLine
  );
}

function createRoadClosureBadgeImage() {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <g transform="translate(32 32) rotate(45)">
        <rect x="-24" y="-24" width="48" height="48" fill="#ffffff"/>
        <rect x="-21" y="-21" width="42" height="42" fill="#111111"/>
        <rect x="-17" y="-17" width="34" height="34" fill="#ffd43b"/>
      </g>
      <g stroke="#111111" stroke-width="7" stroke-linecap="round">
        <path d="M22 22 L42 42"/>
        <path d="M42 22 L22 42"/>
      </g>
    </svg>`;

  return (
    "data:image/svg+xml;charset=utf-8,"
    + encodeURIComponent(svg)
  );
}

async function fetchJson(
  fetchImpl,
  url,
  timeoutMs = 12000
) {
  const controller =
    typeof AbortController === "function"
      ? new AbortController()
      : null;

  const timeout = controller
    ? setTimeout(
        () =>
          controller.abort(),
        timeoutMs
      )
    : null;

  try {
    const response =
      await fetchImpl(
        url,
        {
          method: "GET",
          headers: {
            Accept:
              "application/geo+json,application/json"
          },
          signal:
            controller?.signal
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    return await response.json();
  } finally {
    if (timeout) {
      clearTimeout(
        timeout
      );
    }
  }
}

export async function loadFloodRoadClosures({
  fetchImpl = globalThis.fetch,
  relayUrl =
    DEFAULT_FLOOD_ROAD_CLOSURE_RELAY_URL
} = {}) {
  if (
    typeof fetchImpl !== "function"
  ) {
    throw new Error(
      "Flood-road closure fetch is unavailable."
    );
  }

  const payload =
    await fetchJson(
      fetchImpl,
      relayUrl
    );

  return {
    payload:
      filterFloodRoadClosures(
        payload
      ),
    transport:
      "StormTracker relay"
  };
}

export function createFloodRoadClosureLayer({
  viewer,
  CesiumRef = globalThis.Cesium,
  fetchImpl = globalThis.fetch,
  relayUrl =
    DEFAULT_FLOOD_ROAD_CLOSURE_RELAY_URL,
  refreshMs =
    5 * 60 * 1000,
  visible = true,
  onStatus = () => {},
  onUpdate = () => {}
} = {}) {
  if (!viewer) {
    throw new Error(
      "Flood-road closure layer requires a Cesium viewer."
    );
  }

  if (!CesiumRef) {
    throw new Error(
      "Flood-road closure layer requires Cesium."
    );
  }

  const dataSource =
    new CesiumRef.CustomDataSource(
      "flood-road-closures"
    );

  dataSource.show =
    Boolean(
      visible
    );

  viewer.dataSources.add(
    dataSource
  );

  const closureColour =
    CesiumRef.Color.fromCssColorString(
      "#ffd43b"
    );

  const lineUnderlay =
    CesiumRef.Color.fromCssColorString(
      "#111111"
    );

  const badgeImage =
    createRoadClosureBadgeImage();

  let currentFeatures = [];
  let loading = null;
  let timer = null;
  let lastLoadedAt = 0;
  let snapshotExpired = false;
  function expireStaleSnapshot() {
    if (snapshotExpired || !sourceSnapshotState({lastLoadedAt,maxAgeMs:MAX_CONTEXT_SNAPSHOT_AGE_MS.floodRoadClosures}).expired) return false;
    snapshotExpired = true;
    currentFeatures = [];
    dataSource.entities.removeAll();
    viewer.scene.requestRender();
    onUpdate([]);
    onStatus({kind:"error",message:"Source expired · old flood-closure markers removed · last checked "+checkedAtAest(lastLoadedAt)});
    return true;
  }


  function decorateClosureEntity(
    entity,
    summary,
    kind
  ) {
    entity.stormTrackerFloodClosureId =
      String(
        summary.id
        ?? ""
      );

    entity.stormTrackerFloodClosureKind =
      kind;

    return entity;
  }

  function addEntityMarker(
    summary,
    coordinate,
    key
  ) {
    if (!coordinate) {
      return;
    }

    const common = {
      id:
        `flood-road-${summary.id ?? key}-marker-${key}`,
      name:
        `${summary.roadName}${
          summary.locality
            ? ` · ${summary.locality}`
            : ""
        }`,
      position:
        CesiumRef.Cartesian3
          .fromDegrees(
            coordinate[0],
            coordinate[1],
            0
          )
    };

    const sharedHeightReference =
      CesiumRef.HeightReference
        ?.CLAMP_TO_GROUND
        ?? undefined;

    const graphics = {
      billboard: {
        image:
          badgeImage,
        width:
          38,
        height:
          38,
        verticalOrigin:
          CesiumRef.VerticalOrigin
            ?.CENTER,
        heightReference:
          sharedHeightReference,
        disableDepthTestDistance:
          Number.POSITIVE_INFINITY
      }
    };

    const entity =
      dataSource.entities.add({
        ...common,
        ...graphics
      });

    decorateClosureEntity(
      entity,
      summary,
      "marker"
    );
  }

  function addLine(
    summary,
    coordinates,
    key
  ) {
    const positions =
      linePositions(
        CesiumRef,
        coordinates
      );

    if (!positions.length) {
      return;
    }

    const name =
      `${summary.roadName}${
        summary.locality
          ? ` · ${summary.locality}`
          : ""
      }`;

    const underlay =
      dataSource.entities.add({
        id:
          `flood-road-${summary.id ?? key}-line-underlay-${key}`,
        name,
        polyline: {
          positions,
          width:
            9,
          clampToGround:
            true,
          material:
            lineUnderlay
              .withAlpha(
                0.92
              )
        }
      });

    decorateClosureEntity(
      underlay,
      summary,
      "line"
    );

    const overlay =
      dataSource.entities.add({
        id:
          `flood-road-${summary.id ?? key}-line-${key}`,
        name,
        polyline: {
          positions,
          width:
            5,
          clampToGround:
            true,
          material:
            closureColour
              .withAlpha(
                0.98
              )
        }
      });

    decorateClosureEntity(
      overlay,
      summary,
      "line"
    );
  }

  function render(payload) {
    const filtered =
      filterFloodRoadClosures(
        payload
      );

    currentFeatures =
      filtered.features;

    dataSource.entities
      .suspendEvents();

    dataSource.entities
      .removeAll();

    currentFeatures.forEach(
      (
        feature,
        featureIndex
      ) => {
        const summary =
          floodRoadClosureSummary(
            feature
          );

        const parts =
          floodRoadGeometryParts(
            feature
          );

        let lineIndex = 0;

        for (
          const geometry
          of parts
        ) {
          if (
            geometry.type
            === "LineString"
          ) {
            addLine(
              summary,
              geometry.coordinates,
              `${featureIndex}-${lineIndex++}`
            );
          } else if (
            geometry.type
            === "MultiLineString"
          ) {
            for (
              const coordinates
              of geometry.coordinates
                ?? []
            ) {
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
          floodRoadClosureMarkerCoordinate(
            feature
          ),
          featureIndex
        );
      }
    );

    dataSource.entities
      .resumeEvents();

    viewer.scene
      .requestRender();

    onUpdate(
      currentFeatures.slice()
    );
  }

  async function refresh({
    force = false
  } = {}) {
    if (
      !dataSource.show
      && !force
    ) {
      return currentFeatures;
    }

    if (loading) {
      return loading;
    }

    loading =
      (async () => {
        onStatus({
          kind:
            "loading",
          message:
            "Checking QLDTraffic flood closures…"
        });

        const result =
          await loadFloodRoadClosures({
            fetchImpl,
            relayUrl
          });

        render(
          result.payload
        );

        lastLoadedAt =
          Date.now();
        snapshotExpired = false;

        onStatus({
          kind:
            "ok",
          message:
            `${currentFeatures.length} active flood closure${
              currentFeatures.length === 1
                ? ""
                : "s"
            } · checked ${checkedAtAest(lastLoadedAt)}`,
          count:
            currentFeatures.length,
          transport:
            result.transport,
          loadedAt:
            lastLoadedAt
        });

        return currentFeatures;
      })();

    try {
      return await loading;
    } catch (error) {
      expireStaleSnapshot();
      onStatus(sourceFailureStatus({error,lastLoadedAt,maxAgeMs:MAX_CONTEXT_SNAPSHOT_AGE_MS.floodRoadClosures}));

      throw error;
    } finally {
      loading =
        null;
    }
  }

  function setVisible(
    nextVisible
  ) {
    expireStaleSnapshot();
    dataSource.show =
      Boolean(
        nextVisible
      );

    viewer.scene
      .requestRender();

    if (
      dataSource.show
    ) {
      const stale =
        !lastLoadedAt
        || (
          Date.now()
          - lastLoadedAt
        ) >= refreshMs;

      if (stale) {
        refresh()
          .catch(
            () => {}
          );
      }
    }
  }

  const onVisibilityChange = () => {
    if (document.hidden) return;
    expireStaleSnapshot();
    if (dataSource.show) refresh().catch(() => {});
  };

  function start() {
    if (timer) {
      return;
    }

    if (
      dataSource.show
    ) {
      refresh()
        .catch(
          () => {}
        );
    }

    if (typeof document !== 'undefined') document.addEventListener('visibilitychange',onVisibilityChange);
    timer =
      setInterval(
        () => {
          if (
            typeof document
              !== "undefined"
            && document.hidden
          ) {
            return;
          }

          expireStaleSnapshot();
          refresh()
            .catch(
              () => {}
            );
        },
        refreshMs
      );
  }

  function stop() {
    if (!timer) {
      return;
    }

    clearInterval(
      timer
    );
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange',onVisibilityChange);

    timer =
      null;
  }

  function featureById(id) {
    const wanted =
      String(
        id ?? ""
      );

    return currentFeatures
      .find(
        feature =>
          String(
            feature?.properties?.id
            ?? ""
          ) === wanted
      )
      ?? null;
  }

  return {
    dataSource,
    refresh,
    setVisible,
    start,
    stop,
    featureById,
    get features() {
      return currentFeatures
        .slice();
    },
    get lastLoadedAt() {
      return lastLoadedAt;
    }
  };
}
