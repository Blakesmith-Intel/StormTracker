// Read only published QLDTraffic event/impact classifications and public
// official icon PNGs. Never use a third-party traffic record for status.
const upstream="https://data.qldtraffic.qld.gov.au/events_v2.geojson";
const relay="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/flood-road-closures";
const sources=[["QLDTraffic official raw",upstream],["StormTracker relay",relay]];
function brief(f){
 const p=f?.properties??{};
 return {id:p.id,status:p.status,event_type:p.event_type,
  event_subtype:p.event_subtype,event_due_to:p.event_due_to,
  impact:p.impact,road_summary:p.road_summary,
  duration:p.duration,web_link:p.web_link,geometry:f.geometry};
}
for(const [label,url] of sources){
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(18000),
    headers:{Origin:"https://blakesmith-intel.github.io",Accept:"application/geo+json,application/json"}});
  const ct=response.headers.get("content-type");
  const payload=await response.json();
  const features=Array.isArray(payload.features)?payload.features:[];
  const matches=features.filter(f=>String(f.properties?.id??"")==="750590"||
    /laidley creek west/i.test(JSON.stringify(f.properties?.road_summary??"")));
  const causeCounts={};
  for(const f of features){
    if(String(f.properties?.impact?.impact_type??"").toLowerCase()==="closures"){
      const k=[f.properties?.event_type,f.properties?.event_subtype,f.properties?.event_due_to].join("|");
      causeCounts[k]=(causeCounts[k]??0)+1;
    }
  }
  console.log("SOURCE_AUDIT",JSON.stringify({label,status:response.status,ct,total:features.length,
    sourceCache:payload?.stormtracker??null,events:matches.map(brief),
    classifiedClosureReasons:Object.entries(causeCounts).sort((a,b)=>b[1]-a[1]).slice(0,40)}));
 }catch(e){console.log("SOURCE_ERROR",label,String(e));}
}
for(const [label,url] of [
 ["closed-all","https://qldtraffic-workflow.s3.ap-southeast-2.amazonaws.com/test/reportimages/RoadImpacts_RoadClosed.png"],
 ["closed-through","https://qldtraffic-workflow.s3.ap-southeast-2.amazonaws.com/test/reportimages/RoadImpacts_NoThru.png"]
]){
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(14000)});
  const buf=Buffer.from(await response.arrayBuffer());
  console.log("OFFICIAL_ICON",JSON.stringify({label,status:response.status,
    length:buf.length,mime:response.headers.get("content-type"),
    signature:buf.subarray(0,8).toString("hex"),base64:buf.toString("base64")}));
 }catch(e){console.log("ICON_ERROR",label,String(e));}
}

const {floodRoadClosureMarkerCoordinate}=await import("../frontend/src/context-layers/flood-road-closures-v1.js");
const {isActiveFloodRoadClosure}=await import("../frontend/src/context-layers/flood-road-closure-filter-v1.js");
const fresh=await (await fetch(upstream,{signal:AbortSignal.timeout(20000)})).json();
for(const f of fresh.features.filter(f=>Number(f.properties?.id)===750590)){
 console.log("MAP_ADAPTER_AUDIT",JSON.stringify({id:f.properties.id,
  passesFilter:isActiveFloodRoadClosure(f),
  markerCoordinate:floodRoadClosureMarkerCoordinate(f),rawGeometry:f.geometry}));
}
