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
  scene = null,
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
  let stagedLayer = null;
  let stageGeneration = 0;
  function cancelStage() {
    stageGeneration++;
    if (stagedLayer) {
      removeLayer(stagedLayer);
      stagedLayer = null;
    }
  }

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

    cancelStage();
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

    if (typeof imageryLayers.indexOf !== "function" || imageryLayers.indexOf(layer)<0)
      imageryLayers.add(layer);

    managedLayers.add(
      layer
    );

    // Prepared wind imagery is staged UNDER the previous native scan.
    // At presentation time it must move ABOVE that scan so a top-only
    // fade can preserve 100% combined coverage across the transition.
    if(previousLayer && nextAlpha===1 && typeof imageryLayers.raiseToTop==="function")
      imageryLayers.raiseToTop(layer);

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
        nextAlpha===1 ? 1 : previousStartAlpha*(1-progress);

      // Full-opacity standalone wind frames composite OVER the existing
      // fully opaque source. The basemap never shines through at mid-fade.
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
    cancelStage();
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

  // Pre-stage a decoded genuine BoM wind tile UNDER the previous one.
  // The outgoing Doppler stays fully visible during loading. Only after
  // Cesium has rendered the staged texture do we begin a brief crossfade.
  async function replacePrepared({layer,key,alpha=targetAlpha,
    durationMs=DEFAULT_DOPPLER_CROSSFADE_MS,onAdded=()=>{},
    timeoutMs=900}={}) {
    if (!layer) throw new TypeError("Prepared Doppler layer required");
    if (currentLayer && currentKey===key)
      return replace({layer,key,alpha,durationMs,onAdded});
    if (!currentLayer || !scene?.postRender?.addEventListener ||
        typeof imageryLayers.indexOf!=="function")
      return replace({layer,key,alpha,durationMs,onAdded});
    cancelStage();
    // On a rapid playback step, finish the outgoing scan at the selected
    // opacity before preparing another transition. Otherwise cancelling a
    // half-finished blend can expose the basemap through both wind layers.
    cancelAnimation();
    removeStaleLayers(currentLayer);
    if(currentLayer) currentLayer.alpha=targetAlpha;
    const token=stageGeneration;
    stagedLayer=layer;
    layer.alpha=0.001;
    imageryLayers.add(layer,Math.max(0,imageryLayers.indexOf(currentLayer)));
    requestRender();
    const ready=await new Promise(resolve=>{
      let settled=false,frames=0,timeout,remove=()=>{};
      const finish=value=>{
        if(settled)return;
        settled=true;remove();clearTimeout(timeout);resolve(value);
      };
      remove=scene.postRender.addEventListener(()=>{
        if(token!==stageGeneration){finish(false);return;}
        if(++frames>=3){finish(true);return;}
        requestRender();
      });
      timeout=setTimeout(()=>finish(false),timeoutMs);
      requestRender();
    });
    if(token!==stageGeneration)return {changed:false,cancelled:true};
    stagedLayer=null;
    if(!ready){
      removeLayer(layer);
      return {changed:false,ready:false};
    }
    return replace({layer,key,alpha,durationMs,onAdded});
  }

  return {
    replace,
    replacePrepared,
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
