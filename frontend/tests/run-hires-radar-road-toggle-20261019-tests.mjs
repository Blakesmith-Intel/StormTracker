import assert from "node:assert/strict";
import {measuredHiResRainWindow,isVerifiedHiResRadarFrame}
 from "../src/hires-radar-loop-policy-v1.js";
import {createFloodRoadClosureLayer}
 from "../src/context-layers/flood-road-closures-v1.js";

const timestamps=Array.from({length:10},(_,i)=>
 new Date(Date.UTC(2026,9,19,10,i*5)).toISOString().replace(".000Z","Z"));
const six=measuredHiResRainWindow(timestamps,"30");
assert.equal(six.plan.length,6,"30-minute loop = six actual 5-minute BoM frames");
assert.deepEqual(six.plan.map(x=>x.observedUtc),timestamps.slice(-6));
assert(six.plan.every(x=>x.kind==="observed"));
assert.equal(six.partial,false);
const missing=timestamps.filter((_,i)=>i!==7);
const gap=measuredHiResRainWindow(missing,"30");
assert.equal(gap.plan.length,5);
assert(gap.partial,"Missing BoM observation is reported, never fabricated");
assert(!gap.plan.some(x=>x.observedUtc===timestamps[7]));
assert.equal(measuredHiResRainWindow(timestamps,"60").plan.length,10);
const highres={sourceId:"BOM-MOSAIC",width:768,height:768,
 categories:{length:768*768},georef:{projection:"EPSG:3857"},
 sourceMetadata:{tileMatrixSet:"GoogleMapsCompatible_BoM"},
 observedUtc:timestamps.at(-1)};
assert(isVerifiedHiResRadarFrame(highres));
assert(!isVerifiedHiResRadarFrame({...highres,sourceId:"BOM-FTP-MOSAIC"}));
assert(!isVerifiedHiResRadarFrame({...highres,width:256,height:256,categories:{length:65536}}));
assert(!isVerifiedHiResRadarFrame({...highres,sourceMetadata:{tileMatrixSet:"other"}}));

class Collection{
 values=[];
 add(e){const entity={...e,show:e.show!==false};this.values.push(entity);return entity}
 removeAll(){this.values=[]}
 suspendEvents(){}
 resumeEvents(){}
}
class CustomDataSource{
 constructor(name){this.name=name;this.show=true;this.entities=new Collection()}
}
const Col={fromCssColorString:s=>({css:s,withAlpha(alpha){return {css:s,alpha}}})};
const CesiumRef={CustomDataSource,Color:Col,
 Cartesian3:{fromDegrees:(...x)=>x,fromDegreesArray:x=>x},
 HeightReference:{CLAMP_TO_GROUND:1},VerticalOrigin:{CENTER:0}};
let renderCount=0;
const viewer={dataSources:{add(){}},scene:{requestRender(){renderCount++}}};
const originalLine={type:"Feature",geometry:{type:"MultiLineString",
 coordinates:[[[153.10,-27.4],[153.11,-27.41],[153.12,-27.42]]]},
 properties:{id:750590,status:"Published",event_type:"Hazard",
 event_subtype:"Road damage",impact:{impact_type:"Closures",
 impact_subtype:"Road closed to all traffic"},road_summary:{road_name:"Test Road"}}};
const pointOnly={type:"Feature",geometry:{type:"MultiPoint",
 coordinates:[[153.2,-27.45],[153.21,-27.46]]},
 properties:{...originalLine.properties,id:717127}};
const source={type:"FeatureCollection",features:[originalLine,pointOnly]};
const mockFetch=async()=>({ok:true,status:200,json:async()=>source});
const layer=createFloodRoadClosureLayer({viewer,CesiumRef,fetchImpl:mockFetch,visible:true,
 onStatus(){}});
await layer.refresh();
const active=layer.dataSource.entities.values;
assert.equal(active.filter(x=>x.polyline).length,2,"Exact official line has both outline and core");
assert.equal(active.filter(x=>x.billboard).length,3,"Official MultiPoint locations are retained");
layer.setVisible(false);
assert.equal(layer.dataSource.entities.values.length,0,
 "Disabling closures must remove every Cesium road line and marker, not just hide icons");
await layer.refresh({force:true});
assert.equal(layer.dataSource.entities.values.length,0,
 "Hidden background refresh must not resurrect orphan ground lines");
layer.setVisible(true);
assert.equal(layer.dataSource.entities.values.filter(x=>x.polyline).length,2,
 "Re-enable must restore real official road geometry");
assert.equal(layer.dataSource.entities.values.filter(x=>x.billboard).length,3);
layer.setVisible(false);
assert.equal(layer.dataSource.entities.values.length,0,"Second toggle leaves no road geometry");
assert(renderCount>=5);
console.log("ROAD_LAYER_DISABLE_REMOVES_LINES_AND_ICONS_PASS");
console.log("BOM_HIRES_OBSERVED_ONLY_30_MIN_SIX_FRAMES_PASS");
