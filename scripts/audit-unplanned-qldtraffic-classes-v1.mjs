// Read-only live QLDTraffic classification audit. Used to define "unplanned".
const url="https://data.qldtraffic.qld.gov.au/events_v2.geojson";
const response=await fetch(url,{signal:AbortSignal.timeout(25000)});
if(!response.ok)throw Error("QLDTraffic HTTP "+response.status);
const payload=await response.json();if(!Array.isArray(payload?.features))throw Error("No features");
const counts=new Map();const examples=new Map();const keys=new Set();let all=0;
for(const f of payload.features){
 const p=f.properties??{},impact=p.impact??{};
 if(String(p.status).toLowerCase()!=="published"||
    String(impact.impact_type).toLowerCase()!=="closures"||
    String(impact.impact_subtype).toLowerCase()!=="road closed to all traffic")continue;
 all++;
 const k=[p.event_type,p.event_subtype,p.event_due_to].map(v=>v??"").join(" | ");
 counts.set(k,(counts.get(k)??0)+1);
 if(!examples.has(k))examples.set(k,{id:p.id,road:p.road_summary?.road_name,starts:p.duration?.start,ends:p.duration?.end});
 for(const key of Object.keys(p))if(/plan|schedule|nature|type|status|advice|duration/i.test(key))keys.add(key);
}
console.log("AUDIT",JSON.stringify({totalUpstream:payload.features.length,allTrafficPublished:all,
  groups:[...counts.entries()].sort((a,b)=>b[1]-a[1]).map(([classifications,count])=>({classifications,count,example:examples.get(classifications)})),
  planningRelatedFields:[...keys].sort()}));
