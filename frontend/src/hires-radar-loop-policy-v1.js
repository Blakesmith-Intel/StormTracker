// Genuine BoM high-resolution reflectivity only. This module never creates
// temporal gap-fill images or accepts legacy FTP/site PNG mosaics.
export const BOM_HIRES_CADENCE_MINUTES = 5;

export function isVerifiedHiResRadarFrame(frame){
 return Boolean(
  frame?.sourceId==="BOM-MOSAIC" &&
  frame.width>=512 && frame.height>=512 &&
  frame.categories?.length===frame.width*frame.height &&
  frame.georef?.projection==="EPSG:3857" &&
  frame.sourceMetadata?.tileMatrixSet==="GoogleMapsCompatible_BoM" &&
  Number.isFinite(Date.parse(frame.observedUtc))
 );
}

export function measuredHiResRainWindow(times=[],selection="30"){
 const sorted=[...new Set((times||[]).filter(t=>Number.isFinite(Date.parse(t))))]
  .sort((a,b)=>Date.parse(a)-Date.parse(b));
 const isAll=selection==="all";
 const minutes=Number(selection);
 if(!isAll && (!Number.isInteger(minutes)||minutes<5||minutes>180||minutes%5!==0))
  throw new RangeError("Unsupported measured rain-radar window: "+selection);
 if(!sorted.length)return {plan:[],partial:!isAll,requiredFrames:isAll?0:minutes/5};
 const latest=Date.parse(sorted.at(-1));
 const maxFrames=isAll?sorted.length:minutes/BOM_HIRES_CADENCE_MINUTES;
 // A 30-minute loop comprises six observations (latest plus five earlier
 // five-minute frames). A missing issued frame is NEVER filled by interpolation
 // or by a legacy image, and never compensated with an older out-of-window scan.
 const cutoff=isAll?-Infinity:latest-(minutes-BOM_HIRES_CADENCE_MINUTES)*60000;
 const selected=sorted.filter(t=>Date.parse(t)>=cutoff).slice(-maxFrames);
 const plan=selected.map(observedUtc=>({kind:"observed",observedUtc}));
 return {plan,partial:!isAll&&plan.length<maxFrames,requiredFrames:maxFrames};
}
