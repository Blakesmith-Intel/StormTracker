import assert from "node:assert/strict";
import {
  qldLocalityViewBounds, expandLocalityBounds, localityBoundsContain,
  qldLocalityQueryUrl, normaliseQldLocalities, fetchQldNearbyLocalities
} from "../src/context-layers/qld-nearby-localities-v1.js";
import {createQueenslandTownLabelLayer}
  from "../src/context-layers/qld-town-label-layer-v1.js";

const region={west:139.1,east:139.8,south:-26.15,north:-25.65};
const params=new URL(qldLocalityQueryUrl(region)).searchParams;
assert.ok(params.get("where").includes("LOCB"));
assert.ok(params.get("where").includes("POPL"));
assert.ok(!params.get("where").includes("HILL"),"Do not label every natural feature");
assert.equal(params.get("geometryType"),"esriGeometryEnvelope");
assert.deepEqual(normaliseQldLocalities({type:"FeatureCollection",features:[
  {type:"Feature",properties:{objectid:22,place_name:"Pandie Pandie",type:"LOCB"},
    geometry:{type:"Point",coordinates:[139.55,-25.97]}},
  {type:"Feature",properties:{objectid:23,place_name:"Gully",type:"GLLY"},
    geometry:{type:"Point",coordinates:[139.6,-26.02]}},
  {type:"Feature",properties:{objectid:24,place_name:"Dry Creek",type:"SUB"},
    geometry:{type:"Point",coordinates:[139.6,-25.8]}}
]}).map(x=>x.name),["Pandie Pandie","Dry Creek"]);
assert.equal(localityBoundsContain(expandLocalityBounds(region),region),true);
assert.equal(localityBoundsContain(region,{...region,east:141}),false);
await assert.rejects(()=>fetchQldNearbyLocalities({
  bounds:region,fetchImpl:async()=>({ok:true,async json(){
    return {error:{message:"ArcGIS error"}};
  }})
}),/ArcGIS error/);
// Dense/urban viewport overflow must split into bounded official requests,
// not endlessly refetch the identical over-limit URL when the camera moves.
let subqueries=0,rootQueries=0;
const dense=await fetchQldNearbyLocalities({
  bounds:region,
  fetchImpl:async url=>{
    const geometry=String(new URL(url).searchParams.get("geometry")).split(",").map(Number);
    if(Math.abs(geometry[0]-region.west)<1e-6 &&
       Math.abs(geometry[2]-region.east)<1e-6){
      rootQueries++;
      return {ok:true,async json(){return {
        type:"FeatureCollection",exceededTransferLimit:true,features:[]
      };}};
    }
    subqueries++;
    return {ok:true,async json(){return {type:"FeatureCollection",features:[
      {type:"Feature",properties:{objectid:subqueries,place_name:"Town "+subqueries,type:"SUB"},
        geometry:{type:"Point",coordinates:[(geometry[0]+geometry[2])/2,
          (geometry[1]+geometry[3])/2]}}
    ]};}};
  }
});
assert.equal(rootQueries,1);
assert.equal(subqueries,2,"Exactly two bounded subqueries resolve the saturated viewport");
assert.equal(dense.length,2);
assert.ok(dense.every(x=>x.kind==="SUB"));
const overflowing=async()=>({ok:true,async json(){return {
  type:"FeatureCollection",exceededTransferLimit:true,features:[]
};}});
let boundedCalls=0;
await assert.rejects(()=>fetchQldNearbyLocalities({
  bounds:region,fetchImpl:async()=>{boundedCalls++;return overflowing();},
  maxSplitDepth:3
}),/exceeded bounded query limit/);
assert.equal(boundedCalls,4,"An over-limit leftmost quadrant fails immediately at depth three");
assert.ok(boundedCalls<=15,"No branch can exceed a hard 15-query bound");
const CesiumMath={toDegrees:v=>v};
let activeRegion=region;
const camera={positionCartographic:{height:55000},computeViewRectangle:()=>activeRegion};
assert.deepEqual(qldLocalityViewBounds(camera,{Math:CesiumMath},{}),region);
assert.equal(qldLocalityViewBounds({...camera,positionCartographic:{height:300000}},
  {Math:CesiumMath},{}),null,"No statewide gazetteer download");
