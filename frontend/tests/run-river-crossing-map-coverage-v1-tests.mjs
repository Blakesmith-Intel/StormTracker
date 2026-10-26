import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseBoMStationCrossingHeader,publishedCrossingForFeature,CROSSING_SCHEMA}
 from "../src/context-layers/river-crossing-state-v1.js";
import {reconcileFloodEvents} from "../src/context-layers/river-flood-events-v1.js";
import {createRiverGaugeMarkerImage,createRiverGaugeMapMarkerBitmap,riverGaugeMapMarkerDimensions} from "../src/context-layers/river-gauge-layer-v1.js";
import {riverGaugePanelAppearance} from "../src/context-layers/river-gauges-operational-v1.js";
import {floodIconPriority} from "../src/context-layers/severity-marker-layer-v1.js";
import {buildNotableFloodGaugeReport} from "../src/context-layers/river-gauge-notable-report-v1.js";
import worker from "../../relay/worker.js";

const MIN=60000,now=Date.UTC(2026,9,24,11,8); // 9:08 pm AEST
const html='<html><h1>Latest River Heights for Theresa Creek</h1>'+
 '<p>Station details: Station Number: <b>535162</b> Name: Theresa Creek at Theresa Creek Dam</p>'+
 '<p><b>Crossing Levels:</b> Bridge: 1.71 m</p>'+
 '<p>Data from the previous 14 days.</p>';
const crossing=parseBoMStationCrossingHeader(html,"535162");
assert.equal(crossing.type,"B");
assert.equal(crossing.heightMetres,1.71);
assert.equal(parseBoMStationCrossingHeader(html,"535161"),null,
 "Never transfer a neighbouring station's crossing value");
assert.equal(parseBoMStationCrossingHeader(html.replace("Station Number","Station Id"),"535162"),null);
assert.equal(parseBoMStationCrossingHeader(html.replace("Bridge: 1.71 m","Dam spillway: 1.71 m"),"535162"),null);
const withMany=html.replace("Bridge: 1.71 m","Causeway: 1.52 m, Bridge: 1.71 m");
assert.equal(parseBoMStationCrossingHeader(withMany,"535162").heightMetres,1.52,
 "Lowest published road crossing must win, not a dam or unrelated gauge");
const make=(number,height,at=now-8*MIN,extra={})=>({
 id:"bom:"+number,type:"Feature",geometry:{type:"Point",coordinates:[147.55,-22.85]},
 properties:{name:"Gauge "+number,bom_stn_num:number,location_types:"water level gauge;",
  STORMTRACKER_HEIGHT_METRES:height,
  STORMTRACKER_FLOOD_CLASS:"",
  STORMTRACKER_TENDENCY:"steady",
  STORMTRACKER_OBSERVED_TEXT:"21:00 24/10/2026",
  STORMTRACKER_OFFICIAL_OBSERVED_AT:at,
  ...extra}
});
const th=make("535162",2.80,now-8*MIN,{STORMTRACKER_PLOT_CROSSING:crossing});
const alerts=reconcileFloodEvents([th],{}, {},now);
assert.equal(alerts.features.length,1,
 "535162 above BoM 1.71 m bridge must be mapped without a minor flood threshold or session history");
assert.equal(alerts.features[0].properties.STORMTRACKER_DISPLAY_STATE,"crossing");
assert.equal(alerts.features[0].properties.STORMTRACKER_RAPID_RISE,false,
 "Crossing reach alone is not proof of an active rapid rise");
