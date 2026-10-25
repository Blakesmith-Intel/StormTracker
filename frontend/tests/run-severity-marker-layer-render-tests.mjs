import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createSeverityMarkerLayers,rainfallIconPriority,floodIconPriority,FLOOD_PRIMITIVE_MARKER_SIZE}
 from "../src/context-layers/severity-marker-layer-v1.js";

const rainfallSource=readFileSync(new URL(
 "../src/context-layers/significant-rainfall-operational-v1.js",import.meta.url),"utf8");
assert.match(rainfallSource,/Cartesian3\.fromDegrees\(record\.longitude,record\.latitude\)/,
 "Source BoM gauge longitude/latitude must map directly to Cesium");
assert.match(rainfallSource,/image:marker\(record\),width:98,height:40/,
 "The entire droplet and rarity label must remain attached as one image");
assert.doesNotMatch(rainfallSource,/pixelOffset\s*:/,
 "Do not move the AEP label independently from its gauge");

// Every BoM station and its entire SVG (droplet + label) stays anchored to
// its verified coordinate. The 3-D draw priority must never discard a gauge.
class FakeBillboardCollection{
 constructor(){this.items=[];}
 removeAll(){this.items=[];}
 add(item){this.items.push(item);return item;}
}
class FakeEntitySource{
 constructor(name){
  this.name=name;this.show=false;
  this.entities={
   values:[],add(item){this.values.push(item);return item;},
   removeAll(){this.values=[];},suspendEvents(){},resumeEvents(){}
  };
 }
}
const stack=[];
const viewer={
 dataSources:{add(s){return s;},raiseToTop(){}},
 scene:{
  primitives:{
   add(pool){stack.push(pool);return pool;},
   raiseToTop(pool){
    const index=stack.indexOf(pool);
    assert(index>=0);stack.splice(index,1);stack.push(pool);
   }
  },
  requestRender(){}
 }
};
const CesiumRef={BillboardCollection:FakeBillboardCollection,
 CustomDataSource:FakeEntitySource,JulianDate:{now:()=>0}};
const flood=createSeverityMarkerLayers({viewer,CesiumRef,owner:"flood",
 priorities:[0,1,2,4,6],visible:true});
const rainfall=createSeverityMarkerLayers({viewer,CesiumRef,owner:"rainfall",
 priorities:[0,1,2,3,4,5,6],visible:true});
function add(layer,rank,id,longitude,latitude){
 const position=Object.freeze({longitude,latitude});
 const entity=layer.sourceFor(rank).entities.add({
  id,position,billboard:{
   image:"whole-droplet-plus-AEP-label:"+id,width:98,height:40,
   disableDepthTestDistance:Infinity
  }
 });
 entity.stormTrackerRainGaugeId=id;
 return entity;
}
const ranks=[
 ["less-rare",1,151.55,-25.65],
 ["notable",2,151.61,-25.66],
 ["unusual",3,151.62,-25.68],
 ["rare",4,151.64,-25.69],
 ["very-rare",5,151.71,-25.7],
 ["exceptional",6,151.75,-25.71]
];
for(const [id,rank,longitude,latitude] of ranks)
 add(rainfall,rank,id,longitude,latitude);
const major=flood.sourceFor(6).entities.add({
 id:"major-flood",position:Object.freeze({longitude:151.7,latitude:-25.67})
});
major.stormTrackerRiverGaugeId="major-flood";
major.stormTrackerFloodBillboard={
 image:"water-pin:major-flood",width:38,height:42,
 disableDepthTestDistance:Infinity
};
assert.deepEqual([20,10,5,2,1].map(x=>
 rainfallIconPriority({aepDesignThreshold:x})),[2,3,4,5,6]);
