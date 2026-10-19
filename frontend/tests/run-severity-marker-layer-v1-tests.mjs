import assert from "node:assert/strict";
import {createSeverityMarkerLayers,floodIconPriority,rainfallIconPriority} from "../src/context-layers/severity-marker-layer-v1.js";
const order=[];
class Source{
 constructor(name){this.name=name;this.show=false;this.entities={values:[],
  suspendEvents(){},resumeEvents(){},add(e){this.values.push(e);return e;},
  removeAll(){this.values=[];}};}
}
const viewer={dataSources:{
 add(s){order.push(s);return s;},
 raiseToTop(s){const i=order.indexOf(s);assert(i>=0);order.splice(i,1);order.push(s);}
}};
const CesiumRef={CustomDataSource:Source};
const rain=createSeverityMarkerLayers({viewer,CesiumRef,owner:"rainfall",priorities:[0,1,2,3,4,5,6]});
const flood=createSeverityMarkerLayers({viewer,CesiumRef,owner:"flood",priorities:[0,1,2,4,6]});
assert.deepEqual(order.map(s=>Number(s.name.match(/-(\d+)$/)[1])),
 [0,0,1,1,2,2,3,4,4,5,6,6],"Ascending draw order across both layers");
assert.deepEqual(["unverified","rapid-rise","minor","moderate","major"].map(floodIconPriority),[0,1,2,4,6]);
assert.deepEqual([null,{classification:"below-20pct-aep"},...[
 20,10,5,2,1].map(aepDesignThreshold=>({aepDesignThreshold}))].map(rainfallIconPriority),[0,1,2,3,4,5,6]);
flood.setVisible(true);rain.setVisible(true);
assert(order.slice(-2).every(s=>s.name.endsWith("-6")),
 "Major flood and exceptional rainfall are the foremost tiers");
rain.setVisible(false);
assert(rain.dataSources.every(s=>!s.show)&&flood.dataSources.every(s=>s.show),
 "Each layer independently toggles its entire set of tier sources");
rain.sourceFor(6).entities.add({id:"exceptional"});
rain.clear();assert(rain.dataSources.every(s=>s.entities.values.length===0));
console.log("Severity stacking, shared flood/rainfall ordering and independent visibility passed.");
