function dopplerDisplayColour(
  velocity
) {
  const value =
    Number(
      velocity
    );

  if (
    value < 0
  ) {
    const strength =
      Math.min(
        1,
        Math.abs(
          value
        ) / 70
      );

    return Cesium.Color
      .fromHsl(
        0.56,
        0.95,
        0.72
          - strength * 0.32,
        0.78
      );
  }

  const strength =
    Math.min(
      1,
      value / 70
    );

  return Cesium.Color
    .fromHsl(
      0.13
        - strength * 0.12,
      0.95,
      0.62
        - strength * 0.18,
      0.78
    );
}

function clearDopplerOverlay() {
  if (
    dopplerOverlayCollection
  ) {
    scene.primitives.remove(
      dopplerOverlayCollection
    );

    dopplerOverlayCollection =
      null;
  }

  const count =
    $("dopplerOverlayCount");

  if (count) {
    count.textContent =
      "0";
  }
}

async function decodeHistoricalDopplerFrame(
  radarId,
  frameDescriptor
) {
  const key =
    `${radarId}:${frameDescriptor.filename}`;

  if (
    dopplerFrameCache
      .has(
        key
      )
  ) {
    return dopplerFrameCache
      .get(
        key
      );
  }

  const promise =
    (
      async () => {
        const source =
          await loadDopplerFrame(
            radarId,
            frameDescriptor
          );

        const palette =
          dopplerPalettes
            .get(
              String(
                radarId
              )
            );

        if (!palette) {
          throw new Error(
            `No calibrated Doppler palette for radar ${radarId}.`
          );
        }

        const decoded =
          geolocatedHistoricalDopplerSamples(
            radarId,
            canvasImageData(
              source.canvas
            ),
            palette,
            {
              stride:
                1,

              includeZero:
                false
            }
          );

        return {
          radarId:
            String(
              radarId
            ),

          product:
            source.product,

          observedUtc:
            source.observedUtc
            ?? frameDescriptor.observedUtc,

          timeBasis:
            source.timeSource
            ?? "bom-history-filename-utc",

          filename:
            frameDescriptor.filename,

          validPixelCount:
            decoded.validPixelCount,

          nonZeroPixelCount:
            decoded.nonZeroPixelCount,

          samples:
            decoded.samples
        };
      }
    )();

  dopplerFrameCache.set(
    key,
    promise
  );

  try {
    return await promise;
  } catch (error) {
    dopplerFrameCache.delete(
      key
    );

    throw error;
  }
}

async function loadDopplerHistoriesAndPalettes() {
  const radarIds =
    [
      "66",
      "50",
      "08"
    ];

  const settled =
    await Promise.allSettled(
      radarIds.map(
        async radarId => {
          const [
            history,
            latest
          ] =
            await Promise.all([
              loadDopplerHistory(
                radarId
              ),

              loadDopplerDiagnostic(
                radarId
              )
            ]);

          const palette =
            paletteFromLatestDopplerImage(
              canvasImageData(
                latest.canvas
              )
            );

          return {
            radarId,
            history,
            palette
          };
        }
      )
    );

  dopplerHistories =
    new Map();

  dopplerPalettes =
    new Map();

  for (
    const result
    of settled
  ) {
    if (
      result.status
      !== "fulfilled"
    ) {
      continue;
    }

    dopplerHistories.set(
      result.value.radarId,
      result.value.history
    );

    dopplerPalettes.set(
      result.value.radarId,
      result.value.palette
    );
  }
}

