import assert from "node:assert/strict";
import {
  QUEENSLAND_POPULATION_CENTRES_QUERY_URL,
  populationCentreQueryUrl,
  normaliseQueenslandPopulationCentres,
  fetchQueenslandPopulationCentres,
  townLabelRange,
  createStableQueenslandPlaceLabels
} from "../src/context-layers/stable-queensland-place-labels-v1.js";

const raw = (id, name, longitude, latitude, population = null) => ({
  type: "Feature",
  id,
  properties: { objectid: id, name, population, upper_scale: 25000 },
  geometry: { type: "Point", coordinates: [longitude, latitude] }
});
const birdsville = raw(1,"Birdsville",139.35,-25.9,115);
const brisbane = raw(2,"Brisbane",153.03,-27.47,2500000);
const norm = normaliseQueenslandPopulationCentres({
  type: "FeatureCollection",
  features: [birdsville, brisbane, raw(3,"",151,-25),raw(4,"NSW",151,-33)]
});
assert.equal(norm.length,2);
assert.equal(norm[0].name,"Birdsville");
assert.deepEqual([norm[0].longitude,norm[0].latitude],[139.35,-25.9]);
assert.ok(QUEENSLAND_POPULATION_CENTRES_QUERY_URL.includes("/20/query"));
const url = new URL(populationCentreQueryUrl({offset:1000,pageSize:1000}));
assert.equal(url.searchParams.get("f"),"geojson");
assert.equal(url.searchParams.get("resultOffset"),"1000");
assert.equal(url.searchParams.get("orderByFields"),"objectid ASC");
assert.equal(url.searchParams.get("outSR"),"4326");
assert.ok(townLabelRange(115) >= 1600000);
assert.ok(townLabelRange(500000) > townLabelRange(115));

const urls=[];
const pages=[[birdsville],[brisbane]];
const features=await fetchQueenslandPopulationCentres({
  pageSize:1,
  maxPages:3,
  fetchImpl:async url=>{
    urls.push(url);
    const index=Number(new URL(url).searchParams.get("resultOffset"));
    return {ok:true, async json(){return {type:"FeatureCollection",features:pages[index]??[]};}};
  }
});
assert.equal(features.length,2);
assert.equal(urls.length,3);
assert.equal(features[0].name,"Brisbane","Population tier should be deterministic");
await assert.rejects(
  fetchQueenslandPopulationCentres({
    pageSize:1,maxPages:1,
    fetchImpl:async()=>({ok:true,async json(){return {features:[birdsville]};}})
  }),
  /page limit/
);

let registered=null;
const added=[];
const status=[];
const labels={
  add(v){ added.push(v); return v; }
};
const Cesium={
  LabelCollection:class {constructor(){return labels;}},
  BlendOption:{TRANSLUCENT:2},
  Cartesian3:{fromDegrees:(x,y,z)=>[x,y,z]},
  Color:{WHITE:"white",BLACK:"black"},
  LabelStyle:{FILL_AND_OUTLINE:"fill-outline"},
  HorizontalOrigin:{LEFT:"left"},
  VerticalOrigin:{CENTER:"center"},
  Cartesian2:class{constructor(x,y){this.x=x;this.y=y;}},
  DistanceDisplayCondition:class{constructor(near,far){this.near=near;this.far=far;}}
};
const viewer={scene:{
  primitives:{add(v){registered=v;return v;},remove(v){assert.equal(v,labels);return true;}},
  requestRender(){}
}};
let fetched=0;
const instance=createStableQueenslandPlaceLabels({
  viewer,CesiumRef:Cesium,
  fetchImpl:async()=>{fetched++; return {ok:true,async json(){return {features:[birdsville,brisbane]};}};},
  onStatus:v=>status.push(v)
});
await instance.start();
await instance.start();
assert.equal(fetched,1,"Camera and basemap changes must not refetch names");
assert.equal(instance.count,2);
assert.equal(added.length,2);
assert.equal(added[0].text,"Brisbane");
assert.equal(added[1].text,"Birdsville");
assert.deepEqual(added[1].position,[139.35,-25.9,0]);
assert.equal(added[1].disableDepthTestDistance,Number.POSITIVE_INFINITY);
assert.ok(!("heightReference" in added[1]),"Avoid re-clamping labels during terrain refinement");
assert.ok(!("clampToGround" in added[1]),"Labels must not track terrain tile changes");
assert.ok(status.some(v=>v.kind==="ok"));
instance.destroy();
console.log("Stable Queensland place-label checks passed: paged point dataset, correct coordinates, fixed Cesium label primitives, camera-independent state, cleanup.");
