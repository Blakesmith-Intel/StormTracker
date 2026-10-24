import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {planBoMStationTableLookups} from "../src/context-layers/bom-recent-river-history-v1.js";
import {reconcileFloodEvents} from "../src/context-layers/river-flood-events-v1.js";
import {CROSSING_SCHEMA} from "../src/context-layers/river-crossing-state-v1.js";

const NOW=Date.UTC(2026,9,24,11,30),mins=n=>n*60000;
const mk=(number,height,tendency="steady",extra={})=>({
 id:"bom:"+number,type:"Feature",geometry:{type:"Point",coordinates:[147.56,-22.97]},
 properties:{
  name:"Gauge "+number,bom_stn_num:number,location_types:"water level gauge;",
  STORMTRACKER_HEIGHT_METRES:height,STORMTRACKER_TENDENCY:tendency,
  STORMTRACKER_OFFICIAL_OBSERVED_AT:NOW-mins(11),
  STORMTRACKER_OBSERVED_TEXT:"21:19 Sat",
  STORMTRACKER_SOURCE_PRODUCT:"IDQ60289",
  STORMTRACKER_RECENT_DATA_HREF:
   "/fwo/IDQ65392/IDQ65392."+number+".plt.shtml",
  STORMTRACKER_MINOR_FLOOD_METRES:null,...extra}
});
const th=mk("535162",2.77,"steady");
const falling=mk("535999",0.75,"falling");
const rising=mk("535160",0.89,"rising");
const official=mk("535555",3.2,"steady",{STORMTRACKER_MINOR_FLOOD_METRES:2});
const low=mk("535556",0.02,"steady");
let features=[th,falling,rising,official,low];
const find=options=>planBoMStationTableLookups(features,{nowMs:NOW,...options});
let chosen=find();
assert.equal(chosen.length,5,"EVERY measured station with verified exact BoM link is eligible, regardless of trend or published flood class");
assert(chosen.some(x=>x.id==="bom:535162" && x.station==="535162"),
 "Theresa Creek STEADY above bridge must be looked up without browser history");
assert(chosen.some(x=>x.id==="bom:535999"),
 "A falling station that remains above its crossing must be looked up");
assert(chosen.some(x=>x.id==="bom:535556"),
 "Even lower-height data-only gauges must not be skipped; crossing might be at 0.0 m");
assert(chosen.some(x=>x.id==="bom:535555"),
 "Gauges with a minor flood level can also have crossing levels");
assert.equal(chosen[0].id,"bom:535162",
 "Give high-height, threshold-free no-catalogue station an early crossing lookup");
let cached=find({plotCrossings:{"bom:535162":{crossing:null,checkedAt:NOW}}});
assert(!cached.some(x=>x.id==="bom:535162"),
 "Recent verified absent crossing is cached to avoid unnecessary BoM repeat calls");
assert.equal(cached.length,4);
const oldSection={schema:CROSSING_SCHEMA,entries:{"bom:535162":{
 heightMetres:1.71,type:"B",crossingName:"Theresa Creek bridge"}}};
const withSection=find({crossingCatalogue:oldSection});
assert(withSection.some(x=>x.id==="bom:535162"),
 "Verify current station page eventually, even when an older Section 5 crossing exists");
const malformed=mk("535777",3.0,"steady",
 {STORMTRACKER_RECENT_DATA_HREF:"/fwo/IDQ65392/IDQ65392.535778.plt.shtml"});
const mismatched=mk("535888",3.0,"steady",{bom_stn_num:"535889"});
assert(!planBoMStationTableLookups([malformed,mismatched],{nowMs:NOW}).length,
 "Cross-station identity mismatches must fail closed");
const catalogue={schema:CROSSING_SCHEMA,entries:{"bom:535162":{
 heightMetres:1.71,type:"B",crossingName:"Theresa Creek bridge"}}};
const state=reconcileFloodEvents([th],{}, {},NOW,catalogue);
assert.equal(state.features.length,1);
assert.equal(state.features[0].properties.STORMTRACKER_CROSSING_REACHED,true);
assert.equal(state.features[0].properties.STORMTRACKER_DISPLAY_STATE,"elevated");
assert.equal(state.features[0].properties.STORMTRACKER_RAPID_RISE,false);
const fallingWithCrossing=mk("535999",1.8,"falling",{
 STORMTRACKER_PLOT_CROSSING:{heightMetres:1.7,type:"B",
 crossingName:"BoM source bridge",source:"Station plot"}});
assert.equal(reconcileFloodEvents([fallingWithCrossing],{}, {},NOW).features.length,1,
 "A falling water level remains on map until fresh water drops below exact crossing");
const below=mk("535999",1.69,"falling",{
 STORMTRACKER_PLOT_CROSSING:fallingWithCrossing.properties.STORMTRACKER_PLOT_CROSSING});
assert.equal(reconcileFloodEvents([below],{}, {},NOW).features.length,0,
 "Marker clears only on fresh verified return below the exact crossing");
const layer=readFileSync(new URL("../src/context-layers/river-gauge-layer-v1.js",import.meta.url),"utf8");
assert(layer.includes("if(!/^bom:\d{6}$/.test(id)"),
 "Exact BoM ID regex must recognise normal six-digit IDs");
assert(!layer.includes("if(!/^bom:\\d{6}$/.test(id)"),
 "Never double-escape JavaScript regex literals; this previously excluded all station-page lookups");
assert(layer.includes("planBoMStationTableLookups("),
 "Production layer must actually consume the all-state lookup planner");
assert(layer.includes("scheduleCrossingScan("),
 "Discovery must continue between 10-minute observations rather than checking only first 16 stations");
assert(layer.includes("setCrossingCatalogue("),
 "Published Section 5 crossings still apply immediately");
console.log("PASS statewide all-tendency 535162 and all exact-BoM stations, no-ID-spoofing, cache and continuous discovery, crossing persistence and no fake rapid-rise");
