import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  validateHistoricalCycloneBundle,historicalCycloneMoments,
  historicalCycloneSnapshot,nestedHistoricalPolygonPositions
} from "../src/historical-cyclone-replay-v1.js";
import {mountHistoricalCycloneQA}
  from "../src/historical-cyclone-overlay-v1.js";
const load=id=>JSON.parse(readFileSync(new URL("../data/cyclone-history/"+id+".json",import.meta.url),"utf8"));
const koji=load("koji-2026"),yasi=load("yasi-2011");
validateHistoricalCycloneBundle(koji);
validateHistoricalCycloneBundle(yasi);
assert.equal(koji.id,"koji-2026");
assert.ok(koji.sources[0].includes("CycloneHistorical/MapServer"));
assert.equal(koji.fixes[0].utc,"2026-01-07T12:00:00.000Z");
assert.equal(koji.fixes.at(-1).category,2);
assert.equal(koji.windAreas.length,9,"ALL archived Koji polygons selected by source audit");
assert.equal(koji.windAreaAvailableTimes.length,6);
assert.equal(koji.windAreas[0].geometry.coordinates[0].length,1405,
  "Original source wind polygon must not be decimated for FPS");
const kojiTimes=historicalCycloneMoments(koji);
assert.ok(kojiTimes.length>koji.fixes.length);
const moment=koji.windAreaAvailableTimes[0];
const snap=historicalCycloneSnapshot(koji,moment);
assert.equal(snap.isWindIssue,true);
assert.ok(snap.windAtIssue.length>=1);
assert.equal(snap.live,false);
assert.equal(snap.officialThunderstormWarning,false);
assert.ok(snap.fixesSoFar.every(x=>x.utc<=moment));
assert.throws(()=>historicalCycloneSnapshot(koji,"2026-10-16T12:00:00Z"),RangeError,
  "No invented historical issue timestamps allowed");

assert.equal(yasi.id,"yasi-2011");
assert.equal(yasi.fixes.length,14);
assert.equal(yasi.fixes[0].utc,"2011-01-31T12:00:00Z");
assert.equal(yasi.fixes.at(-1).utc,"2011-02-03T12:00:00Z");
assert.equal(yasi.fixes[0].centralPressureHpa,971);
assert.equal(yasi.windAreas.length,0,"No fake Yasi thunderstorm warning polygons");
assert.deepEqual(yasi.track[0].geometry.coordinates.map(p=>p.slice(0,2)),
  yasi.fixes.map(p=>p.position),"Yasi track is ONLY sequential archived BoM positions");
assert.ok(yasi.fixes.every(f=>f.utc.startsWith("2011-")),
  "Never confuse Yasi 2011 with another year");
const tampered=structuredClone(yasi);tampered.notLive=false;
assert.throws(()=>validateHistoricalCycloneBundle(tampered));
const warped=structuredClone(koji);warped.windAreas[0].geometry.coordinates[0][0][1]=95;
assert.throws(()=>validateHistoricalCycloneBundle(warped));
const misNamed=structuredClone(yasi);misNamed.id="koji-2012";
assert.throws(()=>validateHistoricalCycloneBundle(misNamed));

const colour=value=>({value,withAlpha(alpha){return {...this,alpha};}});
const fakeCesium={
  Color:{
    fromCssColorString:colour,CYAN:colour("#0ff"),YELLOW:colour("#ff0"),
    RED:colour("#f00"),MAGENTA:colour("#f0f"),BLACK:colour("#000"),
    WHITE:colour("#fff")
  },
  Cartesian3:{
    fromDegreesArray:xs=>xs,
    fromDegrees:(lon,lat)=>[lon,lat]
  },
  Cartesian2:class{constructor(x,y){this.x=x;this.y=y;}},
  PolygonHierarchy:class{constructor(positions,holes=[]){
    this.positions=positions;this.holes=holes;
  }},
  ClassificationType:{BOTH:3},
  HeightReference:{CLAMP_TO_GROUND:1},
  LabelStyle:{FILL_AND_OUTLINE:1},
  HorizontalOrigin:{LEFT:1},
  Rectangle:{fromDegrees:(...args)=>args}
};
class Element{
  constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.style={};this.listeners={};this.textContent="";this.value="";this.disabled=false;}
  append(...v){this.children.push(...v);}
  appendChild(v){this.children.push(v);}
  addEventListener(event,fn){this.listeners[event]=fn;}
  remove(){this.removed=true;}
  async change(){return this.listeners.change?.();}
  input(){return this.listeners.input?.();}
  click(){return this.listeners.click?.();}
}
const documentRef={createElement:tag=>new Element(tag),
  createTextNode:text=>({nodeType:3,textContent:text})};
