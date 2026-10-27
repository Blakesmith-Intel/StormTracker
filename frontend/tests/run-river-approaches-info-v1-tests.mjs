import assert from "node:assert/strict";
import {parseBoMStationCrossingHeader} from "../src/context-layers/river-crossing-state-v1.js";
import {reconcileFloodEvents} from "../src/context-layers/river-flood-events-v1.js";
import {riverGaugeOperationalSummary} from "../src/context-layers/river-gauge-layer-v1.js";
import {riverGaugeRoadReferenceRows} from "../src/context-layers/river-gauges-operational-v1.js";

// 27 October 2026 BoM source example: Condamine River at Centenary Bridge.
// BoM publishes 5/6/7 m official flood stages and an approaches reference
// of 6.25 m AHD, with NO separately published bridge height.
const raw='<p>Station details: Station Number: <b>041472</b> '+
 'Name: Condamine River at Centenary Bridge</p>'+
 '<p>Flood Classification Levels: Minor: 5.00 m AHD Moderate: 6.00 m AHD Major: 7.00 m AHD</p>'+
 '<p>Crossing Levels: <b>Approaches: 6.25 m AHD</b></p>'+
 '<p>Data from the previous 14 days.</p>';
const approaches=parseBoMStationCrossingHeader(raw,"041472");
assert.equal(approaches.type,"A");
assert.equal(approaches.heightMetres,6.25);
assert.equal(parseBoMStationCrossingHeader(raw,"41472"),null,
 "Preserve the exact leading-zero BoM station number; never borrow from another station");

const NOW=Date.UTC(2026,9,27,9,0); // Synthetic 7:00 pm AEST test time
const sample=height=>({
 id:"bom:041472",type:"Feature",geometry:null,
 properties:{bom_stn_num:"041472",name:"Condamine River at Centenary Bridge",
  location_types:"water level gauge;",
  STORMTRACKER_HEIGHT_METRES:height,
  STORMTRACKER_FLOOD_CLASS:"",
  STORMTRACKER_TENDENCY:"steady",
  STORMTRACKER_OFFICIAL_OBSERVED_AT:NOW-10*60000,
  STORMTRACKER_OBSERVED_TEXT:"18:50 27/10/2026",
  STORMTRACKER_PLOT_CROSSING:approaches}
});
function inspect(height){
 const state=reconcileFloodEvents([sample(height)],{}, {},NOW);
 assert.equal(state.features.length,1,"Official moderate/major stage must remain visible");
 const summary=riverGaugeOperationalSummary(state.features[0]);
 return {state:state.features[0].properties,summary,rows:Object.fromEntries(
  riverGaugeRoadReferenceRows(summary))};
}

// Test heights below are synthetic only; the user's BoM screenshot supplied
// the PUBLISHED 6.25m approaches level, not a verified latest measured 6.70m.
const moderate=inspect(6.70);
assert.equal(moderate.state.STORMTRACKER_DISPLAY_STATE,"moderate",
 "BoM moderate flood yellow outranks the amber crossing marker");
assert.equal(moderate.state.STORMTRACKER_CROSSING_TYPE,"A");
assert.equal(moderate.state.STORMTRACKER_CROSSING_REACHED,true);
assert.equal(moderate.summary.crossingType,"A");
assert.match(moderate.rows["BoM published approaches level"],/6\.25 m/);
assert.match(moderate.rows["Water over approaches"],/^0\.45 m over published approaches level/);
assert.match(moderate.rows["Water over approaches"],/NOT confirmation of road closure/);
assert(!Object.hasOwn(moderate.rows,"Crossing status"),
 "Approaches must use the explicit water-over-approaches information label");

const below=inspect(6.10);
assert.equal(below.state.STORMTRACKER_DISPLAY_STATE,"moderate",
 "Approaches below road level must not hide official moderate flooding");
assert.equal(below.state.STORMTRACKER_CROSSING_REACHED,false);
assert.match(below.rows["Water over approaches"],/not currently exceeded/);

const major=inspect(7.15);
assert.equal(major.state.STORMTRACKER_DISPLAY_STATE,"major",
 "BoM major red still outranks approaches reference");
