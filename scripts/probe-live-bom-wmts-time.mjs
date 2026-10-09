// Read-only verification of live public BOM WMTS advertised time dimension.
// No fake scans, no production worker mutations or background services.
import {candidateBomReflectivityTimes,buildBomReflectivityTileUrl} from
  "../frontend/src/bom-wmts-loop-v2.js";
const base="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/wmts";
async function probe(url,label){
  try{
    const r=await fetch(url,{
      signal:AbortSignal.timeout(12000),
      headers:{accept:"application/xml,text/xml,image/png,*/*"}
    });
    const bytes=Buffer.from(await r.arrayBuffer());
    const ct=r.headers.get("content-type")??"";
    console.log("LIVE_WMTS_SOURCE_PROBE",JSON.stringify({
      label,http:r.status,contentType:ct,bytes:bytes.length,
      message:ct.includes("image")?null:bytes.toString("utf8",0,Math.min(220,bytes.length))
    }));
    return {r,body:bytes.toString("utf8")};
  }catch(e){
    console.log("LIVE_WMTS_SOURCE_PROBE",JSON.stringify({label,error:String(e)}));return null;
  }
}
const caps=await probe(base+"?SERVICE=WMTS&REQUEST=GetCapabilities&VERSION=1.0.0",
  "relay capabilities");
if(caps?.r.ok){
  const xml=caps.body;
  for(const key of ["atm_surf_air_precip_reflectivity_dbz",
     "<Dimension>","<ows:Identifier>time","<Default>","<Value>"]){
    const i=xml.indexOf(key);
    if(i>=0) console.log("LIVE_WMTS_CAPABILITIES_EXCERPT",
      JSON.stringify({key,excerpt:xml.slice(Math.max(0,i-150),i+1600)}));
  }
}
const candidates=candidateBomReflectivityTimes(Date.now(),12);
for(const utc of candidates){
  const url=buildBomReflectivityTileUrl(34,15,utc);
  const result=await probe(url,utc);
  if(result?.r.status===200 && String(result.r.headers.get("content-type")).includes("image")){
    console.log("WMTS_VALID_SOURCE_OBSERVED_AT",utc);
  }
}
