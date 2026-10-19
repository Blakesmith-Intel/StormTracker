#!/usr/bin/env node
import {loadPowerOutages,ENERGEX_OUTAGE_AREA_QUERY_URL,ENERGEX_OUTAGE_POINT_QUERY_URL,isCurrentPowerOutage} from "../frontend/src/context-layers/power-outages-v1.js";
const fetcher=async url=>fetch(url,{signal:AbortSignal.timeout(18000)});
for(const [kind,url] of [["area",ENERGEX_OUTAGE_AREA_QUERY_URL],["point",ENERGEX_OUTAGE_POINT_QUERY_URL]]){
 try{
  const res=await fetcher(url);const body=await res.json();
  const matching=(body.features??[]).filter(f=>/wynnum|manly|lota|tingalpa|wakerley|hemman/i.test(String(f.properties?.SUBURBS??"")));
  console.log("ENERGEX_LIVE_AREA_OR_POINT",JSON.stringify({kind,status:res.status,features:body.features?.length,error:body.error,match:matching.map(f=>({
   id:f.id,properties:f.properties,geoType:f.geometry?.type,
   coordinates:f.geometry?.coordinates?.length,nowValid:isCurrentPowerOutage(f)
  })).slice(0,15)}));
 }catch(e){console.log("ENERGEX_LIVE_FAILED",kind,String(e))}
}
try{
 const m=await loadPowerOutages({fetchImpl:fetcher});
 console.log("STORMTRACKER_FILTERED_LIVE_OUTAGES",JSON.stringify({features:m.payload.features.length,providers:m.providers,partial:m.partial,failed:m.failedProviders,aroundWynnum:m.payload.features.filter(f=>/wynnum|manly|lota|tingalpa|wakerley|hemman/i.test(String(f.properties?.SUBURBS??""))).map(f=>({id:f.id,properties:f.properties,geometry:f.geometry?.type}))}));
}catch(e){console.log("STORMTRACKER_LIVE_OUTAGES_FAILED",String(e))}
