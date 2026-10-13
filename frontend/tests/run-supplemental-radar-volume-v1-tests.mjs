import assert from "node:assert/strict";
import {createSupplementalRadarVolumes,
  SUPPLEMENTAL_VOLUME_MAX_COLUMNS,SUPPLEMENTAL_VOLUME_MAX_GLYPHS
} from "../src/supplemental-radar-volume-v1.js";

class Collection {
  constructor(){this.show=true;this.items=[];}
  add(item){this.items.push(item);return item;}
  removeAll(){this.items=[];}
  get length(){return this.items.length;}
  get(i){return this.items[i];}
}
const collections=[];
const Cesium={
  BillboardCollection:Collection,PointPrimitiveCollection:Collection,
  Cartesian3:{fromDegrees:(longitude,latitude,altitude)=>({longitude,latitude,altitude})}
};
const scene={primitives:{add(c){collections.push(c);return c;}},requestRender(){}};
let frame=0,volumePercent=75;
const display=createSupplementalRadarVolumes({
  Cesium,scene,getModel:()=>({profiles:[1]}),
  getSettings:()=>({blob:true,minimumDbzh:40,occupancyThreshold:.35,
    pointSize:3,verticalScale:1,volumePercent}),
  inferColumn:()=>[{dbzh:43,altitude_m_amsl:1000},{dbzh:47,altitude_m_amsl:3000}],
  representativeDbzForCategory:category=>category===9?45:null,
  pixelCentreMercator:(source,x,y)=>({x,y}),
  webMercatorToDegrees:(x,y)=>({longitude:x,latitude:y}),
  styleForInferredPoint:()=>({pixelSize:3,alpha:.8}),
  displayedVolumeAltitude:alt=>alt,
  colourForDbzh:()=>({withAlpha:alpha=>({alpha,withAlpha(v){return {alpha:v,withAlpha:this.withAlpha};}})}),
  addVolumeGlyph:(collection,options,alpha,percent)=>{
    frame++;collection.add({...options,alpha,percent});
  },
  setVolumeDisplayOpacity:()=>{}
});
const utc="2026-10-13T12:00:00Z";
const categories=new Uint8Array(200*200).fill(9);
categories.fill(0,0,5000); // national WMTS overlap masked out
const observed={observedUtc:utc,width:200,height:200,categories};
const created=display.render("08",observed,utc);
assert.ok(created>0 && created<=SUPPLEMENTAL_VOLUME_MAX_GLYPHS);
assert.ok(frame<=SUPPLEMENTAL_VOLUME_MAX_COLUMNS*2);
assert.equal(display.visibleSites[0],"08");
assert.ok(collections[0].items.every(x=>x.position.longitude>=0));
const old=collections[0];
display.render("08",observed,utc);
assert.equal(collections[0],old,"reuse Cesium collection rather than destroying GPU textures");
assert.equal(collections.length,1);
display.setOpacity(0);
display.hide("08");
assert.equal(collections[0].show,false);
assert.deepEqual(display.visibleSites,[]);
assert.equal(display.render("08",{...observed,observedUtc:"bad"},utc),0);
display.render("08",observed,utc);
display.refresh();
assert.equal(collections.length,1);
assert.ok(display.glyphs<=SUPPLEMENTAL_VOLUME_MAX_GLYPHS);
console.log("Supplemental 3-D source UTC, overlap mask, 40 dBZ, GPU cap and reusable-collection tests passed.");
