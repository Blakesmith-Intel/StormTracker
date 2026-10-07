export const IDLE_GLOBE_SSE = 4;
export const INTERACTION_GLOBE_SSE = 8;

export function createCameraPerformanceGovernor({
  globe,
  scene,
  idleScreenSpaceError = IDLE_GLOBE_SSE,
  interactionScreenSpaceError = INTERACTION_GLOBE_SSE,
  settleMs = 160,
  schedule = setTimeout,
  cancel = clearTimeout
}) {
  if (!globe) {
    throw new TypeError(
      "Camera performance governor requires a globe."
    );
  }

  let timer = null;
  let active = false;

  function applyScreenSpaceError(value) {
    if (
      globe.maximumScreenSpaceError
      !== value
    ) {
      globe.maximumScreenSpaceError =
        value;

      scene?.requestRender?.();
    }
  }

  function restore() {
    if (timer != null) {
      cancel(timer);
      timer = null;
    }

    active = false;

    applyScreenSpaceError(
      idleScreenSpaceError
    );
  }

  function pulse() {
    active = true;

    applyScreenSpaceError(
      interactionScreenSpaceError
    );

    if (timer != null) {
      cancel(timer);
    }

    timer =
      schedule(
        () => {
          timer = null;
          active = false;

          applyScreenSpaceError(
            idleScreenSpaceError
          );
        },
        settleMs
      );
  }

  return {
    pulse,
    restore,

    get active() {
      return active;
    }
  };
}
