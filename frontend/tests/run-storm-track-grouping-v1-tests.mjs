import assert from "node:assert/strict";
import { segmentWebMercatorCategoryFrame } from "../src/segmentation.js";
import { SEGMENTATION_DEFAULTS } from "../src/config.js";
import { cellsToRadarObservations, deduplicateRadarCells, updateTracks, trackToDict } from "../src/tracking.js";
import { stormTrackPresentation } from "../src/storm-track-presentation-v1.js";
import { createStormTrackLabelOverlay } from "../src/storm-track-label-overlay-v1.js";

assert.equal(SEGMENTATION_DEFAULTS.thresholdCategory,7,"Never lower the observed 40 dBZ cutoff");
assert.equal(SEGMENTATION_DEFAULTS.minPixels,16);
assert.equal(SEGMENTATION_DEFAULTS.maxGapPixels,2);
assert.equal('minAreaKm2' in SEGMENTATION_DEFAULTS,false);
assert.equal('maxGapKm' in SEGMENTATION_DEFAULTS,false);

const width=60,height=60;
const make=()=>new Uint8Array(width*height);
const fill=(c,x,y,n,cat)=>{
  for(let row=y;row<y+n;row++)for(let col=x;col<x+n;col++)c[row*width+col]=cat;
};
const georef={projection:"EPSG:3857",minX:17000000,maxX:17080000,minY:-3500000,maxY:-3420000};
const segment=c=>segmentWebMercatorCategoryFrame({
  categories:c,width,height,georef,sourceId:"BOM-MOSAIC",
  ...SEGMENTATION_DEFAULTS
});

let c=make();
fill(c,15,15,4,7);fill(c,20,15,4,7);
let result=segment(c);
assert.equal(result.raw_component_count,2);
assert.equal(result.grouped_component_count,1,"Short real-world gap between weak 40 dBZ lobes should join");
assert.equal(result.retained_cell_count,1);
assert.equal(result.cells[0].pixel_count,32,"No synthetic pixels may be counted");
assert.equal(result.labels[15*width+19],0,"Below-40 gap remains unmeasured");
// Measured connected-pixel quantities must survive the worker tracking handoff.
const trackedCells=cellsToRadarObservations("66","2026-10-01T00:00:00Z",result.cells);
assert.equal(trackedCells[0].pixel_count,32);
const globalCells=deduplicateRadarCells(trackedCells);
assert.equal(globalCells[0].pixel_count,32);
const measuredTracks=[];
updateTracks(measuredTracks,globalCells,1);
assert.equal(trackToDict(measuredTracks[0]).latest.pixel_count,32);


c=make();fill(c,15,15,4,11);fill(c,20,15,4,11);
result=segment(c);
assert.equal(result.retained_cell_count,2,"Two distinct intense cores retain independent identities");

c=make();fill(c,10,10,4,7);fill(c,26,10,4,7);
result=segment(c);
assert.equal(result.retained_cell_count,2,"Distant cells must not merge");

c=make();fill(c,10,10,4,6);fill(c,26,10,4,7);
result=segment(c);
assert.equal(result.retained_cell_count,1,"Below-40 pixels never create cells or bridges");

c=make();fill(c,10,10,4,7);
result=segmentWebMercatorCategoryFrame({
  categories:c,width,height,
  georef:{projection:"EPSG:3857",minX:17000000,maxX:17006000,minY:-3500000,maxY:-3494000},
  sourceId:"BOM-MOSAIC",...SEGMENTATION_DEFAULTS
});
assert.equal(result.retained_cell_count,1,"16 connected pixels are retained even when projected area is far below 6 km²");
assert.ok(result.cells[0].sampled_area_km2 < 6,"Area remains metadata, never a cutoff");
c=make();fill(c,10,10,3,7);
result=segment(c);
assert.equal(result.retained_cell_count,0,"Fewer than 16 observed strong pixels never create a track");

const t0="2026-10-01T00:00:00Z",t1="2026-10-01T00:05:00Z";
const obs=(observed_utc,dbz=40,pixels=16)=>({observed_utc,maximum_dbzh_lower_bound:dbz,pixel_count:pixels,sampled_area_km2:1000});
const history=[obs(t0),obs(t1)];
assert.equal(stormTrackPresentation({history},history[0],t0).show,false,"First ordinary observation is not labelled");
assert.equal(stormTrackPresentation({history},history[1],t1).show,true,"Second observed scan establishes label");
assert.equal(stormTrackPresentation({history:[obs(t0,55)]},obs(t0,55),t0).show,true,"New intense cores appear immediately");
assert.equal(stormTrackPresentation({history:[obs(t0,50,79)]},obs(t0,50,79),t0).show,false,"79 connected pixels do not promote 50 dBZ track");
assert.equal(stormTrackPresentation({history:[obs(t0,50,80)]},obs(t0,50,80),t0).show,true,"80 connected pixels promote 50 dBZ track regardless of estimated area");
const small=stormTrackPresentation({history},obs(t1,50,20),t1).priority;
const large=stormTrackPresentation({history},obs(t1,50,81),t1).priority;
assert.ok(large>small,"Priority is based on observed pixel count");
assert.equal(stormTrackPresentation({history:[obs(t0)]},obs(t0),t0,true).show,true,"Manually selected tracks remain visible");

function element(){
  return {style:{},hidden:false,children:[],setAttribute(){},
    appendChild(v){this.children.push(v);},replaceChildren(...v){this.children=v;},remove(){}};
}
const container=element();
container.clientWidth=500;container.clientHeight=300;
let project;
const scene={
  camera:{positionWC:{}},globe:{ellipsoid:{}},
  postRender:{addEventListener(fn){project=fn;return ()=>{};}},
  requestRender(){}
};
const CesiumRef={
  SceneTransforms:{worldToWindowCoordinates(_scene,pos){return{x:pos.x,y:pos.y};}},
  EllipsoidalOccluder:class{isPointVisible(){return true;}}
};
const overlay=createStormTrackLabelOverlay({scene,CesiumRef,container,documentRef:{createElement:element}});
overlay.setMarkers([
  {position:{x:108,y:100},text:"ST-low",colour:"#aaa",size:8,priority:1},
  {position:{x:100,y:100},text:"ST-strong",colour:"#faa",size:12,priority:1000},
  {position:{x:300,y:180},text:"ST-independent",colour:"#faf",size:10,priority:200}
]);
const markers=container.children[0].children;
assert.equal(markers[0].children[0].textContent,"ST-strong","Highest-priority overlap wins");
assert.equal(markers[0].hidden,false);
assert.equal(markers[2].hidden,true,"Colliding low-priority dot and label hidden together");
assert.equal(markers[1].hidden,false,"Separated storms remain visible");
project();
overlay.setVisible(false);
assert.equal(container.children[0].hidden,true,"The existing Labels toggle remains immediate");
overlay.destroy();
console.log("40 dBZ grouping, independent severe cores, temporal presentation and screen decluttering passed.");