assert.equal(rainfallIconPriority({classification:"below-20pct-aep"}),1);
assert.equal(floodIconPriority("major"),6);
rainfall.finish();flood.finish();
const all=()=>stack.flatMap(pool=>pool.items);
assert.equal(stack.length,7,"One rank-specific Cesium collection for each severity");
assert.equal(all().length,7,"Never suppress an overlapping BoM station");
assert.deepEqual(stack.flatMap(pool=>pool.items.map(x=>x.id.id)),[
 "less-rare","notable","unusual","rare","very-rare","major-flood","exceptional"
],"Less rare draws before Notable and rarer categories");
for(const [id,rank,longitude,latitude] of ranks){
 const rendered=all().find(x=>x.id.id===id);
 assert(rendered,"Every gauge retained even at overlapping screen coordinates");
 assert.deepEqual(rendered.position,{longitude,latitude},
  "Never move geographic marker positions or round to a different station");
 assert.equal(rendered.image,"whole-droplet-plus-AEP-label:"+id);
 assert.equal(rendered.width,98);
 assert.equal(rendered.height,40);
 assert.equal(rendered.pixelOffset,undefined,"Never offset the label from its gauge");
 assert.equal(rendered.eyeOffset,undefined,"Never displace the gauge in 3-D");
 assert.equal(rendered.id.stormTrackerRainGaugeId,id,"Original picking identity retained");
 assert.equal(rendered.disableDepthTestDistance,Infinity);
}
assert.equal(major.stormTrackerRiverGaugeId,"major-flood");
assert.equal(major.billboard,undefined,"No second Cesium entity billboard for flood");
const renderedFlood=all().find(x=>x.id===major);
assert.ok(renderedFlood,"Single flood primitive must render");
assert.equal(renderedFlood.image,"water-pin:major-flood");
assert.deepEqual([renderedFlood.width,renderedFlood.height],[38,42],
 "Use original approved uniform map footprint");
rainfall.setVisible(false);
assert.deepEqual(all().map(x=>x.id.id),["major-flood"],
 "Turning off rainfall cannot erase river/flood gauges");
rainfall.setVisible(true);
assert.equal(all().length,7,"Every measured station must return without needing zoom");
flood.clear();flood.finish();
assert.deepEqual(all().map(x=>x.id.id),ranks.map(x=>x[0]));
// Check the ACTUAL primitive options for every flood icon and both rising states.
// Deliberately put incorrect dimensions on the incoming blue monitoring entity;
// a regression back to that size must fail this test.
const allFloodStates=["rapid-rise","elevated","unverified","crossing",
 "minor","moderate","major"];
const allFloodVariants=[];
for(const state of allFloodStates){
 for(const rapid of [false,true]){
  const id=state+(rapid?":rapid":":normal");
  const entity=flood.sourceFor(floodIconPriority(state)).entities.add({
   id,position:Object.freeze({longitude:151.6,latitude:-25.7})
  });
  entity.stormTrackerRiverGaugeId=id;
  entity.stormTrackerFloodBillboard={
   image:"flood-svg:"+id,
   width:state==="elevated"?114:14,
   height:state==="elevated"?126:17,
   scale:state==="elevated"?3:.2,
   scaleByDistance:{near:1,nearValue:1,far:500000,farValue:.2},
   heightReference:"CLAMP_TO_GROUND",
   disableDepthTestDistance:Infinity
  };
  allFloodVariants.push(entity);
 }
}
flood.finish();
assert.equal(all().length,allFloodVariants.length);
for(const entity of allFloodVariants){
 const pin=all().find(item=>item.id===entity);
 assert.ok(pin,"Missing rendered flood gauge "+entity.id);
 assert.deepEqual([pin.width,pin.height],
  [FLOOD_PRIMITIVE_MARKER_SIZE.width,FLOOD_PRIMITIVE_MARKER_SIZE.height],
  "Final GPU dimensions inconsistent for "+entity.id);
 assert.equal(pin.scale,1,"Flood scale must be one: "+entity.id);
 assert.equal(pin.sizeInMeters,false,"Pin size must be in pixels: "+entity.id);
 assert.equal(pin.scaleByDistance,undefined,"No distance shrinking: "+entity.id);
 assert.deepEqual(pin.position,entity.position,"Source coordinate moved: "+entity.id);
 assert.equal(pin.image,"flood-svg:"+entity.id,"Original icon art changed");
 assert.equal(pin.id.stormTrackerRiverGaugeId,entity.id);
}
flood.setVisible(false);assert.deepEqual(all(),[]);
flood.setVisible(true);
assert.equal(all().length,allFloodVariants.length,
 "Toggling must not restore a differently sized monitoring icon");
console.log("PASS 14 final flood billboard states/variants identical pixel sizes and scales, rainfall preserved");
