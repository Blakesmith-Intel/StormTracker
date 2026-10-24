import assert from "node:assert/strict";
import {joinRiverGaugeObservations} from "../frontend/src/context-layers/river-gauge-observations-v1.js";
import {withStationFloodLevels} from "../frontend/src/context-layers/river-flood-thresholds-v1.js";
import {reconcileFloodEvents} from "../frontend/src/context-layers/river-flood-events-v1.js";
import {planBoMStationTableLookups} from "../frontend/src/context-layers/bom-recent-river-history-v1.js";
const worker="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev";
const req=async path=>{
 const res=await fetch(worker+path,{headers:{Origin:"https://blakesmith-intel.github.io"},signal:AbortSignal.timeout(20000)});
 assert.equal(res.status,200,path+": "+res.status);
 return await res.json();
};
const [gauge,bulletin,recent]=await Promise.all([
 req("/river-gauge-metadata"),
 req("/river-height-bulletins?force=1"),
 req("/river-recent-history?product=IDQ65392&station=535162")
]);
assert.equal(recent.station,"535162");
assert.equal(recent.crossing?.heightMetres,1.71);
const features=withStationFloodLevels(joinRiverGaugeObservations({
 gauges:gauge,bulletins:bulletin,nowMs:Date.now()
}).payload.features);
const found=features.find(f=>f.id==="bom:535162");
assert(found,"535162 must be joined by exact ID, not guessed name");
const plan=planBoMStationTableLookups(features,{nowMs:Date.now()});
assert(plan.some(x=>x.id==="bom:535162"),
 "Whole-state discovery planner must include 535162 even when bulletin says steady");
const enriched={...found,properties:{...found.properties,
 STORMTRACKER_PLOT_CROSSING:recent.crossing}};
const actual=enriched.properties.STORMTRACKER_HEIGHT_METRES;
assert(actual>=1.71,"Source level must currently exceed bridge reference");
const signals=reconcileFloodEvents([enriched],{}, {},Date.now());
assert.equal(signals.features.length,1,
 "End-to-end current BoM data must produce mapped crossing signal");
const marker=signals.features[0];
assert.equal(marker.id,"bom:535162");
assert.equal(marker.properties.STORMTRACKER_CROSSING_REACHED,true);
assert.equal(marker.properties.STORMTRACKER_DISPLAY_STATE,"elevated");
assert.equal(marker.properties.STORMTRACKER_CROSSING_LEVEL_METRES,1.71);
assert.deepEqual(marker.geometry.coordinates,found.geometry.coordinates,
 "Never modify exact real-world gauge coordinates");
console.log("PASS LIVE 535162 end-to-end BoM station join, crossing reference, current height, map selection and original coordinates",JSON.stringify({
 height:actual,crossing:recent.crossing.heightMetres,
 tendency:enriched.properties.STORMTRACKER_TENDENCY,latitude:marker.geometry.coordinates[1],
 longitude:marker.geometry.coordinates[0],alert:marker.properties.STORMTRACKER_DISPLAY_STATE
}));
