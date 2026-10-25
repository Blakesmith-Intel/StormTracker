import { chromium } from "playwright";

const browser=await chromium.launch({headless:true,args:[
 "--use-gl=angle","--use-angle=swiftshader","--enable-webgl",
 "--enable-unsafe-swiftshader","--ignore-gpu-blocklist"
]});
try{
 const page=await browser.newPage({viewport:{width:430,height:910},
  deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const errors=[],badRequests=[];
 page.on("pageerror",err=>errors.push(String(err)));
 page.on("response",r=>{if(r.status()>=400&&r.url().includes(".js"))
  badRequests.push({status:r.status(),url:r.url()})});
 let didInstrument=false;
 await page.route("**/src/live3d-operational-v9.js*",async route=>{
  const response=await route.fetch();
  const script=await response.text();
  const anchor="const scene = viewer.scene;";
  if(!script.includes(anchor))throw Error("Viewer access insertion point moved");
  didInstrument=true;
  await route.fulfill({response,contentType:"application/javascript",
   body:script.replace(anchor,anchor+" globalThis.__STORMTRACKER_QA_VIEWER=viewer;")});
 });
 await page.route("**/src/context-layers/river-gauges-operational-v1.js*",async route=>{
  const response=await route.fetch();
  const original=await response.text();
  const needle="// Opt-in browser QA: verify only qualifying BoM flood signals are rendered.";
  if(!original.includes(needle))throw Error("Flood layer test instrumentation anchor moved");
  await route.fulfill({response,contentType:"application/javascript",
   body:original.replace(needle,"window.__QA_PERSISTED_FLOOD_LAYER=layer;\n  "+needle)});
 });
 await page.goto("https://blakesmith-intel.github.io/StormTracker/live3d-operational-v9.html?qaFloodSignals=1",
  {waitUntil:"domcontentloaded",timeout:60000});
 await page.locator("#showRiverGauges").check({timeout:45000});
 await page.waitForFunction(()=>Boolean(window.__stormtrackerFloodDiagnostics?.().loadedAt>0),
  null,{timeout:110000});
 await page.waitForTimeout(1200);
 let snapshot=async(stage)=>await page.evaluate(stage=>{
  const viewer=window.__STORMTRACKER_QA_VIEWER;
  if(!viewer)return {stage,error:"instrumentation missing"};
  const sources=(viewer.dataSources._dataSources??[]).filter(s=>String(s.name).startsWith("flood-severity-"));
  const entities=sources.flatMap(x=>x.entities.values);
  const parseState=(e)=>{
   const src=e.stormTrackerFloodBillboard?.image;
   if(!src||typeof src!=="string")return {state:"unknown",color:null};
   const raw=decodeURIComponent(src.slice(src.indexOf(",")+1));
   const color=raw.match(/fill="(#[0-9a-f]{6})"/i)?.[1]??"none";
   const arrow=raw.includes('cx="61"');
   return {color,arrow,state:color==="#1269e8"?(arrow?"blue-rapid":"blue-monitoring"):color};
  };
  const items=[],unknown=[];
  const pools=viewer.scene.primitives?._primitives??[];
  for(const pool of pools){
   if(typeof pool.get!=="function"||typeof pool.length!=="number")continue;
   if(pool.length>2500)continue;
   for(let i=0;i<pool.length;i++){
    const bb=pool.get(i),id=bb?.id?.stormTrackerRiverGaugeId;
    if(!id)continue;
    items.push({id,state:parseState(bb.id),
     width:bb.width,height:bb.height,scale:bb.scale,sizeInMeters:bb.sizeInMeters,
     show:bb.show,scaleByDistance:bb.scaleByDistance?.toString?.()??null,
     position:bb.position?{x:bb.position.x,y:bb.position.y,z:bb.position.z}:null});
   }
  }
  const sourcesInMap=entities.map(e=>({id:e.stormTrackerRiverGaugeId??e.id,
   state:parseState(e),hasNativeBillboard:Boolean(e.billboard),
   width:e.stormTrackerFloodBillboard?.width,height:e.stormTrackerFloodBillboard?.height}));
  const counts={},sizes={};
  for(const x of items){counts[x.state.state]=(counts[x.state.state]??0)+1;
   const key=x.state.state+"/"+x.width+"x"+x.height+"/scale="+x.scale;
   sizes[key]=(sizes[key]??0)+1;
  }
  return {stage,viewer:!!viewer,sourceCount:entities.length,
   directRenderedCount:items.length,counts,sizes,
   sample:items.slice(0,65),sourceSample:sourcesInMap.slice(0,45),
   appDiagnostics:window.__stormtrackerFloodDiagnostics?.()};
 },stage);
 const first=await snapshot("before-camera");
 console.log("LIVE_FLOOD_CESIUM_SNAPSHOT",JSON.stringify({didInstrument,first,errors,badRequests}).slice(0,36000));
 await page.screenshot({path:"qa-flood-live-screenshot.png",fullPage:false,timeout:30000}).catch(()=>{});
 const sanity=first.first??first;
 if(!didInstrument||sanity.error)throw Error("No Cesium browser instrument");
 if(sanity.sourceCount===0)throw Error("No live BoM flood gauge icons available at test time");
 if(sanity.directRenderedCount===0)throw Error("No actual flood primitives in scene");
 // Seed a genuine-source, station-ID-keyed post-rise event in this isolated
 // browser only. The published app has no initial blue pins on fresh installs;
 // the user's Safari already has saved monitoring records.
 const chosen=await page.evaluate(async()=>{
  const layer=window.__QA_PERSISTED_FLOOD_LAYER;
  if(!layer)throw Error("No instrumented live gauge layer");
  const {stationFloodLevels}=await import("./src/context-layers/river-flood-thresholds-v1.js");
  const source=layer.sourceFeatures??[];
  const candidates=source.filter(f=>{
   const p=f.properties??{};
   return /^bom:\\d{6}$/.test(f.id) &&
     stationFloodLevels(f)?.minor==null &&
     Number.isFinite(p.STORMTRACKER_HEIGHT_METRES) &&
     p.STORMTRACKER_HEIGHT_METRES>0 &&
     !/tide gauge|tidal|sea level|estuary/i.test(String(p.location_types??"")) &&
     !["minor","moderate","major"].includes(
      String(p.STORMTRACKER_FLOOD_CLASS??"").toLowerCase()) &&
     !p.STORMTRACKER_PLOT_CROSSING;
  });
  const f=candidates.find(f=>Number(f.properties?.STORMTRACKER_HEIGHT_METRES)>0.4)
    ??candidates[0];
  if(!f)throw Error("No valid unclassified inland BoM reference station");
  return {id:f.id,name:f.properties?.name,height:f.properties.STORMTRACKER_HEIGHT_METRES,
   lat:f.geometry?.coordinates?.[1],lon:f.geometry?.coordinates?.[0],
   eligible:candidates.length};
 });
 console.log("PERSISTED_MONITORING_TEST_GAUGE",JSON.stringify(chosen));
 await page.evaluate(({id,height})=>{
  const t=Date.now();
  localStorage.setItem("stormtracker.qld-flood-events.v1",
   JSON.stringify({[id]:{type:"rapid-rise",activatedAt:t-3600000,
    lastObservedAt:t-1200000,lastHeight:height,
    baselineHeight:height-0.4,peakHeight:height+0.2,
    recoveryMarginMetres:0.1,recoveryCount:0,lastRecoveryAt:null}}));
 },chosen);
 await page.reload({waitUntil:"domcontentloaded",timeout:60000});
 await page.waitForFunction(()=>window.__stormtrackerFloodDiagnostics?.().loadedAt>0,
  null,{timeout:120000});
 const persisted=await page.evaluate(id=>{
  const viewer=window.__STORMTRACKER_QA_VIEWER,layer=window.__QA_PERSISTED_FLOOD_LAYER;
  const feature=layer.features.find(x=>x.id===id);
  const states=(viewer?.dataSources?._dataSources??[])
   .filter(x=>String(x.name).startsWith("flood-severity-"))
   .flatMap(x=>x.entities.values);
  const entity=states.find(x=>x.stormTrackerRiverGaugeId===id);
  const pools=viewer?.scene?.primitives?._primitives??[];
  let bb=null;
  for(const pool of pools){
   if(typeof pool.get!=="function"||pool.length>2500)continue;
   for(let i=0;i<pool.length;i++){
    const e=pool.get(i);
    if(e?.id?.stormTrackerRiverGaugeId===id){bb=e;break;}
   }
   if(bb)break;
  }
  const greens=states.filter(x=>x.stormTrackerFloodBillboard?.image?.startsWith("data:image/png"));
  return {
   id,displayState:feature?.properties?.STORMTRACKER_DISPLAY_STATE??null,
   rapidRise:feature?.properties?.STORMTRACKER_RAPID_RISE??null,
   hasEntity:!!entity,bitmapPng:entity?.stormTrackerFloodBillboard?.image?.startsWith("data:image/png;base64,")??false,
   bitmapSize:entity?.stormTrackerFloodBillboard?.image?.length??0,
   bitmapWidth:bb?.width??null,bitmapHeight:bb?.height??null,
   bitmapScale:bb?.scale??null,sizeInMeters:bb?.sizeInMeters??null,
   otherBmpCount:greens.length
  };
 },chosen.id);
 console.log("PERSISTED_BLUE_MONITORING_PRODUCTION_RESULT",JSON.stringify(persisted));
 if(persisted.displayState!=="elevated"||persisted.rapidRise!==false||
  !persisted.bitmapPng||persisted.bitmapWidth!==38||
  persisted.bitmapHeight!==42||persisted.bitmapScale!==1||
  persisted.sizeInMeters!==false)
  throw Error("Real published Safari-persisted monitoring state failed rendering contract: "+JSON.stringify(persisted));
 console.log("LIVE_PERSISTED_BLUE_MONITORING_PRODUCTION_PASS",JSON.stringify(persisted));
 console.log("LIVE_FLOOD_AUDIT_COMPLETED",
 JSON.stringify({source:page.url(),sourceCount:sanity.sourceCount,
 renderedCount:sanity.directRenderedCount,sizeGroups:sanity.sizes}));
}finally{
 await browser.close();
}
