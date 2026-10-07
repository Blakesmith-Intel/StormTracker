export function frameSliderBounds(
  frameCount,
  frameIndex = 0
) {
  const count =
    Math.max(
      0,
      Math.floor(
        Number(frameCount) || 0
      )
    );

  const max =
    Math.max(
      0,
      count - 1
    );

  const index =
    Math.max(
      0,
      Math.min(
        max,
        Math.floor(
          Number(frameIndex) || 0
        )
      )
    );

  return {
    min: 0,
    max,
    step: 1,
    value: index,
    disabled:
      count === 0
  };
}

export function syncFrameSlider(
  slider,
  frameCount,
  frameIndex = 0
) {
  if (!slider) {
    return null;
  }

  const bounds =
    frameSliderBounds(
      frameCount,
      frameIndex
    );

  slider.min =
    String(bounds.min);

  slider.max =
    String(bounds.max);

  slider.step =
    String(bounds.step);

  slider.value =
    String(bounds.value);

  slider.disabled =
    bounds.disabled;

  return bounds;
}
