import {
  decodeBureauDopplerPanel,
  locateExactBureauVelocityPalette
} from "./bom-doppler-decoder-v1.js?v=spatial-v1";

import {
  BOM_DOPPLER_GIF_LAYOUT,
  dopplerPixelCentreToLonLat
} from "./bom-doppler-georef-v1.js?v=spatial-v1";

export function decodeGeoreferencedDoppler(
  radarId,
  imageData
) {
  const layout =
    BOM_DOPPLER_GIF_LAYOUT;

  if (
    imageData.width
      !== layout.width
    || imageData.height
      !== layout.height
  ) {
    throw new Error(
      `Unexpected Bureau Doppler GIF size: ` +
      `${imageData.width}x${imageData.height}; ` +
      `expected ${layout.width}x${layout.height}.`
    );
  }

  const palette =
    locateExactBureauVelocityPalette(
      imageData
    );

  // The existing decoder intentionally works on the top-left square
  // 524x524 panel, because that was enough to validate the palette.
  // Spatial sampling uses the recovered native 512x512 map panel inside
  // that GIF: x/y 6..517 inclusive.
  const velocityByRgb =
    new Map(
      palette.swatches.map(
        swatch => [
          `${swatch.rgb[0]},${swatch.rgb[1]},${swatch.rgb[2]}`,
          swatch.velocity_kmh
        ]
      )
    );

  const velocities =
    new Float32Array(
      layout.panelSize
      * layout.panelSize
    );

  velocities.fill(
    Number.NaN
  );

  let validPixelCount =
    0;

  let nonZeroPixelCount =
    0;

  for (
    let row = 0;
    row < layout.panelSize;
    row++
  ) {
    for (
      let column = 0;
      column < layout.panelSize;
      column++
    ) {
      const gifX =
        column
        + layout.panelX;

      const gifY =
        row
        + layout.panelY;

      const sourceIndex =
        (
          gifY
          * imageData.width
          + gifX
        )
        * 4;

      const key =
        `${
          imageData.data[
            sourceIndex
          ]
        },${
          imageData.data[
            sourceIndex + 1
          ]
        },${
          imageData.data[
            sourceIndex + 2
          ]
        }`;

      if (
        !velocityByRgb.has(
          key
        )
      ) {
        continue;
      }

      const velocity =
        velocityByRgb.get(
          key
        );

      velocities[
        row
        * layout.panelSize
        + column
      ] =
        velocity;

      validPixelCount++;

      if (
        velocity !== 0
      ) {
        nonZeroPixelCount++;
      }
    }
  }

  return {
    radarId:
      String(
        radarId
      ),

    width:
      layout.panelSize,

    height:
      layout.panelSize,

    velocities,

    palette,

    validPixelCount,

    nonZeroPixelCount
  };
}

export function geolocatedDopplerSamples(
  decoded,
  {
    stride = 1,
    includeZero = false
  } = {}
) {
  const samples = [];

  for (
    let row = 0;
    row < decoded.height;
    row += stride
  ) {
    for (
      let column = 0;
      column < decoded.width;
      column += stride
    ) {
      const velocity =
        decoded.velocities[
          row
          * decoded.width
          + column
        ];

      if (
        Number.isNaN(
          velocity
        )
      ) {
        continue;
      }

      if (
        !includeZero
        && velocity === 0
      ) {
        continue;
      }

      const position =
        dopplerPixelCentreToLonLat(
          decoded.radarId,
          column,
          row
        );

      samples.push({
        column,
        row,
        velocity_kmh:
          velocity,

        longitude:
          position.longitude,

        latitude:
          position.latitude
      });
    }
  }

  return samples;
}
