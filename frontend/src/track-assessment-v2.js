import {
  buildTrackLikelihood
} from "./lightning.js";

export function strictDopplerValuesFromTrackContext(
  context
) {
  const primary =
    context?.primary
    ?? null;

  if (!primary) {
    return [];
  }

  const values =
    [];

  const toward =
    Number(
      primary.strongest_toward_kmh
    );

  const away =
    Number(
      primary.strongest_away_kmh
    );

  if (
    Number.isFinite(
      toward
    )
    && toward !== 0
  ) {
    values.push(
      toward
    );
  }

  if (
    Number.isFinite(
      away
    )
    && away !== 0
  ) {
    values.push(
      away
    );
  }

  return values;
}

export function buildFootprintRestrictedTrackAssessment(
  track,
  dopplerContext,
  {
    referenceTime =
      new Date()
  } = {}
) {
  const primary =
    dopplerContext?.primary
    ?? null;

  const dopplerValues =
    strictDopplerValuesFromTrackContext(
      dopplerContext
    );

  const assessment =
    buildTrackLikelihood(
      track,
      {
        dopplerValues,
        referenceTime
      }
    );

  const dopplerComponent =
    assessment.components
      .find(
        component =>
          component.name
          === "doppler-dynamics"
      )
    ?? null;

  return {
    ...assessment,

    doppler_integrated:
      Boolean(
        primary
        && dopplerValues.length
      ),

    doppler_radar_id:
      primary?.radar_id
      ?? null,

    doppler_sample_count:
      primary?.sample_count
      ?? 0,

    doppler_source_time_utc:
      primary?.source_time_utc
      ?? null,

    doppler_time_delta_minutes:
      primary?.time_delta_minutes
      ?? null,

    doppler_component_score:
      dopplerComponent?.score
      ?? 0,

    doppler_component_maximum:
      dopplerComponent?.maximum
      ?? 15,

    assessment_basis:
      "Measured 2-D reflectivity track + time-matched strict Doppler samples inside the measured >=40 dBZ ST footprint. Doppler does not create or move the track.",

    interpretation:
      "Ordinal inferred convective/lightning likelihood. It is not a lightning-strike observation, not a calibrated probability, and Doppler is not treated as horizontal storm motion or a rotation diagnosis."
  };
}
