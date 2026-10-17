import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {decodeHistoricalBomCycloneGml,cycloneForecastSummary}
 from "../src/bom-historical-forecast-gml-v1.js";
import {createHistoricalCycloneForecastQA}
 from "../src/historical-cyclone-forecast-map-v1.js";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const html=read("../live3d-operational-v9.html");
const runtime=read("../src/live3d-operational-v9.js");
const source=read("../src/historical-cyclone-forecast-map-v1.js");
const css=read("../src/single-interface-v1.css");

assert.match(html,/id="openCycloneForecastQa"[^>]*aria-expanded="false"/);
assert.match(html,/id="cycloneForecastQaPanel"[^>]*hidden>/);
assert.match(html,/id="historicalCycloneMapStamp" hidden/);
assert.match(html,/id="cycloneGmlFile" type="file"/);
assert.match(html,/id="cycloneShow72" checked/);
assert.match(html,/id="cycloneShow120" checked/);
assert.match(runtime,/if\(INCREMENTAL_VOLUME_PREVIEW && window\.location\.pathname\.includes\("\/preview\/incremental-3d\/"\)\)/);
assert.doesNotMatch(source,/\bfetch\s*\(|setInterval\s*\(|\bWorker\s*\(/);
assert.match(source,/new Cesium\.CustomDataSource/);
assert.match(css,/#cycloneForecastQaPanel\[hidden\]\{display:none!important;\}/);

const ns="http://www.bom.gov.au/dtd/tc";
const gml="http://www.opengis.net/gml";
class XMLNode{
 constructor(localName,children=[],text="",attributes={},namespaceURI=ns){
  this.localName=localName;this.children=children;this._text=text;
  this.attributes=attributes;this.namespaceURI=namespaceURI;
 }
 get textContent(){return this._text||this.children.map(c=>c.textContent).join("");}
 getAttribute(key){return this.attributes[key]??null;}
}
const N=(name,children=[],text="",attrs={},uri=ns)=>
 new XMLNode(name,children,text,attrs,uri);
const T=(name,text)=>N(name,[],text);
const R=(text)=>N("LinearRing",[N("coordinates",[],text,{},gml)],"",{},gml);
const G=(txt)=>N("geometry",[
 N("polygonMember",[N("Polygon",[
  N("outerBoundaryIs",[R(txt)],"",{},gml)
 ],"",{},gml)],"",{},gml)
],"",{srsName:"urn:ogc:def:crs:EPSG:6.6:4283"});
const ring="132,-11 133,-11 133,-12 132,-12 132,-11";
const area=(h)=>N("tcForecastArea",[
 G(ring),T("areaType","Likely Tracks Area"),T("extent","Up to "+h+" hours")
]);
const fix=(lead,lat,lon)=>N("tcFix",[
 N("point",[N("coordinates",[],lon+","+lat,{},gml)],
  "",{srsName:"urn:ogc:def:crs:EPSG:6.6:4283"}),
 T("fixType","Forecast"),T("fixTime",lead===12?"2025-11-20T18:00:00Z":"2025-11-21T06:00:00Z"),
 T("category","2"),T("timeOffset",String(lead))
]);
const track=N("tcTrack",[
 N("lineString",[N("coordinates",[],"133,-10 132,-11 131,-12",{},gml)],
  "",{srsName:"urn:ogc:def:crs:EPSG:6.6:4283"}),
 T("trackType","Forecast"),T("startTime","2025-11-20T06:00:00Z"),
 T("endTime","2025-11-21T06:00:00Z")
]);
const observed=N("tcFix",[
 N("point",[N("coordinates",[],"133,-10",{},gml)],
  "",{srsName:"urn:ogc:def:crs:EPSG:6.6:4283"}),
 T("fixType","Current"),T("fixTime","2025-11-20T06:00:00Z")
]);
const warning=N("tcWarningArea",[G(ring),T("areaType","Warning")]);
const root=N("tcData",[
 T("fcastTime","2025-11-20T06:00:00Z"),
 T("issueTime","2025-11-20T06:53:03Z"),
 T("expiryHrs","8"),T("distId","AU202526_02U"),T("distName","Fina"),
 area(72),area(120),track,observed,fix(12,-10.29,133.01),fix(24,-10.91,132.58),warning
]);
const fakeParse=()=>({documentElement:root});
const XML="<?xml version='1.0'?><tcData xmlns='http://www.bom.gov.au/dtd/tc'>".padEnd(140," ")+"</tcData>";
const parse=(options={})=>decodeHistoricalBomCycloneGml(XML,{
 filename:"IDD65401.gml",parseXml:fakeParse,...options
});
const result=parse();
const summary=cycloneForecastSummary(result);
assert.equal(result.cycloneName,"Fina");
assert.equal(result.issueUtc,"2025-11-20T06:53:03.000Z");
assert.equal(summary.forecastFixes,2);
assert.equal(summary.uncertainty72,1);
assert.equal(summary.uncertainty120,1);
assert.equal(summary.forecastTracks,1);
assert.equal(summary.observedFixes,1);
assert.deepEqual(result.features.find(x=>x.areaKey==="120").geometry.coordinates[0],
  [[132,-11],[133,-11],[133,-12],[132,-12],[132,-11]],
 "Original source polygon ring is not buffered, rounded or simplified");
assert.equal(result.features.find(x=>x.role==="forecast_fix").geometry.coordinates[1],-10.29);
assert.equal(result.features.find(x=>x.role==="warning_area").areaKey,null);
assert.throws(()=>parse({filename:"IDQ00000.gml"}),/documented original/);
assert.throws(()=>decodeHistoricalBomCycloneGml("<!DOCTYPE x>"+XML,{
 filename:"IDD65401.gml",parseXml:fakeParse}),/unsafe/);
const a=root.children.find(node=>node.localName==="tcForecastArea");
a.children.find(x=>x.localName==="areaType")._text="Calculated Cone";
assert.throws(parse,/likely-tracks polygon/);
a.children.find(x=>x.localName==="areaType")._text="Likely Tracks Area";
const polygonRing=a.children[0].children[0].children[0].children[0].children[0].children[0];
polygonRing._text="132,-11 133,-11 133,-12 132,-12";
assert.throws(parse,/not closed/);
polygonRing._text=ring;
const geom=a.children[0];geom.attributes.srsName="EPSG:9999";
assert.throws(parse,/unsupported BoM geographic CRS/);
geom.attributes.srsName="urn:ogc:def:crs:EPSG:6.6:4283";
const truncated=root.children.filter(x=>x!==area(72));
void truncated;

// Renderer is independently testable with a fake validated decode, not
// a copy of original BoM geometry in the repository or QA test file.
const mapEls=new Map();
for(const id of ["openCycloneForecastQa","cycloneForecastQaPanel","cycloneGmlFile",
 "cycloneForecastQaStatus","historicalCycloneMapStamp","cycloneShow72","cycloneShow120",
 "cycloneForecastQaFocus","cycloneForecastQaClear","cycloneForecastQaClose"]){
 mapEls.set(id,{id,hidden:id==="cycloneForecastQaPanel",checked:id==="cycloneShow72"||id==="cycloneShow120",
  disabled:false,textContent:"",files:[],value:"",listeners:{},
  addEventListener(event,cb){this.listeners[event]=cb},
  setAttribute(name,v){this[name]=v},
  focus(){this.focused=true}});
}
const entities=[];
const dataSource={
 entities:{add(o){entities.push(o);return o},removeAll(){entities.length=0}}
};
class Color{
 static fromCssColorString(hex){return {hex,withAlpha(a){return {hex,alpha:a}}}}
}
class CustomDataSource{constructor(){this.entities=dataSource.entities}}
class PolygonHierarchy{constructor(positions,holes=[]){this.positions=positions;this.holes=holes}}
const Cesium={
 CustomDataSource,PolygonHierarchy,Color,
 Cartesian3:{fromDegreesArray(flat){return flat},fromDegrees(...coords){return coords}},
 Cartesian2:class{constructor(x,y){this.x=x;this.y=y}},
 Rectangle:{fromDegrees(...coords){return coords}},
 HeightReference:{CLAMP_TO_GROUND:1},
 ClassificationType:{BOTH:3},
 LabelStyle:{FILL_AND_OUTLINE:1},
 HorizontalOrigin:{LEFT:1}
};
let flights=0,requests=0;
const viewer={
 dataSources:{add(x){return x},remove(){}},
 scene:{requestRender(){requests++}},
 camera:{flyTo(){flights++}}
};
const ui=createHistoricalCycloneForecastQA({
 Cesium,viewer,documentRef:{getElementById:id=>mapEls.get(id)},
 decode:()=>result
});
assert.equal(entities.length,0,"No cyclone imagery on page load");
mapEls.get("openCycloneForecastQa").listeners.click();
assert.equal(mapEls.get("cycloneForecastQaPanel").hidden,false);
mapEls.get("cycloneGmlFile").files=[{size:500,name:"IDD65401.gml",text:async()=>XML}];
await mapEls.get("cycloneGmlFile").listeners.change();
assert.equal(flights,1,"Load should focus original issued positions");
assert.equal(entities.filter(x=>x.polygon).length,2,"Render the two original areas");
assert.ok(entities.some(x=>x.name.includes("issued forecast track")));
assert.ok(entities.some(x=>x.name.includes("forecast")));
assert.ok(!entities.some(x=>x.name.includes("Warning")));
assert.match(mapEls.get("cycloneForecastQaStatus").textContent,/ARCHIVED, NOT LIVE/);
assert.equal(mapEls.get("historicalCycloneMapStamp").hidden,false);
assert.match(mapEls.get("historicalCycloneMapStamp").textContent,/ARCHIVED BoM FORECAST · NOT LIVE/);
mapEls.get("cycloneShow72").checked=false;
mapEls.get("cycloneShow72").listeners.change();
assert.equal(entities.filter(x=>x.polygon).length,1,"72h toggle removes only that polygon");
mapEls.get("cycloneForecastQaClear").listeners.click();
assert.equal(entities.length,0);
assert.equal(mapEls.get("historicalCycloneMapStamp").hidden,true);
assert.equal(ui.loaded,null);
assert.ok(requests>=3);
console.log("PASS original local BoM cyclone GML browser parser, truthful issued source areas and isolated Cesium QA lifecycle.");
