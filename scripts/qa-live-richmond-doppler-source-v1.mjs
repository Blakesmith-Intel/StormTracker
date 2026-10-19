// Read-only acceptance check against an authentic timestamped Richmond BoM PNG.
// Unlike synthetic fixtures, this audits the *real* southern pixel colours,
// comparing the production decoder with an independent palette classification.
// It is deliberately strict: no measured southern data => no "verified" claim.
import assert from "node:assert/strict";
import {chromium} from "playwright";
const root="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev";
const product="IDR107I";
const q=new URLSearchParams({product});
const deadline=15000;
async function source(url){
  const response=await fetch(url,{headers:{Origin:"https://blakesmith-intel.github.io"},
    signal:AbortSignal.timeout(deadline)});
  if(!response.ok)throw Error("BoM source HTTP "+response.status+" at "+new URL(url).pathname);
  return response;
}
const history=await (await source(root+"/radar-history?"+q)).json();
assert.equal(history.format,"StormTrackerDopplerHistoryV1");
assert.ok(history.frames?.length,"No authentic BoM Richmond Doppler history available");
const frames=[...history.frames].filter(f=>/^IDR107I\.T\.[0-9]{12}\.png$/.test(f.filename) &&
 Number.isFinite(Date.parse(f.observedUtc))).sort((a,b)=>
 Math.abs(Date.parse(a.observedUtc)-Date.parse("2026-10-19T12:13:00Z"))-
 Math.abs(Date.parse(b.observedUtc)-Date.parse("2026-10-19T12:13:00Z"))).slice(0,3);
assert.ok(frames.length,"No authentic Richmond timestamped PNG filenames");
const gif=Buffer.from(await (await source(root+"/radar?"+q)).arrayBuffer());
let image=null,chosen=null;
for(const f of frames){
 try{
  const url=root+"/radar-frame?"+q+"&file="+encodeURIComponent(f.filename);
  image=Buffer.from(await(await source(url)).arrayBuffer());chosen=f;break;
 }catch(e){console.log("FRAME_SOURCE_UNAVAILABLE",f.filename,String(e));}
}
assert.ok(image && chosen,"BoM could not deliver a genuine Richmond weather-only PNG");
console.log("RICHMOND_SOURCE",chosen.filename,chosen.observedUtc,
  "PNG_BYTES",image.length,"LATEST_GIF_BYTES",gif.length);
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 await page.route("http://127.0.0.1:8137/qa-richmond.html",
    route=>route.fulfill({contentType:"text/html",body:"<!doctype html><title>Richmond source QA</title>"}));
 await page.goto("http://127.0.0.1:8137/qa-richmond.html",{waitUntil:"load"});
 const result=await page.evaluate(async({gif,png})=>{
  const [{extractNativeDopplerPanel,reprojectNativeDopplerPanel},
   {paletteFromLatestDopplerImage},
   {nearestPaletteMatch},
   {lonLatToDopplerMapCoordinate}]=await Promise.all([
    import("./src/native-doppler-image-v1.js"),
    import("./src/bom-doppler-history-spatial-v1.js"),
    import("./src/bom-doppler-display-v2.js"),
    import("./src/bom-doppler-georef-v1.js")
  ]);
  async function imageData(base64){
   const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
   const bitmap=await createImageBitmap(new Blob([bytes]));
   const c=document.createElement("canvas");c.width=bitmap.width;c.height=bitmap.height;
   const g=c.getContext("2d",{willReadFrequently:true});g.drawImage(bitmap,0,0);
   const pixels=g.getImageData(0,0,c.width,c.height);bitmap.close();
   return pixels;
  }
  const latest=await imageData(gif);
  const raw=await imageData(png);
  const palette=paletteFromLatestDopplerImage(latest);
  const panel=extractNativeDopplerPanel(raw,palette);
  const proj=reprojectNativeDopplerPanel("107",panel,{resolution:512,gridStep:16});
  const offsetX=raw.width===512?0:6,offsetY=raw.height===512?0:6;
  const bands=[[0,437],[438,479],[480,511]];
  const audits=bands.map(([min,max])=>{
    let eligible=0,near=0,retained=0,refused=0;
    for(let y=min;y<=max;y++)for(let x=0;x<512;x++){
      const i=((y+offsetY)*raw.width+(x+offsetX))*4;
      if(!raw.data[i+3])continue;
      const swatch=nearestPaletteMatch([
         raw.data[i],raw.data[i+1],raw.data[i+2]],palette);
      if(!swatch||swatch.velocity_kmh===0)continue;
      eligible++;if(swatch.match_mode==="near")near++;
      if(panel.data[(y*512+x)*4+3])retained++;else refused++;
    }
    return {rows:min+"-"+max,eligible,near,retained,refused};
  });
  const corfield=lonLatToDopplerMapCoordinate("107",143.383,-21.717);
  return {source:[raw.width,raw.height],paletteSwatches:palette.swatches?.length,
    framePixels:panel.nativePixelCount,projectedPixels:proj.displayedPixels,
    corfieldRow:corfield.row,southBands:audits};
 },{gif:gif.toString("base64"),png:image.toString("base64")});
 console.log("RICHMOND_GENUINE_SOUTH_PIXEL_AUDIT",JSON.stringify(result));
 assert.ok(result.corfieldRow>438 && result.corfieldRow<512);
 assert.ok(result.southBands.slice(1).reduce((n,s)=>n+s.eligible,0)>0,
   "Real BoM scan has no southern palette pixels to demonstrate full coverage");
 for(const band of result.southBands)
   assert.equal(band.refused,0,
     "Decoder dropped genuine "+band.rows+" source pixels: "+
       JSON.stringify(band));
 assert.ok(result.projectedPixels>0,"Cesium-ready projection lost genuine Doppler pixels");
 console.log("LIVE_SOURCE_DOPPLER_SOUTH_PIXEL_PRESERVATION_PASS");
}finally{await browser.close();}
