const EARTH_RADIUS_M = 6371008.8;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function wrapLongitude(longitude) {
  let value = Number(longitude);
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}

function wrapHeading(heading) {
  const twoPi = Math.PI * 2;
  let value = Number(heading) % twoPi;
  if (value < 0) value += twoPi;
  return value;
}

export function panTargetByScreenPixels(
  state,
  dx,
  dy,
  metresPerPixel
) {
  const heading = Number(state.heading);

  const eastMetres =
    (
      -Number(dx) * Math.cos(heading)
      + Number(dy) * Math.sin(heading)
    ) * metresPerPixel;

  const northMetres =
    (
      Number(dx) * Math.sin(heading)
      + Number(dy) * Math.cos(heading)
    ) * metresPerPixel;

  const latitudeRadians =
    Number(state.latitude) * Math.PI / 180;

  const latitude =
    Number(state.latitude)
    + (northMetres / EARTH_RADIUS_M) * 180 / Math.PI;

  const cosLatitude =
    Math.max(0.05, Math.cos(latitudeRadians));

  const longitude =
    Number(state.longitude)
    + (
        eastMetres
        / (EARTH_RADIUS_M * cosLatitude)
      )
      * 180
      / Math.PI;

  return {
    ...state,
    longitude: wrapLongitude(longitude),
    latitude: clamp(latitude, -85, 85)
  };
}

export function orbitStateByPixels(
  state,
  dx,
  dy,
  {
    headingRadiansPerPixel = 0.0055,
    pitchRadiansPerPixel = 0.0045,
    minimumPitchRadians = -Math.PI / 2 + 0.01,
    maximumPitchRadians = -0.12
  } = {}
) {
  return {
    ...state,
    heading: wrapHeading(
      Number(state.heading)
      + Number(dx) * headingRadiansPerPixel
    ),
    pitch: clamp(
      Number(state.pitch)
      + Number(dy) * pitchRadiansPerPixel,
      minimumPitchRadians,
      maximumPitchRadians
    )
  };
}

export function classifyWheelDelta(
  deltaY,
  deltaMode = 0
) {
  const value =
    Number(
      deltaY
    );

  if (
    !Number.isFinite(
      value
    )
    || value === 0
  ) {
    return {
      mode:"none",
      steps:0
    };
  }

  const direction =
    value < 0
      ? -1
      : 1;

  const magnitude =
    Math.abs(
      value
    );

  if (
    deltaMode === 1
  ) {
    return {
      mode:"discrete",
      steps:
        direction
        * Math.max(
            1,
            Math.min(
              6,
              Math.round(
                magnitude / 3
              )
            )
          )
    };
  }

  if (
    deltaMode === 2
  ) {
    return {
      mode:"discrete",
      steps:
        direction
    };
  }

  if (
    magnitude >= 80
  ) {
    return {
      mode:"discrete",
      steps:
        direction
        * Math.max(
            1,
            Math.min(
              6,
              Math.round(
                magnitude / 100
              )
            )
          )
    };
  }

  return {
    mode:"smooth",
    steps:
      direction
  };
}

export function zoomStateByDirection(
  state,
  direction,
  {
    zoomInFactor = 0.82,
    zoomOutFactor = 1.22,
    minimumRange = 800,
    maximumRange = 5000000
  } = {}
) {
  const factor =
    direction < 0
      ? zoomInFactor
      : zoomOutFactor;

  return {
    ...state,
    range: clamp(
      Number(state.range) * factor,
      minimumRange,
      maximumRange
    )
  };
}

function cloneState(state) {
  return {
    longitude: Number(state.longitude),
    latitude: Number(state.latitude),
    targetHeight: Number(state.targetHeight ?? 0),
    range: Number(state.range),
    heading: Number(state.heading ?? 0),
    pitch: Number(
      state.pitch ?? (-Math.PI / 2 + 0.01)
    )
  };
}

