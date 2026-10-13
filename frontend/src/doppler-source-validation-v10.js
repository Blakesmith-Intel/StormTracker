// V10 source trust gate. No permission to infer velocities outside the source palette.
import { BOM_DOPPLER_VELOCITY_SCALE_KMH } from "./bom-doppler-decoder-v1.js";

export function validateDopplerSource(record, reflectivityUtc, {
  maximumPairingMinutes = 8,
  maximumAgeMinutes = 30,
  nowUtc = null
} = {}) {
  const reasons = [];
  const productTime = Date.parse(record?.observedUtc ?? "");
  const reflectionTime = Date.parse(reflectivityUtc ?? "");
  const ageReference = nowUtc == null ? null : Date.parse(nowUtc);
  if (!Number.isFinite(productTime) || !Number.isFinite(reflectionTime)) reasons.push("missing-observed-utc");
  else if (Math.abs(productTime - reflectionTime) > maximumPairingMinutes * 60000) reasons.push("timestamps-not-aligned");
  if (ageReference != null) {
    if (!Number.isFinite(ageReference) || !Number.isFinite(productTime) ||
        productTime > ageReference + 5 * 60000 ||
        ageReference - productTime > maximumAgeMinutes * 60000) reasons.push("stale-or-future-observation");
  }
  if (!["08","50","66"].includes(String(record?.radarId))) reasons.push("unverified-radar-site");
  if (record?.velocityRangeVerified !== true) reasons.push("velocity-product-not-verified");
  if (!record?.timeBasis || record.timeBasis !== "observed") reasons.push("timestamp-not-observed");
  if (record?.spatialCalibrationVerified !== true) reasons.push("georeferencing-not-verified");
  if (record?.signConventionVerified !== true) reasons.push("sign-convention-not-verified");
  if (record?.dealiasingVerified !== true) reasons.push("velocity-aliasing-not-verified");
  if (!Number.isFinite(record?.verifiedRadialRangeKmh) || record.verifiedRadialRangeKmh <= 0)
    reasons.push("velocity-range-missing");
  const paletteCeilingKmh = Math.max(...BOM_DOPPLER_VELOCITY_SCALE_KMH.map(Math.abs));
  const detectableMaxKmh = record?.sourceFormat === "bom-colour-image" ? paletteCeilingKmh :
    record?.sourceFormat === "verified-quantitative-velocity" ? Number(record?.verifiedRadialRangeKmh) : null;
  if (detectableMaxKmh == null || !Number.isFinite(detectableMaxKmh)) reasons.push("unsupported-source-format");
  if (record?.sourceFormat === "bom-colour-image" && Number(record?.verifiedRadialRangeKmh) > paletteCeilingKmh)
    reasons.push("range-claim-exceeds-colour-palette");
  const supported = reasons.length === 0;
  return {
    supported, reasons, detectableMaxKmh,
    damagingRadialScreenPossible: supported && detectableMaxKmh >= 90,
    destructiveRadialScreenPossible: supported && detectableMaxKmh >= 125,
    interpretation: "A radar radial velocity is not a surface wind gust. Aliasing, sampling height and geometry limit inference."
  };
}
