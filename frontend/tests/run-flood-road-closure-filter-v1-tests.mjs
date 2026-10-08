import assert from "node:assert/strict";
import {
  filterFloodRoadClosures,
  filterLegacyFloodRoadClosures,
  isActiveFloodRoadClosure,
  isFloodRelatedRoadEvent,
  isRoadClosureEvent
} from "../src/context-layers/flood-road-closure-filter-v1.js";

const referenceTime=Date.parse("2026-10-09T00:00:00+10:00");
function event({
  id, status="Published", event_type="Flooding",
  event_subtype="Flash flooding",event_due_to="",
  impact_type="Closures",impact_subtype="Road closed to all traffic",
  description="",duration=null
}={}){
  return {type:"Feature",geometry:{type:"Point",coordinates:[153,-27]},
    properties:{id,status,event_type,event_subtype,event_due_to,description,
      ...(duration?{duration}:{}),
      impact:{impact_type,impact_subtype},
      road_summary:{road_name:"Test Road"}}};
}

const permitted=[
  event({id:"flash",event_subtype:"Flash flooding"}),
  event({id:"long-term",event_subtype:"Long-term flooding"}),
  event({id:"earlier",event_type:"Hazard",event_subtype:"Road damage",event_due_to:"Earlier flooding"}),
  event({id:"heavy-rain",event_type:"Hazard",event_subtype:"Road damage",event_due_to:"Heavy rain"})
];
for(const f of permitted){
  assert.equal(isFloodRelatedRoadEvent(f),true, f.properties.id);
  assert.equal(isRoadClosureEvent(f),true, f.properties.id);
  assert.equal(isActiveFloodRoadClosure(f,referenceTime),true,f.properties.id);
}
const rejected=[
  ["no-all-traffic",event({id:"not-all",impact_subtype:"Road closed to through traffic"})],
  ["restriction",event({id:"restriction",impact_type:"Restrictions"})],
  ["water-over-road",event({id:"water",event_type:"Hazard",event_subtype:"Road damage",event_due_to:"Water over road"})],
  ["earlier-flash",event({id:"earlier-flash",event_type:"Hazard",event_subtype:"Road damage",event_due_to:"Earlier flash flooding"})],
  ["flooding-generic",event({id:"flooding",event_subtype:"",event_due_to:""})],
  ["crash-mention",event({id:"description",event_type:"Crash",event_subtype:"",event_due_to:"Other",description:"Flash flooding in free text"})],
  ["planned",event({id:"planned",status:"Draft"})],
  ["ended",event({id:"ended",duration:{end:"2026-10-08T23:00:00+10:00"}})],
  ["future",event({id:"future",duration:{start:"2026-10-09T01:00:00+10:00"}})]
];
for(const [name,f] of rejected)
  assert.equal(isActiveFloodRoadClosure(f,referenceTime),false,name);

assert.equal(isActiveFloodRoadClosure(event({
  id:"local-time",duration:{start:"2026-10-08T23:30:00",end:"2026-10-09T00:30:00"}
}),referenceTime),true,"Published timezone-less records are interpreted as AEST");

const laidley=event({
  id:750590,event_type:"Hazard",event_subtype:"Road damage",
  event_due_to:"Earlier flooding",
  duration:{start:"2026-06-30T14:26:00+10:00",end:"2026-11-30T14:26:00+10:00"}
});
assert.equal(isActiveFloodRoadClosure(laidley,referenceTime),true,
  "QLDTraffic event 750590, Laidley Creek West Road, must pass the exact rule");

const result=filterFloodRoadClosures({
  type:"FeatureCollection",features:[...permitted,...rejected.map(([,x])=>x),laidley]
},referenceTime);
assert.deepEqual(result.features.map(f=>f.properties.id),
  ["flash","long-term","earlier","heavy-rain",750590]);

const legacy=filterLegacyFloodRoadClosures({type:"FeatureCollection",features:[
  event({id:"legacy-water-over-road",event_type:"Hazard",
    event_subtype:"Road damage",event_due_to:"Water over road"}),
  event({id:"legacy-rain",event_type:"Hazard",
    event_subtype:"Road damage",event_due_to:"Heavy rain"}),
  event({id:"legacy-through",event_type:"Flooding",
    impact_subtype:"Road closed to through traffic"})
]},referenceTime);
assert.deepEqual(legacy.features.map(x=>x.properties.id),
  ["legacy-water-over-road","legacy-through"],
  "The deployed V9.13 road endpoint must retain its existing broader classifications");
console.log("PASS dual QLDTraffic policies — original v4 endpoint remains unchanged; strict V9.15 policy isolated");
console.log("PASS QLDTraffic closure classification: only current, published, all-traffic closures due to Flash flooding, Long-term flooding, Earlier flooding or Heavy rain, including Laidley Creek West event 750590");