assert.match(major.rows["Water over approaches"],/^0\.90 m over published approaches level/);

// The operator's 041472 source-table reading: 6.74m at 14:43 AEST
// 27 October 2026, equal to 0.49m above the 6.25m approaches.
const lastObserved=Date.UTC(2026,9,27,4,43);
const oldGauge=sample(6.74);
oldGauge.properties.STORMTRACKER_OFFICIAL_OBSERVED_AT=lastObserved;
oldGauge.properties.STORMTRACKER_OBSERVED_TEXT="14:43 27/10/2026";
const lastKnown=reconcileFloodEvents([oldGauge],{}, {},NOW);
assert.equal(lastKnown.features.length,1,
 "Stale official moderate must retain its existing last-confirmed marker");
assert.equal(lastKnown.features[0].properties.STORMTRACKER_DISPLAY_STATE,"moderate",
 "Approach over-height cannot override the published moderate flood category");
assert.equal(lastKnown.features[0].properties.STORMTRACKER_CROSSING_REACHED,false,
 "Stale water above approaches is informational, never a current crossing flag");
const lastKnownSummary=riverGaugeOperationalSummary(lastKnown.features[0]);
assert.equal(lastKnownSummary.observationStale,true);
assert.equal(lastKnownSummary.officialObservedAt,lastObserved,
 "The time must belong to the same station's actual source observation");
const stale=Object.fromEntries(riverGaugeRoadReferenceRows(lastKnownSummary));
assert.match(stale["Water over approaches"],
 /^Last measured 0\.49 m over published approaches level as at 14:43 27\/10\/2026 AEST/);
assert.match(stale["Water over approaches"],/STALE — current level unverified/);
assert.match(stale["Water over approaches"],/NOT confirmation of road closure/);
assert(!stale["Water over approaches"].includes("19:00"),
 "Never substitute the current app refresh time for the source observation");

// Bridge, causeway, road crossing and both approach types all retain depth
// measured at the last observation without changing operational flood markers.
for(const type of ["B","C","X","R","A"]){
 const rows=Object.fromEntries(riverGaugeRoadReferenceRows({
  crossingType:type,crossingLevelMetres:6.25,heightMetres:6.74,
  crossingName:"BoM published road reference",crossingReached:false,
  observationStale:true,officialObservedAt:lastObserved
 }));
 const value=rows[type==="A"||type==="R"?"Water over approaches":"Crossing status"];
 assert.match(value,/0\.49 m (?:over published approaches level|above published reference) as at 14:43 27\/10\/2026 AEST/,
  type+" must show the last observation's depth and timestamp");
 assert.match(value,/current level unverified/);
}
const staleBelow=Object.fromEntries(riverGaugeRoadReferenceRows({
 crossingType:"A",crossingLevelMetres:6.25,heightMetres:6.15,
 observationStale:true,officialObservedAt:lastObserved}));
assert.match(staleBelow["Water over approaches"],
 /Last measured 0\.10 m below published approaches level as at 14:43 27\/10\/2026 AEST/,
 "A below-approaches reading must not falsely claim water above the road");
const unknownTime=Object.fromEntries(riverGaugeRoadReferenceRows({
 crossingType:"B",crossingLevelMetres:6.25,heightMetres:6.74,
 observationStale:true,officialObservedAt:null}));
assert.match(unknownTime["Crossing status"],/0\.49 m above published reference/);
assert.match(unknownTime["Crossing status"],/observation time unavailable/);
assert.doesNotMatch(unknownTime["Crossing status"],/27\/10\/2026/,
 "Do not invent an observation date when none is source-verified");
const bridgeRows=Object.fromEntries(riverGaugeRoadReferenceRows({
 crossingType:"B",crossingLevelMetres:1.71,crossingName:"Bridge",
 crossingReached:true,heightMetres:2.00,observationStale:false}));
assert.equal(bridgeRows["Crossing status"],
 "0.29 m above published reference · NOT confirmation of road closure");
assert.equal(bridgeRows["BoM published crossing level"],"Bridge · 1.71 m");

console.log("PASS 041472 stale 6.74m at 14:43 over 6.25m approaches, source-timestamped B/C/X/R/A depths, unchanged severity and map freshness");
