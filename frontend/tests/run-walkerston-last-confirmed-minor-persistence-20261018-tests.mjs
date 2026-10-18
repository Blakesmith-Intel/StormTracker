import assert from "node:assert/strict";
import {
  OFFICIAL_FLOOD_STORAGE_KEY,retainConfirmedFloodStations,
  cleanConfirmedFloodStations
} from "../src/context-layers/river-official-flood-persistence-v1.js";
import {reconcileFloodEvents}
  from "../src/context-layers/river-flood-events-v1.js";
import {evaluateFloodSignal,parseQueenslandObservationTime}
  from "../src/context-layers/river-flood-signals-v1.js";
import {riverGaugePanelAppearance,riverGaugeOperationalSummary}
  from "../src/context-layers/river-gauges-operational-v1.js";

const now=Date.parse("2026-10-18T06:41:00Z");
const at=Date.parse("2026-10-18T04:18:00Z");
const observed="02.18PM Sun";
const walkerston={type:"Feature",id:"bom:533142",
  geometry:{type:"Point",coordinates:[149.0556,-21.1594]},
  properties:{bom_stn_num:533142,awrc_stateid:"125???",
    name:"Walkerston (Bakers Creek)",state:"QLD",
    lat:-21.1594,long:149.0556,location_types:"rain gauge;water level gauge;",
    forecast_site_classification:"information",
    STORMTRACKER_HEIGHT_METRES:2.75,
    STORMTRACKER_TENDENCY:"falling",
    STORMTRACKER_FLOOD_CLASS:"minor",
    STORMTRACKER_OBSERVED_TEXT:observed,
    STORMTRACKER_SOURCE_PRODUCT:"IDQ60290"}};
assert.equal(parseQueenslandObservationTime(observed,now),at);
assert.ok(now-at>90*60000);
assert.equal(OFFICIAL_FLOOD_STORAGE_KEY,"stormtracker.qld-confirmed-flood-stations.v1");
const decision=evaluateFloodSignal(walkerston,{},now);
assert.equal(decision.show,true,
  "Real Bakers Creek at Walkerston station 533142 must be visible past 90 minutes");
assert.equal(decision.state,"minor");
assert.equal(decision.stale,true);
assert.equal(decision.rapidRise,false,"Never attach an old rapid rise to stale flood marker");
const stage=reconcileFloodEvents([walkerston],{},{},now);
assert.equal(stage.features.length,1);
assert.equal(stage.features[0].properties.STORMTRACKER_DISPLAY_STATE,"minor");
assert.equal(stage.features[0].properties.STORMTRACKER_OBSERVATION_STALE,true);
assert.equal(stage.features[0].properties.STORMTRACKER_OFFICIAL_OBSERVED_AT,at);
const panel=riverGaugePanelAppearance(riverGaugeOperationalSummary(stage.features[0]));
assert.match(panel.category,/BOM MINOR FLOOD/);
assert.match(panel.category,/LAST CONFIRMED, STALE/);
assert.equal(panel.state,"minor");

let {features,cache}=retainConfirmedFloodStations([walkerston],{},now);
assert.equal(features.length,1);
assert.equal(cache["bom:533142"].observedAt,at);
// Reload/refresh when source stops reporting, or when one bulletin is partial:
// retain this EXACT source-ID and clearly mark its past observation.
({features,cache}=retainConfirmedFloodStations([],cache,now+2*3600000));
assert.deepEqual(features.map(f=>f.id),["bom:533142"]);
assert.equal(reconcileFloodEvents(features,{}, {},now+2*3600000).features.length,1);
({features,cache}=retainConfirmedFloodStations([],cache,now+72*3600000));
assert.equal(features.length,1,"Missing data is NOT a new below-minor observation");
assert.equal(reconcileFloodEvents(features,{}, {},now+72*3600000).features[0]
  .properties.STORMTRACKER_OBSERVATION_STALE,true);
assert.equal(Object.keys(cleanConfirmedFloodStations(cache,now+72*3600000)).length,1);

const below={...walkerston,properties:{...walkerston.properties,
  STORMTRACKER_HEIGHT_METRES:0.9,
  STORMTRACKER_FLOOD_CLASS:"below-minor",
  STORMTRACKER_OBSERVED_TEXT:"04.41PM Sun"}};
const newNow=Date.parse("2026-10-18T06:45:00Z");
({features,cache}=retainConfirmedFloodStations([below],cache,newNow));
assert.equal(cache["bom:533142"],undefined,
  "Newer explicitly below-minor BoM station observation clears saved stage");
assert.equal(reconcileFloodEvents(features,{}, {},newNow).features.length,0);
assert.equal(retainConfirmedFloodStations([],cache,newNow).features.length,0);

// A separate station with a similar name is never matched by locality.
const other={...walkerston,id:"bom:533063",
  properties:{...walkerston.properties,bom_stn_num:533063,name:"Bakers Creek"}};
const isolated=retainConfirmedFloodStations([walkerston,other],{},now);
assert.deepEqual(Object.keys(isolated.cache).sort(),["bom:533063","bom:533142"]);
assert.equal(retainConfirmedFloodStations([below],isolated.cache,newNow)
  .cache["bom:533063"].feature.id,"bom:533063");

// Unknown/invalid or unverified gauge identifiers are not allowed to
// forge local official flood stages.
assert.deepEqual(cleanConfirmedFloodStations({"bom:533142":{
  observedAt:at,feature:{...walkerston,id:"bom:999999"}
}},now),{});

console.log("PASS live 18 Oct 2026 Bakers Creek at Walkerston 533142 2.75m minor (1.40m threshold) retains green marker after 143-minute stale reading; no arrow, stage preserved across gaps and ID-only below-minor recovery.");
