export const RADARS = Object.freeze({
  "08": Object.freeze({
    id: "08",
    name: "Gympie (Mt Kanigan)",
    latitude: -25.967000,
    longitude: 152.582990,
    halfSpanKm: 128,
    recoveredMapCorners: [
      [-27.106450, 151.295640],
      [-27.106450, 153.870340],
      [-24.807130, 151.287990],
      [-24.807130, 153.878770]
    ]
  }),
  "50": Object.freeze({
    id: "50",
    name: "Brisbane (Marburg)",
    latitude: -27.608000,
    longitude: 152.539000,
    halfSpanKm: 128
  }),
  "66": Object.freeze({
    id: "66",
    name: "Brisbane (Mt Stapylton)",
    latitude: -27.718100,
    longitude: 153.240010,
    halfSpanKm: 128
  })
});

export const SEGMENTATION_DEFAULTS = Object.freeze({
  thresholdCategory: 7,
  thresholdInterpretation: "Category 7 and above: definite >=40 dBZ.",
  minPixels: 8,
  connectivity: 8
});

export const TRACKING_DEFAULTS = Object.freeze({
  crossRadarTimeToleranceSeconds: 180,
  maximumSpeedKmh: 140,
  maximumGapMinutes: 12,
  activeMinutes: 12
});

export const FRESHNESS = Object.freeze({
  liveMinutes: 15,
  degradedMinutes: 30,
  futureToleranceMinutes: 2
});
