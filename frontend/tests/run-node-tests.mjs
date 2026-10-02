import assert from "node:assert/strict";
import { connectedComponents, segmentCategoryFrame } from "../src/segmentation.js";
import { RADARS } from "../src/config.js";
import { deduplicateRadarCells, updateTracks } from "../src/tracking.js";
import { category, dopplerComponent, freshness, growthComponents, reflectivityComponent } from "../src/lightning.js";

let passed = 0;
function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); passed++; }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}

test("8-connectivity joins diagonal pixels", () => {
  const {components}=connectedComponents(Uint8Array.from([1,0,0,1]),2,2,8);
  assert.equal(components.length,1);
});

test("4-connectivity separates diagonal pixels", () => {
  const {components}=connectedComponents(Uint8Array.from([1,0,0,1]),2,2,4);
  assert.equal(components.length,2);
});

test("segmentation keeps strong component and rejects fragment", () => {
  const width=12,height=12,c=new Uint8Array(width*height);
  for(let r=4;r<7;r++) for(let col=4;col<7;col++) c[r*width+col]=12;
  c[1*width+1]=14;c[1*width+2]=14;c[2*width+1]=14;
  const result=segmentCategoryFrame({categories:c,width,height,radar:RADARS["66"],thresholdCategory:7,minPixels:8,connectivity:8});
  assert.equal(result.retained_cell_count,1);
  assert.equal(result.cells[0].pixel_count,9);
  assert.equal(result.cells[0].maximum_category,12);
});

const BASE=Date.parse("2026-08-27T06:00:00Z");
function radarCell(radar,minute,lon,lat,cellId=1,area=100,cat=12){return{
  radar_id:radar,observed_utc:new Date(BASE+minute*60000).toISOString(),local_cell_id:cellId,
  centroid_longitude:lon,centroid_latitude:lat,sampled_area_km2:area,maximum_category:cat,
  maximum_dbzh_lower_bound:55,maximum_dbzh_upper_bound:58,min_longitude:lon-.03,max_longitude:lon+.03,min_latitude:lat-.03,max_latitude:lat+.03
};}
function globalObs(minute,lon,lat){return{
  observed_utc:new Date(BASE+minute*60000).toISOString(),centroid_longitude:lon,centroid_latitude:lat,sampled_area_km2:100,
  maximum_category:12,maximum_dbzh_lower_bound:55,maximum_dbzh_upper_bound:58,min_longitude:lon-.03,max_longitude:lon+.03,min_latitude:lat-.03,max_latitude:lat+.03,
  source_radars:["66"],source_cells:[["66",1]],multi_radar_confirmed:false,merge_method:"single-radar"
};}

test("nearby cells from different radars merge",()=>{
  const merged=deduplicateRadarCells([radarCell("50",0,153.10,-27.60),radarCell("66",1,153.12,-27.61)]);
  assert.equal(merged.length,1); assert.equal(merged[0].multi_radar_confirmed,true); assert.deepEqual(merged[0].source_radars,["50","66"]);
});

test("same-radar cells do not merge",()=>{
  const merged=deduplicateRadarCells([radarCell("66",0,153.10,-27.60,1),radarCell("66",0,153.11,-27.61,2)]);
  assert.equal(merged.length,2);
});

test("plausible motion preserves ST0001",()=>{
  const tracks=[]; let next=updateTracks(tracks,[globalObs(0,153.10,-27.60)],1); next=updateTracks(tracks,[globalObs(5,153.13,-27.59)],next);
  assert.equal(tracks.length,1);assert.equal(tracks[0].track_id,"ST0001");assert.equal(tracks[0].observations.length,2);
});

test("impossible jump creates ST0002",()=>{
  const tracks=[]; let next=updateTracks(tracks,[globalObs(0,153.10,-27.60)],1); updateTracks(tracks,[globalObs(5,154.50,-27.60)],next);
  assert.equal(tracks.length,2);assert.equal(tracks[0].track_id,"ST0001");assert.equal(tracks[1].track_id,"ST0002");
});

test("stronger reflectivity scores higher",()=>assert.ok(reflectivityComponent(14).score>reflectivityComponent(7).score));

test("growth and intensification score",()=>{
  const [area,intensity]=growthComponents([
    {observed_utc:"2026-08-31T10:00:00Z",sampled_area_km2:40,maximum_category:10},
    {observed_utc:"2026-08-31T10:05:00Z",sampled_area_km2:80,maximum_category:12}
  ]);
  assert.ok(area.score>0);assert.ok(intensity.score>0);
});

test("Doppler toward/away span contributes",()=>assert.ok(dopplerComponent([-80,-60,-20,20,60,80,-32768]).score>=10));

test("stale data is not operationally live",()=>{
  const result=freshness("2026-08-31T10:00:00Z",new Date("2026-08-31T10:45:00Z"));
  assert.equal(result.state,"stale");assert.equal(result.operational_live,false);
});

test("lightning likelihood categories match recovered thresholds",()=>{
  assert.equal(category(10),"LOW");assert.equal(category(30),"MODERATE");assert.equal(category(50),"HIGH");assert.equal(category(70),"VERY HIGH");
});

console.log(`\n${passed} tests passed.`);
