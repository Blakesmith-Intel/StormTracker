import {
  historicalPanelLayout
} from "./bom-doppler-history-spatial-v1.js?v=display-v2";

import {
  dopplerPixelCentreToLonLat
} from "./bom-doppler-georef-v1.js?v=display-v2";

function squaredRgbDistance(
  a,
  b
) {
  const dr = Number(a[0]) - Number(b[0]);
  const dg = Number(a[1]) - Number(b[1]);
  const db = Number(a[2]) - Number(b[2]);

  return dr * dr + dg * dg + db * db;
}

function chroma(
  rgb
) {
  return (
    Math.max(...rgb)
    - Math.min(...rgb)
  );
}

function directionCompatible(
  rgb,
  velocity
) {
  const [r, g, b] = rgb;

  if (velocity < 0) {
    return (
      b >= r + 4
      && b >= g - 10
    );
  }

  if (velocity > 0) {
    return (
      r >= b + 8
      && (
        r >= 90
        || g >= 90
      )
    );
  }

  return chroma(rgb) <= 45;
}

export function nearestPaletteMatch(
  rgb,
  palette,
  {
    exactDistance = 0,
    relaxedDistance = 24
  } = {}
) {
  let best = null;

  for (
    const swatch
    of palette?.swatches
    ?? []
  ) {
    const distanceSquared =
      squaredRgbDistance(
        rgb,
        swatch.rgb
      );

    if (
      !best
      || distanceSquared
        < best.distanceSquared
    ) {
      best = {
        swatch,
        distanceSquared
      };
    }
  }

  if (!best) {
    return null;
  }

  const distance =
    Math.sqrt(
      best.distanceSquared
    );

  if (distance <= exactDistance) {
    return {
      ...best.swatch,
      match_distance: distance,
      match_mode: "exact"
    };
  }

  if (
    distance <= relaxedDistance
    && directionCompatible(
      rgb,
      best.swatch.velocity_kmh
    )
  ) {
    return {
      ...best.swatch,
      match_distance: distance,
      match_mode: "near"
    };
  }

  return null;
}

export function geolocatedDopplerDisplaySamples(
  radarId,
  imageData,
  palette,
  {
    includeZero = false,
    stride = 1,
    relaxedDistance = 24
  } = {}
) {
  const layout =
    historicalPanelLayout(
      imageData.width,
      imageData.height
    );

  const samples = [];

  let exactCount = 0;
  let nearCount = 0;

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
      const x = layout.panelX + column;
      const y = layout.panelY + row;

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

      const rgb = [
        imageData.data[offset],
        imageData.data[offset + 1],
        imageData.data[offset + 2]
      ];

      const match =
        nearestPaletteMatch(
          rgb,
          palette,
          {
            relaxedDistance
          }
        );

      if (!match) {
        continue;
      }

      if (
        !includeZero
        && match.velocity_kmh === 0
      ) {
        continue;
      }

      const position =
        dopplerPixelCentreToLonLat(
          radarId,
          column,
          row
        );

      if (match.match_mode === "exact") {
        exactCount++;
      } else {
        nearCount++;
      }

      samples.push({
        column,
        row,
        velocity_kmh: match.velocity_kmh,
        palette_rgb: [
          match.rgb[0],
          match.rgb[1],
          match.rgb[2]
        ],
        match_distance: match.match_distance,
        match_mode: match.match_mode,
        longitude: position.longitude,
        latitude: position.latitude
      });
    }
  }

  return {
    radarId: String(radarId),
    width: layout.panelSize,
    height: layout.panelSize,
    exactCount,
    nearCount,
    displayPixelCount: samples.length,
    samples
  };
}
