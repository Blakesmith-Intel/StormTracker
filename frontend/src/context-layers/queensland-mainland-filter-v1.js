export const QUEENSLAND_MAINLAND_QUERY_URL =
  "https://services1.arcgis.com/0BLakgVcDpWpuh4i/arcgis/rest/services/Locality/FeatureServer/5/query"
  + "?where=STATE%3D%27QUEENSLAND%27"
  + "&outFields=OBJECTID"
  + "&returnGeometry=true"
  + "&outSR=4326"
  + "&f=geojson";

function ringArea(
  ring
) {
  let area = 0;

  for (
    let index = 0;
    index < ring.length;
    index += 1
  ) {
    const current =
      ring[index];

    const next =
      ring[
        (
          index + 1
        )
        % ring.length
      ];

    area +=
      current[0]
      * next[1]
      - next[0]
      * current[1];
  }

  return area / 2;
}

function ringCentroid(
  ring
) {
  if (
    !Array.isArray(
      ring
    )
    || ring.length < 3
  ) {
    return null;
  }

  let factorSum = 0;
  let x = 0;
  let y = 0;

  for (
    let index = 0;
    index < ring.length;
    index += 1
  ) {
    const current =
      ring[index];

    const next =
      ring[
        (
          index + 1
        )
        % ring.length
      ];

    const factor =
      current[0]
      * next[1]
      - next[0]
      * current[1];

    factorSum +=
      factor;

    x +=
      (
        current[0]
        + next[0]
      )
      * factor;

    y +=
      (
        current[1]
        + next[1]
      )
      * factor;
  }

  if (
    Math.abs(
      factorSum
    ) < 1e-12
  ) {
    const valid =
      ring.filter(
        coordinate =>
          Array.isArray(
            coordinate
          )
          && coordinate.length >= 2
          && coordinate.every(
            Number.isFinite
          )
      );

    if (!valid.length) {
      return null;
    }

    return [
      valid.reduce(
        (
          sum,
          coordinate
        ) =>
          sum
          + coordinate[0],
        0
      )
      / valid.length,

      valid.reduce(
        (
          sum,
          coordinate
        ) =>
          sum
          + coordinate[1],
        0
      )
      / valid.length
    ];
  }

  return [
    x / (
      3
      * factorSum
    ),

    y / (
      3
      * factorSum
    )
  ];
}

function pointInRing(
  point,
  ring
) {
  const [
    x,
    y
  ] = point;

  let inside =
    false;

  for (
    let index = 0,
      previous =
        ring.length - 1;
    index < ring.length;
    previous =
      index,
    index += 1
  ) {
    const [
      xi,
      yi
    ] =
      ring[index];

    const [
      xj,
      yj
    ] =
      ring[previous];

    const crosses =
      (
        yi > y
      )
      !== (
        yj > y
      )
      && x
      < (
        (
          xj - xi
        )
        * (
          y - yi
        )
        / (
          yj - yi
        )
        + xi
      );

    if (crosses) {
      inside =
        !inside;
    }
  }

  return inside;
}

function pointInPolygonCoordinates(
  point,
  coordinates
) {
  const outer =
    coordinates?.[0];

  if (
    !Array.isArray(
      outer
    )
    || !pointInRing(
      point,
      outer
    )
  ) {
    return false;
  }

  for (
    const hole
    of coordinates
      .slice(
        1
      )
  ) {
    if (
      pointInRing(
        point,
        hole
      )
    ) {
      return false;
    }
  }

  return true;
}

export function pointInGeoJsonBoundary(
  point,
  boundaryPayload
) {
  const features =
    Array.isArray(
      boundaryPayload?.features
    )
      ? boundaryPayload.features
      : [];

  return features.some(
    feature => {
      const geometry =
        feature?.geometry;

      if (
        geometry?.type
        === "Polygon"
      ) {
        return pointInPolygonCoordinates(
          point,
          geometry.coordinates
        );
      }

      if (
        geometry?.type
        === "MultiPolygon"
      ) {
        return geometry.coordinates
          .some(
            polygon =>
              pointInPolygonCoordinates(
                point,
                polygon
              )
          );
      }

      return false;
    }
  );
}

export function representativePointForGeometry(
  geometry
) {
  if (
    geometry?.type
    === "Point"
  ) {
    const coordinate =
      geometry.coordinates;

    return (
      Array.isArray(
        coordinate
      )
      && coordinate.length >= 2
      && coordinate.every(
        Number.isFinite
      )
    )
      ? coordinate.slice(
          0,
          2
        )
      : null;
  }

  const polygons =
    geometry?.type
    === "Polygon"
      ? [
          geometry.coordinates
        ]
      : (
          geometry?.type
          === "MultiPolygon"
            ? geometry.coordinates
            : []
        );

  let selected =
    null;

  let selectedArea =
    -1;

  for (
    const polygon
    of polygons
  ) {
    const outer =
      polygon?.[0];

    if (
      !Array.isArray(
        outer
      )
      || outer.length < 3
    ) {
      continue;
    }

    const area =
      Math.abs(
        ringArea(
          outer
        )
      );

    if (
      area > selectedArea
    ) {
      selected =
        outer;

      selectedArea =
        area;
    }
  }

  return selected
    ? ringCentroid(
        selected
      )
    : null;
}

export function representativePointForFeature(
  feature
) {
  const longitudeText =
    String(
      feature?.properties
        ?.STORMTRACKER_SOURCE_LONGITUDE
      ?? ""
    ).trim();

  const latitudeText =
    String(
      feature?.properties
        ?.STORMTRACKER_SOURCE_LATITUDE
      ?? ""
    ).trim();

  const longitude =
    Number(
      longitudeText
    );

  const latitude =
    Number(
      latitudeText
    );

  if (
    longitudeText
    && latitudeText
    && Number.isFinite(
      longitude
    )
    && Number.isFinite(
      latitude
    )
  ) {
    return [
      longitude,
      latitude
    ];
  }

  return representativePointForGeometry(
    feature?.geometry
  );
}

export function filterFeaturesToQueensland(
  payload,
  boundaryPayload
) {
  const boundaryFeatures =
    Array.isArray(
      boundaryPayload?.features
    )
      ? boundaryPayload.features
      : [];

  if (!boundaryFeatures.length) {
    throw new Error(
      "Queensland mainland boundary returned no polygon features."
    );
  }

  const features =
    Array.isArray(
      payload?.features
    )
      ? payload.features
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

    features:
      features.filter(
        feature => {
          const point =
            representativePointForFeature(
              feature
            );

          return (
            point
            && pointInGeoJsonBoundary(
              point,
              boundaryPayload
            )
          );
        }
      )
  };
}
