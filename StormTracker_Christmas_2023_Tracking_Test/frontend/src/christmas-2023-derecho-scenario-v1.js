import {
  deduplicateRadarCells,
  trackToDict,
  updateTracks
} from "./tracking.js";

import {
  buildFootprintRestrictedTrackAssessment
} from "./track-assessment-v2.js";

export const CHRISTMAS_2023_GOLD_COAST_SCENARIO =
  Object.freeze({
    id:
      "christmas-2023-gold-coast-qlcs-v1",

    title:
      "Christmas Night 2023 Gold Coast QLCS / derecho-style tracking validation",

    date_local:
      "2023-12-25",

    timezone:
      "Australia/Brisbane",

    classification_note:
      "Event-constrained deterministic simulation. Track corridor/timing/severity anchors are based on published accounts of the 25 December 2023 South East Queensland severe thunderstorm event. The per-frame radar-cell geometry, dBZ classes and Doppler radial-velocity classes below are simulated validation inputs, not archived Bureau radar pixels.",

    observed_anchors: [
      {
        local_time:
          "19:49 AEST",

        description:
          "Gold Coast explicitly entered Detailed Severe Thunderstorm Warnings."
      },

      {
        local_time:
          "19:56 AEST",

        description:
          "Scenic Rim and Gold Coast warning escalated to Very Dangerous Thunderstorm."
      },

      {
        local_time:
          "20:40 AEST",

        description:
          "Detailed warning escalated to include destructive wind gusts."
      },

      {
        local_time:
          "21:12 AEST",

        description:
          "Gold Coast Seaway recorded 106 km/h maximum wind gust."
      },

      {
        local_time:
          "event damage",

        description:
          "Bureau summary describes a 3–4 km wide and 30–50 km long area of damaging to locally destructive winds across the Gold Coast and Scenic Rim."
      }
    ],

    source_notes: [
      "Bureau of Meteorology newsroom update: 7:49 pm detailed warning; 7:56 pm Very Dangerous Thunderstorm; 8:40 pm destructive-wind escalation; 106 km/h at Gold Coast Seaway at 9:12 pm.",
      "Bureau 2023-24 financial-year climate report: damaging to locally destructive wind swath approximately 3–4 km wide and 30–50 km long across Gold Coast and Scenic Rim; radar evidence of rotation was noted.",
      "Independent post-event meteorological analysis documents QLCS/bow-echo movement from the Amberley/Ripley area through Jimboomba/Tamborine toward the northern Gold Coast, with 3-D radar analysis around 8:20–8:45 pm."
    ],

    frames: [
      {
        index:0,
        local_time:"20:20 AEST",
        observed_utc:"2023-12-25T10:20:00.000Z",
        corridor_label:"Ripley / western approach",
        latitude:-27.7200,
        longitude:152.8200,
        sampled_area_km2:120,
        maximum_category:11,
        maximum_dbzh_lower_bound:52,
        maximum_dbzh_upper_bound:55,
        toward_kmh:-40,
        away_kmh:35,
        doppler_samples:24
      },
      {
        index:1,
        local_time:"20:25 AEST",
        observed_utc:"2023-12-25T10:25:00.000Z",
        corridor_label:"Greenbank corridor",
        latitude:-27.7548,
        longitude:152.9160,
        sampled_area_km2:170,
        maximum_category:12,
        maximum_dbzh_lower_bound:55,
        maximum_dbzh_upper_bound:58,
        toward_kmh:-50,
        away_kmh:45,
        doppler_samples:36
      },
      {
        index:2,
        local_time:"20:30 AEST",
        observed_utc:"2023-12-25T10:30:00.000Z",
        corridor_label:"Jimboomba approach",
        latitude:-27.7896,
        longitude:153.0120,
        sampled_area_km2:240,
        maximum_category:13,
        maximum_dbzh_lower_bound:58,
        maximum_dbzh_upper_bound:61,
        toward_kmh:-60,
        away_kmh:50,
        doppler_samples:48
      },
      {
        index:3,
        local_time:"20:35 AEST",
        observed_utc:"2023-12-25T10:35:00.000Z",
        corridor_label:"Tamborine approach",
        latitude:-27.8244,
        longitude:153.1080,
        sampled_area_km2:320,
        maximum_category:14,
        maximum_dbzh_lower_bound:61,
        maximum_dbzh_upper_bound:64,
        toward_kmh:-70,
        away_kmh:60,
        doppler_samples:64
      },
      {
        index:4,
        local_time:"20:40 AEST",
        observed_utc:"2023-12-25T10:40:00.000Z",
        corridor_label:"Tamborine / Wongawallan",
        latitude:-27.8592,
        longitude:153.2040,
        sampled_area_km2:410,
        maximum_category:15,
        maximum_dbzh_lower_bound:64,
        maximum_dbzh_upper_bound:70,
        toward_kmh:-80,
        away_kmh:70,
        doppler_samples:82
      },
      {
        index:5,
        local_time:"20:45 AEST",
        observed_utc:"2023-12-25T10:45:00.000Z",
        corridor_label:"Oxenford / Coomera",
        latitude:-27.8940,
        longitude:153.3000,
        sampled_area_km2:380,
        maximum_category:14,
        maximum_dbzh_lower_bound:61,
        maximum_dbzh_upper_bound:64,
        toward_kmh:-75,
        away_kmh:65,
        doppler_samples:76
      }
    ]
  });

