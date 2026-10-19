import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const page=await browser.newPage({viewport:{width:1440,height:850}});
const errors=[],failedModules=[];
page.on("pageerror",e=>errors.push(String(e)));
page.on("response",r=>{if(r.status()>=400&&/\.js(?:\?|$)/.test(r.url()))
 failedModules.push({status:r.status(),url:r.url()})});
await page.route("https://blakesmith-intel.github.io/StormTracker/**",async route=>{
 const url=new URL(route.request().url());
 const local="http://127.0.0.1:8137"+url.pathname.replace("/StormTracker","")+url.search;
 try{
  const res=await fetch(local);
  await route.fulfill({status:res.status,body:Buffer.from(await res.arrayBuffer()),
   contentType:res.headers.get("content-type")||"application/octet-stream"});
 }catch(e){await route.abort("failed")}
});
await page.route(/\/StormTracker\/src\/live3d-operational-v9\.js/,async route=>{
 const resp=await route.fetch(),text=(await resp.text());
 if(!text.includes("const scene = viewer.scene;"))throw Error("Cesium instrumentation drift");
 await route.fulfill({response:resp,
  body:text.replace("const scene = viewer.scene;",
    "const scene = viewer.scene; globalThis.__STORMTRACKER_QA_VIEWER=viewer;"),
  contentType:"application/javascript"});
});
const at=new Date().toISOString();
const station=(id,name,latitude,longitude,period)=>({
 id,name,latitude,longitude,region:"seast",period,mm:50,band:"orange",sourceCreatedAt:at});
const source={format:"StormTrackerSignificantRainfallV1",checkedAt:at,regional:[],failed:[],
 observations:{since9am:[],lastHour:[
 station("QA19501","QA Adavale rainfall station",-25.91,144.6,"lastHour"),
 station("QA19502","QA Gold Coast rainfall station",-28.002,153.424,"lastHour")]}};
await page.route("**/qld-significant-rainfall",route=>route.fulfill({status:200,
 contentType:"application/json",headers:{"Access-Control-Allow-Origin":"*"},
 body:JSON.stringify(source)}));
try{
 await page.goto("https://blakesmith-intel.github.io/StormTracker/live3d-operational-v9.html?qaFtpAep=20261019",
  {waitUntil:"domcontentloaded",timeout:45000});
 await page.waitForSelector("#cesiumContainer .cesium-widget canvas",{state:"attached",timeout:45000});
 await page.locator("#significantRainfallPeriod").selectOption("lastHour");
 await page.locator("#showSignificantRainfall").check();
 await page.waitForFunction(()=>{
  const viewer=window.__STORMTRACKER_QA_VIEWER;
  const ds=viewer?.dataSources?._dataSources?.find(x=>x.name==="significant-rainfall");
  return ds?.entities.values.length===1 &&
    ds.entities.values[0].stormTrackerRainGaugeId==="QA19501";
 },null,{timeout:40000});
 const atXY=await page.evaluate(()=>{
  const v=window.__STORMTRACKER_QA_VIEWER,C=window.Cesium;
  const e=v.dataSources._dataSources.find(s=>s.name==="significant-rainfall").entities.values[0];
  v.camera.setView({destination:C.Cartesian3.fromDegrees(144.6,-25.91,120000)});
  v.scene.requestRender();
  return e.id;
 });
 assert(/QA19501/.test(atXY));
 await page.waitForTimeout(1500);
 const pos=await page.evaluate(()=>{
  const v=window.__STORMTRACKER_QA_VIEWER,C=window.Cesium;
  const e=v.dataSources._dataSources.find(s=>s.name==="significant-rainfall").entities.values[0];
  const p=v.scene.cartesianToCanvasCoordinates(e.position.getValue(C.JulianDate.now()));
  const b=v.scene.canvas.getBoundingClientRect();
  return p?{x:b.left+p.x,y:b.top+p.y}:null;
 });
 assert(pos);
 await page.mouse.click(pos.x,pos.y);
 await page.waitForFunction(()=>document.querySelector("#significantRainfallInfo")?.hidden===false,null,{timeout:12000});
 const actual=await page.evaluate(()=>{
  const v=window.__STORMTRACKER_QA_VIEWER;
  return {popup:document.getElementById("significantRainfallInfoRows")?.textContent,
  title:document.getElementById("significantRainfallInfoTitle")?.textContent,
  status:document.getElementById("significantRainfallStatus")?.textContent,
  visibleMarkerCount:v.dataSources._dataSources.find(x=>x.name==="significant-rainfall").entities.values.length,
  ftpFirst:globalThis.__STORMTRACKER_FTP_FIRST===true,cesium:!!window.Cesium}
 });
 assert(actual.title.includes("Adavale"));
 assert(actual.popup.includes("50.0 mm"));
 assert(actual.popup.includes("10% AEP"),"Observed local 50mm not identified as Adavale's 10% AEP design rainfall");
 assert(actual.popup.includes("QA19501"));
 assert(actual.ftpFirst);
 assert.equal(actual.visibleMarkerCount,1,"50mm Gold Coast must not appear as a ≥20% AEP rainfall event");
 assert.deepEqual(failedModules,[],"Missing source module after staged Pages build");
 assert.deepEqual(errors,[],"Uncaught production app JS errors");
 console.log("FTP_AEP_ACTUAL_V10_CESIUM_MAP_PASS",JSON.stringify({actual,position:pos}));
 await page.screenshot({path:"/tmp/v10-ftp-aep-cesium-qa.png"}).catch(()=>{});
}catch(error){
 console.log("FTP_AEP_ACTUAL_V10_CESIUM_MAP_FAIL",JSON.stringify({error:String(error),errors:errors.slice(0,8),failedModules}));
 await page.screenshot({path:"/tmp/v10-ftp-aep-cesium-qa.png"}).catch(()=>{});
 throw error;
}finally{await browser.close()}
