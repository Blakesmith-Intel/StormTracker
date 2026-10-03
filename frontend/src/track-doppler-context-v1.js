const WEB_MERCATOR_RADIUS =
  6378137;

function clampLatitude(
  latitude
) {
  return Math.max(
    -85.05112878,
    Math.min(
      85.05112878,
      Number(
        latitude
      )
    )
  );
}

export function lonLatToWebMercator(
  longitude,
  latitude
) {
  const lon =
    Number(
      longitude
    );

  const lat =
    clampLatitude(
      latitude
    );

  return {
    x:
      WEB_MERCATOR_RADIUS
      * lon
      * Math.PI
      / 180,

    y:
      WEB_MERCATOR_RADIUS
      * Math.log(
          Math.tan(
            Math.PI / 4
            + lat
              * Math.PI
              / 360
          )
        )
  };
}

export function webMercatorToLonLat(
  x,
  y
) {
  return {
    longitude:
      Number(
        x
      )
      / WEB_MERCATOR_RADIUS
      * 180
      / Math.PI,

    latitude:
      (
        2
        * Math.atan(
            Math.exp(
              Number(
                y
              )
              / WEB_MERCATOR_RADIUS
            )
          )
        - Math.PI / 2
      )
      * 180
      / Math.PI
  };
}

export function framePixelForLonLat(
  frame,
  longitude,
  latitude
) {
  if (
    frame?.georef?.projection
    !== "EPSG:3857"
  ) {
    throw new Error(
      "Doppler/track association requires an EPSG:3857 reflectivity frame."
    );
  }

  const projected =
    lonLatToWebMercator(
      longitude,
      latitude
    );

  const {
    minX,
    maxX,
    minY,
    maxY
  } =
    frame.georef;

  const dx =
    (
      maxX
      - minX
    )
    / frame.width;

  const dy =
    (
      maxY
      - minY
    )
    / frame.height;

  const column =
    Math.floor(
      (
        projected.x
        - minX
      )
      / dx
    );

  const row =
    Math.floor(
      (
        maxY
        - projected.y
      )
      / dy
    );

  if (
    column < 0
    || column >= frame.width
    || row < 0
    || row >= frame.height
  ) {
    return null;
  }

  return {
    column,
    row,
    index:
      row
      * frame.width
      + column
  };
}

export function pixelCentreLonLat(
  frame,
  column,
  row
) {
  const dx =
    (
      frame.georef.maxX
      - frame.georef.minX
    )
    / frame.width;

  const dy =
    (
      frame.georef.maxY
      - frame.georef.minY
    )
    / frame.height;

  const x =
    frame.georef.minX
    + (
        Number(
          column
        )
        + 0.5
      )
      * dx;

  const y =
    frame.georef.maxY
    - (
        Number(
          row
        )
        + 0.5
      )
      * dy;

  return webMercatorToLonLat(
    x,
    y
  );
}

export function localCellIdForObservation(
  observation,
  sourceId =
    "BOM-MOSAIC"
) {
  for (
    const entry
    of observation?.source_cells
    ?? []
  ) {
    const [
      source,
      localCellId
    ] =
      entry;

    if (
      String(
        source
      )
      === String(
        sourceId
      )
    ) {
      const value =
        Number(
          localCellId
        );

      return Number.isFinite(
        value
      )
        ? value
        : null;
    }
  }

  return null;
}

export function summariseRadialVelocities(
  values,
  {
    minimumSamples =
      3
  } = {}
) {
  const valid =
    Array.from(
      values
      ?? []
    )
      .map(
        Number
      )
      .filter(
        value =>
          Number.isFinite(
            value
          )
          && value !== 0
      );

  if (
    valid.length
    < minimumSamples
  ) {
    return null;
  }

  const negative =
    valid.filter(
      value =>
        value < 0
    );

  const positive =
    valid.filter(
      value =>
        value > 0
    );

  const strongestToward =
    negative.length
      ? Math.min(
          ...negative
        )
      : null;

  const strongestAway =
    positive.length
      ? Math.max(
          ...positive
        )
      : null;

  const span =
    strongestToward != null
    && strongestAway != null
      ? strongestAway
        - strongestToward
      : null;

  return {
    sample_count:
      valid.length,

    strongest_toward_kmh:
      strongestToward,

    strongest_away_kmh:
      strongestAway,

    radial_span_kmh:
      span,

    maximum_absolute_kmh:
      Math.max(
        ...valid.map(
          value =>
            Math.abs(
              value
            )
        )
      )
  };
}

function parsedEpochMs(
  value
) {
  if (!value) {
    return null;
  }

  const epoch =
    Date.parse(
      value
    );

  return Number.isFinite(
    epoch
  )
    ? epoch
    : null;
}

function observationForFrame(
  track,
  observedUtc
) {
  return (
    track?.history
      ?.find(
        observation =>
          observation.observed_utc
          === observedUtc
      )
    ?? null
  );
}