function radarCell(
  frame,
  radarId,
  offsetLongitude,
  offsetLatitude,
  categoryOffset,
  localCellId
) {
  const category =
    Math.max(
      7,
      Math.min(
        15,
        frame.maximum_category
        + categoryOffset
      )
    );

  const lowerBound =
    category >= 15
      ? 64
      : (
          category === 14
            ? 61
            : (
                category === 13
                  ? 58
                  : (
                      category === 12
                        ? 55
                        : (
                            category === 11
                              ? 52
                              : 40
                          )
                    )
              )
        );

  return {
    radar_id:
      String(
        radarId
      ),

    observed_utc:
      frame.observed_utc,

    local_cell_id:
      localCellId,

    centroid_longitude:
      frame.longitude
      + offsetLongitude,

    centroid_latitude:
      frame.latitude
      + offsetLatitude,

    sampled_area_km2:
      frame.sampled_area_km2
      * (
          radarId === "66"
            ? 1
            : 0.94
        ),

    maximum_category:
      category,

    maximum_dbzh_lower_bound:
      lowerBound,

    maximum_dbzh_upper_bound:
      category >= 15
        ? null
        : lowerBound + 3,

    min_longitude:
      frame.longitude
      - 0.065
      + offsetLongitude,

    max_longitude:
      frame.longitude
      + 0.065
      + offsetLongitude,

    min_latitude:
      frame.latitude
      - 0.045
      + offsetLatitude,

    max_latitude:
      frame.latitude
      + 0.045
      + offsetLatitude
  };
}

export function scenarioRadarObservations(
  frame
) {
  return [
    radarCell(
      frame,
      "50",
      -0.008,
      0.004,
      -1,
      frame.index * 10 + 1
    ),

    radarCell(
      frame,
      "66",
      0.006,
      -0.003,
      0,
      frame.index * 10 + 2
    )
  ];
}

export function scenarioDopplerContext(
  frame
) {
  const span =
    frame.away_kmh
    - frame.toward_kmh;

  return {
    primary: {
      radar_id:
        "66",

      source_time_utc:
        frame.observed_utc,

      time_delta_minutes:
        0,

      sample_count:
        frame.doppler_samples,

      strongest_toward_kmh:
        frame.toward_kmh,

      strongest_away_kmh:
        frame.away_kmh,

      radial_span_kmh:
        span,

      maximum_absolute_kmh:
        Math.max(
          Math.abs(
            frame.toward_kmh
          ),
          Math.abs(
            frame.away_kmh
          )
        )
    },

    radar_count:
      1,

    radars: [
      {
        radar_id:"66"
      }
    ]
  };
}

export function runChristmas2023TrackingScenario() {
  const tracks =
    [];

  let nextTrackNumber =
    1;

  const results =
    [];

  for (
    const frame
    of CHRISTMAS_2023_GOLD_COAST_SCENARIO.frames
  ) {
    const radarObservations =
      scenarioRadarObservations(
        frame
      );

    const globalObservations =
      deduplicateRadarCells(
        radarObservations,
        180
      );

    nextTrackNumber =
      updateTracks(
        tracks,
        globalObservations,
        nextTrackNumber,
        140,
        12
      );

    const activeTrack =
      tracks.find(
        track =>
          track.observations
            .at(
              -1
            )
            ?.observed_utc
          === frame.observed_utc
      );

    if (!activeTrack) {
      throw new Error(
        `Scenario lost the active storm track at ${frame.local_time}.`
      );
    }

    const track =
      trackToDict(
        activeTrack
      );

    const dopplerContext =
      scenarioDopplerContext(
        frame
      );

    const assessment =
      buildFootprintRestrictedTrackAssessment(
        track,
        dopplerContext,
        {
          referenceTime:
            new Date(
              frame.observed_utc
            )
        }
      );

    results.push({
      frame,
      radarObservations,
      globalObservations,
      track,
      dopplerContext,
      assessment
    });
  }

  return {
    scenario:
      CHRISTMAS_2023_GOLD_COAST_SCENARIO,

    results,

    finalTracks:
      tracks.map(
        trackToDict
      ),

    nextTrackNumber
  };
}