export function createStormTrackerCameraController({
  viewer,
  container,
  home,
  minimumRange = 800,
  maximumRange = 5000000,
  wheelGestureQuietMs = 180,
  onUnexpectedCorrection = null,
  onInteraction = () => {}
}) {
  if (!viewer || !container) {
    throw new Error("viewer and container are required.");
  }

  const scene = viewer.scene;
  const camera = viewer.camera;
  const nativeController =
    scene.screenSpaceCameraController;

  scene.requestRenderMode = true;
  scene.maximumRenderTimeChange = Infinity;

  nativeController.enableInputs = false;
  nativeController.enableRotate = false;
  nativeController.enableTranslate = false;
  nativeController.enableZoom = false;
  nativeController.enableTilt = false;
  nativeController.enableLook = false;

  nativeController.inertiaSpin = 0;
  nativeController.inertiaTranslate = 0;
  nativeController.inertiaZoom = 0;
  nativeController.bounceAnimationTime = 0;
  nativeController.minimumZoomDistance = minimumRange;
  nativeController.maximumZoomDistance = maximumRange;

  container.style.touchAction = "none";
  container.style.overscrollBehavior = "none";

  let state = cloneState(home);
  let stableCamera = null;
  let applyingState = false;
  let restoringCamera = false;
  let destroyed = false;
  let correctionCount = 0;
  let activePointer = null;
  let wheelGestureOpen = false;
  let wheelQuietTimer = null;

  function snapshotCamera() {
    stableCamera = {
      position: Cesium.Cartesian3.clone(
        camera.positionWC
      ),
      heading: camera.heading,
      pitch: camera.pitch,
      roll: camera.roll
    };
  }

  function angleDifference(a, b) {
    const twoPi = Math.PI * 2;
    let difference = Math.abs(a - b) % twoPi;
    if (difference > Math.PI) {
      difference = twoPi - difference;
    }
    return difference;
  }

  function cameraMovedUnexpectedly() {
    if (!stableCamera) return false;

    return (
      Cesium.Cartesian3.distance(
        camera.positionWC,
        stableCamera.position
      ) > 0.05
      || angleDifference(
        camera.heading,
        stableCamera.heading
      ) > 1e-7
      || angleDifference(
        camera.pitch,
        stableCamera.pitch
      ) > 1e-7
      || angleDifference(
        camera.roll,
        stableCamera.roll
      ) > 1e-7
    );
  }

  function restoreUnexpectedMotion() {
    if (
      destroyed
      || applyingState
      || restoringCamera
      || !stableCamera
      || !cameraMovedUnexpectedly()
    ) {
      return;
    }

    restoringCamera = true;

    try {
      camera.cancelFlight();

      camera.setView({
        destination:
          Cesium.Cartesian3.clone(
            stableCamera.position
          ),
        orientation: {
          heading: stableCamera.heading,
          pitch: stableCamera.pitch,
          roll: stableCamera.roll
        }
      });

      correctionCount++;
      onUnexpectedCorrection?.(correctionCount);
    } finally {
      restoringCamera = false;
    }

    scene.requestRender();
  }

  function applyState() {
    applyingState = true;

    try {
      camera.cancelFlight();

      const target =
        Cesium.Cartesian3.fromDegrees(
          state.longitude,
          state.latitude,
          state.targetHeight
        );

      camera.lookAt(
        target,
        new Cesium.HeadingPitchRange(
          state.heading,
          state.pitch,
          state.range
        )
      );

      camera.lookAtTransform(
        Cesium.Matrix4.IDENTITY
      );

      snapshotCamera();
    } finally {
      applyingState = false;
    }

    scene.requestRender();
  }

  function metresPerPixel() {
    const height =
      Math.max(1, container.clientHeight);

    const fovy =
      Number(camera.frustum?.fovy);

    const verticalFov =
      Number.isFinite(fovy)
        ? fovy
        : Cesium.Math.toRadians(60);

    return (
      2
      * state.range
      * Math.tan(verticalFov / 2)
      / height
    );
  }

  function setView(next) {
    state = cloneState({
      ...state,
      ...next,
      range: clamp(
        Number(next.range ?? state.range),
        minimumRange,
        maximumRange
      )
    });

    applyState();
  }

  function reset() {
    state = cloneState(home);
    applyState();
  }

  function panPixels(dx, dy) {
    state = panTargetByScreenPixels(
      state,
      dx,
      dy,
      metresPerPixel()
    );
    applyState();
  }

  function orbitPixels(dx, dy) {
    state = orbitStateByPixels(
      state,
      dx,
      dy
    );
    applyState();
  }

  function tiltPixels(dy) {
    state = orbitStateByPixels(
      state,
      0,
      dy
    );
    applyState();
  }

  function zoomDirection(direction) {
    state = zoomStateByDirection(
      state,
      direction,
      {
        minimumRange,
        maximumRange
      }
    );
    applyState();
  }

  function panByFraction(horizontal, vertical) {
    panPixels(
      horizontal * Math.max(1, container.clientWidth),
      vertical * Math.max(1, container.clientHeight)
    );
  }

  function rotateDegrees(degrees) {
    state = {
      ...state,
      heading: wrapHeading(
        state.heading
        + Cesium.Math.toRadians(degrees)
      )
    };
    applyState();
  }

  function tiltDegrees(degrees) {
    state = {
      ...state,
      pitch: clamp(
        state.pitch
        + Cesium.Math.toRadians(degrees),
        -Math.PI / 2 + 0.01,
        -0.12
      )
    };
    applyState();
  }

  function endPointer(event) {
    if (
      !activePointer
      || event.pointerId !== activePointer.pointerId
    ) {
      return;
    }

    try {
      if (
        container.hasPointerCapture?.(
          event.pointerId
        )
      ) {
        container.releasePointerCapture(
          event.pointerId
        );
      }
    } catch {
      // Already released by browser.
    }

    activePointer = null;
    snapshotCamera();
    scene.requestRender();
  }

  function onPointerDown(event) {
    if (
      event.button !== 0
      && event.button !== 1
      && event.button !== 2
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const mode =
      event.button === 2
        ? "orbit"
        : (
            event.button === 1
            || event.shiftKey
              ? "tilt"
              : "pan"
          );

    activePointer = {
      pointerId: event.pointerId,
      mode,
      x: event.clientX,
      y: event.clientY,
      originX: event.clientX,
      originY: event.clientY,
      dragging: false
    };

    try {
      container.setPointerCapture(
        event.pointerId
      );
    } catch {
      // Pointer capture is optional.
    }
  }

  function onPointerMove(event) {
    if (
      !activePointer
      || event.pointerId !== activePointer.pointerId
    ) {
      return;
    }

    if (event.buttons === 0) {
      endPointer(event);
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const totalDistance =
      Math.hypot(
        event.clientX
          - activePointer.originX,
        event.clientY
          - activePointer.originY
      );

    if (
      !activePointer.dragging
      && totalDistance < 4
    ) {
      return;
    }

    const dx =
      event.clientX - activePointer.x;

    const dy =
      event.clientY - activePointer.y;

    activePointer.x = event.clientX;
    activePointer.y = event.clientY;

    if (!activePointer.dragging) {
      activePointer.dragging = true;
    }

    onInteraction();

    if (activePointer.mode === "pan") {
      panPixels(dx, dy);
    } else if (activePointer.mode === "orbit") {
      orbitPixels(dx, dy);
    } else {
      tiltPixels(dy);
    }
  }

  function onPointerEnd(event) {
    event.preventDefault();
    event.stopPropagation();
    endPointer(event);
  }

  function onContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function closeWheelGestureLater() {
    if (wheelQuietTimer) {
      clearTimeout(wheelQuietTimer);
    }

    wheelQuietTimer =
      setTimeout(
        () => {
          wheelGestureOpen = false;
          wheelQuietTimer = null;
        },
        wheelGestureQuietMs
      );
  }

  function onWheel(event) {
    event.preventDefault();
    event.stopPropagation();

    const wheel =
      classifyWheelDelta(
        event.deltaY,
        event.deltaMode
      );

    if (
      wheel.mode
      === "none"
    ) {
      return;
    }

    if (
      wheel.mode
      === "discrete"
    ) {
      const direction =
        wheel.steps < 0
          ? -1
          : 1;

      onInteraction();

      for (
        let index = 0;
        index < Math.abs(
          wheel.steps
        );
        index++
      ) {
        state =
          zoomStateByDirection(
            state,
            direction,
            {
              minimumRange,
              maximumRange
            }
          );
      }

      applyState();

      wheelGestureOpen =
        false;

      if (
        wheelQuietTimer
      ) {
        clearTimeout(
          wheelQuietTimer
        );

        wheelQuietTimer =
          null;
      }

      return;
    }

    if (
      !wheelGestureOpen
    ) {
      wheelGestureOpen =
        true;

      onInteraction();

      zoomDirection(
        wheel.steps
      );
    }

    closeWheelGestureLater();
  }

  container.addEventListener(
    "pointerdown",
    onPointerDown,
    { passive:false, capture:true }
  );

  container.addEventListener(
    "pointermove",
    onPointerMove,
    { passive:false, capture:true }
  );

  container.addEventListener(
    "pointerup",
    onPointerEnd,
    { passive:false, capture:true }
  );

  container.addEventListener(
    "pointercancel",
    onPointerEnd,
    { passive:false, capture:true }
  );

  container.addEventListener(
    "lostpointercapture",
    endPointer,
    { passive:false, capture:true }
  );

  container.addEventListener(
    "contextmenu",
    onContextMenu,
    { passive:false, capture:true }
  );

  container.addEventListener(
    "wheel",
    onWheel,
    { passive:false, capture:true }
  );

  const correctionTimer =
    window.setInterval(
      restoreUnexpectedMotion,
      250
    );

  applyState();

  return {
    setView,
    reset,
    panByFraction,
    zoomDirection,
    rotateDegrees,
    tiltDegrees,

    getState() {
      return { ...state };
    },

    getCorrectionCount() {
      return correctionCount;
    },

    destroy() {
      destroyed = true;
      clearInterval(correctionTimer);

      if (wheelQuietTimer) {
        clearTimeout(wheelQuietTimer);
      }

      container.removeEventListener(
        "pointerdown",
        onPointerDown,
        true
      );
      container.removeEventListener(
        "pointermove",
        onPointerMove,
        true
      );
      container.removeEventListener(
        "pointerup",
        onPointerEnd,
        true
      );
      container.removeEventListener(
        "pointercancel",
        onPointerEnd,
        true
      );
      container.removeEventListener(
        "lostpointercapture",
        endPointer,
        true
      );
      container.removeEventListener(
        "contextmenu",
        onContextMenu,
        true
      );
      container.removeEventListener(
        "wheel",
        onWheel,
        true
      );
    }
  };
}
