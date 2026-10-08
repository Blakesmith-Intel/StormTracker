import { DOPPLER_AVAILABLE_LOOP_VALUE } from "./doppler-available-window-v1.js";

export const RAIN_ONLY_LOOP_MINUTES = Object.freeze([60,120,180]);

// Exactly four visible selections, always in this order.
// Source-dependent availability disables an option; it never adds extra modes.
export function buildOperationalWindowChoices({
  combinedAvailable = false,
  rainAvailableMinutes = []
} = {}) {
  const enabledMinutes = new Set(rainAvailableMinutes.map(Number));
  return [
    {
      value: DOPPLER_AVAILABLE_LOOP_VALUE,
      label: "Radar + Doppler — All available",
      disabled: !combinedAvailable
    },
    ...RAIN_ONLY_LOOP_MINUTES.map(minutes => ({
      value: String(minutes),
      label: minutes + " min — Rain radar only",
      disabled: !enabledMinutes.has(minutes)
    }))
  ];
}
