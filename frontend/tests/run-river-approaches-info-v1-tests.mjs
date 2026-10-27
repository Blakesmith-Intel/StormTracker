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

const stale=riverGaugeRoadReferenceRows({...moderate.summary,observationStale:true});
assert.match(Object.fromEntries(stale)["Water over approaches"],/current exceedance unverified/);
assert.doesNotMatch(Object.fromEntries(stale)["Water over approaches"],/0\.45 m over/);
const bridgeRows=Object.fromEntries(riverGaugeRoadReferenceRows({
 crossingType:"B",crossingLevelMetres:1.71,crossingName:"Bridge",
 crossingReached:true,heightMetres:2.00,observationStale:false}));
assert.equal(bridgeRows["Crossing status"],
 "0.29 m above published reference · NOT confirmation of road closure");
assert.equal(bridgeRows["BoM published crossing level"],"Bridge · 1.71 m");

console.log("PASS BoM 041472 approaches 6.25m AHD shown as water-over-approaches depth, current/stale reporting, unchanged 5/6/7m severity and old bridge labels");
