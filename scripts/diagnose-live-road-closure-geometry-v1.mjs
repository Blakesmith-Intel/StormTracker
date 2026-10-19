import {filterFloodRoadClosures,floodRoadGeometryParts,floodRoadClosureSummary} from "../frontend/src/context-layers/flood-road-closure-filter-v1.js";
const sources=[
 ["raw","https://data.qldtraffic.qld.gov.au/events_v2.geojson"],
 ["relay","https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/flood-road-closures-v9-15"]
];
function classify(f){
 const parts=floodRoadGeometryParts(f);
 return {id:f.properties?.id,road:f.properties?.road_summary?.road_name,
  locality:f.properties?.road_summary?.locality,
  geometry:f.geometry?.type,parts:parts.map(x=>({type:x.type,length:x.coordinates?.length})),
  code:f.properties?.impact?.impact_type,
  reason:f.properties?.event_type,
  subtype:f.properties?.event_subtype};
}
for(const [label,url] of sources){
 try{
  const res=await fetch(url,{signal:AbortSignal.timeout(30000)});
  const data=await res.json();
  const active=filterFloodRoadClosures(data);
  const sourceStats={},activeStats={};
  for(const f of data.features||[])sourceStats[f.geometry?.type||"NULL"]=(sourceStats[f.geometry?.type||"NULL"]||0)+1;
  for(const f of active.features||[])activeStats[f.geometry?.type||"NULL"]=(activeStats[f.geometry?.type||"NULL"]||0)+1;
  console.log("QLDTRAFFIC_GEOMETRY_AUDIT",JSON.stringify({
   label,status:res.status,sourceLength:data.features?.length,activeLength:active.features.length,
   sourceStats,activeStats,sourceSample:(data.features||[]).slice(0,4).map(classify),
   activeSample:active.features.slice(0,16).map(classify),
   activeWithRealLines:active.features.filter(f=>floodRoadGeometryParts(f).some(p=>p.type==="LineString"||p.type==="MultiLineString")).length,
   activeWithoutRealLines:active.features.filter(f=>!floodRoadGeometryParts(f).some(p=>p.type==="LineString"||p.type==="MultiLineString")).length
  }));
 }catch(e){console.log("QLDTRAFFIC_SOURCE_AUDIT_ERROR",label,String(e));}
}
