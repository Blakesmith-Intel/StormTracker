const WEB_MERCATOR_RADIUS = 6378137;

export function webMercatorYToLatitudeDegrees(
  y
) {
  return (
    (
      2
      * Math.atan(
        Math.exp(
          Number(y)
          / WEB_MERCATOR_RADIUS
        )
      )
      - Math.PI / 2
    )
    * 180
    / Math.PI
  );
}

export function latitudeDegreesToWebMercatorY(
  latitude
) {
  const clamped =
    Math.max(
      -85.05112878,
      Math.min(
        85.05112878,
        Number(latitude)
      )
    );

  return (
    WEB_MERCATOR_RADIUS
    * Math.log(
      Math.tan(
        Math.PI / 4
        + clamped
          * Math.PI
          / 360
      )
    )
  );
}

export function sourceRowToGeographicOutputRow(
  frame,
  sourceRow
) {
  const northLatitude =
    webMercatorYToLatitudeDegrees(
      frame.georef.maxY
    );

  const southLatitude =
    webMercatorYToLatitudeDegrees(
      frame.georef.minY
    );

  const sourceFraction =
    (
      Number(sourceRow)
      + 0.5
    )
    / frame.height;

  const sourceMercatorY =
    frame.georef.maxY
    - sourceFraction
      * (
        frame.georef.maxY
        - frame.georef.minY
      );

  const latitude =
    webMercatorYToLatitudeDegrees(
      sourceMercatorY
    );

  return (
    (
      northLatitude
      - latitude
    )
    / (
      northLatitude
      - southLatitude
    )
    * frame.height
    - 0.5
  );
}

export function geographicOutputRowToSourceRow(
  frame,
  outputRow
) {
  const northLatitude =
    webMercatorYToLatitudeDegrees(
      frame.georef.maxY
    );

  const southLatitude =
    webMercatorYToLatitudeDegrees(
      frame.georef.minY
    );

  const outputFraction =
    (
      Number(outputRow)
      + 0.5
    )
    / frame.height;

  const latitude =
    northLatitude
    - outputFraction
      * (
        northLatitude
        - southLatitude
      );

  const mercatorY =
    latitudeDegreesToWebMercatorY(
      latitude
    );

  return (
    (
      frame.georef.maxY
      - mercatorY
    )
    / (
      frame.georef.maxY
      - frame.georef.minY
    )
    * frame.height
    - 0.5
  );
}

export function reprojectWebMercatorRgbaToGeographic(
  frame,
  sourceRgba
) {
  const expected =
    frame.width
    * frame.height
    * 4;

  if (
    sourceRgba.length
    !== expected
  ) {
    throw new Error(
      `RGBA length mismatch: expected ${expected}, got ${sourceRgba.length}.`
    );
  }

  const output =
    new Uint8ClampedArray(
      expected
    );

  const rowBytes =
    frame.width
    * 4;

  for (
    let outputRow = 0;
    outputRow < frame.height;
    outputRow++
  ) {
    const sourceRowFloat =
      geographicOutputRowToSourceRow(
        frame,
        outputRow
      );

    const sourceRow =
      Math.max(
        0,
        Math.min(
          frame.height - 1,
          Math.round(
            sourceRowFloat
          )
        )
      );

    const sourceStart =
      sourceRow
      * rowBytes;

    const outputStart =
      outputRow
      * rowBytes;

    output.set(
      sourceRgba.subarray(
        sourceStart,
        sourceStart
        + rowBytes
      ),
      outputStart
    );
  }

  return output;
}
