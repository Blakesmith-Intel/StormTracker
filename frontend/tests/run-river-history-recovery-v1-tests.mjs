import assert from "node:assert/strict";
import {createRiverGaugeLayer} from "../src/context-layers/river-gauge-layer-v1.js";

// Exercise the actual optional history path; current bulletins and Cesium
// entities must remain independent of a failed history lookup.
let clock=Date.UTC(2026,9,18,0,30);
const minute=60000;
const p=n=>String(n).padStart(2,"0");
function observedText(){
  const local=new Date(clock-15*minute+10*60*minute);
  return p(local.getUTCHours())+":"+p(local.getUTCMinutes())+" "+
    p(local.getUTCDate())+"/"+p(local.getUTCMonth()+1)+"/"+local.getUTCFullYear();
}
const gauge=(id)=>({id:"bom:"+id,type:"Feature",geometry:{
  type:"Point",coordinates:[153.1,-27.6]},properties:{
  bom_stn_num:id,state:"QLD",name:"Test River "+id,
  lat:-27.6,long:153.1,location_types:"water level gauge;"
}});
const features=[gauge("540384")];
let mode="service-down",historyCalls=0,renderCalls=0;
const statuses=[];
const fetchImpl=async url=>{
  const u=String(url);
  if(u.includes("/river-gauge-metadata"))return {ok:true,json:async()=>({
    type:"FeatureCollection",features})};
  if(u.includes("/river-height-bulletins"))return {ok:true,json:async()=>({
    partial:false,products:[{product:"IDQ60285",observations:features.map(f=>({
      stationName:f.properties.name,stationId:f.properties.bom_stn_num,
      heightMetres:2.25,tendency:"rising",floodClass:"minor",
      observedText:observedText(),
      recentDataHref:"/fwo/IDQ65388/IDQ65388."+
        f.properties.bom_stn_num+".plt.shtml"
    }))}]})};
  if(u.includes("/river-recent-history?")){
    historyCalls++;
    if(mode==="service-down")return new Response(JSON.stringify({
      code:"source_transport_failure"}),{
        status:503,headers:{"Content-Type":"application/json"}});
    if(mode==="station-missing"&&u.includes("540385"))
      return {ok:true,json:async()=>({
        format:"StormTrackerBomRecentRiverHistoryV1",
        availability:"no_recent_observations",
        product:"IDQ65388",station:"540385",samples:[]
      })};
    if(mode==="station-oversize"&&u.includes("540385"))
      return new Response(JSON.stringify({code:"source_response_too_large"}),{
        status:502,headers:{"Content-Type":"application/json"}});
    return {ok:true,json:async()=>({
      format:"StormTrackerBomRecentRiverHistoryV1",
      product:"IDQ65388",station:new URL(u).searchParams.get("station"),
      samples:[
        {time:clock-75*minute,height:0.6},
        {time:clock-15*minute,height:2.25}
      ]
    })};
  }
  throw Error("Unexpected request "+u);
};
class Collection{
  constructor(){this.values=[];}
  suspendEvents(){}
  resumeEvents(){}
  removeAll(){this.values=[];}
  add(item){this.values.push(item);return item;}
}
class Source{
  constructor(){this.entities=new Collection();this.show=true;}
}
const viewer={
  dataSources:{add:()=>{}},
  scene:{requestRender(){renderCalls++;}}
};
const layer=createRiverGaugeLayer({
  viewer,fetchImpl,now:()=>clock,visible:false,
  storage:{getItem:()=>null,setItem:()=>{}},
  CesiumRef:{CustomDataSource:Source,
    Cartesian3:{fromDegrees:(...parts)=>parts},
    VerticalOrigin:{CENTER:0},HeightReference:{CLAMP_TO_GROUND:1}},
  onStatus:status=>statuses.push(status)
});
async function waitHistory(condition){
  for(let attempt=0;attempt<60&&!condition();attempt++)
    await new Promise(resolve=>setTimeout(resolve,0));
  assert.ok(condition(),"Optional history pass did not complete");
}
await layer.refresh();
await waitHistory(()=>layer.diagnostics?.recentHistory?.failed===1);
assert.equal(historyCalls,1);
assert.equal(layer.recentHistoryRequestCount,1);
assert.equal(layer.diagnostics.historyScreeningIncomplete,1);
assert.ok(statuses.some(s=>s.kind==="warning"&&s.screeningIncomplete===1),
  "Failure should warn about unscreened rising gauges");
