import assert from "node:assert/strict";
import {
  QLD_STATE_BORDER_SERVICE, QLD_STATE_BORDER_QUERY,
  stateBorderQueryUrl, validateStateBorderGeoJson,
  fetchOfficialQueenslandStateBorder, createQueenslandStateBorderLayer
} from "../src/context-layers/qld-state-border-v1.js";

assert.equal(QLD_STATE_BORDER_SERVICE,
  "https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Boundaries/AdministrativeBoundaries/MapServer/50");
const url = new URL(stateBorderQueryUrl({offset:1000,pageSize:300}));
assert.equal(url.origin,"https://spatial-gis.information.qld.gov.au");
assert.equal(url.searchParams.get("outSR"),"4326","Government source is EPSG:3857 but map must use 4326");
assert.equal(url.searchParams.get("f"),"geojson");
assert.equal(url.searchParams.get("returnGeometry"),"true");
assert.equal(url.searchParams.get("where"),"feature_type = 'State Border'");
assert.equal(url.searchParams.get("resultOffset"),"1000");
assert.equal(url.searchParams.get("resultRecordCount"),"300");

const crossing=[[150.11,-28.99],[150.22,-28.99],[150.34,-28.99]];
const sample={type:"FeatureCollection",features:[{
  type:"Feature",properties:{objectid:1,feature_type:"State Border"},
  geometry:{type:"LineString",coordinates:crossing}
}]};
assert.equal(validateStateBorderGeoJson(sample).length,1);
assert.deepEqual(sample.features[0].geometry.coordinates,crossing,
  "Official border vertices must not be shifted or simplified");
assert.throws(()=>validateStateBorderGeoJson({features:[{
  geometry:{type:"Polygon",coordinates:[crossing]}
}]}),/GeoJSON FeatureCollection|non-line/);
assert.throws(()=>validateStateBorderGeoJson({type:"FeatureCollection",features:[{
  geometry:{type:"LineString",coordinates:[[150,-50],[150.1,-50]]}
}]}),/outside Queensland/);

let fetchCount=0;
const payload=await fetchOfficialQueenslandStateBorder({
  fetchImpl:async request=>{
    assert.ok(request.startsWith(QLD_STATE_BORDER_QUERY));
    fetchCount++;
    return {ok:true,async json(){return sample;}};
  }
});
assert.equal(fetchCount,1);
assert.deepEqual(payload.features[0].geometry.coordinates,crossing);
await assert.rejects(fetchOfficialQueenslandStateBorder({
  fetchImpl:async()=>({ok:true,async json(){return {type:"FeatureCollection",features:[]};}})
}),/empty/);

const fakeSource={show:false,entities:{values:[{polyline:{}}]}};
const sourceCalls=[];
let loaded=0, removed=0;
const viewer={dataSources:{
  async add(source){sourceCalls.push("add");return source;},
  remove(source,destructive){assert.equal(source,fakeSource);assert.equal(destructive,true);removed++;}
},scene:{requestRender(){}}};
const CesiumRef={
  GeoJsonDataSource:{async load(geojson,options){
    loaded++;
    assert.equal(options.clampToGround,true);
    assert.deepEqual(geojson.features[0].geometry.coordinates,crossing);
    return fakeSource;
  }},
  Color:{WHITE:{},BLACK:{}},
  PolylineOutlineMaterialProperty:class{constructor(options){this.options=options;}}
};
const status=[];
const layer=createQueenslandStateBorderLayer({
  viewer,CesiumRef,mode:"street",
  fetchImpl:async()=>({ok:true,async json(){return sample;}}),
  onStatus:message=>status.push(message)
});
assert.equal(layer.visible,false);
layer.setMode("street");
assert.equal(loaded,0,"Street mode must never fetch/draw an additional border");
layer.setMode("qld-imagery");
await layer.start();
assert.equal(layer.count,1);
assert.equal(layer.visible,true,"Satellite view must restore surveyed border");
assert.equal(loaded,1);
assert.equal(fakeSource.entities.values[0].polyline.clampToGround,true);
layer.setMode("street");
assert.equal(layer.visible,false,"Street view retains its own basemap border");
layer.setMode("qld-imagery");
assert.equal(layer.visible,true,"Return to satellite shows same geometry");
await layer.start();
assert.equal(loaded,1,"Switching modes cannot reload boundary geometry");
assert.equal(sourceCalls.length,1);
assert.ok(status.some(s=>s.kind==="ok"));
layer.destroy();
assert.equal(removed,1);
console.log("State border tests passed: official layer 50, WGS84 geometry unmodified, satellite-only visibility, no refetch on mode switches, terrain clamp and cleanup.");