async function buildDopplerStateForFrame(
  frameIndex
) {
  const frame =
    hybridFrames[
      frameIndex
    ];

  const result =
    hybridResults[
      frameIndex
    ];

  const segmentation =
    result
      ?.segmentations
      ?.[0];

  if (
    !frame
    || !segmentation
  ) {
    return null;
  }

  const radarIds =
    [
      "66",
      "50",
      "08"
    ];

  const pairings =
    radarIds.map(
      radarId => {
        const history =
          dopplerHistories
            .get(
              radarId
            );

        return {
          radarId,

          ...nearestDopplerFrameForTime(
            history?.frames
            ?? [],
            frame.observedUtc,
            8
          )
        };
      }
    );

  const loadResults =
    await Promise.allSettled(
      pairings.map(
        pairing => {
          if (
            !pairing.matched
            || !pairing.candidate
          ) {
            return Promise.resolve({
              radarId:
                pairing.radarId,

              observedUtc:
                pairing.candidate
                  ?.observedUtc
                ?? null,

              timeBasis:
                "bom-history-filename-utc",

              filename:
                pairing.candidate
                  ?.filename
                ?? null,

              samples:
                []
            });
          }

          return decodeHistoricalDopplerFrame(
            pairing.radarId,
            pairing.candidate
          );
        }
      )
    );

  const records =
    [];

  let sourceFailures =
    0;

  for (
    let index = 0;
    index < pairings.length;
    index++
  ) {
    const pairing =
      pairings[
        index
      ];

    const load =
      loadResults[
        index
      ];

    if (
      load.status
      === "fulfilled"
    ) {
      records.push(
        load.value
      );
    } else {
      sourceFailures++;

      records.push({
        radarId:
          pairing.radarId,

        observedUtc:
          pairing.candidate
            ?.observedUtc
          ?? null,

        timeBasis:
          "bom-history-filename-utc",

        filename:
          pairing.candidate
            ?.filename
          ?? null,

        samples:
          []
      });
    }
  }

  const context =
    buildTrackDopplerContexts({
      frame,

      segmentation,

      tracks:
        result?.tracks
        ?? [],

      dopplerRecords:
        records,

      maxTimeDeltaMinutes:
        8,

      minimumSamples:
        3
    });

  return {
    frameIndex,

    reflectivityUtc:
      frame.observedUtc,

    pairings,

    records,

    context,

    sourceFailures
  };
}

async function buildDopplerSequence() {
  await loadDopplerHistoriesAndPalettes();

  dopplerFrameCache =
    new Map();

  const states =
    [];

  for (
    let frameIndex = 0;
    frameIndex < hybridFrames.length;
    frameIndex++
  ) {
    states.push(
      await buildDopplerStateForFrame(
        frameIndex
      )
    );
  }

  hybridDopplerFrameStates =
    states;
}

function dopplerStateForFrame(
  index
) {
  return (
    hybridDopplerFrameStates[
      index
    ]
    ?? null
  );
}

function dopplerContextForTrack(
  index,
  trackId
) {
  return (
    dopplerStateForFrame(
      index
    )
      ?.context
      ?.contextByTrack
      ?.get(
        trackId
      )
    ?? null
  );
}

function selectedDopplerRecord(
  index
) {
  const radarId =
    $("dopplerOverlayRadar")
      ?.value
    ?? "66";

  const state =
    dopplerStateForFrame(
      index
    );

  if (!state) {
    return null;
  }

  const pairing =
    state.pairings
      .find(
        item =>
          item.radarId
          === radarId
      );

  if (
    !pairing
    || !pairing.matched
  ) {
    return null;
  }

  return (
    state.records
      .find(
        record =>
          record.radarId
          === radarId
          && record.samples
            ?.length
      )
    ?? null
  );
}

function formatDopplerUtc(
  value
) {
  if (!value) {
    return "timestamp unavailable";
  }

  return value
    .replace(
      "T",
      " "
    )
    .replace(
      ":00.000Z",
      " UTC"
    )
    .replace(
      ".000Z",
      " UTC"
    );
}

