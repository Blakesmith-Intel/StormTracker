import assert from "node:assert/strict";
import {
  LATEST_RIVER_GAUGE_STORAGE_KEY,cleanLatestGaugeObservations,
  retainLatestGaugeObservations
} from "../src/context-layers/river-gauge-latest-v1.js";
import {
  OFFICIAL_FLOOD_STORAGE_KEY,cleanConfirmedFloodStations,
  retainConfirmedFloodStations
} from "../src/context-layers/river-official-flood-persistence-v1.js";
import {reconcileFloodEvents} from "../src/context-layers/river-flood-events-v1.js";
import {DEFAULT_RIVER_GAUGE_REFRESH_MS} from "../src/context-layers/river-gauges-v1.js";

const now=Date.UTC(2026,9,19,13,36); // Monday 23:36 AEST
const station=(id,name,height,time,flood="",tendency="falling")=>({
  id:"bom:"+id,type:"Feature",
  geometry:{type:"Point",coordinates:[149.5583,-25.7961]},
  properties:{
    bom_stn_num:id,name,state:"QLD",lat:-25.7961,long:149.5583,
    location_types:"water level gauge;",
    STORMTRACKER_HEIGHT_METRES:height,
    STORMTRACKER_OBSERVED_TEXT:time,
    STORMTRACKER_FLOOD_CLASS:flood,
    STORMTRACKER_TENDENCY:tendency,
    STORMTRACKER_SOURCE_PRODUCT:"IDQ60289"
  }
});
const taranaOld=station("535142","Tarana Crossing ALERT",6.64,"9.37PM Mon","major");
const taranaLatest=station("535142","Tarana Crossing ALERT",0.23,"10.57PM Mon","");
const panoramaOld=station("535214","Panorama Creek at Dawson Highway",2.50,"10.59PM Mon","");
const panoramaLatest=station("535214","Panorama Creek at Dawson Highway",2.55,"11.14PM Mon","");
assert.equal(DEFAULT_RIVER_GAUGE_REFRESH_MS,10*60*1000);
assert.ok(LATEST_RIVER_GAUGE_STORAGE_KEY && OFFICIAL_FLOOD_STORAGE_KEY);

let newest=retainLatestGaugeObservations([taranaOld,panoramaOld],{},now);
let classState=retainConfirmedFloodStations(newest.features,{},now);
assert.equal(classState.features[0].properties.STORMTRACKER_HEIGHT_METRES,6.64);
assert.ok(classState.cache["bom:535142"]);
newest=retainLatestGaugeObservations([taranaLatest,panoramaLatest],newest.cache,now);
classState=retainConfirmedFloodStations(newest.features,classState.cache,now);
const tarana=classState.features.find(f=>f.id==="bom:535142");
const panorama=classState.features.find(f=>f.id==="bom:535214");
assert.equal(tarana.properties.STORMTRACKER_HEIGHT_METRES,0.23,
  "New verified Tarana reading must replace the prior 6.64m in the popup");
assert.equal(tarana.properties.STORMTRACKER_OBSERVED_TEXT,"10.57PM Mon",
  "Displayed observation time must be the 22:57 SOURCE time, not 21:37");
assert.equal(tarana.properties.STORMTRACKER_LAST_CONFIRMED_FLOOD_CLASS,"major",
  "An omitted flood class must not silently cancel an official earlier status");
assert.ok(tarana.properties.STORMTRACKER_LAST_CONFIRMED_FLOOD_AT <
  tarana.properties.STORMTRACKER_OFFICIAL_OBSERVED_AT);
assert.equal(panorama.properties.STORMTRACKER_HEIGHT_METRES,2.55);
assert.equal(panorama.properties.STORMTRACKER_OBSERVED_TEXT,"11.14PM Mon");
const mapped=reconcileFloodEvents(classState.features,{}, {},now);
const taranaMarker=mapped.features.find(x=>x.id==="bom:535142");
assert.ok(taranaMarker);
assert.equal(taranaMarker.properties.STORMTRACKER_HEIGHT_METRES,0.23);
assert.equal(taranaMarker.properties.STORMTRACKER_DISPLAY_STATE,"major");
assert.equal(taranaMarker.properties.STORMTRACKER_OBSERVATION_STALE,false);
assert.equal(taranaMarker.properties.STORMTRACKER_CLASSIFICATION_UNVERIFIED,true);
assert.equal(taranaMarker.properties.STORMTRACKER_RAPID_RISE,false);

// A stale CDN reply must not reverse any newer source-verified gauge height.
const replay=retainLatestGaugeObservations(
  [taranaOld,panoramaOld],newest.cache,now);
assert.deepEqual(replay.features.map(x=>x.properties.STORMTRACKER_HEIGHT_METRES),
  [0.23,2.55]);
const persisted=cleanLatestGaugeObservations(
  JSON.parse(JSON.stringify(newest.cache)),now);
assert.equal(persisted["bom:535142"].feature.properties.STORMTRACKER_HEIGHT_METRES,0.23);
const classRoundtrip=cleanConfirmedFloodStations(
  JSON.parse(JSON.stringify(classState.cache)),now);
assert.equal(classRoundtrip["bom:535142"].latestFeature.properties.STORMTRACKER_HEIGHT_METRES,0.23);

// The similarly named gauge 035271 must never be merged with ALERT 535142.
const regular=station("035271","Tarana Crossing",2.70,"11.14PM Mon","");
const split=retainLatestGaugeObservations([regular],newest.cache,now);
assert.equal(split.features[0].properties.STORMTRACKER_HEIGHT_METRES,2.70);
assert.equal(split.cache["bom:535142"].feature.properties.STORMTRACKER_HEIGHT_METRES,0.23);
assert.equal(split.cache["bom:035271"].feature.properties.STORMTRACKER_HEIGHT_METRES,2.70);

// Explicit newer official below-minor confirms recovery and clears the
// precautionary persisted category. A blank class never does so.
const recovered=station("535142","Tarana Crossing ALERT",0.20,"11.20PM Mon",
  "below-minor");
const cleared=retainConfirmedFloodStations([recovered],classState.cache,now);
assert.equal(cleared.cache["bom:535142"],undefined);
assert.equal(cleared.features[0].properties.STORMTRACKER_HEIGHT_METRES,0.20);
assert.equal(cleared.features[0].properties.STORMTRACKER_LAST_CONFIRMED_FLOOD_CLASS,undefined);
console.log("PASS real Tarana/Panorama source timestamps, independent current heights and flood class, replay resistance and 10-minute refresh.");
