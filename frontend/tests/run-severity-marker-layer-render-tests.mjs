import assert from "node:assert/strict";
import {createSeverityMarkerLayers,rainfallIconPriority,floodIconPriority,chooseVisibleSeverityMarkers}
 from "../src/context-layers/severity-marker-layer-v1.js";

// Cesium billboard drawing is ordered by one BillboardCollection, not by
// CustomDataSource.raiseToTop(). Exercise low -> high overlap order across
// BOTH rainfall and river/flood marker owners, and preserve native pick IDs.
class FakeBillboardCollection {
 constructor(){this.items=[];}
 removeAll(){this.items=[];}
 add(item){this.items.push(item);return item;}
}
class FakeEntitySource {
 constructor(name){
  this.name=name;this.show=false;
  this.entities={
   values:[],
   add(item){this.values.push(item);return item;},
   removeAll(){this.values=[];},
   suspendEvents(){},
   resumeEvents(){}
  };
 }
}
const stage=[];
const viewer={
 dataSources:{add(s){return s;},raiseToTop(){}},
 scene:{
  primitives:{
   add(pool){stage.push(pool);return pool;},
   raiseToTop(pool){assert.equal(pool,stage[0]);}
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
function add(layer,rank,id){
 const entity=layer.sourceFor(rank).entities.add({
  id,position:{x:1},billboard:{
   image:id,width:98,height:40,disableDepthTestDistance:Infinity
  }
 });
 entity.stormTrackerRainGaugeId=id;
 return entity;
}
assert.equal(rainfallIconPriority({classification:"below-20pct-aep"}),1);
assert.equal(rainfallIconPriority({aepDesignThreshold:20}),2);
assert.equal(rainfallIconPriority({aepDesignThreshold:10}),3);
assert.equal(rainfallIconPriority({aepDesignThreshold:5}),4);
assert.equal(rainfallIconPriority({aepDesignThreshold:2}),5);
assert.equal(rainfallIconPriority({aepDesignThreshold:1}),6);
assert.equal(floodIconPriority("major"),6);
const less=add(rainfall,1,"less-rare");
add(rainfall,2,"notable");
add(rainfall,3,"unusual");
add(rainfall,4,"rare");
add(rainfall,5,"very-rare");
const exceptional=add(rainfall,6,"exceptional");
add(flood,6,"major-flood");
rainfall.finish();
flood.finish();
assert.equal(stage.length,1,"Both owners must use one billboard collection");
assert.deepEqual(stage[0].items.map(x=>x.image),[
 "less-rare","notable","unusual","rare","very-rare","major-flood","exceptional"
],"More severe rainfall appears AFTER less-rare markers, never hidden below them");
assert.equal(less.billboard.show,false,"Entity visual must not double-render");
assert.equal(stage[0].items.at(-1).id,exceptional,
 "Original Cesium entity identity must survive primitive picking");
assert.equal(stage[0].items.at(-1).disableDepthTestDistance,Infinity);
rainfall.setVisible(false);
assert.deepEqual(stage[0].items.map(x=>x.image),["major-flood"],
 "Turning off rainfall must retain flood markers");
rainfall.setVisible(true);
assert.equal(stage[0].items.at(-1).image,"exceptional");
flood.clear();
flood.finish();
assert.deepEqual(stage[0].items.map(x=>x.image),[
 "less-rare","notable","unusual","rare","very-rare","exceptional"
]);
const rect=(x,y,w=98,h=40)=>({left:x,top:y,right:x+w,bottom:y+h});
const material=[
 {id:"less",rank:1,owner:"rainfall",rect:rect(0,0)},
 {id:"notable",rank:2,owner:"rainfall",rect:rect(10,4)},
 {id:"exceptional",rank:6,owner:"rainfall",rect:rect(13,7)},
 {id:"separate-less",rank:1,owner:"rainfall",rect:rect(250,0)}
];
const near=chooseVisibleSeverityMarkers(material);
assert.deepEqual([...near].sort(),["exceptional","separate-less"],
 "Highest rarity must remain visible and materially overlapping lower rarity must be obscured");
const moved=chooseVisibleSeverityMarkers(material.map(x=>x.id==="less"?
 {...x,rect:rect(-200,0)}:x));
assert(moved.has("less"),"Lower rarity must reappear when camera separates its footprint");
const edge=chooseVisibleSeverityMarkers([
 {id:"notable",rank:2,owner:"rainfall",rect:rect(0,0)},
 {id:"less",rank:1,owner:"rainfall",rect:rect(95,0)}
]);
assert.equal(edge.size,2,"A slight 3px icon-edge touch must not hide a gauge");
const same=chooseVisibleSeverityMarkers([
 {id:"lower-total",rank:4,owner:"rainfall",mm:51,rect:rect(0,0)},
 {id:"higher-total",rank:4,owner:"rainfall",mm:160,rect:rect(0,0)}
]);
assert.deepEqual([...same],["higher-total"],"Equal rarity prefers the larger measured total");
console.log("PASS scene-level flood/rainfall AEP severity overlaps, pick IDs and toggles");
