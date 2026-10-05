import {
  locateExactBureauVelocityPalette
} from "./bom-doppler-decoder-v1.js?v=history-spatial-v1";

import {
  dopplerPixelCentreToLonLat
} from "./bom-doppler-georef-v1.js?v=operational-v9-7";

export function historicalPanelLayout(
  width,
  height
) {
  if (
    width === 512
    && height === 512
  ) {
    return {
      panelX:0,
      panelY:0,
      panelSize:512
    };
  }

  if (
    width >= 518
    && height >= 518
  ) {
    return {
      panelX:6,
      panelY:6,
      panelSize:512
    };
  }

  throw new Error(
    `Unsupported historical Doppler image size: ${width}x${height}`
  );
}

function paletteLookup(
  palette
) {
  return new Map(
    palette.swatches.map(
      swatch => [
        `${swatch.rgb[0]},${swatch.rgb[1]},${swatch.rgb[2]}`,
        swatch.velocity_kmh
      ]
    )
  );
}

export function paletteFromLatestDopplerImage(
  imageData
) {
  return locateExactBureauVelocityPalette(
    imageData
  );
}

export function geolocatedHistoricalDopplerSamples(
  radarId,
  imageData,
  palette,
  {
    includeZero = false,
    stride = 1
  } = {}
) {
  const layout =
    historicalPanelLayout(
      imageData.width,
      imageData.height
    );

  const lookup =
    paletteLookup(
      palette
    );

  const samples = [];

  let validPixelCount =
    0;

  let nonZeroPixelCount =
    0;

  for (
    let row = 0;
    row < layout.panelSize;
    row += stride
  ) {
    for (
      let column = 0;
      column < layout.panelSize;
      column += stride
    ) {
      const x =
        layout.panelX
        + column;

      const y =
        layout.panelY
        + row;

      const offset =
        (
          y
          * imageData.width
          + x
        )
        * 4;

      if (
        imageData.data[
          offset + 3
        ] === 0
      ) {
        continue;
      }

      const key =
        `${
          imageData.data[offset]
        },${
          imageData.data[offset + 1]
        },${
          imageData.data[offset + 2]
        }`;

      if (
        !lookup.has(
          key
        )
      ) {
        continue;
      }

      const velocity =
        lookup.get(
          key
        );

      validPixelCount++;

      if (
        velocity !== 0
      ) {
        nonZeroPixelCount++;
      }

      if (
        !includeZero
        && velocity === 0
      ) {
        continue;
      }

      const position =
        dopplerPixelCentreToLonLat(
          radarId,
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

  return {
    radarId:
      String(
        radarId
      ),

    width:
      layout.panelSize,

    height:
      layout.panelSize,

    validPixelCount,

    nonZeroPixelCount,

    samples
  };
}
