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

function isColourCandidate(
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

  const spread =
    maximum
    - minimum;

  // Reject black/white/grey map text and footer background.
  return (
    maximum >= 80
    && spread >= 35
  );
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

  const raw = [];

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

    raw.push({
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

  return raw;
}

export function locateEmbeddedLegend(
  imageData
) {
  const {
    width,
    height
  } = imageData;

  const searchStart =
    Math.max(
      0,
      height - 100
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

    const candidates =
      runs.filter(
        run =>
          run.width >= 3
          && isColourCandidate(
            run.rgba
          )
      );

    if (!candidates.length) {
      continue;
    }

    const colourWidth =
      candidates.reduce(
        (
          sum,
          run
        ) =>
          sum + run.width,
        0
      );

    const longRuns =
      candidates.filter(
        run =>
          run.width >= 8
      );

    // The embedded BOM velocity bar is the strongest sequence of
    // long, saturated horizontal runs in the footer.
    const score =
      colourWidth
      + longRuns.length * 25;

    if (
      !best
      || score > best.score
    ) {
      best = {
        y,
        score,
        runs:
          candidates
      };
    }
  }

  if (!best) {
    return null;
  }

  // Keep only meaningful swatches around the long colour bar.
  const substantial =
    best.runs.filter(
      run =>
        run.width >= 5
    );

  if (!substantial.length) {
    return best;
  }

  const minX =
    Math.max(
      0,
      Math.min(
        ...substantial.map(
          run => run.start
        )
      ) - 18
    );

  const maxX =
    Math.min(
      width - 1,
      Math.max(
        ...substantial.map(
          run => run.end
        )
      ) + 18
    );

  return {
    ...best,
    minX,
    maxX,
    runs:
      substantial
  };
}

export function createEnlargedLegendCanvas(
  sourceCanvas,
  legend,
  {
    scale = 4
  } = {}
) {
  if (!legend) {
    return null;
  }

  const sourceWidth =
    sourceCanvas.width;

  const sourceHeight =
    sourceCanvas.height;

  const x0 =
    legend.minX
    ?? 0;

  const x1 =
    legend.maxX
    ?? (
      sourceWidth - 1
    );

  const y0 =
    Math.max(
      0,
      legend.y - 12
    );

  const y1 =
    sourceHeight - 1;

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

  return canvas;
}

export function analyseDopplerLegend(
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

  const legend =
    locateEmbeddedLegend(
      imageData
    );

  return {
    legend,

    enlargedCanvas:
      createEnlargedLegendCanvas(
        sourceCanvas,
        legend
      )
  };
}
