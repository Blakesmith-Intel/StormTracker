export const BOM_RIVER_TIDE_GAUGE_ATTRIBUTION =
  "© Commonwealth of Australia (Bureau of Meteorology) 2025";

export const BOM_RIVER_TIDE_GAUGE_QUERY_URL =
  "https://hosting.wsapi.cloud.bom.gov.au/arcgis/rest/services/flood/National_Flood_Gauge_Network/FeatureServer/5/query"
  + "?where=state%3D%27QLD%27"
  + "&outFields=bom_stn_num%2Cawrc_stateid%2Cname%2Clat%2Clong%2Cstate%2Clocation_types%2Cforecast_site_classification%2Cbasin%2Cagency%2Cfeatreal"
  + "&returnGeometry=true"
  + "&outSR=4326"
  + "&f=geojson";

export const DEFAULT_RIVER_GAUGE_REFRESH_MS =
  15 * 60 * 1000;

function text(
  value
) {
  return String(
    value ?? ""
  ).trim();
}

function propertiesOf(
  featureOrProperties
) {
  return (
    featureOrProperties
      ?.properties
    ?? featureOrProperties
    ?? {}
  );
}

function normalise(
  value
) {
  return text(
    value
  ).toLowerCase();
}

export function isTidalRiverGauge(
  featureOrProperties
) {
  const properties =
    propertiesOf(
      featureOrProperties
    );

  return normalise(
    properties.location_types
  ).includes(
    "tide gauge"
  );
}

export function riverGaugeId(
  featureOrProperties
) {
  const properties =
    propertiesOf(
      featureOrProperties
    );

  const bomStation =
    text(
      properties.bom_stn_num
    );

  if (bomStation) {
    return `bom:${bomStation}`;
  }

  const awrcStation =
    text(
      properties.awrc_stateid
    );

  if (awrcStation) {
    return `awrc:${awrcStation}`;
  }

  return "";
}

export function riverGaugeSummary(
  feature
) {
  const properties =
    propertiesOf(
      feature
    );

  return {
    id:
      riverGaugeId(
        feature
      ),

    bomStationNumber:
      text(
        properties.bom_stn_num
      ),

    awrcStationId:
      text(
        properties.awrc_stateid
      ),

    name:
      text(
        properties.name
      )
      || "Unnamed gauge",

    state:
      text(
        properties.state
      ),

    latitude:
      Number(
        properties.lat
        ?? feature?.geometry
          ?.coordinates?.[1]
      ),

    longitude:
      Number(
        properties.long
        ?? feature?.geometry
          ?.coordinates?.[0]
      ),

    locationTypes:
      text(
        properties.location_types
      ),

    tidal:
      isTidalRiverGauge(
        properties
      ),

    forecastSiteClassification:
      text(
        properties
          .forecast_site_classification
      ),

    basin:
      text(
        properties.basin
      ),

    agency:
      text(
        properties.agency
      ),

    featureReality:
      text(
        properties.featreal
      )
  };
}

export function filterQueenslandRiverGauges(
  payload
) {
  const features =
    Array.isArray(
      payload?.features
    )
      ? payload.features
          .filter(
            feature => {
              const summary =
                riverGaugeSummary(
                  feature
                );

              return (
                summary.id
                && summary.state
                  .toUpperCase()
                  === "QLD"
                && feature?.geometry
                  ?.type
                  === "Point"
                && Number.isFinite(
                  summary.latitude
                )
                && Number.isFinite(
                  summary.longitude
                )
              );
            }
          )
          .map(
            feature => ({
              ...feature,
              id:
                riverGaugeId(
                  feature
                )
            })
          )
      : [];

  return {
    ...(
      payload
      && typeof payload
        === "object"
        ? payload
        : {}
    ),

    type:
      "FeatureCollection",

    features
  };
}

async function fetchJson(
  fetchImpl,
  url,
  timeoutMs = 12000
) {
  const controller =
    typeof AbortController
      === "function"
      ? new AbortController()
      : null;

  const timeout =
    controller
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
          method:
            "GET",

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
        `BoM river-gauge metadata HTTP ${response.status}`
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

export async function loadRiverGaugeLocations({
  fetchImpl =
    globalThis.fetch,

  url =
    BOM_RIVER_TIDE_GAUGE_QUERY_URL
} = {}) {
  if (
    typeof fetchImpl
      !== "function"
  ) {
    throw new Error(
      "River-gauge metadata fetch is unavailable."
    );
  }

  const payload =
    await fetchJson(
      fetchImpl,
      url
    );

  return {
    payload:
      filterQueenslandRiverGauges(
        payload
      ),

    source:
      "Bureau of Meteorology National Flood Gauge Network",

    transport:
      "Direct first-party ArcGIS GeoJSON"
  };
}
