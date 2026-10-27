import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildNotableFloodGaugeReport,FLOOD_CROSSINGS_SCHEMA}
 from "../src/context-layers/river-gauge-notable-report-v1.js";
import {parseBomQueenslandCrossings,QLD_CROSSING_SOURCE}
 from "../../relay/river-crossing-heights-v1.js";

const official=`<html><pre>
 Date: 05/01/2022 SECTION 5 Page: 1
 QUEENSLAND FLOOD WARNING RIVER HEIGHT STATIONS
 DETAILS OF CROSSINGS
 Station No Station Name Stream Crossing Height Type Name of Crossing
 SOUTH COAST 540291 CLAGIRABA ROAD ALERT COOMERA RIVER -0.03 C Clagiraba Road Causeway
 540254 MUDGEERABA ALERT MUDGEERABA CREEK 4.60 B Pacific Highway Bridge
 540001 GOLD COAST TIDE TM BROADWATER 1.91 T
 LOGAN-ALBERT 540063 COLLEGES CROSSING ALERT BRISBANE RIVER 2.67 X Colleges Crossing
 540154 HARRISVILLE ALERT WARRILL CREEK 5.50 B Warrill Creek Bridge
 540119 ENOGGERA DAM ALERT ENOGGERA CREEK 74.40 S Dam
 540691 TAMBORINE ALERT ALBERT RIVER 15.40 B
 540692 TEST ROAD ALERT TEST CREEK 2.30 R Local Road Approaches
 540693 TEST TOWN ALERT TEST RIVER 1.25 A Town Approaches
 540694 TEST SPILLWAY ALERT TEST RIVER 1.25 S Dam Spillway
 </pre></html>`;
const e=parseBomQueenslandCrossings(official);
assert.equal(e["bom:540291"].heightMetres,-0.03);
assert.equal(e["bom:540291"].type,"C");
assert.equal(e["bom:540254"].crossingName,"Pacific Highway Bridge");
assert.equal(e["bom:540063"].type,"X");
assert.equal(e["bom:540691"].crossingName,"Published bridge");
assert.equal(e["bom:540692"].type,"R");
assert.equal(e["bom:540692"].crossingName,"Local Road Approaches");
assert.equal(e["bom:540693"].type,"A");
assert.equal(e["bom:540693"].crossingName,"Town Approaches");
assert.equal(e["bom:540694"],undefined,"Spillway must remain excluded");
assert.equal(e["bom:540001"],undefined,"Tidal datum is NOT a road crossing");
assert.equal(e["bom:540119"],undefined,"Dam/spillway isn't a causeway");
assert.equal(QLD_CROSSING_SOURCE,"https://www.bom.gov.au/qld/flood/networks/section5.shtml");
assert.throws(()=>parseBomQueenslandCrossings("<p>Unrelated web page</p>"),/heading missing/);
const MIN=60000,now=Date.UTC(2026,9,24,0,30);
const station=(number,height,klass="",observedAt=now-15*MIN,opts={})=>({
 id:"bom:"+number,type:"Feature",geometry:{type:"Point",coordinates:[153,-27]},
 properties:{name:opts.name??("BoM "+number),bom_stn_num:opts.id??number,
  STORMTRACKER_HEIGHT_METRES:height,
  STORMTRACKER_FLOOD_CLASS:klass,
  STORMTRACKER_TENDENCY:"steady",
  STORMTRACKER_OFFICIAL_OBSERVED_AT:observedAt,
  STORMTRACKER_OBSERVED_TEXT:"10:15 24/10/2026"}
});
const reference={schema:FLOOD_CROSSINGS_SCHEMA,sourceDate:"2022-01-05",entries:e};
const gauges=[
 station("540291",0.10,"below-minor",now-15*MIN,{name:"Clagiraba"}),
 station("540254",4.80,"",now-15*MIN,{name:"Mudgeeraba"}),
 station("540063",2.67,"",now-15*MIN,{name:"Colleges Crossing"}),
 station("540154",0.10,"below-minor"),
 station("999991",7.5,"moderate",now-15*MIN,{name:"Official moderate station"}),
 station("999992",9.0,"major",now-15*MIN,{name:"Official major station"}),
 station("999993",1.0,"major",now-180*MIN,{name:"Stale major"}),
 station("540291",0.8,"minor",now-5*MIN,{id:"123456",name:"Mismatched station number"}),
 station("540119",75,"below-minor")
];
const model=buildNotableFloodGaugeReport(gauges,reference,now);
assert.equal(model.total,5,
 "Fresh major/moderate, and three crossing-only matches; stale and mismatched stations excluded");
assert.deepEqual(model.groups.map(g=>g.rows.length),[2,1,2],
 "Mudgeeraba 4.80m is above its ACTUAL BoM 4.10m major stage as well as 4.60m bridge; appear once under major");
