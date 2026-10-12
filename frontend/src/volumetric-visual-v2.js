// Experimental display-only interpretation of the existing BoM dBZ categories.
// The underlying imagery, tracking, Doppler and empirical vertical profiles
// remain source-true and unchanged. mm/h is NOT an official BoM rain-rate field.
import { BOM_REFLECTIVITY_RGB, REFLECTIVITY_CLASSES } from "./palette.js";

export const RAIN_RATE_ESTIMATE_SOURCE = "Marshall–Palmer Z=200R^1.6 (illustrative; not calibrated by BoM)";
export const VOLUME_BASE_VERTICAL_EXAGGERATION = 1.0;

export function estimateRainRateMmH(dbz) {
  const value=Number(dbz);
  if(!Number.isFinite(value))return null;
  return Math.pow(Math.pow(10,value/10)/200,1/1.6);
}

export function rateRangeForReflectivityCategory(category) {
  const range=REFLECTIVITY_CLASSES[category];
  if(!range)return null;
  return {
    lowerDbz:range[0],upperDbz:range[1],
    lowerMmH:estimateRainRateMmH(range[0]),
    upperMmH:range[1]==null?null:estimateRainRateMmH(range[1])
  };
}

export function formatRate(value) {
  if(value==null||!Number.isFinite(value))return "—";
  if(value<1)return value.toFixed(1);
  if(value<10)return value.toFixed(1);
  return Math.round(value).toLocaleString("en-AU");
}

export function rainfallLegendBands() {
  return BOM_REFLECTIVITY_RGB.map(entry=>{
    const range=rateRangeForReflectivityCategory(entry.value);
    return {
      category:entry.value,
      color:"#"+entry.rgb.map(v=>v.toString(16).padStart(2,"0")).join(""),
      dbzLabel:range.upperDbz==null?`${range.lowerDbz}+ dBZ`:`${range.lowerDbz}–${range.upperDbz} dBZ`,
      rainRateLabel:range.upperMmH==null?`${formatRate(range.lowerMmH)}+ mm/h`:
        `${formatRate(range.lowerMmH)}–${formatRate(range.upperMmH)} mm/h`,
      rainRateLowerMmH:range.lowerMmH
    };
  });
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
