// Diagnostic-only (GitHub Actions), not part of StormTracker production.
// Compare actual BoM radar 66 WMTS readable tiles and historical Doppler GIFs.
import { buildBomReflectivityTileUrl, reflectivityWindowForRegion,
  candidateBomReflectivityTimes } from "../frontend/src/bom-wmts-loop-v2.js";
import { buildSharedProductTimeline,
  buildRadarPrimaryProductTimeline } from "../frontend/src/shared-product-timeline-v1.js";
import { buildDopplerHistoryUrl, nearestDopplerFrameForTime } from "../frontend/src/bom-doppler-intake-v3.js";

async function get(url, ms=10000) {
  const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(ms)});
  if(!response.ok)throw Error("HTTP "+response.status+" "+url.slice(0,80));
  return response;
}
const region="66",id="66";
const radarHistoryURL=buildDopplerHistoryUrl(id);
const response=await get(radarHistoryURL,18000);
const history=await response.json();
if(history?.format!=="StormTrackerDopplerHistoryV1" || !Array.isArray(history.frames))
  throw Error("Unexpected BoM history response");
const frames=history.frames
  .filter(v=>v.observedUtc && v.filename)
  .sort((a,b)=>Date.parse(a.observedUtc)-Date.parse(b.observedUtc));
console.log("HISTORY_FROM_BOM_RADAR66",JSON.stringify({
  total:frames.length,first:frames[0]?.observedUtc,last:frames.at(-1)?.observedUtc,
  filenames:frames.slice(-12).map(x=>({at:x.observedUtc,file:x.filename}))
}));
const tileWindow=reflectivityWindowForRegion(region);
const tileLocations=[];
for(let row=tileWindow.rowStart;row<=tileWindow.rowEnd;row++)
 for(let col=tileWindow.colStart;col<=tileWindow.colEnd;col++)
   tileLocations.push({row,col});
console.log("WMTS_TILE_WINDOW",JSON.stringify({region,tileWindow,count:tileLocations.length}));
const now=Date.now();
const candidates=candidateBomReflectivityTimes(now,16);
const statuses=[];
for(const at of candidates){
  let results=[];
  for(const {row,col} of tileLocations){
    const url=buildBomReflectivityTileUrl(col,row,at);
    try {
      const r=await get(url,10000);
      const contentType=r.headers.get("content-type")??"";
      if(!contentType.includes("image/"))throw Error("nonimage "+contentType);
      const bytes=await r.arrayBuffer();
      if(bytes.byteLength===0)throw Error("empty image");
      results.push({col,row,ok:true,bytes:bytes.byteLength});
    }catch(e){results.push({col,row,ok:false,error:String(e.message).slice(0,100)});}
  }
  const passed=results.filter(x=>x.ok).length;
  const matching=nearestDopplerFrameForTime(frames,at,8);
  const entry={at,wmtsComplete:passed===results.length,readableTiles:passed,
    totalTiles:results.length,missing:results.filter(x=>!x.ok),
    dopplerMatched:matching.matched,dopplerDeltaMinutes:matching.deltaMinutes,
    dopplerUtc:matching.candidate?.observedUtc??null};
  statuses.push(entry);
  console.log("RADAR66_FRAME",JSON.stringify(entry));
}
const complete=statuses.filter(x=>x.wmtsComplete).map(x=>x.at).reverse();
const selected=complete.slice(-7);
const strict=buildSharedProductTimeline(selected,new Map([[id,{frames}]]),new Map(),[id]);
const left=buildRadarPrimaryProductTimeline(selected,new Map([[id,{frames}]]),new Map(),[id],8);
console.log("RADAR66_COVERAGE_SUMMARY",JSON.stringify({
  latestDate:new Date(now).toISOString(),
  frameProbeCount:statuses.length,
  fullyReadableRadarFrames:complete.length,
  selectedObservedRadarFrames:selected.length,
  selectedStrictSharedFrames:strict.entries.length,
  selectedRadarPrimaryFrames:left.entries.length,
  selectedMatchedDopplerFrames:left.entries.filter(x=>x.pairings.some(p=>p.matched)).length,
  historicalDopplerFramesWithinSelectedWindow:frames.filter(x=>selected.length &&
    Date.parse(x.observedUtc)>=Date.parse(selected[0])-8*60000 &&
    Date.parse(x.observedUtc)<=Date.parse(selected.at(-1))+8*60000).length
}));
if(!frames.length)throw Error("Source history empty: cannot diagnose shared Doppler loop");
if(!complete.length)throw Error("No complete WMTS mosaics found; radar relay likely unavailable");
