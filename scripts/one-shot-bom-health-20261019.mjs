// One-shot, read-only external BoM health probe. Run: node scripts/one-shot-bom-health-20261019.mjs
import {performance} from "node:perf_hooks";
const relay="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev";
const caps=relay+"/wmts?SERVICE=WMTS&REQUEST=GetCapabilities&VERSION=1.0.0&LAYER=atm_surf_air_precip_reflectivity_dbz";
async function check(name,url,read="text"){
 const t=performance.now();const out={name};
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{Accept:"*/*"}});
  out.status=r.status;out.type=r.headers.get("content-type");out.ms=Math.round(performance.now()-t);
  if(read==="png"){const b=Buffer.from(await r.arrayBuffer());out.bytes=b.length;out.png=b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));}
  else {const s=(await r.text()).slice(0,2000000);out.bytes=s.length;
   if(read==="caps"){const {parsePublishedReflectivityTimes}=await import("../frontend/src/bom-wmts-published-times-v1.js");try{out.times=parsePublishedReflectivityTimes(s);out.latest=out.times.at(-1)}catch(e){out.parserError=String(e.message);out.sample=s.slice(0,140)}}
   else if(read==="json"){try{const data=JSON.parse(s);out.count=data.frames?.length;out.lastFrame=data.frames?.at(-1)?.filename??null;out.sample=data.frames?.at(-1)}catch{out.sample=s.slice(0,140)}}
   else out.sample=s.slice(0,140);
  }
 }catch(e){out.error=String(e.cause?.message??e.message??e);out.ms=Math.round(performance.now()-t)}
 console.log(JSON.stringify(out));return out;
}
const results=[];
results.push(await check("BoM FTP anonymous listing via public HTTP gateway","https://www.bom.gov.au/anon/gen/radar/"));
results.push(await check("Cloudflare relay Doppler/history",""+relay+"/radar-history?product=IDR66I","json"));
results.push(await check("Cloudflare WMTS metadata",caps,"caps"));
results.push(await check("Direct BoM WMTS metadata","https://api.bom.gov.au/apikey/v1/mapping/timeseries/wmts?SERVICE=WMTS&REQUEST=GetCapabilities&VERSION=1.0.0","caps"));
const times=results[2].times??[];
if(times.length){const time=times.at(-1);const p=new URLSearchParams({SERVICE:"WMTS",REQUEST:"GetTile",VERSION:"1.0.0",LAYER:"atm_surf_air_precip_reflectivity_dbz",STYLE:"default",FORMAT:"image/png",TILEMATRIXSET:"GoogleMapsCompatible_BoM",TILEMATRIX:"8",TILEROW:"15",TILECOL:"34",time});results.push(await check("Relay verified advertised WMTS tile",relay+"/wmts?"+p,"png"))}
else console.log(JSON.stringify({name:"Relay verified advertised WMTS tile",skipped:"No verified published timestamp; never guess."}));
const last=results[1].sample;
if(last?.filename){results.push(await check("Relay genuine Doppler PNG",relay+"/radar-frame?product=IDR66I&file="+encodeURIComponent(last.filename),"png"))}
console.log("RESULT:",JSON.stringify({successful:results.filter(x=>x.status===200).length,checked:results.length,errors:results.filter(x=>x.error||x.status>=400||x.parserError).map(x=>x.name)}));