export function buildTrackDopplerContexts({
  frame,
  segmentation,
  tracks,
  dopplerRecords,
  maxTimeDeltaMinutes =
    8,
  minimumSamples =
    3
}) {
  if (
    !segmentation?.labels
    || segmentation.labels.length
      !== frame.width
        * frame.height
  ) {
    throw new Error(
      "Reflectivity segmentation labels are required for exact Doppler footprint matching."
    );
  }

  const labelToTrack =
    new Map();

  const contextByTrack =
    new Map();

  for (
    const track
    of tracks
    ?? []
  ) {
    const observation =
      observationForFrame(
        track,
        frame.observedUtc
      );

    if (!observation) {
      continue;
    }

    const localCellId =
      localCellIdForObservation(
        observation
      );

    if (
      localCellId == null
    ) {
      continue;
    }

    labelToTrack.set(
      localCellId,
      track.track_id
    );

    contextByTrack.set(
      track.track_id,
      {
        track_id:
          track.track_id,

        observed_utc:
          frame.observedUtc,

        local_cell_id:
          localCellId,

        radars:
          new Map(),

        primary:
          null
      }
    );
  }

  const sourceStatus =
    [];

  const frameEpoch =
    parsedEpochMs(
      frame.observedUtc
    );

  for (
    const record
    of dopplerRecords
    ?? []
  ) {
    const radarId =
      String(
        record.radarId
      );

    const sourceEpoch =
      parsedEpochMs(
        record.observedUtc
      );

    const timeDeltaMinutes =
      frameEpoch != null
      && sourceEpoch != null
        ? Math.abs(
            sourceEpoch
            - frameEpoch
          )
          / 60000
        : null;

    const timeMatched =
      timeDeltaMinutes != null
      && timeDeltaMinutes
        <= maxTimeDeltaMinutes;

    sourceStatus.push({
      radar_id:
        radarId,

      source_time_utc:
        record.observedUtc
        ?? null,

      time_delta_minutes:
        timeDeltaMinutes,

      time_matched:
        timeMatched,

      sample_count:
        record.samples
          ?.length
        ?? 0,

      time_basis:
        record.timeBasis
        ?? "unknown"
    });

    if (
      !timeMatched
    ) {
      continue;
    }

    const valuesByTrack =
      new Map();

    for (
      const sample
      of record.samples
      ?? []
    ) {
      const velocity =
        Number(
          sample.velocity_kmh
        );

      if (
        !Number.isFinite(
          velocity
        )
        || velocity === 0
      ) {
        continue;
      }

      const pixel =
        framePixelForLonLat(
          frame,
          sample.longitude,
          sample.latitude
        );

      if (!pixel) {
        continue;
      }

      const localCellId =
        Number(
          segmentation.labels[
            pixel.index
          ]
        );

      if (
        !localCellId
      ) {
        continue;
      }

      const trackId =
        labelToTrack.get(
          localCellId
        );

      if (!trackId) {
        continue;
      }

      if (
        !valuesByTrack.has(
          trackId
        )
      ) {
        valuesByTrack.set(
          trackId,
          []
        );
      }

      valuesByTrack
        .get(
          trackId
        )
        .push(
          velocity
        );
    }

    for (
      const [
        trackId,
        values
      ]
      of valuesByTrack
    ) {
      const summary =
        summariseRadialVelocities(
          values,
          {
            minimumSamples
          }
        );

      if (!summary) {
        continue;
      }

      const context =
        contextByTrack.get(
          trackId
        );

      if (!context) {
        continue;
      }

      context.radars.set(
        radarId,
        {
          radar_id:
            radarId,

          source_time_utc:
            record.observedUtc,

          time_delta_minutes:
            timeDeltaMinutes,

          time_basis:
            record.timeBasis
            ?? "unknown",

          ...summary
        }
      );
    }
  }

  for (
    const context
    of contextByTrack.values()
  ) {
    const candidates =
      [...context.radars.values()]
        .sort(
          (
            a,
            b
          ) =>
            b.sample_count
            - a.sample_count
            || a.time_delta_minutes
              - b.time_delta_minutes
            || a.radar_id
              .localeCompare(
                b.radar_id
              )
        );

    context.primary =
      candidates[0]
      ?? null;

    context.radar_count =
      candidates.length;

    context.radars =
      candidates;
  }

  return {
    contextByTrack,

    sourceStatus,

    tracks_with_doppler:
      [...contextByTrack.values()]
        .filter(
          context =>
            context.primary
        )
        .length,

    interpretation:
      "Doppler is sampled only where exact geolocated non-zero radial-velocity pixels intersect the measured >=40 dBZ reflectivity component for the same ST track. Radial spans are calculated within one radar only and are not horizontal storm-motion vectors or rotation diagnoses."
  };
}
