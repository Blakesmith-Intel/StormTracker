#!/usr/bin/env node
// Actual live national BoM reflectivity mosaic probe. Never invent a WMTS time.
import {publishedReflectivityTimes} from "../frontend/src/bom-wmts-published-times-v1.js";
import {buildBomReflectivityTileUrl,reflectivityWindowForRegion} from "../frontend/src/bom-wmts-loop-v2.js";

const timeoutMs=14000;
const now=Date.now();
const observations=await publishedReflectivityTimes();
const recent=observations.filter(s=>Date.parse(s)>now-150*60000&&Date.parse(s)<now+5*60000);
console.log("BOM_NATIONAL_CAPABILITIES",JSON.stringify({
 currentTime:new Date(now).toISOString(),published:observations,within150Minutes:recent
}));
if(!recent.length)throw Error("No recent official national mosaic observation times");
const targets=["107","66","SEQ"].map(region=>{
 const win=reflectivityWindowForRegion(region);
 return {region,col:Math.floor((win.colStart+win.colEnd)/2),
 row:Math.floor((win.rowStart+win.rowEnd)/2),win};
});
for(const target of targets){
 console.log("NATIONAL_GEOGRAPHIC_COVERAGE",JSON.stringify(target));
 let passed=false;
 for(const observedUtc of recent.slice(-4).reverse()){
  const url=buildBomReflectivityTileUrl(target.col,target.row,observedUtc);
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(timeoutMs)});
   const body=await response.arrayBuffer();
   const prefix=new Uint8Array(body).slice(0,8);
   const png=prefix.join(",")==="137,80,78,71,13,10,26,10";
   console.log("NATIONAL_WMTS_SOURCE_TILE",JSON.stringify({
    ...target,observedUtc,status:response.status,
    type:response.headers.get("content-type"),bytes:body.byteLength,png,
    detail:png?"":new TextDecoder().decode(new Uint8Array(body).slice(0,240))
   }));
   if(response.ok&&png&&body.byteLength>100){passed=true;break}
  }catch(error){console.log("NATIONAL_WMTS_TILE_ERROR",JSON.stringify({
   region:target.region,observedUtc,error:String(error.message)
  }))}
 }
 if(!passed)throw Error("Authentic national WMTS unavailable at "+target.region);
}
console.log("NATIONAL_BOM_MOSAIC_LIVE_PASS");
