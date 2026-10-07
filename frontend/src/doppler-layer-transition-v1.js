export const DEFAULT_DOPPLER_CROSSFADE_MS =
  180;

export const DEFAULT_DOPPLER_FADE_OUT_MS =
  120;

export function dopplerOverlayFrameKey(
  radarId,
  record
) {
  if (!record) {
    return null;
  }

  const identity =
    record.filename
    ?? record.observedUtc
    ?? record.product
    ?? null;

  if (!identity) {
    return null;
  }

  return `${String(radarId)}:${String(identity)}`;
}

export function transitionProgress(
  elapsedMs,
  durationMs
) {
  const duration =
    Math.max(
      1,
      Number(durationMs) || 1
    );

  return Math.max(
    0,
    Math.min(
      1,
      Number(elapsedMs) / duration
    )
  );
}

export function createDopplerLayerTransition({
  imageryLayers,
  requestRender = () => {},
  requestFrame =
    callback =>
      globalThis.requestAnimationFrame(
        callback
      ),
  cancelFrame =
    handle =>
      globalThis.cancelAnimationFrame(
        handle
      ),
  now =
    () =>
      globalThis.performance?.now?.()
      ?? Date.now()
}) {
  if (!imageryLayers) {
    throw new TypeError(
      "Doppler layer transition requires an imagery collection."
    );
  }

  let currentLayer = null;
  let currentKey = null;
  let targetAlpha = 1;
  let animationHandle = null;
  let animationGeneration = 0;
  const managedLayers =
    new Set();

  function removeLayer(
    layer
  ) {
    if (!layer) {
      return;
    }

    managedLayers.delete(
      layer
    );

    try {
      imageryLayers.remove(
        layer,
        true
      );
    } catch {
      // Layer may already have been removed by a view reset.
    }
  }

  function cancelAnimation() {
    animationGeneration++;

    if (animationHandle != null) {
      cancelFrame(
        animationHandle
      );

      animationHandle = null;
    }
  }

  function removeStaleLayers(
    keep = null
  ) {
    for (
      const layer
      of [...managedLayers]
    ) {
      if (layer !== keep) {
        removeLayer(
          layer
        );
      }
    }
  }

  function setOpacity(
    alpha
  ) {
    targetAlpha =
      Math.max(
        0,
        Math.min(
          1,
          Number(alpha)
        )
      );

    if (
      currentLayer
      && animationHandle == null
    ) {
      currentLayer.alpha =
        targetAlpha;

      requestRender();
    }
  }

  function replace({
    layer,
    key,
    alpha =
      targetAlpha,
    durationMs =
      DEFAULT_DOPPLER_CROSSFADE_MS,
    onAdded = () => {}
  }) {
    if (!layer) {
      throw new TypeError(
        "Replacement Doppler imagery layer is required."
      );
    }

    const nextAlpha =
      Math.max(
        0,
        Math.min(
          1,
          Number(alpha)
        )
      );

    if (
      currentLayer
      && currentKey === key
    ) {
      currentLayer.alpha =
        nextAlpha;

      targetAlpha =
        nextAlpha;

      requestRender();

      return {
        changed:
          false,
        layer:
          currentLayer
      };
    }

    cancelAnimation();

    // If rapid playback interrupted the previous blend, preserve the most recent
    // layer as the only starting point before beginning the next transition.
    removeStaleLayers(
      currentLayer
    );

    const previousLayer =
      currentLayer;

    targetAlpha =
      nextAlpha;

    layer.alpha =
      previousLayer
        ? 0
        : nextAlpha;

    imageryLayers.add(
      layer
    );

    managedLayers.add(
      layer
    );

    currentLayer =
      layer;

    currentKey =
      key;

    onAdded(
      layer
    );

    if (
      !previousLayer
      || durationMs <= 0
    ) {
      layer.alpha =
        nextAlpha;

      removeLayer(
        previousLayer
      );

      requestRender();

      return {
        changed:
          true,
        layer
      };
    }

    const generation =
      animationGeneration;

    const startedAt =
      now();

    const previousStartAlpha =
      Number.isFinite(
        previousLayer.alpha
      )
        ? previousLayer.alpha
        : nextAlpha;

    function step(
      timestamp
    ) {
      if (
        generation
        !== animationGeneration
      ) {
        return;
      }

      const progress =
        transitionProgress(
          Number.isFinite(timestamp)
            ? timestamp - startedAt
            : now() - startedAt,
          durationMs
        );

      layer.alpha =
        nextAlpha
        * progress;

      previousLayer.alpha =
        previousStartAlpha
        * (1 - progress);

      requestRender();

      if (progress < 1) {
        animationHandle =
          requestFrame(
            step
          );

        return;
      }

      animationHandle =
        null;

      layer.alpha =
        nextAlpha;

      removeLayer(
        previousLayer
      );

      removeStaleLayers(
        layer
      );

      requestRender();
    }

    animationHandle =
      requestFrame(
        step
      );

    return {
      changed:
        true,
      layer
    };
  }

  function clear({
    durationMs =
      0
  } = {}) {
    cancelAnimation();

    removeStaleLayers(
      currentLayer
    );

    const layer =
      currentLayer;

    currentLayer =
      null;

    currentKey =
      null;

    if (!layer) {
      return;
    }

    if (durationMs <= 0) {
      removeLayer(
        layer
      );

      requestRender();

      return;
    }

    const generation =
      animationGeneration;

    const startedAt =
      now();

    const startAlpha =
      Number.isFinite(
        layer.alpha
      )
        ? layer.alpha
        : targetAlpha;

    function step(
      timestamp
    ) {
      if (
        generation
        !== animationGeneration
      ) {
        return;
      }

      const progress =
        transitionProgress(
          Number.isFinite(timestamp)
            ? timestamp - startedAt
            : now() - startedAt,
          durationMs
        );

      layer.alpha =
        startAlpha
        * (1 - progress);

      requestRender();

      if (progress < 1) {
        animationHandle =
          requestFrame(
            step
          );

        return;
      }

      animationHandle =
        null;

      removeLayer(
        layer
      );

      requestRender();
    }

    animationHandle =
      requestFrame(
        step
      );
  }

  return {
    replace,
    clear,
    setOpacity,

    get currentLayer() {
      return currentLayer;
    },

    get currentKey() {
      return currentKey;
    }
  };
}
