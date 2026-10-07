import {
  filterFloodRoadClosures,
  floodRoadClosureSummary,
  floodRoadGeometryParts
} from "./flood-road-closure-filter-v1.js?v=9.10.2";

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

function createRoadClosureBadgeCanvas() {
  if (
    typeof document === "undefined"
    || typeof document.createElement
      !== "function"
  ) {
    return null;
  }

  const canvas =
    document.createElement("canvas");

  canvas.width = 64;
  canvas.height = 64;

  const context =
    canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.translate(
    32,
    32
  );

  context.rotate(
    Math.PI / 4
  );

  context.fillStyle =
    "#ffffff";

  context.fillRect(
    -24,
    -24,
    48,
    48
  );

  context.fillStyle =
    "#111111";

  context.fillRect(
    -21,
    -21,
    42,
    42
  );

  context.fillStyle =
    "#ffd43b";

  context.fillRect(
    -17,
    -17,
    34,
    34
  );

  context.rotate(
    -Math.PI / 4
  );

  context.strokeStyle =
    "#111111";

  context.lineWidth = 7;
  context.lineCap =
    "round";

  context.beginPath();
  context.moveTo(
    -10,
    -10
  );
  context.lineTo(
    10,
    10
  );
  context.moveTo(
    10,
    -10
  );
  context.lineTo(
    -10,
    10
  );
  context.stroke();

  return canvas;
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

  const badgeCanvas =
    createRoadClosureBadgeCanvas();

  let currentFeatures = [];
  let loading = null;
  let timer = null;
  let lastLoadedAt = 0;

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

    const graphics =
      badgeCanvas
        ? {
            billboard: {
              image:
                badgeCanvas,
              width:
                36,
              height:
                36,
              verticalOrigin:
                CesiumRef.VerticalOrigin
                  ?.CENTER,
              heightReference:
                sharedHeightReference,
              disableDepthTestDistance:
                Number.POSITIVE_INFINITY
            },
            point: {
              pixelSize:
                48,
              color:
                CesiumRef.Color.WHITE
                  .withAlpha(
                    0.001
                  ),
              outlineWidth:
                0,
              heightReference:
                sharedHeightReference,
              disableDepthTestDistance:
                Number.POSITIVE_INFINITY
            }
          }
        : {
            point: {
              pixelSize:
                18,
              color:
                closureColour,
              outlineColor:
                lineUnderlay,
              outlineWidth:
                4,
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

        onStatus({
          kind:
            "ok",
          message:
            `${currentFeatures.length} active flood closure${
              currentFeatures.length === 1
                ? ""
                : "s"
            }`,
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
      onStatus({
        kind:
          "error",
        message:
          error?.message
          ?? String(error)
      });

      throw error;
    } finally {
      loading =
        null;
    }
  }

  function setVisible(
    nextVisible
  ) {
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
