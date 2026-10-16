import assert from "node:assert/strict";
import {selectSupplementalVolumeSampleIndices}
  from "../src/supplemental-volume-sampling-v1.js";
import {createSupplementalRadarVolumes}
  from "../src/supplemental-radar-volume-v1.js";

const palette=v=>v===5?45:v===6?55:null;
const w=640,h=320;
const categories=new Uint8Array(w*h);
// A source mosaic can have high-dBZ pixels on odd indices only (for example,
// a tile/mask footprint and a sparse active convective line). Pixel-index %
// evenStride falsely selects zero cells, despite a real measured echo.
for(let y=10;y<290;y+=2)
  for(let x=11;x<550;x+=8) categories[y*w+x]=y%4?6:5;
const selected=selectSupplementalVolumeSampleIndices(categories,palette,40,250);
assert.equal(selected.indices.length,250);
assert.ok(selected.indices.every(i=>i%2===1));
assert.ok(selected.indices.every(i=>categories[i]>=5));
assert.ok(selected.indices.some(i=>i<100*w));
assert.ok(selected.indices.some(i=>i>200*w));
const same=selectSupplementalVolumeSampleIndices(categories,palette,40,250);
assert.deepEqual(selected.indices,same.indices,"Stable across repeated scans");
const updated=categories.slice();
for(let j=0;j<selected.indices.length;j+=2) updated[selected.indices[j]]=6;
assert.deepEqual(
  selectSupplementalVolumeSampleIndices(updated,palette,40,250).indices,
  selected.indices,"Same cells at new original dBZ must retain their render keys"
);
assert.deepEqual(
  selectSupplementalVolumeSampleIndices(new Uint8Array(25),palette,40,250),
  {eligible:0,indices:[]},"No fabricated weather where no 40+ source pixels exist"
);
assert.throws(()=>selectSupplementalVolumeSampleIndices(categories,palette,40,0),RangeError);

class GlyphCollection {
  constructor(){this.items=[];this.show=true;}
  add(point){const g={...point};this.items.push(g);return g;}
  get length(){return this.items.length;}
  remove(g){const i=this.items.indexOf(g);if(i<0)return false;this.items.splice(i,1);return true;}
}
let newCollections=0,renderRequests=0,disposed=0,created=0;
const scene={primitives:{
 add(obj){newCollections++;return obj;},
 remove(obj){disposed++;obj.items=[];}
},requestRender(){renderRequests++;}};
const Cesium={
  BillboardCollection:GlyphCollection,
  PointPrimitiveCollection:GlyphCollection,
  Cartesian3:{fromDegrees:(longitude,latitude,altitude)=>({longitude,latitude,altitude})}
};
const model={};
const sourceFrame=(data,utc)=>({
  categories:data,width:w,height:h,observedUtc:utc,
  georef:{projection:"WM",minX:1,maxX:2,minY:3,maxY:4}
});
let defaults={
  blob:false,occupancyThreshold:0.3,minimumDbzh:40,
  pointSize:3,verticalScale:1,volumePercent:100
};
const overlay=createSupplementalRadarVolumes({
 Cesium,scene,getModel:()=>model,getSettings:()=>defaults,
 inferColumn:(_,dbzh)=>[{dbzh,altitude_m_amsl:1800}],
 representativeDbzForCategory:palette,
 pixelCentreMercator:(_frame,x,y)=>({x,y}),
 webMercatorToDegrees:(x,y)=>({longitude:x/100,latitude:y/100}),
 styleForInferredPoint:()=>({pixelSize:3,alpha:0.8}),
 displayedVolumeAltitude:v=>v,
 colourForDbzh:dbz=>({dbz,alpha:1,withAlpha(alpha){return {...this,alpha};}}),
 addVolumeGlyph:(collection,options)=>{created++;return collection.add(options);},
 updateVolumeGlyph:(glyph,options)=>Object.assign(glyph,options),
 setVolumeDisplayOpacity:()=>{},
 incremental:true
});
const t1="2026-10-16T01:00:00Z",t2="2026-10-16T01:05:00Z";
const frame1=sourceFrame(categories,t1),frame2=sourceFrame(updated,t2);
const g1=overlay.render("secondaryA",frame1,t1);
assert.ok(g1>0,"A secondary radar MUST render real BoM 40+ 3-D glyphs");
assert.ok(g1<=1500);
assert.equal(overlay.glyphs,g1);
assert.equal(overlay.siteGlyphs.secondaryA,g1);
const createdBefore=created,retained=overlay.siteGlyphs.secondaryA;
const g2=overlay.render("secondaryA",frame2,t2);
assert.equal(g2,g1,"New genuine scan retains same count");
assert.equal(newCollections,1,"One stable per-site Cesium collection across source scans");
assert.equal(created,createdBefore,"dBZ changes must update glyphs in place");
assert.equal(overlay.siteGlyphs.secondaryA,retained);
assert.equal(overlay.render("secondaryB",frame2,t1),0,"Reject mismatched source UTC");
const gB=overlay.render("secondaryB",frame2,t2);
assert.ok(gB>0);
assert.equal(newCollections,2,"Each displayed secondary radar has its own cloud");
overlay.pruneSites(["secondaryB"]);
assert.ok(disposed>=1,"Deselecting secondary radar frees its GPU collection");
assert.equal(overlay.siteGlyphs.secondaryA,undefined);
assert.ok(overlay.siteGlyphs.secondaryB>0);
overlay.hide("secondaryB");
assert.equal(overlay.siteGlyphs.secondaryB,0);
assert.ok(renderRequests>0);
console.log("PASS genuine sparse odd-indexed BoM high-dBZ coverage, source-UTC enforcement, 2 secondary sites, stable glyph updates, source time and selection cleanup.");
