import assert from "node:assert/strict";
import {
  filterFloodRoadClosures,filterLegacyFloodRoadClosures,
  isActiveFloodRoadClosure,isUnplannedRoadClosureEvent,
  isRoadClosureEvent
} from "../src/context-layers/flood-road-closure-filter-v1.js";

const now=Date.parse("2026-10-09T00:00:00+10:00");
function event({
  id,status="Published",event_type="Hazard",event_subtype="Road damage",
  event_due_to="",impact_type="Closures",
  impact_subtype="Road closed to all traffic",
  duration=null,description=""
}={}){
  return {type:"Feature",geometry:{type:"Point",coordinates:[153,-27]},
    properties:{id,status,event_type,event_subtype,event_due_to,description,
      ...(duration?{duration}:{}),
      impact:{impact_type,impact_subtype},
      road_summary:{road_name:"Test Road"}}};
}
const eligible=[
  event({id:"flash",event_type:"Flooding",event_subtype:"Flash flooding",event_due_to:"Heavy rain"}),
  event({id:"long-term",event_type:"Flooding",event_subtype:"Long-term flooding"}),
  event({id:"earlier",event_due_to:"Earlier flooding"}),
  event({id:"heavy-rain",event_due_to:"Heavy rain"}),
  event({id:"other-road-damage"}),
  event({id:"bridge-damaged",event_subtype:"Bridge or culvert damaged"}),
  event({id:"crash",event_type:"Crash",event_subtype:"Multi-vehicle crash"}),
  event({id:"emergency-roadworks",event_type:"Roadworks",event_subtype:"Emergency roadworks"}),
  event({id:"unexpected",event_type:"Other",event_subtype:"Unexpected obstruction"})
];
for(const f of eligible){
  assert.equal(isUnplannedRoadClosureEvent(f),true,f.properties.id);
  assert.equal(isRoadClosureEvent(f),true,f.properties.id);
  assert.equal(isActiveFloodRoadClosure(f,now),true,f.properties.id);
}
const rejected=[
 ["planned-roadworks",event({id:"planned-works",event_type:"Roadworks",event_subtype:"Planned roadworks"})],
 ["scheduled-roadworks",event({id:"scheduled-works",event_type:"Roadworks",event_subtype:"Scheduled maintenance"})],
 ["ambiguous-roadworks",event({id:"ambiguous-works",event_type:"Roadworks",event_subtype:""})],
 ["planned-event",event({id:"planned-event",event_type:"Special event",event_subtype:"Planned public event"})],
 ["unclassified-event",event({id:"unclassified",event_type:"",event_subtype:""})],
 ["through-traffic-only",event({id:"through",impact_subtype:"Road closed to through traffic"})],
 ["partial-restriction",event({id:"restriction",impact_type:"Restrictions"})],
 ["draft-incident",event({id:"draft",status:"Draft"})],
 ["future",event({id:"future",duration:{start:"2026-10-09T01:00:00+10:00"}})],
 ["expired",event({id:"expired",duration:{end:"2026-10-08T23:00:00+10:00"}})]
];
for(const [name,f] of rejected){
  assert.equal(isActiveFloodRoadClosure(f,now),false,name);
}
const local=event({id:"local",duration:{
  start:"2026-10-08T23:30:00",end:"2026-10-09T00:30:00"
}});
assert.equal(isActiveFloodRoadClosure(local,now),true,"AEST naive official timestamps");
const laidley=event({id:750590,event_type:"Hazard",event_subtype:"Road damage",
  event_due_to:"Earlier flooding",duration:{
    start:"2026-06-30T14:26:00+10:00",end:"2026-11-30T14:26:00+10:00"
}});
assert.equal(isActiveFloodRoadClosure(laidley,now),true,"Laidley Creek West Road 750590");
const filtered=filterFloodRoadClosures({type:"FeatureCollection",
  features:[...eligible,...rejected.map(([,f])=>f),laidley]
},now);
assert.deepEqual(filtered.features.map(f=>f.properties.id),
  [...eligible.map(f=>f.properties.id),750590]);

// Legacy production /flood-road-closures remains entirely unchanged.
const legacy=filterLegacyFloodRoadClosures({type:"FeatureCollection",features:[
 event({id:"legacy-flood",event_type:"Flooding",event_subtype:"Long-term flooding"}),
 event({id:"legacy-water",event_due_to:"Water over road"}),
 event({id:"legacy-through",event_type:"Flooding",impact_subtype:"Road closed to through traffic"}),
 event({id:"legacy-bridge",event_subtype:"Bridge or culvert damaged"})
]},now);
assert.deepEqual(legacy.features.map(f=>f.properties.id),
  ["legacy-flood","legacy-water","legacy-through"]);
console.log("PASS V9.15 all-traffic unplanned closures, hazards, crash/emergency works, planned-work exclusions, AEST dates and Laidley Creek West; legacy production preserved.");
