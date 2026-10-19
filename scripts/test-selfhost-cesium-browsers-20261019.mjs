import {chromium,firefox} from "playwright";
import assert from "node:assert/strict";
const site="http://127.0.0.1:8137/";
async function check(engine,name){
 const browser=await engine.launch({headless:true,args:name==="chromium"?["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]:[]});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const requests=[],errors=[],blocked=[];
 if(name==="firefox"){
  // The GitHub Linux runner has no functional WebGL2 GPU for headless Firefox.
  // Check Firefox's loading of the exact same-origin Cesium distribution
  // without constructing a Cesium Viewer; Chromium tests the actual scene.
  const html='<!doctype html><html><head><link rel="stylesheet" href="/cesium/Widgets/widgets.css">'+
   '<script>window.CESIUM_BASE_URL=new URL("/cesium/",document.baseURI).href;</script>'+
   '<script src="/cesium/Cesium.js"></script></head><body>Firefox Cesium asset QA</body></html>';
  await page.route(site+"cesium-asset-smoke.html",route=>route.fulfill({status:200,contentType:"text/html",body:html}));
 }
 page.on("request",req=>{if(/cesium|unpkg/i.test(req.url()))requests.push(req.url())});
 page.on("response",res=>{if(res.status()>=400&&res.url().startsWith(site+"cesium/"))blocked.push({url:res.url(),status:res.status()})});
 page.on("pageerror",e=>errors.push(String(e)));
 try{
  await page.goto(name==="firefox"?site+"cesium-asset-smoke.html":site+"live3d-operational-v9.html",{waitUntil:"domcontentloaded",timeout:45000});
  if(name==="chromium")await page.waitForSelector("#cesiumContainer .cesium-widget canvas",{state:"attached",timeout:60000});
  else await page.waitForFunction(()=>typeof window.Cesium==="object",null,{timeout:25000});
  await page.waitForTimeout(900);
  const actual=await page.evaluate(()=>({
   cesium:typeof window.Cesium==="object",
   workerBase:window.CESIUM_BASE_URL,
   cssUrl:[...document.querySelectorAll('link[rel="stylesheet"]')].map(x=>x.href).find(x=>/cesium/i.test(x)),
   jsUrl:[...document.scripts].map(x=>x.src).find(x=>/cesium\.js$/i.test(x)),
   canvas:document.querySelectorAll("#cesiumContainer .cesium-widget canvas").length,
   status:document.querySelector("#status")?.textContent?.slice(0,220)
  }));
  assert(actual.cesium);
  if(name==="chromium")assert.equal(actual.canvas,1);
  assert(actual.cssUrl?.startsWith(site+"cesium/"));
  assert(actual.jsUrl?.startsWith(site+"cesium/"));
  assert(actual.workerBase?.startsWith(site+"cesium/"));
  assert(requests.every(url=>!url.includes("unpkg.com/cesium")),"Unexpected external Cesium file");
  assert.deepEqual(blocked,[],"Failed local Cesium asset");
  assert.deepEqual(errors,[],"Uncaught browser JavaScript error");
  const result={browser:name,scope:name==="chromium"?"full Cesium map and local assets":"same-origin CSS/JS in Firefox, no virtual GPU",
    actual,cesiumRequests:requests.length,externalCesiumRequests:0,localFailures:blocked,jsErrors:errors};
  console.log(name==="chromium"?"CESIUM_SELFHOST_BROWSER_PASS":"CESIUM_FIREFOX_ASSETS_PASS_NO_GPU_IN_CI",JSON.stringify(result));
  await page.screenshot({path:"/tmp/stormtracker-"+name+"-cesium-qa.png"}).catch(()=>{});
 }catch(error){
  console.error("CESIUM_SELFHOST_BROWSER_FAIL",JSON.stringify({name,error:String(error),errors,blocked,requests:requests.slice(0,16)}));
  throw error;
 }finally{await browser.close()}
}
await check(chromium,"chromium");
await check(firefox,"firefox");
