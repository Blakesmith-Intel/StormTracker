import {
  pixelCentreMercator,
  webMercatorToDegrees
} from "./inferred-volume-v1.js?v=registration-v1";

const WEB_MERCATOR_RADIUS = 6378137;

export function degreesToWebMercator(
  longitude,
  latitude
) {
  const lon = Number(longitude);

  const lat = Math.max(
    -85.05112878,
    Math.min(
      85.05112878,
      Number(latitude)
    )
  );

  return {
    x:
      WEB_MERCATOR_RADIUS
      * lon
      * Math.PI
      / 180,

    y:
      WEB_MERCATOR_RADIUS
      * Math.log(
        Math.tan(
          Math.PI / 4
          + lat
            * Math.PI
            / 360
        )
      )
  };
}

export function geographicToPixel(
  frame,
  longitude,
  latitude
) {
  const mercator =
    degreesToWebMercator(
      longitude,
      latitude
    );

  const dx =
    (
      frame.georef.maxX
      - frame.georef.minX
    )
    / frame.width;

  const dy =
    (
      frame.georef.maxY
      - frame.georef.minY
    )
    / frame.height;

  return {
    column:
      (
        mercator.x
        - frame.georef.minX
      )
      / dx
      - 0.5,

    row:
      (
        frame.georef.maxY
        - mercator.y
      )
      / dy
      - 0.5
  };
}

export function registrationResidualPixels(
  frame,
  column,
  row
) {
  const mercator =
    pixelCentreMercator(
      frame,
      column,
      row
    );

  const geographic =
    webMercatorToDegrees(
      mercator.x,
      mercator.y
    );

  const roundTrip =
    geographicToPixel(
      frame,
      geographic.longitude,
      geographic.latitude
    );

  return {
    column_error_px:
      roundTrip.column
      - column,

    row_error_px:
      roundTrip.row
      - row,

    magnitude_px:
      Math.hypot(
        roundTrip.column
        - column,

        roundTrip.row
        - row
      )
  };
}

export function selectRegistrationAnchors(
  frame,
  {
    count = 3,
    minimumCategory = 2,
    minimumSeparationPx = 40
  } = {}
) {
  const candidates = [];

  for (
    let row = 0;
    row < frame.height;
    row++
  ) {
    for (
      let column = 0;
      column < frame.width;
      column++
    ) {
      const category =
        Number(
          frame.categories[
            row * frame.width
            + column
          ]
        );

      if (
        category
        < minimumCategory
      ) {
        continue;
      }

      candidates.push({
        row,
        column,
        category
      });
    }
  }

  candidates.sort(
    (a, b) =>
      b.category
      - a.category
  );

  const selected = [];

  for (const candidate of candidates) {
    const tooClose =
      selected.some(
        existing =>
          Math.hypot(
            candidate.column
            - existing.column,

            candidate.row
            - existing.row
          )
          < minimumSeparationPx
      );

    if (tooClose) {
      continue;
    }

    const mercator =
      pixelCentreMercator(
        frame,
        candidate.column,
        candidate.row
      );

    const geographic =
      webMercatorToDegrees(
        mercator.x,
        mercator.y
      );

    const residual =
      registrationResidualPixels(
        frame,
        candidate.column,
        candidate.row
      );

    selected.push({
      id:
        `A${selected.length + 1}`,

      ...candidate,

      longitude:
        geographic.longitude,

      latitude:
        geographic.latitude,

      residual_px:
        residual.magnitude_px
    });

    if (
      selected.length
      >= count
    ) {
      break;
    }
  }

  return selected;
}
