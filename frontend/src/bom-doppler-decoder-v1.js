export const BOM_DOPPLER_VELOCITY_SCALE_KMH =
  Object.freeze([
    -70,
    -60,
    -50,
    -40,
    -30,
    -20,
    -15,
    -10,
    -5,
    0,
    5,
    10,
    15,
    20,
    30,
    40,
    50,
    60,
    70
  ]);

function rgbAt(
  data,
  width,
  x,
  y
) {
  const i =
    (
      y * width
      + x
    ) * 4;

  return [
    data[i],
    data[i + 1],
    data[i + 2],
    data[i + 3]
  ];
}

function sameRgb(
  a,
  b
) {
  return (
    a[0] === b[0]
    && a[1] === b[1]
    && a[2] === b[2]
  );
}

function chroma(
  rgb
) {
  return (
    Math.max(
      ...rgb
    )
    - Math.min(
      ...rgb
    )
  );
}

function isPaletteLikeRgb(
  rgb
) {
  const maximum =
    Math.max(
      ...rgb
    );

  const minimum =
    Math.min(
      ...rgb
    );

  return (
    (
      maximum >= 45
      && chroma(
        rgb
      ) >= 20
    )
    || (
      minimum >= 180
      && chroma(
        rgb
      ) <= 55
    )
  );
}

function isNeutralRgb(
  rgb
) {
  return (
    Math.min(
      ...rgb
    ) >= 180
    && chroma(
      rgb
    ) <= 55
  );
}

function isBlueSideRgb(
  rgb
) {
  const [
    r,
    g,
    b
  ] = rgb;

  return (
    b >= 65
    && b >= r + 20
    && b >= g
  );
}

function isWarmSideRgb(
  rgb
) {
  const [
    r,
    g,
    b
  ] = rgb;

  return (
    (
      r >= 110
      && r >= b + 25
    )
    || (
      r >= 180
      && g >= 120
      && b <= 140
    )
  );
}

function rowRuns(
  imageData,
  y
) {
  const {
    width,
    data
  } = imageData;

  const runs = [];

  let start =
    0;

  let previous =
    rgbAt(
      data,
      width,
      0,
      y
    );

  for (
    let x = 1;
    x <= width;
    x++
  ) {
    const current =
      x < width
        ? rgbAt(
            data,
            width,
            x,
            y
          )
        : null;

    if (
      current
      && sameRgb(
        previous,
        current
      )
    ) {
      continue;
    }

    runs.push({
      start,
      end:
        x - 1,

      width:
        x - start,

      rgb:
        previous.slice(
          0,
          3
        ),

      alpha:
        previous[3]
    });

    start =
      x;

    previous =
      current;
  }

  return runs;
}

function median(
  values
) {
  if (!values.length) {
    return null;
  }

  const ordered =
    [...values].sort(
      (a, b) =>
        a - b
    );

  const middle =
    Math.floor(
      ordered.length / 2
    );

  return (
    ordered.length % 2
      ? ordered[middle]
      : (
          ordered[middle - 1]
          + ordered[middle]
        ) / 2
  );
}

function widthCoefficientOfVariation(
  runs
) {
  if (!runs.length) {
    return Infinity;
  }

  const widths =
    runs.map(
      run =>
        run.width
    );

  const mean =
    widths.reduce(
      (sum, value) =>
        sum + value,
      0
    )
    / widths.length;

  if (!(mean > 0)) {
    return Infinity;
  }

  const variance =
    widths.reduce(
      (sum, value) =>
        sum
        + (
          value - mean
        ) ** 2,
      0
    )
    / widths.length;

  return (
    Math.sqrt(
      variance
    )
    / mean
  );
}

function clusterByGap(
  runs,
  {
    maxGap = 4
  } = {}
) {
  if (!runs.length) {
    return [];
  }

  const clusters = [];
  let current = [
    runs[0]
  ];

  for (
    let index = 1;
    index < runs.length;
    index++
  ) {
    const previous =
      current.at(-1);

    const next =
      runs[index];

    const gap =
      next.start
      - previous.end
      - 1;

    if (
      gap <= maxGap
    ) {
      current.push(
        next
      );
    } else {
      clusters.push(
        current
      );

      current = [
        next
      ];
    }
  }

  clusters.push(
    current
  );

  return clusters;
}

