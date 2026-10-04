import { QLD_RADAR_SITES } from "./qld-radar-sites-v1.js";
import {
  inverseGnomonic
} from "./geo.js?v=doppler-georef-v1";

export const BOM_DOPPLER_GIF_LAYOUT =
  Object.freeze({
    width: 524,
    height: 564,
    panelX: 6,
    panelY: 6,
    panelSize: 512,
    footerY: 524
  });

export const BOM_DOPPLER_MAPS =
  Object.freeze({
    ...Object.fromEntries(Object.values(QLD_RADAR_SITES)
      .filter(site => site.dopplerProduct && !['08','50','66'].includes(site.id))
      .map(site => [site.id, Object.freeze({
        id: site.id, product: site.dopplerProduct, map: `IDR${site.id}3`,
        projection: 'Gnomonic', latitude: site.dopplerLatitude, longitude: site.dopplerLongitude,
        nominalPanel: true, recoveredCentrePixel: Object.freeze({column:256,row:256})
      })])),
    "08": Object.freeze({
      id: "08",
      product: "IDR08I",
      map: "IDR083.map",
      projection: "Gnomonic",
      latitude: -25.967000,
      longitude: 152.582990,

      corners: Object.freeze({
        sw: Object.freeze({
          latitude: -27.106450,
          longitude: 151.295640
        }),

        nw: Object.freeze({
          latitude: -24.807200,
          longitude: 151.320560
        }),

        ne: Object.freeze({
          latitude: -24.807130,
          longitude: 153.853680
        }),

        se: Object.freeze({
          latitude: -27.106370,
          longitude: 153.878770
        })
      }),

      recoveredCentrePixel:
        Object.freeze({
          column: 255.165,
          row: 257.023
        })
    }),

    "50": Object.freeze({
      id: "50",
      product: "IDR50I",
      map: "IDR503.map",
      projection: "Gnomonic",
      latitude: -27.608000,
      longitude: 152.539000,

      corners: Object.freeze({
        sw: Object.freeze({
          latitude: -28.748160,
          longitude: 151.233090
        }),

        nw: Object.freeze({
          latitude: -26.447760,
          longitude: 151.260240
        }),

        ne: Object.freeze({
          latitude: -26.447660,
          longitude: 153.829700
        }),

        se: Object.freeze({
          latitude: -28.748040,
          longitude: 153.857090
        })
      }),

      recoveredCentrePixel:
        Object.freeze({
          column: 254.811,
          row: 256.903
        })
    }),

    "66": Object.freeze({
      id: "66",
      product: "IDR66I",
      map: "IDR663.map",
      projection: "Gnomonic",
      latitude: -27.718100,
      longitude: 153.240010,

      corners: Object.freeze({
        sw: Object.freeze({
          latitude: -28.857650,
          longitude: 151.930950
        }),

        nw: Object.freeze({
          latitude: -26.556400,
          longitude: 151.958280
        }),

        ne: Object.freeze({
          latitude: -26.556320,
          longitude: 154.531130
        }),

        se: Object.freeze({
          latitude: -28.857550,
          longitude: 154.558670
        })
      }),

      recoveredCentrePixel:
        Object.freeze({
          column: 255.065,
          row: 257.123
        })
    })
  });

const R =
  6371008.8;

const DEG =
  Math.PI / 180;

function toRad(
  value
) {
  return (
    Number(value)
    * DEG
  );
}

export function forwardGnomonic(
  longitude,
  latitude,
  longitude0,
  latitude0
) {
  const lambda =
    toRad(
      longitude
    );

  const phi =
    toRad(
      latitude
    );

  const lambda0 =
    toRad(
      longitude0
    );

  const phi0 =
    toRad(
      latitude0
    );

  const deltaLambda =
    lambda
    - lambda0;

  const cosC =
    Math.sin(
      phi0
    )
    * Math.sin(
        phi
      )
    + Math.cos(
        phi0
      )
      * Math.cos(
          phi
        )
      * Math.cos(
          deltaLambda
        );

  if (
    cosC <= 0
  ) {
    throw new Error(
      "Point is outside the visible hemisphere of the Gnomonic projection."
    );
  }

  return {
    x:
      R
      * Math.cos(
          phi
        )
      * Math.sin(
          deltaLambda
        )
      / cosC,

    y:
      R
      * (
          Math.cos(
            phi0
          )
          * Math.sin(
              phi
            )
          - Math.sin(
              phi0
            )
            * Math.cos(
                phi
              )
            * Math.cos(
                deltaLambda
              )
        )
      / cosC
  };
}

