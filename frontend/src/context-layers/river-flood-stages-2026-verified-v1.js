// Source: Bureau of Meteorology Queensland Flood Forecasting and Warning
// Services SLS v3.7 (May 2026), Schedule 3, flood classification station IDs.
// https://www.bom.gov.au/sites/default/files/2026-05/service-level-specification-flood-forecasting-warning-services-queensland-v3.7.pdf
// Explicit station IDs only; 2022 gauge-relative stages MUST NOT take
// precedence over the newer station-specific published thresholds.
// This is a verified high-risk-site subset, not a completed statewide import.
export const VERIFIED_MAY_2026_STAGES=Object.freeze({
  "bom:540610":Object.freeze({minor:98.1,moderate:100.7,major:102.3}),
  "bom:540057":Object.freeze({minor:76.2,moderate:77.7,major:79.2}),
  "bom:539066":Object.freeze({minor:111.5,moderate:115,major:121}),
  "bom:540646":Object.freeze({minor:41.5,moderate:42,major:42.5})
});
export const OFFICIAL_MAY_2026_STAGES_URL=
 "https://www.bom.gov.au/sites/default/files/2026-05/service-level-specification-flood-forecasting-warning-services-queensland-v3.7.pdf";