function normalisePaletteCluster(
  cluster
) {
  const neutralCandidates =
    cluster
      .map(
        (
          run,
          index
        ) => ({
          run,
          index
        })
      )
      .filter(
        item =>
          isNeutralRgb(
            item.run.rgb
          )
      );

  if (
    !neutralCandidates.length
  ) {
    return null;
  }

  const clusterMiddle =
    (
      cluster.length - 1
    ) / 2;

  neutralCandidates.sort(
    (
      a,
      b
    ) => {
      const distanceA =
        Math.abs(
          a.index
          - clusterMiddle
        );

      const distanceB =
        Math.abs(
          b.index
          - clusterMiddle
        );

      if (
        distanceA
        !== distanceB
      ) {
        return (
          distanceA
          - distanceB
        );
      }

      const brightnessA =
        Math.min(
          ...a.run.rgb
        );

      const brightnessB =
        Math.min(
          ...b.run.rgb
        );

      return (
        brightnessB
        - brightnessA
      );
    }
  );

  const neutral =
    neutralCandidates[0];

  const requiredEachSide =
    (
      BOM_DOPPLER_VELOCITY_SCALE_KMH
        .length
      - 1
    ) / 2;

  const start =
    neutral.index
    - requiredEachSide;

  const endExclusive =
    neutral.index
    + requiredEachSide
    + 1;

  if (
    start < 0
    || endExclusive
      > cluster.length
  ) {
    return null;
  }

  const window =
    cluster.slice(
      start,
      endExclusive
    );

  if (
    window.length
    !== BOM_DOPPLER_VELOCITY_SCALE_KMH
      .length
  ) {
    return null;
  }

  const neutralIndex =
    requiredEachSide;

  const blueCount =
    window
      .slice(
        0,
        neutralIndex
      )
      .filter(
        run =>
          isBlueSideRgb(
            run.rgb
          )
      )
      .length;

  const warmCount =
    window
      .slice(
        neutralIndex + 1
      )
      .filter(
        run =>
          isWarmSideRgb(
            run.rgb
          )
      )
      .length;

  if (
    blueCount < 6
    || warmCount < 6
    || !isNeutralRgb(
      window[
        neutralIndex
      ].rgb
    )
  ) {
    return null;
  }

  return {
    runs:
      window,

    neutralIndex,

    blueCount,

    warmCount,

    widthCv:
      widthCoefficientOfVariation(
        window
      )
  };
}

export function locateExactBureauVelocityPalette(
  imageData
) {
  const {
    width,
    height
  } = imageData;

  const footerStart =
    Math.min(
      width,
      height
    );

  if (
    height <= footerStart
  ) {
    throw new Error(
      `No Bureau Doppler footer in ${width}x${height} image.`
    );
  }

  let best =
    null;

  for (
    let y = footerStart;
    y < height;
    y++
  ) {
    const runs =
      rowRuns(
        imageData,
        y
      ).filter(
        run =>
          run.alpha > 0
          && run.width >= 4
          && run.width <= 60
          && isPaletteLikeRgb(
            run.rgb
          )
      );

    const clusters =
      clusterByGap(
        runs
      );

    for (
      const cluster
      of clusters
    ) {
      const normalised =
        normalisePaletteCluster(
          cluster
        );

      if (!normalised) {
        continue;
      }

      const span =
        normalised.runs.at(-1).end
        - normalised.runs[0].start
        + 1;

      const score =
        normalised.blueCount
        * 200
        + normalised.warmCount
        * 200
        + span
        - normalised.widthCv
          * 1000;

      if (
        !best
        || score
          > best.score
      ) {
        best = {
          y,
          footerStart,
          score,
          ...normalised
        };
      }
    }
  }

  if (!best) {
    throw new Error(
      "Could not isolate the 19-swatch Bureau Doppler velocity palette."
    );
  }

  return {
    ...best,

    swatches:
      best.runs.map(
        (
          run,
          index
        ) => ({
          ...run,

          velocity_kmh:
            BOM_DOPPLER_VELOCITY_SCALE_KMH[
              index
            ]
        })
      )
  };
}

function rgbKey(
  rgb
) {
  return (
    (
      rgb[0]
      << 16
    )
    | (
      rgb[1]
      << 8
    )
    | rgb[2]
  );
}

export function decodeBureauDopplerPanel(
  imageData,
  palette
) {
  const panelSize =
    Math.min(
      imageData.width,
      imageData.height
    );

  const velocities =
    new Float32Array(
      panelSize
      * panelSize
    );

  velocities.fill(
    Number.NaN
  );

  const lookup =
    new Map(
      palette.swatches.map(
        swatch => [
          rgbKey(
            swatch.rgb
          ),
          swatch.velocity_kmh
        ]
      )
    );

  const counts =
    new Map();

  let validPixelCount =
    0;

  let minimumVelocity =
    null;

  let maximumVelocity =
    null;

  for (
    let y = 0;
    y < panelSize;
    y++
  ) {
    for (
      let x = 0;
      x < panelSize;
      x++
    ) {
      const sourceIndex =
        (
          y
          * imageData.width
          + x
        )
        * 4;

      if (
        imageData.data[
          sourceIndex + 3
        ] === 0
      ) {
        continue;
      }

      const key =
        (
          imageData.data[
            sourceIndex
          ]
          << 16
        )
        | (
          imageData.data[
            sourceIndex + 1
          ]
          << 8
        )
        | imageData.data[
          sourceIndex + 2
        ];

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

      velocities[
        y
        * panelSize
        + x
      ] =
        velocity;

      validPixelCount++;

      counts.set(
        velocity,
        (
          counts.get(
            velocity
          )
          ?? 0
        ) + 1
      );

      minimumVelocity =
        minimumVelocity == null
          ? velocity
          : Math.min(
              minimumVelocity,
              velocity
            );

      maximumVelocity =
        maximumVelocity == null
          ? velocity
          : Math.max(
              maximumVelocity,
              velocity
            );
    }
  }

  return {
    panelSize,

    velocities,

    validPixelCount,

    minimumVelocityKmh:
      minimumVelocity,

    maximumVelocityKmh:
      maximumVelocity,

    radialVelocitySpanKmh:
      minimumVelocity == null
      || maximumVelocity == null
        ? null
        : maximumVelocity
          - minimumVelocity,

    counts:
      Object.fromEntries(
        [...counts.entries()]
          .sort(
            (
              a,
              b
            ) =>
              Number(
                a[0]
              )
              - Number(
                  b[0]
                )
          )
      )
  };
}