function projectedCorner(
  radar,
  corner
) {
  return forwardGnomonic(
    corner.longitude,
    corner.latitude,
    radar.longitude,
    radar.latitude
  );
}

export function projectedBoundsForRadar(
  radarId
) {
  const radar =
    BOM_DOPPLER_MAPS[
      String(
        radarId
      )
    ];

  if (!radar) {
    throw new Error(
      `Unsupported Doppler radar: ${radarId}`
    );
  }

  if (radar.nominalPanel) return {west:-128000,east:128000,south:-128000,north:128000};

  const sw =
    projectedCorner(
      radar,
      radar.corners.sw
    );

  const nw =
    projectedCorner(
      radar,
      radar.corners.nw
    );

  const ne =
    projectedCorner(
      radar,
      radar.corners.ne
    );

  const se =
    projectedCorner(
      radar,
      radar.corners.se
    );

  return {
    west:
      (
        sw.x
        + nw.x
      ) / 2,

    east:
      (
        ne.x
        + se.x
      ) / 2,

    south:
      (
        sw.y
        + se.y
      ) / 2,

    north:
      (
        nw.y
        + ne.y
      ) / 2
  };
}

export function dopplerMapCoordinateToLonLat(
  radarId,
  column,
  row
) {
  const radar =
    BOM_DOPPLER_MAPS[
      String(
        radarId
      )
    ];

  if (!radar) {
    throw new Error(
      `Unsupported Doppler radar: ${radarId}`
    );
  }

  const bounds =
    projectedBoundsForRadar(
      radarId
    );

  const size =
    BOM_DOPPLER_GIF_LAYOUT
      .panelSize;

  const x =
    bounds.west
    + (
        Number(
          column
        )
        / size
      )
      * (
        bounds.east
        - bounds.west
      );

  const y =
    bounds.north
    - (
        Number(
          row
        )
        / size
      )
      * (
        bounds.north
        - bounds.south
      );

  return inverseGnomonic(
    x,
    y,
    radar.longitude,
    radar.latitude
  );
}

export function dopplerPixelCentreToLonLat(
  radarId,
  column,
  row
) {
  return dopplerMapCoordinateToLonLat(
    radarId,
    Number(
      column
    ) + 0.5,
    Number(
      row
    ) + 0.5
  );
}

export function lonLatToDopplerMapCoordinate(
  radarId,
  longitude,
  latitude
) {
  const radar =
    BOM_DOPPLER_MAPS[
      String(
        radarId
      )
    ];

  if (!radar) {
    throw new Error(
      `Unsupported Doppler radar: ${radarId}`
    );
  }

  const bounds =
    projectedBoundsForRadar(
      radarId
    );

  const projected =
    forwardGnomonic(
      longitude,
      latitude,
      radar.longitude,
      radar.latitude
    );

  const size =
    BOM_DOPPLER_GIF_LAYOUT
      .panelSize;

  return {
    column:
      (
        projected.x
        - bounds.west
      )
      / (
        bounds.east
        - bounds.west
      )
      * size,

    row:
      (
        bounds.north
        - projected.y
      )
      / (
        bounds.north
        - bounds.south
      )
      * size
  };
}

export function gifPixelToDopplerPanelPixel(
  x,
  y
) {
  const layout =
    BOM_DOPPLER_GIF_LAYOUT;

  return {
    column:
      Number(
        x
      )
      - layout.panelX,

    row:
      Number(
        y
      )
      - layout.panelY
  };
}

export function dopplerPanelPixelToGifPixel(
  column,
  row
) {
  const layout =
    BOM_DOPPLER_GIF_LAYOUT;

  return {
    x:
      Number(
        column
      )
      + layout.panelX,

    y:
      Number(
        row
      )
      + layout.panelY
  };
}

export function centrePixelResidual(
  radarId
) {
  const radar =
    BOM_DOPPLER_MAPS[
      String(
        radarId
      )
    ];

  const calculated =
    lonLatToDopplerMapCoordinate(
      radarId,
      radar.longitude,
      radar.latitude
    );

  return {
    calculated,

    recovered:
      radar.recoveredCentrePixel,

    column_error_px:
      calculated.column
      - radar
        .recoveredCentrePixel
        .column,

    row_error_px:
      calculated.row
      - radar
        .recoveredCentrePixel
        .row,

    magnitude_px:
      Math.hypot(
        calculated.column
        - radar
          .recoveredCentrePixel
          .column,

        calculated.row
        - radar
          .recoveredCentrePixel
          .row
      )
  };
}
