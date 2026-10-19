import {chromium} from "playwright";
import assert from "node:assert/strict";
const browser=await chromium.launch({headless:true,args:["--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--enable-unsafe-swiftshader"]});
const page=await browser.newPage({viewport:{width:1200,height:850}});
const errors=[];
page.on("pageerror",e=>errors.push(String(e)));
page.on("console",m=>{if(/CORS|disallowed MIME|404|Failed to fetch/i.test(m.text()))errors.push(m.text().slice(0,380))});
await page.route("https://blakesmith-intel.github.io/StormTracker/**",async route=>{
 const u=new URL(route.request().url());
 const local="http://127.0.0.1:8137"+u.pathname.replace("/StormTracker","")+u.search;
 try{
  const response=await fetch(local);
  await route.fulfill({status:response.status,
   body:Buffer.from(await response.arrayBuffer()),
   contentType:response.headers.get("content-type")||"application/octet-stream"});
 }catch(e){await route.abort("failed")}
});
try{
 await page.goto("https://blakesmith-intel.github.io/StormTracker/ftp-aep-smoke.html",
  {waitUntil:"domcontentloaded",timeout:35000});
 const result=await page.evaluate(async()=>{
  globalThis.__STORMTRACKER_FTP_FIRST=true;
  const radar=await import("./src/bom-wmts-loop-v2.js");
  const rain=await import("./src/context-layers/rainfall-ifd-aep-v1.js");
  const now=Date.now();
  const times=await radar.discoverBomReflectivityHistory(now,45,"SEQ");
  if(times.length<3)throw Error("Fewer than 3 authentic source-confirmed FTP frames");
  const frameResults=[];
  for(const time of times.slice(-3)){
   const f=await radar.loadBomReflectivityMosaicAtTime(time,"SEQ");
   if(f.sourceId!=="BOM-FTP-MOSAIC")throw Error("WMTS used instead of FTP original PNG");
   if(f.georef?.projection!=="EPSG:3857")throw Error("Invalid FTP raster reprojection");
   if(f.width!==1024||f.height!==1024||f.categories.length!==1024*1024)throw Error("Wrong native-georeferenced raster size");
   if(f.sourceMetadata?.siteIds?.length!==3)throw Error("Incomplete supplement radar mosaic");
   if(f.sourceMetadata.colouredPixelCount<1)throw Error("No known BoM dBZ pixels");
   frameResults.push({time,source:f.sourceId,sites:f.sourceMetadata.siteIds,
    dBZPixelCount:f.sourceMetadata.colouredPixelCount,
    pixelsAtLeast40Dbz:f.sourceMetadata.strongPixelCount,
    bounds:f.georef});
  }
  const res=await fetch("https://raw.githubusercontent.com/Blakesmith-Intel/StormTracker/radar-ftp-feed/ifd.json",{cache:"no-store"});
  if(!res.ok)throw Error("Official-derived rainfall IFD source missing");
  const grid=await res.json();
  if(Object.keys(grid.cells||{}).length<2)throw Error("No geographic IFD calibration");
  const base={mm:50,period:"lastHour",sourceCreatedAt:new Date().toISOString(),grid};
  const gold=rain.classifyRainfallAep({...base,latitude:-28.002,longitude:153.424});
  const adavale=rain.classifyRainfallAep({...base,latitude:-25.91,longitude:144.6});
  if(gold.classification!=="below-20pct-aep")throw Error("Gold Coast 50mm falsely marked exceptional");
  if(adavale.aepDesignThreshold!==10)throw Error("Adavale 50mm not graded by local native BoM IFD");
  return {frameResults,ifd:{cells:Object.keys(grid.cells).length,gold,adavale}};
 });
 assert.equal(result.frameResults.length,3);
 console.log("LIVE_FTP_AEP_COMBINED_BROWSER_PASS",JSON.stringify(result));
 if(errors.length)console.log("NON_FATAL_BROWSER_DIAGNOSTICS",errors.slice(0,8));
}catch(error){
 console.log("LIVE_FTP_AEP_COMBINED_BROWSER_FAIL",JSON.stringify({error:String(error),errors:errors.slice(0,10)}));
 throw error;
}finally{await browser.close()}
