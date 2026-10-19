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
  globalThis.__STORMTRACKER_NATIONAL_MOSAIC_PRIMARY=true;
  const radar=await import("./src/bom-wmts-loop-v2.js");
  const rain=await import("./src/context-layers/rainfall-ifd-aep-v1.js");
  const now=Date.now();
  const times=await radar.discoverBomReflectivityHistory(now,45,"SEQ");
  if(times.length<3)throw Error("Fewer than 3 current authenticated BoM radar frames");
  const frameResults=[];
  for(const time of times.slice(-3)){
   const f=await radar.loadBomReflectivityMosaicAtTime(time,"SEQ");
   if(f.sourceId!=="BOM-MOSAIC")
     throw Error("Repaired high-resolution radar regressed to coarse FTP fallback: "+f.sourceId);
   if(f.georef?.projection!=="EPSG:3857")throw Error("Incorrect measured source raster projection");
   if(f.width<512||f.height<512||f.categories.length!==f.width*f.height)
     throw Error("High-resolution native BOM mosaic is not using the real tile grid");
   if(f.sourceMetadata?.tileMatrixSet!=="GoogleMapsCompatible_BoM")
     throw Error("Radar is not using official Australian BoM WMTS");
   if(f.sourceMetadata?.transport?.indexOf("Official high-resolution Bureau national WMTS")!==0)
     throw Error("Unverified source substitution");
   if(Date.now()-Date.parse(f.observedUtc)>45*60000)
     throw Error("High-resolution radar timestamp is not current");
   if(f.sourceId==="BOM-FTP-MOSAIC"&&f.sourceMetadata?.siteIds?.length!==3)
     throw Error("Fallback missing verified source radars");
   if(f.sourceMetadata?.categoryHistogram?.reduce((a,b)=>a+b,0)!==f.categories.length)
     throw Error("Invalid dBZ category histogram");
   frameResults.push({time,source:f.sourceId,sites:f.sourceMetadata.siteIds||["BoM official national"],
    dBZPixelCount:f.sourceMetadata.colouredPixelCount,
    pixelsAtLeast40Dbz:f.sourceMetadata.strongPixelCount,
    bounds:f.georef});
  }
  // Richmond must use the same genuine current high-resolution national product
  // and NOT its visually degraded legacy FTP site PNG.
  const richmond=await radar.discoverBomReflectivityHistory(now,45,"107");
  if(!richmond.length)throw Error("No genuine national BoM observations for Richmond");
  const rFrame=await radar.loadBomReflectivityMosaicAtTime(richmond.at(-1),"107");
  if(rFrame.sourceId!=="BOM-MOSAIC"||rFrame.width<512)
    throw Error("Richmond degraded or reverted to old individual FTP radar imagery");
  const res=await fetch("https://raw.githubusercontent.com/Blakesmith-Intel/StormTracker/radar-ftp-feed/ifd.json",{cache:"no-store"});
  if(!res.ok)throw Error("Official-derived rainfall IFD source missing");
  const grid=await res.json();
  if(Object.keys(grid.cells||{}).length<2)throw Error("No geographic IFD calibration");
  const base={mm:50,period:"lastHour",sourceCreatedAt:new Date().toISOString(),grid};
  const gold=rain.classifyRainfallAep({...base,latitude:-28.002,longitude:153.424});
  const adavale=rain.classifyRainfallAep({...base,latitude:-25.91,longitude:144.6});
  if(gold.classification!=="below-20pct-aep")throw Error("Gold Coast 50mm falsely marked exceptional");
  if(adavale.aepDesignThreshold!==10)throw Error("Adavale 50mm not graded by local native BoM IFD");
  return {frameResults,richmond:{time:rFrame.observedUtc,width:rFrame.width,height:rFrame.height,source:rFrame.sourceId},ifd:{cells:Object.keys(grid.cells).length,gold,adavale}};
 });
 assert.equal(result.frameResults.length,3);
 console.log("LIVE_NATIONAL_PRIMARY_AEP_COMBINED_BROWSER_PASS",JSON.stringify(result));
 if(errors.length)console.log("NON_FATAL_BROWSER_DIAGNOSTICS",errors.slice(0,8));
}catch(error){
 console.log("LIVE_NATIONAL_PRIMARY_AEP_COMBINED_BROWSER_FAIL",JSON.stringify({error:String(error),errors:errors.slice(0,10)}));
 throw error;
}finally{await browser.close()}
