import assert from "node:assert/strict";
import {chromium} from "playwright";

// Reproduce real persistent StormTracker IndexedDB behaviour: 36 native BoM
// source frames from one radar region must survive a page reload and re-enable
// all five measured-only rain loop windows. No FTP, temporal interpolation or
// guessed observation is permitted.
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const page=await browser.newPage();
try{
 await page.goto("http://127.0.0.1:8137/ftp-aep-smoke.html",{waitUntil:"domcontentloaded"});
 const before=await page.evaluate(async()=>{
  const {putRadarFrame}=await import("./src/storage.js");
  const base=Math.floor(Date.now()/300000)*300000;
  const w=768,h=768;
  const times=Array.from({length:36},(_,i)=>
   new Date(base-(35-i)*300000).toISOString().replace(".000Z","Z"));
  for(const time of times){
   await putRadarFrame("66",{
    sourceId:"BOM-MOSAIC",observedUtc:time,
    width:w,height:h,categories:new Uint8Array(w*h),
    georef:{projection:"EPSG:3857"},
    sourceMetadata:{tileMatrixSet:"GoogleMapsCompatible_BoM"}
   });
  }
  return times;
 });
 assert.equal(before.length,36);
 await page.reload({waitUntil:"domcontentloaded"});
 const after=await page.evaluate(async()=>{
  const {getRadarFrames}=await import("./src/storage.js");
  const {isVerifiedHiResRadarFrame,availableMeasuredHiResLoopMinutes,
   measuredHiResRainWindow}=await import("./src/hires-radar-loop-policy-v1.js");
  const frames=(await getRadarFrames("66",Date.now()-4*3600000))
   .filter(isVerifiedHiResRadarFrame);
  const times=frames.map(f=>f.observedUtc);
  return {count:times.length,times,available:availableMeasuredHiResLoopMinutes(times),
   counts:[30,60,90,120,180].map(m=>measuredHiResRainWindow(times,String(m)).plan.length)};
 });
 assert.equal(after.count,36);
 assert.deepEqual(after.times,before);
 assert.deepEqual(after.available,[30,60,90,120,180]);
 assert.deepEqual(after.counts,[6,12,18,24,36]);
 console.log("REAL_INDEXEDDB_BOM_HIRES_180MIN_36_FRAMES_SURVIVES_BROWSER_RELOAD_PASS");
}finally{
 await browser.close();
}
