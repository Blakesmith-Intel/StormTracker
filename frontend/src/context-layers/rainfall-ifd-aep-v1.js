// Australian Rainfall & Runoff 2016 / BoM IFD rarity classification.
// An AEP design depth is a rainfall-frequency benchmark, never a flood forecast.
// Apply only authoritative point/grid data for the EXACT 0.025° cell.
// Unavailable cells are UNCLASSIFIED, not assigned neighbouring/town values.
export const AEP_LEVELS=Object.freeze([20,10,5,2,1]);
export const AEP_GRADES=Object.freeze([
 {aep:1,band:"purple",label:"Exceptional rainfall rarity (≥1% AEP design depth)"},
 {aep:2,band:"red",label:"Very rare rainfall (≥2% AEP design depth)"},
 {aep:5,band:"orange",label:"Rare rainfall (≥5% AEP design depth)"},
 {aep:10,band:"yellow",label:"Unusual rainfall (≥10% AEP design depth)"},
 {aep:20,band:"green",label:"Notable rainfall (≥20% AEP design depth)"}
]);
const CELL=0.025;
export function ifdCellCoordinate(value){
 if(!Number.isFinite(value))throw RangeError("IFD grid coordinate invalid");
 return Number((Math.floor(Number((value/CELL).toFixed(8)))*CELL+CELL/2).toFixed(4));
}
export const ifdCellKey=(lat,lon)=>
 ifdCellCoordinate(lat).toFixed(4)+","+ifdCellCoordinate(lon).toFixed(4);
export function since9amWindowMinutes(sourceUtc){
 const time=Date.parse(sourceUtc);
 if(!Number.isFinite(time))return null;
 const local=new Date(time+10*3600000); // fixed AEST (UTC+10), no DST in QLD
 const today9=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate(),9);
 const reportingStart=(local.getTime()>=today9?today9:today9-86400000)-10*3600000;
 const minutes=(time-reportingStart)/60000;
 return minutes>=1&&minutes<=24*60?minutes:null;
}
export function rainfallWindowMinutes(period,sourceUtc){
 if(!Number.isFinite(Date.parse(sourceUtc)))return null;
 return period==="lastHour"?60:period==="last24Hours"?1440:
   period==="since9am"?since9amWindowMinutes(sourceUtc):null;
}
function interpolatedDepth(table,duration,aep){
 const points=Object.entries(table||{})
  .map(([minutes,depths])=>({minutes:Number(minutes),depth:Number(depths?.[String(aep)])}))
  .filter(x=>Number.isFinite(x.minutes)&&x.minutes>0&&Number.isFinite(x.depth)&&x.depth>0)
  .sort((a,b)=>a.minutes-b.minutes);
 if(!points.length||duration<points[0].minutes||duration>points.at(-1).minutes)return null;
 const exact=points.find(p=>Math.abs(p.minutes-duration)<1e-8);
 if(exact)return {depth:exact.depth,interpolated:false};
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  if(duration>=a.minutes&&duration<=b.minutes){
   const weight=Math.log(duration/a.minutes)/Math.log(b.minutes/a.minutes);
   return {depth:Math.exp(Math.log(a.depth)+weight*Math.log(b.depth/a.depth)),interpolated:true};
  }
 }
 return null;
}
export function classifyRainfallAep({
 mm,period,sourceCreatedAt,latitude,longitude,grid
}){
 const durationMinutes=rainfallWindowMinutes(period,sourceCreatedAt);
 const cell=Number.isFinite(latitude)&&Number.isFinite(longitude)?
   ifdCellKey(latitude,longitude):null;
 const node=cell&&grid?.cells?.[cell];
 const result={band:null,aepDesignThreshold:null,classification:"unclassified",
   durationMinutes,ifdCell:cell,ifdSource:grid?.source??null,
   reason:null,interpolatedDuration:false,designDepthMm:null};
 if(!Number.isFinite(mm)||mm<0){result.reason="Invalid rainfall measurement";return result}
 if(!durationMinutes){result.reason="Observation period duration unknown";return result}
 if(!node?.depthsMmByMinutes){result.reason="Authoritative IFD grid cell unavailable";return result}
 // Validate ordering: for each duration rarer (lower AEP) depth must grow.
 const cells=[];
 for(const aep of [...AEP_LEVELS].sort((a,b)=>b-a)){
  const item=interpolatedDepth(node.depthsMmByMinutes,durationMinutes,aep);
  if(!item){result.reason="IFD has no matching duration/probability";return result}
  cells.push({aep,...item});
 }
 if(cells.some((c,i)=>i>0&&c.depth+1e-9<cells[i-1].depth)){
  result.reason="Invalid non-monotonic IFD values";return result;
 }
 result.classification="below-20pct-aep";result.reason=null;
 for(const grade of AEP_GRADES){
  const threshold=cells.find(c=>c.aep===grade.aep);
  if(mm>=threshold.depth){
   result.band=grade.band;
   result.aepDesignThreshold=grade.aep;
   result.classification="meets-ifd-design-depth";
   result.interpolatedDuration=threshold.interpolated;
   result.designDepthMm=threshold.depth;
   return result;
  }
 }
 result.designDepthMm=cells[0].depth;result.interpolatedDuration=cells[0].interpolated;
 return result;
}