assert.equal(model.crossedCount,3);
for(const [number,level] of [["540692",2.30],["540693",1.25]]){
 const atLevel=buildNotableFloodGaugeReport([station(number,level)],reference,now);
 assert.equal(atLevel.total,1,"Published approaches count at their exact threshold");
 assert.equal(atLevel.crossedCount,1);
 assert.equal(atLevel.groups[2].rows[0].crossing.levelMetres,level);
 assert.equal(buildNotableFloodGaugeReport([station(number,level-0.01)],
  reference,now).total,0,"Approaches below reference must remain off");
}
const entry=model.groups[2].rows.find(x=>x.id==="bom:540291");
assert.equal(entry.crossing.name,"Clagiraba Road Causeway");
assert.equal(entry.crossing.amountAboveMetres,0.13);
assert(model.groups[2].rows.some(x=>x.id==="bom:540063"),
 "Published X-type river crossing must be captured at equality");
assert(!model.groups.some(g=>g.rows.some(x=>x.id==="bom:999993")));
const without=buildNotableFloodGaugeReport(gauges,null,now);
assert.equal(without.total,3,
 "Official Mudgeeraba major stage remains valid even when crossing catalogue is unavailable");
assert.equal(without.crossingSourceAvailable,false);
assert.equal(without.groups[2].rows.length,0);
assert.equal(buildNotableFloodGaugeReport([station("540291",-.04)],reference,now).total,0,
 "A crossing below its published level stays off");
assert.equal(buildNotableFloodGaugeReport([
 station("540154",5.55,"major")
],reference,now).total,1,"Double criterion only listed once");

// 535162 was omitted from the report despite being 2.77m against its
// independently verified BoM station-page bridge reference of 1.71m.
const theresa=station("535162",2.77,"",now-5*MIN,
 {name:"Theresa Creek Dam"});
assert.equal(buildNotableFloodGaugeReport([theresa],reference,now).total,0,
 "An unresolved bridge must NOT be guessed from river height alone");
theresa.properties.STORMTRACKER_PLOT_CROSSING={
 type:"B",heightMetres:1.71,crossingName:"BoM station bridge level",
 source:"BoM station river-height table"};
const withCrossing=buildNotableFloodGaugeReport([theresa],reference,now);
assert.equal(withCrossing.total,1,
 "Once its exact-ID BoM bridge is known, 535162 must appear in report");
assert.equal(withCrossing.crossedCount,1);
assert.equal(withCrossing.groups[2].rows[0].id,"bom:535162");
assert.equal(withCrossing.groups[2].rows[0].crossing.amountAboveMetres,1.06);
const staleTheresa=station("535162",2.77,"",now-180*MIN,
 {name:"Theresa Creek Dam"});
staleTheresa.properties.STORMTRACKER_PLOT_CROSSING=
 theresa.properties.STORMTRACKER_PLOT_CROSSING;
const lastConfirmed=buildNotableFloodGaugeReport([staleTheresa],reference,now);
assert.equal(lastConfirmed.total,1,"Previously verified crossing must not disappear solely on a stale BoM observation");
assert.equal(lastConfirmed.crossedCount,0,"Stale crossing must not be counted as current");
assert.equal(lastConfirmed.lastConfirmedCrossedCount,1);
assert.equal(lastConfirmed.groups[2].rows[0].observationStale,true);
assert.equal(buildNotableFloodGaugeReport([
 station("535162",2.77,"",now-50*60*MIN)
],reference,now).total,0,"Very old unverified state must never be displayed as current");
const html=readFileSync(new URL("../live3d-operational-v9.html",import.meta.url),"utf8");
const script=readFileSync(new URL("../src/context-layers/river-gauges-operational-v1.js",import.meta.url),"utf8");
const layer=readFileSync(new URL("../src/context-layers/river-gauge-layer-v1.js",import.meta.url),"utf8");
for(const id of ["openFloodGaugeReport","floodGaugeReport","closeFloodGaugeReport",
  "refreshFloodGaugeReport","floodGaugeReportRows","floodGaugeReportStatus"])
 assert(html.includes('id="'+id+'"'),"Missing report UI "+id);
assert(script.includes("reportDialog.showModal()"));
assert(script.includes("layer.sourceFeatures"),"Report must consider all source observations");
assert(layer.includes("get sourceFeatures()"));
assert(script.includes("Crossing reference unavailable"));
assert(script.includes("crossingCoverage.pending"),
 "Report must disclose pending unchecked gauge crossing references");
assert(script.includes("layer.checkCrossingReferences()"),
 "Opening and refreshing the report must continue existing BoM lookups");
assert(layer.includes("Promise.all(candidates.slice(i,i+4)"),
 "Lookups must not stall behind 16 serial station waits");
assert(script.includes("reportDialog?.open)renderFloodGaugeReport()"),
 "Report must update on same 10-minute background gauge refresh");
console.log("PASS all-station moderate/major and BoM exact-ID bridge/causeway/crossing report, stale screening, no invented crossings, responsive modal");