function renderDopplerOverlay() {
  clearDopplerOverlay();

  const status =
    $("dopplerOverlayStatus");

  if (
    !$("showDopplerOverlay")
      ?.checked
  ) {
    if (status) {
      status.textContent =
        "hidden";
    }

    return;
  }

  const state =
    dopplerStateForFrame(
      hybridFrameIndex
    );

  if (!state) {
    if (status) {
      status.textContent =
        "Doppler sequence not loaded";
    }

    return;
  }

  const radarId =
    $("dopplerOverlayRadar")
      ?.value
    ?? "66";

  const pairing =
    state.pairings
      .find(
        item =>
          item.radarId
          === radarId
      );

  if (
    !pairing
    || !pairing.candidate
  ) {
    if (status) {
      status.textContent =
        `${radarId} — no historical frame`;
    }

    return;
  }

  if (
    !pairing.matched
  ) {
    if (status) {
      status.textContent =
        `${radarId} — NO MATCH (Δ${pairing.deltaMinutes.toFixed(1)} min)`;
    }

    return;
  }

  const record =
    selectedDopplerRecord(
      hybridFrameIndex
    );

  if (!record) {
    if (status) {
      status.textContent =
        `${radarId} — matched frame failed to decode`;
    }

    return;
  }

  dopplerOverlayCollection =
    scene.primitives.add(
      new Cesium
        .PointPrimitiveCollection()
    );

  let rendered =
    0;

  for (
    const sample
    of record.samples
  ) {
    dopplerOverlayCollection.add({
      position:
        Cesium.Cartesian3
          .fromDegrees(
            sample.longitude,
            sample.latitude,
            180
          ),

      color:
        dopplerDisplayColour(
          sample.velocity_kmh
        ),

      pixelSize:
        3,

      disableDepthTestDistance:
        Number.POSITIVE_INFINITY
    });

    rendered++;
  }

  $("dopplerOverlayCount")
    .textContent =
      rendered
        .toLocaleString();

  if (status) {
    status.textContent =
      `${radarId} ${formatDopplerUtc(record.observedUtc)} ` +
      `(Δ${pairing.deltaMinutes.toFixed(1)} min)`;
  }

  scene.requestRender();
}

function updateDopplerUiForFrame(
  index
) {
  const state =
    dopplerStateForFrame(
      index
    );

  if (!state) {
    $("dopplerRadarsLoaded")
      .textContent =
        "0";

    $("dopplerRadarsMatched")
      .textContent =
        "0";

    $("dopplerTracksMatched")
      .textContent =
        "0";

    $("dopplerFailures")
      .textContent =
        "0";

    $("dopplerFrameTime")
      .textContent =
        "—";

    $("dopplerSourceRows")
      .innerHTML =
        '<div class="hybrid-muted">Doppler sequence not loaded.</div>';

    renderDopplerOverlay();

    return;
  }

  const matched =
    state.pairings
      .filter(
        pairing =>
          pairing.matched
      )
      .length;

  const loaded =
    state.records
      .filter(
        record =>
          record.samples
            ?.length
      )
      .length;

  $("dopplerRadarsLoaded")
    .textContent =
      String(
        loaded
      );

  $("dopplerRadarsMatched")
    .textContent =
      String(
        matched
      );

  $("dopplerTracksMatched")
    .textContent =
      String(
        state.context
          ?.tracks_with_doppler
        ?? 0
      );

  $("dopplerFailures")
    .textContent =
      String(
        state.sourceFailures
      );

  $("dopplerFrameTime")
    .textContent =
      formatDopplerUtc(
        state.reflectivityUtc
      );

  $("dopplerSourceRows")
    .innerHTML =
      state.pairings
        .map(
          pairing => {
            const candidate =
              pairing.candidate;

            const delta =
              pairing.deltaMinutes;

            const matchText =
              pairing.matched
                ? "MATCH"
                : "NO MATCH";

            return (
              `<div class="track-volume-row">` +
                `<div>` +
                  `<strong>Radar ${pairing.radarId}</strong>` +
                  `<span>${formatDopplerUtc(candidate?.observedUtc)}</span>` +
                  `<span>${
                    delta == null
                      ? "delta —"
                      : `Δ${delta.toFixed(1)} min`
                  }</span>` +
                  `<span>${matchText}</span>` +
                `</div>` +
                `<div>` +
                  `<span>timestamp: BOM history filename UTC</span>` +
                  `<span>${candidate?.filename ?? "no historical candidate"}</span>` +
                `</div>` +
              `</div>`
            );
          }
        )
        .join("");

  renderDopplerOverlay();
}

