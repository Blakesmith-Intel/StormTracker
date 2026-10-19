import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const page=await browser.newPage({viewport:{width:1366,height:850}});
const moduleFailures=[],pageErrors=[],failedRequests=[],consoleWarnings=[],externalFailures=[];
page.on("requestfailed",request=>failedRequests.push({url:request.url().slice(0,240),cause:request.failure()}));
page.on("console",message=>{if(["error","warning"].includes(message.type()))consoleWarnings.push(message.text().slice(0,280));});
page.on("response",response=>{
 if(response.status()>=400)externalFailures.push({status:response.status(),url:response.url().slice(0,240)});
 const url=response.url();
 if(response.status()>=400 && url.includes("blakesmith-intel.github.io/StormTracker/src/") && /\.js(?:\?|$)/.test(url))
  moduleFailures.push({status:response.status(),url});
});
page.on("pageerror",e=>pageErrors.push(String(e)));
try{
 await page.goto("https://blakesmith-intel.github.io/StormTracker/live3d-operational-v9.html?rollback=13004a",
  {waitUntil:"domcontentloaded",timeout:35000});
 await page.waitForSelector("#cesiumContainer canvas.cesium-widget-canvas",{state:"attached",timeout:35000});
 await page.waitForTimeout(3500);
 const state=await page.evaluate(()=>({
  canvasCount:document.querySelectorAll("#cesiumContainer canvas.cesium-widget-canvas").length,
  brand:document.querySelector("#controlSidebar .simple-brand strong")?.textContent??"",
  playbackVisible:!!document.getElementById("radarPlaybackDetails"),
  mapDimensions:document.getElementById("cesiumContainer")?.getBoundingClientRect().toJSON(),
  status:document.getElementById("status")?.textContent?.slice(0,220)
 }));
 assert.equal(state.canvasCount,1);
 assert.equal(state.brand,"StormTracker");
 assert(state.playbackVisible);
 assert.deepEqual(moduleFailures,[],"Some published JS dependencies still return 4xx");
 assert(!pageErrors.some(e=>/ftp-reflectivity-operational|Failed to fetch dynamically imported module|disallowed MIME/i.test(e)),
   "A fatal FTP/missing module error remains");
 console.log("PUBLIC_PAGES_CESIUM_BROWSER_PASS",JSON.stringify({state,moduleFailures,pageErrors:pageErrors.slice(0,8)}));
 await page.screenshot({path:"/tmp/stormtracker-recovered-browser.png"}).catch(()=>{});
}catch(e){
 console.log("PUBLIC_PAGES_CESIUM_BROWSER_FAIL",JSON.stringify({reason:String(e),moduleFailures,pageErrors,
  pageTitle:await page.title().catch(()=>""),failedRequests:failedRequests.slice(0,30),
  externalFailures:externalFailures.slice(0,30),consoleWarnings:consoleWarnings.slice(0,30),
  bodyStatus:await page.locator("#status").textContent().catch(()=>""),
  diagnostics:await page.evaluate(()=>({cesiumDefined:!!window.Cesium,scriptUrls:[...document.scripts].map(x=>x.src).filter(Boolean),canvasElements:document.querySelectorAll("canvas").length,viewerHtml:document.querySelector("#cesiumContainer")?.innerHTML.slice(0,350)})).catch(()=>({}))}));
 await page.screenshot({path:"/tmp/stormtracker-recovered-browser.png"}).catch(()=>{});
 throw e;
}finally{await browser.close()}