const renderedAfterFailure=renderCalls;
await layer.refresh({force:true});
assert.equal(historyCalls,1,"Do not retry during the shared 15-minute cooldown");
assert.ok(renderCalls>renderedAfterFailure,"Current bulletins keep refreshing");
mode="recovered";
clock+=16*minute;
await layer.refresh({force:true});
await waitHistory(()=>layer.diagnostics?.recentHistory?.loaded===1);
assert.equal(historyCalls,2,"Previously failed station must retry after recovery");
assert.equal(layer.diagnostics.historyScreeningIncomplete,0);
assert.equal(layer.features.length,1,"Genuine rise must become visible after measured history recovers");
assert.equal(layer.features[0].properties.STORMTRACKER_DISPLAY_STATE,"minor");
assert.equal(layer.features[0].properties.STORMTRACKER_RAPID_RISE,true);
assert.ok(statuses.some(s=>s.screeningIncomplete===0&&s.kind==="ok"),
  "Recovered history should clear the incomplete-screening warning");

// Missing observations for one station are not a service outage: continue
// processing the next station, and leave the first explicitly unassessed.
clock+=16*minute;mode="station-missing";features.push(gauge("540385"),gauge("540386"));
await layer.refresh({force:true});
await waitHistory(()=>layer.diagnostics?.recentHistory?.noData===1);
assert.equal(layer.diagnostics.recentHistory.failed,0,
  "A valid empty station table is not a gateway error");
assert.ok(layer.diagnostics.historyScreeningIncomplete>=1);
assert.equal(layer.diagnostics.historySourceMissing,0);
assert.equal(layer.recentHistoryRequestCount,3);
assert.ok(statuses.at(-1).screeningIncomplete>=1);
assert.equal(statuses.at(-1).historyNoData,1);
const callsAfterEmpty=historyCalls;
await layer.refresh({force:true});
assert.equal(historyCalls,callsAfterEmpty,
  "No repeated no-data station request inside the 15-minute cooldown");
// A genuinely oversized individual station page must not activate the
// service-wide 15-minute circuit breaker or skip the remaining stations.
clock+=16*minute;
mode="station-oversize";
features.push(gauge("540387"));
// Use a fresh session to isolate station-specific retry from history already
// cached and time-aligned by the earlier service-outage recovery scenarios.
const isolatedLayer=createRiverGaugeLayer({
  viewer,fetchImpl,now:()=>clock,visible:false,
  storage:{getItem:()=>null,setItem:()=>{}},
  CesiumRef:{CustomDataSource:Source,
    Cartesian3:{fromDegrees:(...parts)=>parts},
    VerticalOrigin:{CENTER:0},HeightReference:{CLAMP_TO_GROUND:1}},
  onStatus:status=>statuses.push(status)
});
const beforeOversize=historyCalls;
await isolatedLayer.refresh();
await waitHistory(()=>isolatedLayer.diagnostics?.recentHistory?.failed===1);
assert.equal(isolatedLayer.recentHistoryRequestCount,4,
  "Every otherwise qualifying station still gets checked");
assert.equal(historyCalls,beforeOversize+4,
  "Continue checking all other gauges after one oversized station");
assert.equal(isolatedLayer.diagnostics.recentHistory.blockedUntil,0,
  "Oversized station should not mark all BoM history service unavailable");
assert.equal(isolatedLayer.diagnostics.recentHistory.loaded,3);
assert.ok(isolatedLayer.diagnostics.historyScreeningIncomplete>=1,
  "Genuine oversized station data must stay unscreened rather than safe");

console.log("River history recovery checks passed: source failure cooldown and retry, current map independence, truthful screening gap, restored verified signal, and station-specific no-data.");
