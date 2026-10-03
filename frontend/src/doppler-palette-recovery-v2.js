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

function isChromatic(
  rgba
) {
  const [
    r,
    g,
    b,
    a
  ] = rgba;

  if (a === 0) {
    return false;
  }

  const maximum =
    Math.max(
      r,
      g,
      b
    );

  const minimum =
    Math.min(
      r,
      g,
      b
    );

  return (
    maximum >= 70
    && maximum - minimum >= 30
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
        current,
        previous
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
      rgba:
        previous
    });

    start =
      x;

    previous =
      current;
  }

  return runs;
}

function coefficientOfVariation(
  values
) {
  if (
    !values.length
  ) {
    return Infinity;
  }

  const mean =
    values.reduce(
      (a, b) =>
        a + b,
      0
    )
    / values.length;

  if (!(mean > 0)) {
    return Infinity;
  }

  const variance =
    values.reduce(
      (sum, value) =>
        sum
        + (
          value - mean
        ) ** 2,
      0
    )
    / values.length;

  return (
    Math.sqrt(
      variance
    )
    / mean
  );
}

function candidateClusters(
  runs
) {
  const eligible =
    runs.filter(
      run =>
        run.width >= 4
        && run.width <= 40
        && isChromatic(
          run.rgba
        )
    );

  if (!eligible.length) {
    return [];
  }

  const clusters = [];

  let current = [
    eligible[0]
  ];

  for (
    let index = 1;
    index < eligible.length;
    index++
  ) {
    const previous =
      current.at(-1);

    const next =
      eligible[index];

    const gap =
      next.start
      - previous.end
      - 1;

    // The Bureau palette is a contiguous chain of rectangular swatches.
    // Allow only tiny separator/border gaps.
    if (gap <= 3) {
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

function scoreCluster(
  cluster
) {
  if (
    cluster.length < 6
  ) {
    return -Infinity;
  }

  const widths =
    cluster.map(
      run =>
        run.width
    );

  const widthCv =
    coefficientOfVariation(
      widths
    );

  const span =
    cluster.at(-1).end
    - cluster[0].start
    + 1;

  const directionalColours =
    cluster.filter(
      run => {
        const [
          r,
          g,
          b
        ] = run.rgb;

        return (
          b > r + 25
          || r > b + 25
          || (
            r > 180
            && g > 130
            && b < 120
          )
        );
      }
    ).length;

  return (
    cluster.length * 120
    + span
    + directionalColours * 35
    - widthCv * 350
  );
}

export function locateVelocityBar(
  imageData
) {
  const {
    height
  } = imageData;

  const searchStart =
    Math.max(
      0,
      height - 95
    );

  let best = null;

  for (
    let y = searchStart;
    y < height;
    y++
  ) {
    const runs =
      rowRuns(
        imageData,
        y
      );

    for (
      const cluster
      of candidateClusters(
        runs
      )
    ) {
      const score =
        scoreCluster(
          cluster
        );

      if (
        !best
        || score > best.score
      ) {
        best = {
          y,
          score,
          runs:
            cluster,
          minX:
            cluster[0].start,
          maxX:
            cluster.at(-1).end
        };
      }
    }
  }

  return best;
}

export function createFooterCrop(
  sourceCanvas,
  bar,
  {
    scale = 8
  } = {}
) {
  if (!bar) {
    return null;
  }

  const x0 =
    Math.max(
      0,
      bar.minX - 12
    );

  const x1 =
    Math.min(
      sourceCanvas.width - 1,
      bar.maxX + 12
    );

  // Include both the bar and all Bureau text beneath it.
  const y0 =
    Math.max(
      0,
      bar.y - 18
    );

  const y1 =
    Math.min(
      sourceCanvas.height - 1,
      bar.y + 52
    );

  const cropWidth =
    x1 - x0 + 1;

  const cropHeight =
    y1 - y0 + 1;

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    cropWidth * scale;

  canvas.height =
    cropHeight * scale;

  const context =
    canvas.getContext(
      "2d"
    );

  context.imageSmoothingEnabled =
    false;

  context.drawImage(
    sourceCanvas,
    x0,
    y0,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return {
    canvas,
    crop: {
      x0,
      x1,
      y0,
      y1,
      scale
    }
  };
}

export function analyseVelocityPalette(
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

  const bar =
    locateVelocityBar(
      imageData
    );

  if (!bar) {
    return {
      bar: null,
      footer: null
    };
  }

  return {
    bar,
    footer:
      createFooterCrop(
        sourceCanvas,
        bar
      )
  };
}
