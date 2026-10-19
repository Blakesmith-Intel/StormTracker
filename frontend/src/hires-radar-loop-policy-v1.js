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

export const HIRES_RAIN_WINDOWS=Object.freeze([30,60,90,120,180]);

// Only enable a long loop after this browser has actually archived every
// published five-minute observation needed for that duration. No temporal
// interpolation and no substituting older source scans for a missing time.
export function availableMeasuredHiResLoopMinutes(times=[]){
 return HIRES_RAIN_WINDOWS.filter(minutes=>{
  const window=measuredHiResRainWindow(times,String(minutes));
  return !window.partial&&window.plan.length===window.requiredFrames;
 });
}

export function measuredHiResRainWindow(times=[],selection="30"){
 const sorted=[...new Set((times||[]).filter(t=>Number.isFinite(Date.parse(t))))]
  .sort((a,b)=>Date.parse(a)-Date.parse(b));
 const isAll=selection==="all";
 const minutes=Number(selection);
 if(!isAll && !HIRES_RAIN_WINDOWS.includes(minutes))
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
 const expectedSpan=(maxFrames-1)*BOM_HIRES_CADENCE_MINUTES;
 const complete=plan.length===maxFrames &&
   (isAll||(
     Date.parse(plan.at(-1).observedUtc)-Date.parse(plan[0].observedUtc)
       ===expectedSpan*60000 &&
     plan.every((entry,i)=>i===0||Date.parse(entry.observedUtc)-
       Date.parse(plan[i-1].observedUtc)===BOM_HIRES_CADENCE_MINUTES*60000)
   ));
 return {plan,partial:!isAll&&!complete,requiredFrames:maxFrames};
}
