import {parsePublishedReflectivityTimes} from "../frontend/src/bom-wmts-published-times-v1.js";
import {reflectivityWindowForRegion,buildBomReflectivityTileUrl} from "../frontend/src/bom-wmts-loop-v2.js";
const CAP="https://api.bom.gov.au/apikey/v1/mapping/timeseries/wmts/1.0.0/WMTSCapabilities.xml";
const BASE="https://api.bom.gov.au/apikey/v1/mapping/timeseries/wmts";
const f=await fetch(CAP,{headers:{Accept:"application/xml,text/xml;q=0.9,*/*;q=0.1"},signal:AbortSignal.timeout(20000)});
const xml=await f.text();let times=[];
try{times=parsePublishedReflectivityTimes(xml)}catch(e){console.log("NATIVE_CAPABILITIES_PARSE_ERROR",String(e))}
console.log("NATIVE_BOM_CAPABILITIES_STATUS",JSON.stringify({status:f.status,bytes:xml.length,date:f.headers.get("date"),age:Date.now()-Date.parse(times.at(-1)),count:times.length,latest:times.slice(-11),allowOrigin:f.headers.get("access-control-allow-origin"),start:xml.slice(0,150)}));
if(!f.ok||!times.length)throw Error("Official native BoM capabilities not accessible");
const last=times.filter(t=>Date.now()-Date.parse(t)<75*60000&&Date.now()-Date.parse(t)>-5*60000).slice(-5).reverse();
if(!last.length)throw Error("Official native BoM times are stale");
for(const region of ["66","107","SEQ"]){
 const area=reflectivityWindowForRegion(region);
 const col=Math.floor((area.colStart+area.colEnd)/2),row=Math.floor((area.rowStart+area.rowEnd)/2);
 let found=false;
 for(const t of last.slice(0,4)){
  const native=buildBomReflectivityTileUrl(col,row,t).replace("https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/wmts",BASE);
  try{
   const res=await fetch(native,{signal:AbortSignal.timeout(16000)});
   const data=new Uint8Array(await res.arrayBuffer());
   const png=data.length>32&&[137,80,78,71,13,10,26,10].every((v,i)=>v===data[i]);
   console.log("NATIVE_BOM_HIRES_TILE",JSON.stringify({region,col,row,time:t,status:res.status,bytes:data.length,png,cors:res.headers.get("access-control-allow-origin"),cache:res.headers.get("cache-control"),description:png?"":new TextDecoder().decode(data.slice(0,160))}));
   if(png&&res.ok){found=true;break}
  }catch(e){console.log("NATIVE_BOM_HIRES_PROBE_FAILURE",JSON.stringify({region,time:t,error:String(e)}))}
 }
 if(!found)throw Error("BoM native high-res imagery unavailable: "+region);
}
console.log("NATIVE_BOM_HIRES_CONFIRMED_LIVE_SOURCE_PASS");
