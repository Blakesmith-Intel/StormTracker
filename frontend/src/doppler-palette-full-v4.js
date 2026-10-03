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

function rowRuns(
  imageData,
  y
) {
  const {
    width,
    data
  } = imageData;

  const runs = [];

  let start = 0;
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

function isBlue(
  rgb
) {
  const [
    r,
    g,
    b
  ] = rgb;

  return (
    b >= 70
    && b >= r + 25
    && b >= g
  );
}

function isWarm(
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
      && r >= b + 30
    )
    || (
      r >= 170
      && g >= 120
      && b <= 120
    )
  );
}

function isNeutral(
  rgb
) {
  return (
    Math.min(
      ...rgb
    ) >= 175
    && chroma(
      rgb
    ) <= 45
  );
}

function candidateRuns(
  imageData,
  y
) {
  return rowRuns(
    imageData,
    y
  ).filter(
    run =>
      run.alpha > 0
      && run.width >= 4
      && run.width <= 60
      && (
        isBlue(
          run.rgb
        )
        || isWarm(
          run.rgb
        )
        || isNeutral(
          run.rgb
        )
      )
  );
}

function clusterByGap(
  runs,
  {
    maxGap = 3
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

    if (gap <= maxGap) {
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

function clusterScore(
  cluster
) {
  if (
    cluster.length < 3
  ) {
    return -Infinity;
  }

  const span =
    cluster.at(-1).end
    - cluster[0].start
    + 1;

  return (
    cluster.length
    * 100
    + span
  );
}

function directionScore(
  cluster,
  predicate
) {
  return cluster.reduce(
    (
      total,
      run
    ) =>
      total
      + (
        predicate(
          run.rgb
        )
          ? 1
          : 0
      ),
    0
  );
}

export function locateFullVelocityPalette(
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
      `No Bureau footer detected in ${width}x${height} image.`
    );
  }

  let bestRow = null;

  function selectDirectionalCluster(
    clusters,
    predicate
  ) {
    return (
      clusters
        .map(
          cluster => {
            const selected =
              cluster.filter(
                run =>
                  predicate(
                    run.rgb
                  )
              );

            return {
              cluster:
                selected,

              score:
                selected.length >= 3
                  ? clusterScore(
                      selected
                    )
                  : -Infinity
            };
          }
        )
        .filter(
          item =>
            item.cluster.length >= 3
        )
        .sort(
          (a, b) =>
            b.score
            - a.score
        )[0]
      ?? null
    );
  }

  for (
    let y = footerStart;
    y < height;
    y++
  ) {
    const runs =
      candidateRuns(
        imageData,
        y
      );

    const clusters =
      clusterByGap(
        runs
      );

    const blue =
      selectDirectionalCluster(
        clusters,
        isBlue
      );

    const warm =
      selectDirectionalCluster(
        clusters,
        isWarm
      );

    const neutrals =
      runs.filter(
        run =>
          isNeutral(
            run.rgb
          )
      );

    const score =
      (
        blue
          ?.score
        ?? 0
      )
      + (
        warm
          ?.score
        ?? 0
      )
      + neutrals.length
        * 50;

    if (
      !bestRow
      || score
        > bestRow.score
    ) {
      bestRow = {
        y,
        footerStart,
        score,

        towards:
          blue
            ?.cluster
          ?? [],

        away:
          warm
            ?.cluster
          ?? [],

        neutral:
          neutrals
      };
    }
  }

  return bestRow;
}

function createCrop(
  sourceCanvas,
  {
    x0,
    x1,
    y0,
    y1,
    scale = 1
  }
) {
  const sourceX0 =
    Math.max(
      0,
      Math.floor(
        x0
      )
    );

  const sourceX1 =
    Math.min(
      sourceCanvas.width - 1,
      Math.ceil(
        x1
      )
    );

  const sourceY0 =
    Math.max(
      0,
      Math.floor(
        y0
      )
    );

  const sourceY1 =
    Math.min(
      sourceCanvas.height - 1,
      Math.ceil(
        y1
      )
    );

  const width =
    sourceX1
    - sourceX0
    + 1;

  const height =
    sourceY1
    - sourceY0
    + 1;

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    width
    * scale;

  canvas.height =
    height
    * scale;

  const context =
    canvas.getContext(
      "2d"
    );

  context.imageSmoothingEnabled =
    false;

  context.drawImage(
    sourceCanvas,
    sourceX0,
    sourceY0,
    width,
    height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas;
}

function boundsForRuns(
  runs
) {
  if (!runs.length) {
    return null;
  }

  return {
    minX:
      Math.min(
        ...runs.map(
          run =>
            run.start
        )
      ),

    maxX:
      Math.max(
        ...runs.map(
          run =>
            run.end
        )
      )
  };
}

export function buildPaletteDiagnostic(
  sourceCanvas
) {
  const context =
    sourceCanvas.getContext(
      "2d",
      {
        willReadFrequently:
          true
      }
    );

  const imageData =
    context.getImageData(
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height
    );

  const palette =
    locateFullVelocityPalette(
      imageData
    );

  if (!palette) {
    throw new Error(
      "Unable to locate Bureau Doppler palette in footer."
    );
  }

  const footerOverview =
    createCrop(
      sourceCanvas,
      {
        x0:
          0,

        x1:
          sourceCanvas.width - 1,

        y0:
          palette.footerStart,

        y1:
          sourceCanvas.height - 1,

        scale:
          2
      }
    );

  const towardsBounds =
    boundsForRuns(
      palette.towards
    );

  const awayBounds =
    boundsForRuns(
      palette.away
    );

  const towardsCrop =
    towardsBounds
      ? createCrop(
          sourceCanvas,
          {
            x0:
              towardsBounds.minX - 12,

            x1:
              towardsBounds.maxX + 12,

            y0:
              palette.y - 4,

            y1:
              sourceCanvas.height - 1,

            scale:
              8
          }
        )
      : null;

  const awayCrop =
    awayBounds
      ? createCrop(
          sourceCanvas,
          {
            x0:
              awayBounds.minX - 12,

            x1:
              awayBounds.maxX + 12,

            y0:
              palette.y - 4,

            y1:
              sourceCanvas.height - 1,

            scale:
              8
          }
        )
      : null;

  return {
    palette,
    footerOverview,
    towardsCrop,
    awayCrop
  };
}
