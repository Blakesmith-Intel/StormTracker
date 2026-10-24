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
 </pre></html>`;
const e=parseBomQueenslandCrossings(official);
assert.equal(e["bom:540291"].heightMetres,-0.03);
assert.equal(e["bom:540291"].type,"C");
assert.equal(e["bom:540254"].crossingName,"Pacific Highway Bridge");
assert.equal(e["bom:540063"].type,"X");
assert.equal(e["bom:540691"].crossingName,"Published bridge");
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
assert.deepEqual(model.groups.map(g=>g.rows.length),[1,1,3]);
assert.equal(model.crossedCount,3);
const entry=model.groups[2].rows.find(x=>x.id==="bom:540291");
assert.equal(entry.crossing.name,"Clagiraba Road Causeway");
assert.equal(entry.crossing.amountAboveMetres,0.13);
assert(model.groups[2].rows.some(x=>x.id==="bom:540063"),
 "Published X-type river crossing must be captured at equality");
assert(!model.groups.some(g=>g.rows.some(x=>x.id==="bom:999993")));
const without=buildNotableFloodGaugeReport(gauges,null,now);
assert.equal(without.total,2);
assert.equal(without.crossingSourceAvailable,false);
assert.equal(without.groups[2].rows.length,0);
assert.equal(buildNotableFloodGaugeReport([station("540291",-.04)],reference,now).total,0,
 "A crossing below its published level stays off");
assert.equal(buildNotableFloodGaugeReport([
 station("540154",5.55,"major")
],reference,now).total,1,"Double criterion only listed once");
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
assert(script.includes("reportDialog?.open)renderFloodGaugeReport()"),
 "Report must update on same 10-minute background gauge refresh");
console.log("PASS all-station moderate/major and BoM exact-ID bridge/causeway/crossing report, stale screening, no invented crossings, responsive modal");
