import {chromium} from "playwright";
import assert from "node:assert/strict";
const browser=await chromium.launch({headless:true,
 args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const page=await browser.newPage({viewport:{width:1440,height:850}});
const pageErrors=[],failedJs=[];
page.on("pageerror",error=>pageErrors.push(String(error)));
page.on("response",response=>{if(response.status()>=400&&/\.js(?:\?|$)/.test(response.url()))
 failedJs.push({status:response.status(),url:response.url()})});
const marker={id:"540523",name:"QA Gold Coast rainfall station",mm:125,
 band:"red",period:"since9am",region:"seast",latitude:-27.9,longitude:153.35,
 sourceCreatedAt:new Date().toISOString()};
const hour={...marker,mm:61,band:"orange",period:"lastHour"};
const source={format:"StormTrackerSignificantRainfallV1",checkedAt:new Date().toISOString(),
 regional:[],failed:[],observations:{since9am:[marker],lastHour:[hour]}};
// QA fixture only. No synthetic rain observations are ever added to production data.
await page.route("**/qld-significant-rainfall",route=>route.fulfill({status:200,
 contentType:"application/json",headers:{"access-control-allow-origin":"*"},
 body:JSON.stringify(source)}));
await page.route(/\/src\/live3d-operational-v9\.js\?/,async route=>{
 const original=await route.fetch();
 let text=await original.text();
 if(!text.includes("const scene = viewer.scene;"))
  throw Error("Viewer QA instrumentation location not found");
 text=text.replace("const scene = viewer.scene;",
  "const scene = viewer.scene; globalThis.__STORMTRACKER_QA_VIEWER=viewer;");
 await route.fulfill({response:original,body:text,contentType:"application/javascript"});
});
try{
 await page.goto("https://blakesmith-intel.github.io/StormTracker/live3d-operational-v9.html?qaRainPick=20261019",
  {waitUntil:"domcontentloaded",timeout:50000});
 await page.waitForSelector("#cesiumContainer .cesium-widget canvas",{state:"attached",timeout:50000});
 await page.locator("#showSignificantRainfall").check();
 await page.waitForFunction(()=>{
  const viewer=window.__STORMTRACKER_QA_VIEWER;
  if(!viewer)return false;
  const data=viewer.dataSources._dataSources;
  return !!data?.find?.(x=>x.name==="significant-rainfall"&&x.entities.values.length===1);
 },null,{timeout:22000});
 const pixel=await page.evaluate(()=>{
  const viewer=window.__STORMTRACKER_QA_VIEWER,Cesium=window.Cesium;
  const site=viewer.dataSources._dataSources.find(x=>x.name==="significant-rainfall");
  const entity=site.entities.values[0];
  viewer.camera.setView({destination:Cesium.Cartesian3.fromDegrees(153.35,-27.9,130000)});
  viewer.scene.requestRender();
  return {gaugeId:entity.stormTrackerRainGaugeId,entityId:entity.id};
 });
 assert.equal(pixel.gaugeId,"540523");
 await page.waitForTimeout(1600);
 const projected=await page.evaluate(()=>{
  const viewer=window.__STORMTRACKER_QA_VIEWER,Cesium=window.Cesium;
  const entity=viewer.dataSources._dataSources.find(x=>x.name==="significant-rainfall").entities.values[0];
  const at=entity.position.getValue(Cesium.JulianDate.now());
  const point=viewer.scene.cartesianToCanvasCoordinates(at);
  const rect=viewer.scene.canvas.getBoundingClientRect();
  const pos=point?new Cesium.Cartesian2(point.x,point.y):null;
  const hits=pos?viewer.scene.drillPick(pos,24,42,42).map(hit=>({
   id:hit?.id?.id??hit?.id??null, primitiveId:hit?.primitive?.id?.id??null
  })).slice(0,12):[];
  return point?{x:point.x+rect.left,y:point.y+rect.top,
   relX:point.x,relY:point.y,
   rect:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom},
   picks:hits,activeDataSources:viewer.dataSources.length,
   mapSceneMode:viewer.scene.mode,sceneCanvas:[viewer.scene.canvas.width,viewer.scene.canvas.height]}:null;
 });
 assert(projected,"QA station projection missing from viewport");
 console.log("RAIN_MARKER_PROJECTED_PICK_DIAGNOSTIC",JSON.stringify(projected));
 await page.evaluate(p=>{window.__STORMTRACKER_QA_PROJECTED=p},projected);
 await page.mouse.click(projected.x,projected.y);
 try{
  await page.waitForFunction(()=>document.getElementById("significantRainfallInfo")?.hidden===false,
   null,{timeout:6500});
 }catch(error){
  const dbg=await page.evaluate(()=>{
   const v=window.__STORMTRACKER_QA_VIEWER;
   const r=document.getElementById("significantRainfallInfo");
   return {hidden:r?.hidden,style:r?.getAttribute("style"),
    atPointer:document.elementFromPoint(1*0+window.__STORMTRACKER_QA_PROJECTED?.x,
     window.__STORMTRACKER_QA_PROJECTED?.y)?.outerHTML.slice(0,350),
    status:document.getElementById("significantRainfallStatus")?.textContent,
    mapBody:document.getElementById("mapPanel")?.contains(document.elementFromPoint(window.__STORMTRACKER_QA_PROJECTED?.x,window.__STORMTRACKER_QA_PROJECTED?.y))}
  });
  console.error("RAIN_CLICK_FAILURE_DETAILS",JSON.stringify(dbg));
  throw error;
 }
 const popup=await page.evaluate(()=>({
  title:document.getElementById("significantRainfallInfoTitle")?.textContent,
  content:document.getElementById("significantRainfallInfoRows")?.textContent,
  hidden:document.getElementById("significantRainfallInfo")?.hidden,
  mapGaugeCount:window.__STORMTRACKER_QA_VIEWER.dataSources._dataSources.find(x=>x.name==="significant-rainfall").entities.values.length
 }));
 assert(popup.title?.includes("QA Gold Coast rainfall station"));
 assert(popup.content?.includes("125.0 mm"));
 assert(popup.content?.includes("540523"));
 assert.deepEqual(failedJs,[]);
 assert(!pageErrors.some(x=>/TypeError|ReferenceError|SyntaxError/i.test(x)));
 console.log("RAINFALL_REAL_CESIUM_INTERACTIVE_PASS",JSON.stringify({projected,popup,failedJs,pageErrors}));
 await page.screenshot({path:"/tmp/stormtracker-interactive-rainfall-qa.png"}).catch(()=>{});
}catch(error){
 console.error("RAINFALL_REAL_CESIUM_INTERACTIVE_FAIL",JSON.stringify({error:String(error),failedJs,pageErrors}));
 await page.screenshot({path:"/tmp/stormtracker-interactive-rainfall-qa.png"}).catch(()=>{});
 throw error;
}finally{await browser.close()}