const labels=[];
const collection={show:false,add(value){const item={...value};labels.push(item);return item;},
  remove(item){const i=labels.indexOf(item);if(i>=0)labels.splice(i,1);}};
let loads=0;
const scene={
  canvas:{clientWidth:1200,clientHeight:800},
  camera:{...camera,positionWC:{x:10,y:10,z:10},directionWC:{x:0,y:0,z:-1}},
  globe:{ellipsoid:{}},
  primitives:{add(){return collection;},remove(){}},
  postRender:{addEventListener(){return ()=>{};}},
  requestRender(){}
};
const CesiumRef={
  Math:CesiumMath,LabelCollection:class {},BlendOption:{TRANSLUCENT:2},
  Cartesian3:{fromDegrees:(lon,lat,z)=>({x:lon,y:lat,z})},
  LabelStyle:{FILL_AND_OUTLINE:1},
  HorizontalOrigin:{CENTER:1},VerticalOrigin:{CENTER:1},
  Color:{WHITE:1,BLACK:2},Ellipsoid:{WGS84:{}},
  EllipsoidalOccluder:class {isPointVisible(){return true;}},
  SceneTransforms:{worldToWindowCoordinates(_,pos){
    return {x:(pos.x-139.05)*550+200,y:(-25.5-pos.y)*550+150};
  }}
};
const fetchImpl=async url=>{
  loads++;
  if(String(url).includes("QldPlaceNames"))return {
    ok:true,async json(){return {type:"FeatureCollection",features:[
      {type:"Feature",properties:{objectid:22,place_name:"Pandie Pandie",type:"LOCB"},
        geometry:{type:"Point",coordinates:[139.55,-25.97]}},
      {type:"Feature",properties:{objectid:24,place_name:"Dry Creek",type:"SUB"},
        geometry:{type:"Point",coordinates:[139.6,-25.8]}},
      {type:"Feature",properties:{objectid:25,place_name:"Birdsville",type:"POPL"},
        geometry:{type:"Point",coordinates:[139.35,-25.9]}}
    ]};}
  };
  return {ok:true,async json(){return {type:"FeatureCollection",features:[
    {type:"Feature",id:1,properties:{objectid:1,name:"Birdsville",population:115},
      geometry:{type:"Point",coordinates:[139.35,-25.9]}}
  ]};}};
};
const container={children:[],appendChild(el){this.children.push(el);el.parent=this;}};
const documentRef={createElement(){
  return {
    children:[],style:{},parent:null,
    setAttribute(){},
    appendChild(el){this.children.push(el);el.parent=this;},
    remove(){if(this.parent)this.parent.children=
      this.parent.children.filter(x=>x!==this);this.parent=null;}
  };
}};
const layer=createQueenslandTownLabelLayer({
  viewer:{scene,container:{parentElement:container}},
  CesiumRef,fetchImpl,mode:"qld-imagery",container,documentRef,
  deferLocalityDuringNavigation:true
});
await layer.start();
for(let t=0;t<100&&layer.gazetteerCount===0;t++)await new Promise(r=>setTimeout(r,10));
assert.equal(layer.gazetteerCount,2,
  "Load both minor localities while skipping overlapping existing town name");
const names=layer.visibleLabels.map(x=>x.name);
assert.ok(names.includes("Birdsville"),"Original town must remain");
assert.ok(names.includes("Pandie Pandie"),"Minor gazetted rural locality must render at close zoom");
const before=loads;
layer.draw(true);
assert.equal(loads,before,"Viewport coverage must prevent repeat fetches");
layer.setMode("street");
assert.ok(layer.visibleCount>=2,"Street shows supplemental rural localities too");
const previousFetches=loads;
layer.setNavigationActive(true);
activeRegion={west:141,east:141.7,south:-26.15,north:-25.65};
scene.camera.positionWC.x++;
layer.draw(true);
assert.equal(loads,previousFetches,
  "Rapid camera movement must not send locality queries while dragging");
layer.setNavigationActive(false);
await new Promise(resolve=>setTimeout(resolve,720));
assert.ok(loads>previousFetches,
  "Settled navigation performs one viewport-bounded locality update");
layer.destroy();
console.log("QLD locality checks passed: bounded official gazetteer query, rural additions in both Street and imagery, dedupe and DOM cleanup.");
