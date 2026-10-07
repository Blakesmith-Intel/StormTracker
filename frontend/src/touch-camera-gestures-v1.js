function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function shortestAngleDelta(previous, current) {
  let delta = Number(current) - Number(previous);
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function touchPairMetrics(first, second) {
  const dx = Number(second.x) - Number(first.x);
  const dy = Number(second.y) - Number(first.y);
  return {
    distance: Math.max(1, Math.hypot(dx, dy)),
    angle: Math.atan2(dy, dx),
    midpointX: (Number(first.x) + Number(second.x)) / 2,
    midpointY: (Number(first.y) + Number(second.y)) / 2
  };
}

export function pinchRange(currentRange, previousDistance, currentDistance, {
  minimumRange = 800,
  maximumRange = 5000000
} = {}) {
  const previous = Math.max(1, Number(previousDistance));
  const current = Math.max(1, Number(currentDistance));
  return clamp(
    Number(currentRange) * previous / current,
    minimumRange,
    maximumRange
  );
}

export function createStormTrackerTouchCameraGestures({
  container,
  getController,
  onGesture = () => {},
  minimumRange = 800,
  maximumRange = 5000000,
  pitchDegreesPerPixel = 0.12
}) {
  if (!container || typeof getController !== "function") {
    throw new Error("container and getController are required.");
  }

  const pointers = new Map();
  let singleLast = null;
  let pairLast = null;
  let destroyed = false;

  function touchPoints() {
    return [...pointers.values()]
      .sort((a, b) => a.pointerId - b.pointerId);
  }

  function resetGestureBaseline() {
    const points = touchPoints();
    if (points.length === 1) {
      singleLast = { x: points[0].x, y: points[0].y };
      pairLast = null;
    } else if (points.length >= 2) {
      singleLast = null;
      pairLast = touchPairMetrics(points[0], points[1]);
    } else {
      singleLast = null;
      pairLast = null;
    }
  }

  function ownTouchEvent(event) {
    if (event.pointerType !== "touch") return false;
    event.preventDefault();
    // The legacy camera controller deliberately implements mouse pointer input.
    // Touch is owned here so its one-pointer handler cannot swallow pinch/twist.
    event.stopImmediatePropagation();
    return true;
  }

  function onPointerDown(event) {
    if (!ownTouchEvent(event)) return;
    pointers.set(event.pointerId, {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    });
    try { container.setPointerCapture?.(event.pointerId); } catch {}
    resetGestureBaseline();
    onGesture();
  }

  function onPointerMove(event) {
    if (!pointers.has(event.pointerId) || !ownTouchEvent(event)) return;

    const previousPoint = pointers.get(event.pointerId);
    pointers.set(event.pointerId, {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    });

    const controller = getController();
    if (!controller) {
      resetGestureBaseline();
      return;
    }

    const points = touchPoints();
    if (points.length === 1) {
      const current = points[0];
      const previous = singleLast ?? previousPoint;
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      controller.panByFraction(
        (current.x - previous.x) / width,
        (current.y - previous.y) / height
      );
      singleLast = { x: current.x, y: current.y };
      pairLast = null;
      onGesture();
      return;
    }

    if (points.length >= 2) {
      const current = touchPairMetrics(points[0], points[1]);
      if (pairLast) {
        const state = controller.getState();

        const angleDelta =
          shortestAngleDelta(
            pairLast.angle,
            current.angle
          );

        const midpointDy =
          current.midpointY
          - pairLast.midpointY;

        const next = {
          range:
            pinchRange(
              state.range,
              pairLast.distance,
              current.distance,
              {
                minimumRange,
                maximumRange
              }
            )
        };

        if (
          Math.abs(
            angleDelta
            * 180
            / Math.PI
          ) >= 0.08
        ) {
          next.heading =
            Number(state.heading ?? 0)
            + angleDelta;
        }

        if (
          Math.abs(
            midpointDy
          ) >= 0.25
        ) {
          next.pitch =
            Number(state.pitch ?? 0)
            + midpointDy
              * pitchDegreesPerPixel
              * Math.PI
              / 180;
        }

        controller.setView(
          next
        );
      }
      pairLast = current;
      singleLast = null;
      onGesture();
    }
  }

  function endTouch(event) {
    if (!pointers.has(event.pointerId) || !ownTouchEvent(event)) return;
    pointers.delete(event.pointerId);
    try {
      if (container.hasPointerCapture?.(event.pointerId)) {
        container.releasePointerCapture(event.pointerId);
      }
    } catch {}
    resetGestureBaseline();
    onGesture();
  }

  const options = { passive:false, capture:true };
  container.addEventListener("pointerdown", onPointerDown, options);
  container.addEventListener("pointermove", onPointerMove, options);
  container.addEventListener("pointerup", endTouch, options);
  container.addEventListener("pointercancel", endTouch, options);

  return {
    activeTouchCount() { return pointers.size; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      pointers.clear();
      container.removeEventListener("pointerdown", onPointerDown, true);
      container.removeEventListener("pointermove", onPointerMove, true);
      container.removeEventListener("pointerup", endTouch, true);
      container.removeEventListener("pointercancel", endTouch, true);
    }
  };
}
