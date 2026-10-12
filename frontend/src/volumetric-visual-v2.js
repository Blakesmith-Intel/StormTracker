// Experimental display-only interpretation of the existing BoM dBZ categories.
// The underlying imagery, tracking, Doppler and empirical vertical profiles
// remain source-true and unchanged. mm/h is NOT an official BoM rain-rate field.
import { BOM_REFLECTIVITY_RGB, REFLECTIVITY_CLASSES } from "./palette.js";

// BoM native rain-rate band boundaries; the colours match its 15-band
// rain-rate image, but these mm/h categories are NOT derived from a single
// reflectivity-to-rainfall formula.
export const NATIVE_RAIN_RATE_LAYER="atm_surf_air_precip_rate_1hr_total_mm_h";
export const VOLUME_BASE_VERTICAL_EXAGGERATION = 1.0;

const RATE_LABELS=[
  "Under 2","2–3","3–5","5–7","7–10",
  "10–15","15–25","25–35","35–55","55–80",
  "80–120","120–180","180–270","270–400","400+"
];

export function rainfallLegendBands() {
  return BOM_REFLECTIVITY_RGB.map((entry,index)=>({
    category:entry.value,
    color:"#"+entry.rgb.map(v=>v.toString(16).padStart(2,"0")).join(""),
    rainRateLabel:RATE_LABELS[index]+" mm/h",
    rainRateLowerMmH:index===0?0:
      [2,3,5,7,10,15,25,35,55,80,120,180,270,400][index-1]
  }));
}

// Use exactly the same 15 colour categories as the measured BoM 2-D surface.
// Top band is >=64 dBZ, not >=65: the source is categorised and cannot
// reliably distinguish a 64 dBZ pixel from a 65 dBZ pixel.
export function rgbForInferredDbz(dbz) {
  const value=Number(dbz);
  if(!Number.isFinite(value))return null;
  for(let i=15;i>=1;i--){
    if(value>=REFLECTIVITY_CLASSES[i][0]){
      return BOM_REFLECTIVITY_RGB[i-1].rgb;
    }
  }
  return null;
}

// Rendered heights respond to stronger low-level observations, but this
// display transform must NEVER be used as a measured echo-top estimate.
export function intensityHeightMultiplier(observedLowLevelDbz){
  const dbz=Number(observedLowLevelDbz);
  if(!Number.isFinite(dbz))return 1;
  const t=Math.max(0,Math.min(1,(dbz-40)/25));
  return 1+0.4*(t*t*(3-2*t)); // 1.0 at 40 dBZ, 1.4 at >=65 dBZ
}

export function displayedVolumeAltitude(altitudeM, observedLowLevelDbz, userVerticalScale=1) {
  const altitude=Number(altitudeM), scale=Number(userVerticalScale);
  if(!Number.isFinite(altitude)||!Number.isFinite(scale))return NaN;
  return altitude*Math.max(.1,scale)*intensityHeightMultiplier(observedLowLevelDbz);
}

export function volumeBlobDiameterPx(basePointSize, sourceStrengthDbz=40, support=1){
  const base=Math.max(1,Math.min(5,Number(basePointSize)||3));
  const t=Math.max(0,Math.min(1,(Number(sourceStrengthDbz)-40)/25));
  return Math.round(Math.max(7,Math.min(28,base*(2.7+.8*t)*Math.max(.75,Math.min(1.4,support)))));
}

export function createBlobSpriteDataUrl(doc=globalThis.document){
  if(!doc?.createElement)throw new Error("Canvas support required");
  const canvas=doc.createElement("canvas");
  canvas.width=48;canvas.height=48;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw new Error("Unable to create blob sprite");
  const g=ctx.createRadialGradient(23,21,2,24,24,24);
  g.addColorStop(0,"rgba(255,255,255,0.96)");
  g.addColorStop(.42,"rgba(255,255,255,0.84)");
  g.addColorStop(.72,"rgba(255,255,255,0.43)");
  g.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=g;ctx.fillRect(0,0,48,48);
  return canvas.toDataURL("image/png");
}
