import {chromium,firefox} from "playwright";
import assert from "node:assert/strict";
const base="http://127.0.0.1:8137/live3d-operational-v9.html";
async function check(engine,name){
 const browser=await engine.launch({headless:true,args:name==="chromium"?["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]:[]});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const requests=[],fatal=[],warnings=[],blocked=[];
 page.on("request",r=>{if(/cesium|unpkg/i.test(r.url()))requests.push(r.url())});
 page.on("response",r=>{if(r.status()>=400&&r.url().startsWith("http://127.0.0.1:8137/cesium/"))blocked.push({url:r.url(),status:r.status()})});
 page.on("pageerror",e=>fatal.push(String(e)));
 page.on("console",m=>{if(m.type()==="warning"||m.type()==="error")warnings.push(m.text().slice(0,300))});
 try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:45000});
  await page.waitForSelector("#cesiumContainer .cesium-widget canvas",{state:"attached",timeout:60000});
  await page.waitForTimeout(1300);
  const actual=await page.evaluate(()=>({
   cesium:typeof window.Cesium==="object",
   workerBase:window.CESIUM_BASE_URL,
   cssUrl:[...document.querySelectorAll('link[rel="stylesheet"]')].map(x=>x.href).find(x=>/cesium/i.test(x)),
   jsUrl:[...document.scripts].map(x=>x.src).find(x=>/cesium\.js$/i.test(x)),
   canvas:document.querySelectorAll("#cesiumContainer .cesium-widget canvas").length,
   status:document.querySelector("#status")?.textContent.slice(0,220)
  }));
  assert(actual.cesium);
  assert.equal(actual.canvas,1);
  assert(actual.cssUrl?.startsWith("http://127.0.0.1:8137/cesium/"));
  assert(actual.jsUrl?.startsWith("http://127.0.0.1:8137/cesium/"));
  assert(actual.workerBase?.startsWith("http://127.0.0.1:8137/cesium/"));
  assert(requests.every(x=>!x.includes("unpkg.com/cesium")), "Unexpected third-party Cesium assets");
  assert.deepEqual(blocked,[],"Local Cesium static resource failure");
  assert(!fatal.some(x=>/module|Cesium|SyntaxError|ReferenceError/i.test(x)),"Fatal browser import error");
  const report={browser:name,actual,cesiumRequests:requests.length,
   thirdPartyCesiumRequests:requests.filter(x=>x.includes("unpkg")).length,
   localAssetFailures:blocked,jsErrors:fatal,warningCount:warnings.length,
   warningSamples:warnings.slice(0,5)};
  console.log("CESIUM_SELFHOST_BROWSER_PASS",JSON.stringify(report));
  await page.screenshot({path:"/tmp/stormtracker-"+name+"-cesium-qa.png"}).catch(()=>{});
 }catch(e){
  console.error("CESIUM_SELFHOST_BROWSER_FAIL",JSON.stringify({browser:name,error:String(e),fatal,blocked,requests:requests.slice(0,10),warnings:warnings.slice(0,12)}));
  throw e;
 }finally{await browser.close();}
}
await check(chromium,"chromium");
await check(firefox,"firefox");