const sidebar=new Element("aside");
let objects=[],removals=0,lastFly=null;
const viewer={
  entities:{
    add:obj=>{objects.push(obj);return obj;},
    remove:obj=>{objects=objects.filter(x=>x!==obj);removals++;return true;}
  },
  scene:{requestRender(){}},
  camera:{flyTo:data=>{lastFly=data;}}
};
let fetched=0;
const fixtureMap={"koji-2026":koji,"yasi-2011":yasi,
  "alfred-2025":load("alfred-2025"),
  "narelle-2026":load("narelle-2026"),
  "jasper-2023":load("jasper-2023")};
const widget=mountHistoricalCycloneQA({
  Cesium:fakeCesium,viewer,sidebar,documentRef,
  fetchRef:async path=>{
    fetched++;
    assert.match(path,/^\.\/data\/cyclone-history\/(?:koji-2026|yasi-2011|alfred-2025|narelle-2026|jasper-2023)\.json$/);
    const id=path.split("/").at(-1).replace(".json","");
    return {ok:true,json:async()=>fixtureMap[id]};
  }
});
assert.equal(widget.entityCount,0);
assert.equal(fetched,0,"QA overlay does not fetch in background");
widget.toggle.checked=true;
widget.pick.value="koji-2026";
await widget.load();
assert.equal(widget.activeCase,"koji-2026");
assert.ok(widget.entityCount>0);
assert.ok(objects.some(x=>x.polygon),"Historical wind polygons rendered");
assert.ok(objects.filter(x=>x.polygon).every(x=>x.polygon.outline!==true),
  "Cesium clamped-terrain polygons must NEVER use unsupported outline:true");
const borders=objects.filter(x=>x.polyline?.clampToGround && x.name?.includes("boundary"));
assert.ok(borders.length>0,
  "Original storm polygon boundaries must be rendered as ground-clamped polylines");
assert.equal(borders[0].polyline.width,2);
const retained=widget.entityCount,retainedObjects=[...objects];
widget.draw();
assert.equal(widget.entityCount,retained,
  "Revisiting same archived issue must not allocate additional Cesium entities");
assert.deepEqual(objects,retainedObjects,
  "Identical cyclone sources reuse original GPU entities/geometry without churn");
const polygon=objects.find(x=>x.polygon);
const original=koji.windAreas.find(x=>x.geometry.coordinates[0].length===
  polygon.polygon.hierarchy.positions.length/2);
assert.ok(original,"Cesium polygon receives unchanged original source vertices");
assert.ok(objects.some(x=>x.polyline));
assert.ok(objects.some(x=>x.point));
assert.match(widget.status.textContent,/NOT LIVE/);
assert.match(widget.status.textContent,/NOT severe-thunderstorm warnings/i);
widget.range.value="0";widget.draw();
assert.equal(objects.filter(x=>x.polygon).length,0,
  "At earlier observation time do NOT show future warning areas");
widget.focus();
assert.equal(lastFly.destination.length,4);
widget.pick.value="yasi-2011";
await widget.load();
assert.equal(widget.activeCase,"yasi-2011");
assert.equal(widget.showWind.disabled,true);
assert.equal(objects.filter(x=>x.polygon).length,0);
assert.match(widget.status.textContent,/None are fabricated/);
const before=fetched;
await widget.load();
assert.equal(fetched,before,"Fetch source archive once per case, not per radar frame");
widget.toggle.checked=false;await widget.load();
assert.equal(widget.entityCount,0);
assert.ok(removals>0);
widget.dispose();
assert.equal(widget.panel.removed,true);
const runtime=readFileSync(new URL("../src/live3d-operational-v9.js",import.meta.url),"utf8");
assert.match(runtime,/if\(window\.location\.pathname\.includes\("\/preview\/incremental-3d\/"\)\)/);
assert.match(runtime,/mountHistoricalCycloneQA\(\{Cesium,viewer,sidebar:controlsSidebar\}\)/);
assert.doesNotMatch(runtime,/mountHistoricalCycloneQA\(\{Cesium,viewer,sidebar:controlsSidebar\}\);\s*\nconst PUBLISHED_PRODUCTION_RUNTIME/);
console.log("PASS genuine archived Koji (full 1405-vertex wind geometry) + Yasi tracks, scrubber, correct issue UTC, no forecast fabrication, no background fetch, production route isolated.");