assert.equal(alerts.features[0].properties.STORMTRACKER_CROSSING_REACHED,true);
assert.equal(alerts.features[0].properties.STORMTRACKER_CROSSING_LEVEL_METRES,1.71);
const amber=decodeURIComponent(createRiverGaugeMarkerImage("crossing",false).split(",")[1]);
assert.match(amber,/#f5a21b/,"Crossing-only indicator has amber pin");
assert.match(amber,/Bridge deck and supports/,
 "Amber icon illustrates a BRIDGE instead of a car");
assert.match(amber,/#1269e8/,"Blue water visibly crosses the bridge");
assert(!amber.includes('cx="61"'),"No rapid-rise arrow unless measured rise qualifies");
assert.equal(floodIconPriority("crossing"),1,
 "New crossing icon uses existing source/drawing tier without shifting geography");
// Every map pin MUST have exactly the same screen dimensions, including
// official categories, bridge/causeway and the measured-rise arrow variant.
const fixedSize={width:38,height:42};
// Pixel-level contract: the map must use a fixed 160x176 PNG surface for
// EVERY state; legend/popup SVG is intentionally unchanged.
class TestPath2D{
 constructor(d){this.path=d;}
}
for(const state of ["rapid-rise","elevated","unverified","crossing",
                     "minor","moderate","major"]){
 for(const rapid of [false,true]){
  let output=null,canvas=null;
  const painted=[];
  const ctx={
   scale(x,y){painted.push(["scale",x,y]);},
   beginPath(){painted.push(["beginPath"]);},
   arc(...v){painted.push(["arc",...v]);},
   fill(path){painted.push(["fill",this.fillStyle,path?.path??"arc"]);},
   stroke(path){painted.push(["stroke",this.strokeStyle,path?.path??"arc"]);}
  };
  const makeCanvas=()=>{canvas={
   width:0,height:0,getContext(){return ctx;},
   toDataURL(type){assert.equal(type,"image/png");
    output="data:image/png;base64,cG5n";return output;}
  };return canvas;};
  const bitmap=createRiverGaugeMapMarkerBitmap(
   state,rapid,makeCanvas,TestPath2D);
  assert.equal(bitmap,output,`${state} must use a raster PNG map icon`);
  assert.deepEqual([canvas.width,canvas.height],[160,176],
   `${state}: every bitmap uses one identical fixed pixel surface`);
  assert.ok(painted.some(x=>x[0]==="scale"&&x[1]===2&&x[2]===2));
  const pin=painted.find(x=>x[0]==="fill");
  assert.equal(pin[1],({
   "rapid-rise":"#1269e8",elevated:"#1269e8",unverified:"#8292a2",
   crossing:"#f5a21b",minor:"#2db76f",moderate:"#ffd43b",
   major:"#e53935"
  })[state],`${state}: map PNG must preserve exact icon palette`);
  assert.ok(painted.some(x=>x[0]==="stroke"),
   `${state}: map PNG must retain water waves / bridge artwork`);
  assert.equal(painted.some(x=>x[0]==="arc"&&x[1]===61),
   rapid||state==="rapid-rise",
   `${state}: only measured rise may add the blue up-arrow`);
 }
}

const fixedSourceSvg=decodeURIComponent(
 createRiverGaugeMarkerImage("elevated",false).split(",")[1]);
assert.match(fixedSourceSvg,/width="80" height="88" viewBox="0 0 80 88"/,
 "Safari SVG raster dimensions must not be ambiguous");
assert.doesNotMatch(fixedSourceSvg,/cx="61"/,
 "Blue elevated monitoring icon must have no rapid-rise arrow");
const legendCss=readFileSync(new URL("../src/single-interface-v1.css",import.meta.url),"utf8");
const legendIconStyles=legendCss.match(/#riverGaugeSeverityLegend \.flood-legend-entry img,[\s\S]*?object-fit:contain;/);
assert.ok(legendIconStyles,"Flood legend icon CSS must exist");
assert.match(legendIconStyles[0],/width:24px;/,"Legend pin width must match map");
assert.match(legendIconStyles[0],/height:27px;/,"Legend pin height must match map");
for(const state of ["rapid-rise","elevated","unverified","crossing",
                    "minor","moderate","major","unexpected"]){
 assert.deepEqual(riverGaugeMapMarkerDimensions(state),fixedSize,
  `${state}: ALL flood map markers must have identical dimensions`);
}
for(const state of ["rapid-rise","crossing","minor","moderate","major"]){
 for(const rapid of [false,true]){
  assert.match(createRiverGaugeMarkerImage(state,rapid),/^data:image\/svg\+xml/,
   `${state}: both rapid-rise artwork variants must remain available`);
  assert.deepEqual(riverGaugeMapMarkerDimensions(state),fixedSize);
 }
}
const info=riverGaugePanelAppearance({
 displayState:"crossing",rapidRise:false,crossingReached:true
});
assert.match(info.category,/CROSSING HEIGHT REACHED/);
assert.match(info.category,/ROAD STATUS UNCONFIRMED/);
assert.equal(decodeURIComponent(info.image.split(",")[1]),amber,
 "Popup MUST show exact same crossing icon as map");
// Gauge 535162: official BoM crossing reference 1.71m, earlier source
// reading 2.77m; tests do not pretend the historical reading is live.
const theresa277=make("535162",2.77,now-8*MIN,{
 STORMTRACKER_PLOT_CROSSING:crossing
});
const matched=reconcileFloodEvents([theresa277],{}, {},now);
assert.equal(matched.features[0].properties.STORMTRACKER_DISPLAY_STATE,"crossing");
assert.equal(matched.features[0].properties.STORMTRACKER_CROSSING_REACHED,true);
assert.equal(buildNotableFloodGaugeReport([theresa277],null,now).groups[2].rows[0]
 .crossing.amountAboveMetres,1.06);
// Rapid rise is measured from valid samples, NOT merely a high water height.
const risingTheresa=make("535162",2.77,now-8*MIN,{
 STORMTRACKER_PLOT_CROSSING:crossing,STORMTRACKER_TENDENCY:"rising"
});
const risingHistory={"bom:535162":[
 {time:now-38*MIN,height:1.85},{time:now-8*MIN,height:2.77}]};
const risingAlert=reconcileFloodEvents([risingTheresa],risingHistory,{},now);
assert.equal(risingAlert.features[0].properties.STORMTRACKER_DISPLAY_STATE,"crossing");
assert.equal(risingAlert.features[0].properties.STORMTRACKER_RAPID_RISE,true,
 "Bridge marker retains blue arrow if and only if measured rise criteria met");
// A gauge still above its published crossing height keeps its amber bridge,
// but must drop the rapid-rise arrow as soon as the measured rate slows.
const settledCrossing=make("535162",2.80,now+52*MIN,{
 STORMTRACKER_PLOT_CROSSING:crossing,
 STORMTRACKER_OBSERVED_TEXT:"22:00 24/10/2026",
 STORMTRACKER_TENDENCY:"rising"
});
const crossingAfter=reconcileFloodEvents([settledCrossing],{
 "bom:535162":[...risingHistory["bom:535162"],
   {time:now+22*MIN,height:2.78},{time:now+52*MIN,height:2.80}]
},{},now+60*MIN);
assert.equal(crossingAfter.features.length,1,"Crossing marker persists");
assert.equal(crossingAfter.features[0].properties.STORMTRACKER_DISPLAY_STATE,"crossing");
assert.equal(crossingAfter.features[0].properties.STORMTRACKER_CROSSING_REACHED,true);
assert.equal(crossingAfter.features[0].properties.STORMTRACKER_RAPID_RISE,false,
 "Arrow disappears without hiding the water-over-crossing marker");
assert.ok(Math.abs(crossingAfter.features[0].properties.STORMTRACKER_RISE_RATE_M_PER_H-0.04)<1e-8,
 "A crossing must retain a slow positive 30-minute measured rate without a blue arrow");
assert.equal(crossingAfter.features[0].properties.STORMTRACKER_RATE_INTERVAL_MINUTES,30);
const fallingCrossing=make("535162",2.65,now+82*MIN,{
 STORMTRACKER_PLOT_CROSSING:crossing,
 STORMTRACKER_TENDENCY:"falling"
});
const fallingRate=reconcileFloodEvents([fallingCrossing],{
 "bom:535162":[...risingHistory["bom:535162"],
  {time:now+22*MIN,height:2.78},{time:now+52*MIN,height:2.80},
  {time:now+82*MIN,height:2.65}]
},{},now+90*MIN);
assert.equal(fallingRate.features[0].properties.STORMTRACKER_DISPLAY_STATE,"crossing");
assert.ok(Math.abs(fallingRate.features[0].properties.STORMTRACKER_RISE_RATE_M_PER_H+0.30)<1e-8,
 "Negative measured rate must reach the information panel on amber crossing");
assert.equal(fallingRate.features[0].properties.STORMTRACKER_RAPID_RISE,false);
assert.equal(alerts.features[0].properties.STORMTRACKER_RISE_RATE_M_PER_H,null,
 "A crossing with no rate history is marked unavailable, never zero");
assert.equal(crossingAfter.features[0].properties.STORMTRACKER_TENDENCY,"rising",
 "Published BoM tendency remains unchanged for the existing popup");
assert.doesNotMatch(decodeURIComponent(createRiverGaugeMarkerImage(
 "crossing",crossingAfter.features[0].properties.STORMTRACKER_RAPID_RISE
).split(",")[1]),/cx="61"/,"The displayed crossing symbol has no residual arrow");
const arrowSvg=decodeURIComponent(
 createRiverGaugeMarkerImage("crossing",true).split(",")[1]);
assert(arrowSvg.includes('cx="61"'),"Badge is shown over the bridge pin");
assert(arrowSvg.includes("Bridge deck and supports"),"Arrow does not replace bridge");
assert.equal(riverGaugePanelAppearance({
 displayState:"crossing",rapidRise:true,crossingReached:true
}).rapidRise,true,"Popup retains actual rapid-rise modifier");
// Existing official minor/moderate/major ALWAYS supersede crossing colour.
// This hypothetical same-station bridge is a controlled regression fixture.
const official=make("035295",12.55,now-8*MIN,{
 bom_stn_num:"035295",STORMTRACKER_TENDENCY:"steady",
 STORMTRACKER_PLOT_CROSSING:{type:"B",heightMetres:7.45,
 crossingName:"Synthetic test-only bridge"},STORMTRACKER_FLOOD_CLASS:"moderate"
});
const moderate=reconcileFloodEvents([official],{}, {},now);
assert.equal(moderate.features[0].properties.STORMTRACKER_DISPLAY_STATE,
 "moderate","Amber bridge must never replace verified yellow moderate flooding");
assert.equal(moderate.features[0].properties.STORMTRACKER_CROSSING_REACHED,true);
assert.equal(reconcileFloodEvents([
 make("535162",1.70,now-8*MIN,{STORMTRACKER_PLOT_CROSSING:crossing})
],{}, {},now).features.length,0,"Below an exact published crossing without rapid rise is excluded");
assert.equal(reconcileFloodEvents([
 make("535162",2.80,now-180*MIN,{STORMTRACKER_PLOT_CROSSING:crossing})
],{}, {},now).features.length,0,"Old heights cannot establish a current crossing exceedance");
assert.equal(reconcileFloodEvents([
 make("535162",2.8,now-8*MIN,{STORMTRACKER_PLOT_CROSSING:crossing,bom_stn_num:"535161"})
],{}, {},now).features.length,0,"Mismatched exact station number is rejected");
const other=make("535999",1.85);
assert.equal(reconcileFloodEvents([other],{}, {},now).features.length,0,
 "Do not apply Theresa Creek's bridge to every gauge without a flood class");
const catalog={schema:CROSSING_SCHEMA,entries:{"bom:535999":{
 type:"C",heightMetres:1.8,crossingName:"Published causeway"}}};
assert.equal(reconcileFloodEvents([other],{}, {},now,catalog).features.length,1,
 "All stations with a published Section 5 crossing also appear on the map");
const reported=buildNotableFloodGaugeReport([th],null,now);
assert.equal(reported.total,1,
 "Report must include BoM station-plot bridge even when Section 5 list omits that station");
assert.equal(reported.crossedCount,1);
assert.equal(reported.groups[2].rows[0].crossing.levelMetres,1.71);
assert.equal(publishedCrossingForFeature(th,catalog).heightMetres,1.71,
 "Current exact station table should beat an older catalogue record");

// End-to-end: the existing Worker should publish the crossing from the SAME
// .tbl.shtml station page it already reads for history; no extra BoM request.
const table=html+
 '<table id="tableStyle1"><tr><th>Date/Time</th><th>Water Level (m)</th></tr>'+
 '<tr><td>24/10/2026 20:00</td><td>2.77</td></tr>'+
 '<tr><td>24/10/2026 21:00</td><td>2.80</td></tr></table></html>';
const oldFetch=globalThis.fetch;
let upstreamCalls=0;
try{
 globalThis.fetch=async url=>{
  assert.match(String(url),/IDQ65392\.535162\.tbl\.shtml$/);
  upstreamCalls++;
  return new Response(table,{status:200,headers:{"Content-Type":"text/html"}});
 };
 const reply=await worker.fetch(new Request(
  "https://relay.invalid/river-recent-history?product=IDQ65392&station=535162",
  {headers:{Origin:"https://blakesmith-intel.github.io"}}),{});
 assert.equal(reply.status,200);
 const payload=await reply.json();
 assert.equal(payload.format,"StormTrackerBomRecentRiverHistoryV1");
 assert.equal(payload.station,"535162");
 assert.equal(payload.crossing?.heightMetres,1.71);
 assert.equal(upstreamCalls,1,"Do not add redundant station page requests");
 // Actual Cloudflare reads streamed chunks: split even inside the station ID,
 // `Crossing Levels` and the first table opening tag.
 let offset=0;
 globalThis.fetch=async()=>{
  upstreamCalls++;
  return new Response(new ReadableStream({
   pull(controller){
    if(offset>=table.length){controller.close();return;}
    controller.enqueue(new TextEncoder().encode(table.slice(offset,offset+35)));
    offset+=35;
   }
  }),{status:200,headers:{"Content-Type":"text/html"}});
 };
 const chunked=await worker.fetch(new Request(
  "https://relay.invalid/river-recent-history?product=IDQ65392&station=535162",
  {headers:{Origin:"https://blakesmith-intel.github.io"}}),{});
 assert.equal(chunked.status,200);
 assert.equal((await chunked.json()).crossing?.heightMetres,1.71,
  "Stream chunk boundaries must not lose or corrupt exact station crossing metadata");
 assert.equal(upstreamCalls,2,"Each history request still uses only one BoM table fetch");
}finally{globalThis.fetch=oldFetch;}
console.log("PASS BoM exact-ID bridge metadata + relay, 535162 map inclusion, all-station crossings, report, and stale/false-positive guards");
