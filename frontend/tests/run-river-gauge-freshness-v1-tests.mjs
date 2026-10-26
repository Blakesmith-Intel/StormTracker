import assert from "node:assert/strict";
import {
  LATEST_RIVER_GAUGE_STORAGE_KEY,cleanLatestGaugeObservations,
  retainLatestGaugeObservations
} from "../src/context-layers/river-gauge-latest-v1.js";
import {
  OFFICIAL_FLOOD_STORAGE_KEY,cleanConfirmedFloodStations,
  retainConfirmedFloodStations
} from "../src/context-layers/river-official-flood-persistence-v1.js";
import {FLOOD_STAGE_MAX_AGE_MS} from "../src/context-layers/river-flood-signals-v1.js";
import {cleanFloodEvents} from "../src/context-layers/river-flood-events-v1.js";
import {reconcileFloodEvents} from "../src/context-layers/river-flood-events-v1.js";
import {DEFAULT_RIVER_GAUGE_REFRESH_MS} from "../src/context-layers/river-gauges-v1.js";
import {withStationFloodLevels} from "../src/context-layers/river-flood-thresholds-v1.js";

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
assert.equal(tarana.properties.STORMTRACKER_LAST_CONFIRMED_FLOOD_CLASS,undefined,
  "A newer 0.23m station reading below the verified 6m minor level clears obsolete major");
assert.equal(classState.cache["bom:535142"],undefined,
  "A verified below-minor height must also retire persistent obsolete stage history");
assert.equal(panorama.properties.STORMTRACKER_HEIGHT_METRES,2.55);
assert.equal(panorama.properties.STORMTRACKER_OBSERVED_TEXT,"11.14PM Mon");
const mapped=reconcileFloodEvents(
  withStationFloodLevels(classState.features),{}, {},now);
assert.equal(mapped.features.some(x=>x.id==="bom:535142"),false,
  "0.23m is below the 6.0m official minor flood stage; no flood marker");

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
assert.equal(classRoundtrip["bom:535142"],undefined,
  "Do not resurrect flood state on the next browser session after below-minor recovery");

// The similarly named gauge 035271 must never be merged with ALERT 535142.
const regular=station("035271","Tarana Crossing",2.70,"11.14PM Mon","");
const split=retainLatestGaugeObservations([regular],newest.cache,now);
assert.equal(split.features[0].properties.STORMTRACKER_HEIGHT_METRES,2.70);
assert.equal(split.cache["bom:535142"].feature.properties.STORMTRACKER_HEIGHT_METRES,0.23);
assert.equal(split.cache["bom:035271"].feature.properties.STORMTRACKER_HEIGHT_METRES,2.70);

// Explicit newer BoM below-minor classification also confirms recovery.
 // A blank class alone does not clear unclassified stations without thresholds.
const recovered=station("535142","Tarana Crossing ALERT",0.20,"11.20PM Mon",
  "below-minor");
const cleared=retainConfirmedFloodStations([recovered],classState.cache,now);
assert.equal(cleared.cache["bom:535142"],undefined);
assert.equal(cleared.features[0].properties.STORMTRACKER_HEIGHT_METRES,0.20);
assert.equal(cleared.features[0].properties.STORMTRACKER_LAST_CONFIRMED_FLOOD_CLASS,undefined);

// 26 Oct 2026 Nerada (032165): BoM last actual readings ~0.94–1.04 m on
// 21 Oct; relay confirms no recent observations. StormTracker had an
// unsupported cached 19.59 m "major" five days later. It must disappear.
const eventNow=Date.UTC(2026,9,26,4,46); // Mon 14:46 AEST
const nerada=station("032165","North Johnstone River at Nerada",19.59,
  "01.53PM Wed 21/10/2026","major","rising");
const lastVerified=Date.UTC(2026,9,21,3,53);
assert.equal(FLOOD_STAGE_MAX_AGE_MS,24*3600000);
const discardedLatest=retainLatestGaugeObservations([nerada],{},eventNow);
assert.equal(discardedLatest.cache["bom:032165"],undefined,
  "Old unsupported heights MUST NOT persist in the browser cache");
const discardedConfirmed=retainConfirmedFloodStations([nerada],{
  "bom:032165":{observedAt:lastVerified,feature:nerada}
},eventNow);
assert.equal(discardedConfirmed.cache["bom:032165"],undefined,
  "Last-confirmed major flood must expire when no current BoM evidence exists");
assert.equal(reconcileFloodEvents(
  withStationFloodLevels(discardedConfirmed.features),{},{},eventNow
).features.length,0,"Nerada unsupported 19.59 m must have no flood icon");
const vanishedEvent=cleanFloodEvents({"bom:032165":{
 type:"rapid-rise",activatedAt:lastVerified-60*60000,
 lastObservedAt:lastVerified,lastHeight:19.59,baselineHeight:0.94,
 peakHeight:19.59,recoveryMarginMetres:0.1,
 recoveryCount:0,lastRecoveryAt:null
}},eventNow);
assert.equal(Object.keys(vanishedEvent).length,0,
 "Post-rise events must not resurrect a days-old flood icon");

// The exact station-ID mismatch seen in Nerada's popup is an INTEGRITY
// rejection, not merely a grey icon or warning while showing a red flood.
const mismatch=station("032165","Nerada",19.59,
  "02.35PM Mon 26/10/2026","major","rising");
mismatch.properties.bom_stn_num="032164";
const mismatched=withStationFloodLevels([mismatch])[0];
assert.ok(mismatched.properties.STORMTRACKER_IDENTITY_WARNING);
assert.equal(reconcileFloodEvents([mismatched],{},{},eventNow).features.length,0,
 "A mismatched station ID must NEVER map any severity");
assert.equal(retainConfirmedFloodStations([mismatched],{
 "bom:032165":{observedAt:eventNow-60*60000,feature:nerada}
},eventNow).cache["bom:032165"],undefined,
 "Cached major cannot override current ID-integrity failure");

// Genuine manual or event-driven flood records remain available in the
// short missing-telemetry window, but must disappear after 24 hours.
const manual=station("540510","Teviot Brook Coulson Crossing",4.65,
  "11.58AM Mon 26/10/2026","major","steady");
const manualNow=Date.UTC(2026,9,26,4,46);
const manualHeld=retainConfirmedFloodStations([manual],{},manualNow);
assert.ok(manualHeld.cache["bom:540510"],
  "Do not prematurely retire a several-hour-old manual major reading");
assert.equal(reconcileFloodEvents(
  withStationFloodLevels(manualHeld.features),{},{},manualNow
).features.length,1);
const expiredAt=Date.UTC(2026,9,27,2,0); // >24 h from 11:58 26 Oct AEST?
const actualExpire=Date.UTC(2026,9,27,2,0);
assert.ok(actualExpire-Date.UTC(2026,9,26,1,58)>FLOOD_STAGE_MAX_AGE_MS);
const manualExpired=retainConfirmedFloodStations([],manualHeld.cache,actualExpire);
assert.equal(manualExpired.features.length,0);
assert.equal(Object.keys(manualExpired.cache).length,0);
assert.equal(reconcileFloodEvents(
  withStationFloodLevels([manual]),{},{},actualExpire
).features.length,0,"Manual observations must expire without an update");
console.log("PASS real Tarana/Panorama source timestamps, independent current heights and flood class, replay resistance and 10-minute refresh.");
