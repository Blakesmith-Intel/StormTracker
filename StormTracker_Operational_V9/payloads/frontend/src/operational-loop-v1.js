export const SUPPORTED_LOOP_MINUTES =
  Object.freeze([
    30,
    60,
    90,
    120,
    150,
    180
  ]);

export function normaliseLoopMinutes(
  value
) {
  const minutes =
    Number(
      value
    );

  if (
    !SUPPORTED_LOOP_MINUTES
      .includes(
        minutes
      )
  ) {
    throw new RangeError(
      `Unsupported StormTracker loop window: ${value} minutes.`
    );
  }

  return minutes;
}

export function frameCountForLoopMinutes(
  value
) {
  return (
    normaliseLoopMinutes(
      value
    )
    / 5
  );
}

export function playbackDelayForSpeed(
  value
) {
  const speed =
    Number(
      value
    );

  if (
    ![
      0.5,
      1,
      2
    ].includes(
      speed
    )
  ) {
    throw new RangeError(
      `Unsupported StormTracker playback speed: ${value}.`
    );
  }

  return Math.round(
    650 / speed
  );
}
