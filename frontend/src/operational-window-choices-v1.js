import { DOPPLER_AVAILABLE_LOOP_VALUE } from "./doppler-available-window-v1.js";

// The conventional BoM radar animation covers approximately 30 minutes.
// Extended windows are StormTracker's browser-backed observation history.
export const RAIN_ONLY_LOOP_MINUTES = Object.freeze([30,60,120,180]);

export function buildOperationalWindowChoices({
  combinedAvailable = false,
  rainAvailableMinutes = [],
  rainHasFrames = false
} = {}) {
  const available = new Set(rainAvailableMinutes.map(Number));
  return [
    {
      value: DOPPLER_AVAILABLE_LOOP_VALUE,
      label: "Doppler — All available",
      disabled: !combinedAvailable
    },
    ...RAIN_ONLY_LOOP_MINUTES.map(minutes => ({
      value: String(minutes),
      label: minutes === 30
        ? "30 min — Rain radar (BoM standard)"
        : minutes + " min — Rain radar (browser archive)",
      disabled: minutes === 30
        ? !(rainHasFrames || available.has(30))
        : !available.has(minutes)
    }))
  ];
}
