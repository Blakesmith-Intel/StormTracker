import assert from "node:assert/strict";
import fs from "node:fs";
import {Buffer} from "node:buffer";
import {createSupplementalRadarVolumes} from "../frontend/src/supplemental-radar-volume-v1.js";
import {createIncrementalVolumeRenderer} from "../frontend/src/incremental-volume-renderer-v1.js";
import {selectSupplementalVolumeSampleIndices} from "../frontend/src/supplemental-volume-sampling-v1.js";
import {inferColumn,representativeDbzForCategory,webMercatorToDegrees} from "../frontend/src/inferred-volume-v1.js";
import {inverseGnomonic} from "../frontend/src/geo.js";

const source=JSON.parse(fs.readFileSync("/tmp/stormtracker-ftp-qa/frames.json","utf8"));
const grouped=new Map();
for(const record of source){
 const frame={...record,categories:new Uint8Array(Buffer.from(record.categories,"base64")),width:512,height:512,georef:{projection:"Gnomonic",...record.controlPoints}};
 assert.equal(frame.categories.length,512*512);
 if(!grouped.has(record.site))grouped.set(record.site,[]);
 grouped.get(record.site).push(frame);
}
assert.deepEqual([...grouped.keys()].sort(),["08","28","50","66"]);
for(const [site,frames] of grouped){assert.equal(frames.length,3);for(let i=1;i<3;i++)assert(Date.parse(frames[i].observedUtc)>Date.parse(frames[i-1].observedUtc))}
const R=6371008.8;
function project(lon,lat,lon0,lat0){
 const rad=Math.PI/180,[l,p,l0,p0]=[lon,lat,lon0,lat0].map(n=>n*rad),dl=l-l0;
 const cosc=Math.sin(p0)*Math.sin(p)+Math.cos(p0)*Math.cos(p)*Math.cos(dl);
 return {x:R*Math.cos(p)*Math.sin(dl)/cosc,y:R*(Math.cos(p0)*Math.sin(p)-Math.sin(p0)*Math.cos(p)*Math.cos(dl))/cosc};
}
const boundsCache=new WeakMap();
function pixelLonLat(frame,col,row){
 const c=frame.controlPoints;let b=boundsCache.get(frame);
 if(!b){
  const xy=[0,1,2,3].map(i=>project(c["lon"+i],c["lat"+i],c.center_longitude,c.center_latitude));
  b={w:(xy[0].x+xy[1].x)/2,e:(xy[2].x+xy[3].x)/2,s:(xy[0].y+xy[3].y)/2,n:(xy[1].y+xy[2].y)/2};
  boundsCache.set(frame,b);
 }
 const x=b.w+(col+0.5)/512*(b.e-b.w),y=b.n-(row+0.5)/512*(b.n-b.s);
 return inverseGnomonic(x,y,c.center_longitude,c.center_latitude);
}
function pixelCentreMercator(frame,x,y){
 const ll=pixelLonLat(frame,x,y),rad=Math.PI/180;
 return {x:6378137*ll.longitude*rad,y:6378137*Math.log(Math.tan(Math.PI/4+ll.latitude*rad/2))};
}
class Collection {
 constructor(){this.entries=[];this.show=true}
 add(o){const v={...o};this.entries.push(v);return v}
 remove(v){const at=this.entries.indexOf(v);if(at<0)return false;this.entries.splice(at,1);return true}
 removeAll(){this.entries=[]}
 get length(){return this.entries.length}
}
const groups=new Set();
const scene={primitives:{add(x){groups.add(x);return x},remove(x){groups.delete(x);return true}},requestRender(){}};
const Cesium={PointPrimitiveCollection:Collection,BillboardCollection:Collection,Cartesian3:{fromDegrees(lon,lat,height){assert(Number.isFinite(lon)&&Number.isFinite(lat)&&Number.isFinite(height));return {lon,lat,height}}}};
const model={profiles:[{low_level_dbz_min:0,low_level_dbz_max:200,levels:[
 {altitude_m_amsl:1000,occupancy_probability:1,median_delta_dbz:0},
 {altitude_m_amsl:2000,occupancy_probability:1,median_delta_dbz:-1},
 {altitude_m_amsl:3000,occupancy_probability:1,median_delta_dbz:-2}
]}]};
const opts={
 Cesium,scene,getModel:()=>model,getSettings:()=>({blob:false,minimumDbzh:40,occupancyThreshold:0.35,pointSize:3,verticalScale:1,volumePercent:80}),
 inferColumn,representativeDbzForCategory,pixelCentreMercator,webMercatorToDegrees,
 styleForInferredPoint:()=>({pixelSize:3,alpha:0.95}),displayedVolumeAltitude:(m)=>m,
 colourForDbzh:dbz=>({dbz}),addVolumeGlyph:(c,options,alpha)=>c.add({...options,alpha}),
 updateVolumeGlyph:(g,options,alpha)=>Object.assign(g,options,{alpha}),
 setVolumeDisplayOpacity:()=>{},incremental:true
};
const supplementary=createSupplementalRadarVolumes(opts);
const primary=createIncrementalVolumeRenderer({scene});
let primaryCount=0;
function renderPrimary(frame){
 const col=primary.begin("primary:66",()=>new Cesium.PointPrimitiveCollection(),false);
 const sampled=selectSupplementalVolumeSampleIndices(frame.categories,representativeDbzForCategory,40,250);
 for(const i of sampled.indices){
  const category=frame.categories[i],v=representativeDbzForCategory(category);
  if(!Number.isFinite(v)||v<40)continue;
  const points=inferColumn(model,v,{minimumOutputDbz:40});
  const x=i%512,y=Math.floor(i/512),ll=pixelLonLat(frame,x,y);
  const specs=points.map(pt=>({lon:ll.longitude,lat:ll.latitude,height:pt.altitude_m_amsl,category}));
  primary.upsert(i,category,specs,s=>col.add(s),(p,s)=>Object.assign(p,s));
 }
 const delta=primary.end();
 primaryCount=col.length;
 assert(primaryCount>0,"No primary 3-D glyphs");
 return delta;
}
const results=[];
for(let frameIndex=0;frameIndex<3;frameIndex++){
 const prim=grouped.get("66")[frameIndex];renderPrimary(prim);
 const sites={};for(const id of ["08","50","28"]){const frame=grouped.get(id)[frameIndex];sites[id]=supplementary.render(id,frame,frame.observedUtc);assert(sites[id]>0,"Secondary 3-D absent at "+id)}
 assert.equal(supplementary.visibleSites.length,3);
 assert(supplementary.glyphs>0);
 results.push({utc:prim.observedUtc,primary:primaryCount,secondary:sites,totalSecondary:supplementary.glyphs,collections:groups.size});
}
const before=supplementary.siteGlyphs;
supplementary.pruneSites(["08","50"]);
assert.deepEqual(supplementary.visibleSites.sort(),["08","50"]);
assert.equal(supplementary.siteGlyphs["28"],undefined);
primary.reset();supplementary.pruneSites([]);
assert.equal(groups.size,0,"Render primitives leaked after primary/secondary cleanup");
console.log("PASS_REAL_FTP_3D_SOURCE_PIPELINE",JSON.stringify(results));
