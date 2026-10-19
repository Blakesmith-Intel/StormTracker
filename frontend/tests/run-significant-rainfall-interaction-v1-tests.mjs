import assert from "node:assert/strict";
import {initialiseOperationalSignificantRainfall} from "../src/context-layers/significant-rainfall-operational-v1.js";

const listeners=new Map();
const record=(type,fn)=>{if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn)};
const unrecord=(type,fn)=>listeners.get(type)?.delete(fn);
globalThis.window={
 addEventListener:record,removeEventListener:unrecord,
 fire(type,overrides={}){for(const fn of listeners.get(type)||[])fn({type,...overrides})}
};
class Element {
 constructor(name){this.name=name;this.hidden=true;this.textContent="";this.children=[];this.dataset={};this.attributes={};this.handlers=new Map()}
 addEventListener(t,f){this.handlers.set(t,f)}
 setAttribute(k,v){this.attributes[k]=v; if(k==="hidden")this.hidden=true}
 append(...els){this.children.push(...els)}
 replaceChildren(...els){this.children=[...els]}
 closest(){return this.blocked?{}:null}
 getBoundingClientRect(){return {left:100,top:50,right:900,bottom:650}}
}
const elements=new Map(),el=id=>{
 if(!elements.has(id))elements.set(id,new Element(id));
 return elements.get(id);
};
globalThis.document={hidden:false,getElementById:el,createElement:name=>new Element(name)};
const mapTarget=new Element("cesium widget child"),upTarget=new Element("other child after Cesium camera pointer capture");
const blockedTarget=new Element("sidebar");blockedTarget.blocked=true;
const container={contains:target=>[mapTarget,upTarget,el("canvas")].includes(target)};
const sourceCreatedAt="2026-10-19T01:20:00Z";
const fakeSource={format:"StormTrackerSignificantRainfallV1",checkedAt:sourceCreatedAt,failed:[],
 observations:{
  since9am:[{id:"540523",name:"Rockside Mt",mm:125,band:"red",region:"west",period:"since9am",
    sourceCreatedAt,latitude:-25.1,longitude:145.3}],
  lastHour:[{id:"540523",name:"Rockside Mt",mm:63,band:"orange",region:"west",period:"lastHour",
    sourceCreatedAt,latitude:-25.1,longitude:145.3}]
 }};
let renderedEntities=[],activeHit=null,lastPick=null;
const Cesium={
 CustomDataSource:class{
  constructor(){this.show=false;this.entities={
   add(x){const entity={...x};renderedEntities.push(entity);return entity},
   removeAll(){renderedEntities=[]}
  }}
 },
 Cartesian3:{fromDegrees:(lon,lat)=>({lon,lat})},
 Cartesian2:class{constructor(x,y){this.x=x;this.y=y}},
 VerticalOrigin:{BOTTOM:"BOTTOM"},HeightReference:{CLAMP_TO_GROUND:"CLAMP_TO_GROUND"}
};
const viewer={
 container,
 dataSources:{add(){}},
 scene:{
  canvas:el("canvas"),
  requestRender(){},
  drillPick(pos,_limit,width,height){lastPick={pos,width,height};return activeHit?[activeHit]:[]},
  pick(){return activeHit}
 }
};
const layer=initialiseOperationalSignificantRainfall({viewer,CesiumRef:Cesium,
 fetchImpl:async()=>({ok:true,json:async()=>fakeSource}),
 now:()=>Date.parse("2026-10-19T01:23:00Z"),refreshMs:300000});
layer.setVisible(true);
await layer.refresh(true);
assert.equal(layer.features.length,1,"Genuine station must be visible when a measured observation qualifies");
assert.equal(renderedEntities.length,1);
const first=renderedEntities[0];
assert.equal(first.stormTrackerRainGaugeId,"540523");
activeHit={id:first};
const event={button:0,pointerId:9,pointerType:"mouse",clientX:300,clientY:250};
window.fire("pointerdown",{...event,target:mapTarget});
window.fire("pointerup",{...event,target:upTarget});
assert.equal(el("significantRainfallInfo").hidden,false,
 "Tap beginning within Cesium scene must open rainfall details even if pointerup retargets off canvas");
assert.equal(el("significantRainfallInfoTitle").textContent,"Rockside Mt");
const content=el("significantRainfallInfoRows").children
 .filter(x=>x.name==="strong").map(x=>x.textContent);
assert(content.includes("125.0 mm"),"Information panel must show observed rainfall total");
assert(content.includes("540523"),"Information panel must show exact BoM gauge ID");
assert(content.some(x=>x.includes("19 Oct 2026")),"Information panel must show source issuance time");
assert(content.some(x=>x.includes("100 mm or more")),"Current production band must be shown");
assert.equal(lastPick.pos.x,200);assert.equal(lastPick.pos.y,200);
assert.equal(lastPick.width,28);assert.equal(lastPick.height,28);
el("significantRainfallInfo").hidden=true;
window.fire("pointerdown",{...event,pointerId:10,pointerType:"touch",target:mapTarget});
window.fire("pointerup",{...event,pointerId:10,pointerType:"touch",target:upTarget});
assert.equal(lastPick.width,42,"Touch needs a wider tap-pick target");
assert.equal(el("significantRainfallInfo").hidden,false);
el("significantRainfallInfo").hidden=true;
window.fire("pointerdown",{...event,pointerId:11,target:blockedTarget});
window.fire("pointerup",{...event,pointerId:11,target:upTarget});
assert.equal(el("significantRainfallInfo").hidden,true,"Do not select map gauge from clicking sidebar");
window.fire("pointerdown",{...event,pointerId:12,target:mapTarget});
window.fire("pointermove",{...event,pointerId:12,clientX:355,target:mapTarget});
window.fire("pointerup",{...event,pointerId:12,clientX:355,target:upTarget});
assert.equal(el("significantRainfallInfo").hidden,true,"Map dragging must not open a rainfall panel");
activeHit={id:{id:"significant-rain:since9am:540523"}};
window.fire("pointerdown",{...event,pointerId:13,target:mapTarget});
window.fire("pointerup",{...event,pointerId:13,target:upTarget});
assert.equal(el("significantRainfallInfo").hidden,false,
 "Cesium entity ID fallback must work when direct custom field isn't present");
layer.setVisible(false);
assert.equal(el("significantRainfallInfo").hidden,true);
layer.stop();
assert.equal(listeners.get("pointerdown")?.size,0,"Stop must remove capture listeners");
assert.equal(listeners.get("pointerup")?.size,0,"Stop must remove capture listeners");
console.log("PASS rainfall gauge 2D/3D mapped Cesium click: window capture, exact ID, source popup, touch, blocked UI, drag and cleanup");
