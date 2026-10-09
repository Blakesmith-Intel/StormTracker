// V9.16.15: real-browser acceptance on the actual branch build. No fake
// radar frames, no image substitution, and no production Pages deployment.
// When testing localhost, forward the REAL Cloudflare WMTS response through
// Playwright solely to bypass the deployment-origin CORS restriction.
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import {chromium,webkit} from "playwright";

const engine=process.env.BROWSER_ENGINE==="webkit"?"webkit":"chromium";
const browserType=engine==="webkit"?webkit:chromium;
const args=engine==="chromium"?["--no-sandbox","--disable-gpu-sandbox",
  "--use-gl=angle","--use-angle=swiftshader","--enable-webgl",
  "--ignore-gpu-blocklist"]:[];
const browser=await browserType.launch({headless:true,args});
const mobile=engine==="webkit";
const page=await browser.newPage({
  viewport:mobile?{width:390,height:844}:{width:1440,height:900},
  deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile
});
page.setDefaultTimeout(18000);
mkdirSync("qa-screenshots",{recursive:true});
const evidence={engine,startedAt:new Date().toISOString(),events:[],errors:[]};
const note=(name,details={})=>{
  evidence.events.push({name,time:new Date().toISOString(),...details});
  console.log("V9_MULTIRADAR_BROWSER",JSON.stringify(evidence.events.at(-1)));
};
page.on("pageerror",error=>{
  evidence.errors.push({kind:"pageerror",message:error.message});
  console.log("BROWSER_PAGE_ERROR",error.message.slice(0,250));
});
page.on("requestfailed",request=>{
  if(request.url().includes("/wmts")){
    evidence.errors.push({kind:"wmts-failed",url:request.url().slice(0,180),
      failure:request.failure()?.errorText});
  }
});
await page.route("**/wmts?**",async route=>{
  // This is an authentic relay response. No seeded, manipulated or fabricated
  // weather data; browser only receives the upstream's original image bytes.
  try{
    const response=await route.fetch({timeout:60000,maxRetries:1});
    const headers={...response.headers(),"access-control-allow-origin":"*"};
    await route.fulfill({response,headers});
  }catch(error){
    console.log("LIVE_WMTS_PREVIEW_FETCH_ERROR",String(error).slice(0,350));
    await route.abort();
  }
});
const inspect=()=>page.evaluate(()=>window.__stormtrackerMultiRadarDiagnostics?.());
async function waitFor(predicate,timeout=75000){
  await page.waitForFunction(predicate,null,{timeout,polling:350});
  return inspect();
}
async function screenshot(name){
  try{
    await page.screenshot({path:"qa-screenshots/"+engine+"-"+name+".png",
      timeout:6500,captureBeyondViewport:false,animations:"disabled"});
  }catch(error){note("screenshot-unavailable",{name,error:String(error).slice(0,200)})}
}
try{
  await page.goto("http://127.0.0.1:8765/live3d-operational-v9.html?qaMultiRadar=1",
    {waitUntil:"domcontentloaded",timeout:75000});
  await waitFor(()=>Boolean(window.__stormtrackerMultiRadarDiagnostics),75000);
  const initial=await inspect();
  assert.equal(initial.primary,"66");
  assert.deepEqual(initial.secondary,[]);
  assert.equal(initial.openPanel,false);
  assert.ok(initial.mapWidth>300 && initial.mapHeight>200,
    "Real Cesium container should fit screen");
  note("viewer-started",initial);
  await screenshot("initial-cesium");
  await page.locator("#multiRadarSelectButton").click();
  assert.equal(await page.locator("#multiRadarPanel").isVisible(),true);
  assert.equal(await page.locator("#multiRadarSelectButton").getAttribute("aria-expanded"),"true");
  assert.equal(await page.locator('#multiRadarChecklist input[value="66"]').isDisabled(),true);
  // Preserve fully functional checkbox toggles on a real rendered DOM.
  await page.locator('#multiRadarChecklist input[value="50"]').check();
  await page.locator('#multiRadarChecklist input[value="08"]').check();
  let state=await inspect();
  assert.deepEqual(state.secondary,["50","08"]);
  assert.equal(await page.locator("#multiRadarCount").textContent(),"3");
  assert.match(state.addedStatus,/loading|measured sites|paused|original/i);
  note("three-radar-selection",state);
  await screenshot("three-site-selection");
  await page.locator("#closeMultiRadarPanel").click();
  assert.equal(await page.locator("#multiRadarPanel").isVisible(),false);

  // Fail honestly if source is not available. The test should NOT pass by
  // testing only the checkbox UI while real weather never loads.
  try{
    state=await waitFor(()=>{
      const s=window.__stormtrackerMultiRadarDiagnostics?.();
      return s?.primaryUtc && s?.primaryRegion==="66" && s?.frameCount>=2;
    },120000);
    note("real-primary-radar-loaded",state);
  }catch(error){
    state=await inspect();
    throw Error("Real BoM source did not load in browser: "+
      JSON.stringify(state)+"; original failure: "+error.message);
  }
  const loadedUtc=state.primaryUtc;
  assert.match(loadedUtc,/^20\d\d-\d\d-\d\dT\d\d:/);
  await waitFor(()=>{
    const s=window.__stormtrackerMultiRadarDiagnostics?.();
    return s?.primaryUtc && s?.addedStatus &&
      (/additional measured sites/.test(s.addedStatus) ||
       /unavailable/.test(s.addedStatus));
  },75000);
  state=await inspect();
  assert.ok(!/unavailable/.test(state.addedStatus),
    "Additional BoM sources failed: "+state.addedStatus);
  note("three-site-live",state);
  await screenshot("three-site-live-radar");

  // One distant site proves we can extend coverage beyond overlapping SEQ.
  await page.locator("#multiRadarSelectButton").click();
  await page.locator("#clearMultiRadars").click();
  await page.locator('#multiRadarChecklist input[value="24"]').check();
  state=await inspect();
  assert.deepEqual(state.secondary,["24"]);
  await page.locator("#fitMultiRadars").click();
  const fit=await inspect();
  assert.ok(fit.cameraTarget?.latitude>-26.5,
    "Fit selected must include Bowen instead of remaining centred on Brisbane");
  assert.ok(fit.cameraTarget?.range>300000);
  note("distant-site-map-fit",fit);
  try{
    await waitFor(()=>{
      const s=window.__stormtrackerMultiRadarDiagnostics?.();
      return s?.visibleSupplemental?.includes("24") ||
        /unavailable/.test(s?.addedStatus??"");
    },70000);
    state=await inspect();
    assert.ok(state.visibleSupplemental.includes("24"),
      "Actual distant rain image failed: "+state.addedStatus);
    note("distant-original-rain-visible",state);
  }catch(error){throw Error("Distant site source/readiness: "+error.message)}
  await screenshot("fit-distant-radars");

  // Actual frame slider: remove the older layer and only show the selected
  // observed timestamp, not a retained 2D source from a prior scan.
  const slider=page.locator("#hybridFrameSlider");
  const sliderMax=Number(await slider.getAttribute("max"));
  if(sliderMax>1 && await slider.isEnabled()){
    await slider.fill(String(Math.max(0,sliderMax-2)));
    const stepped=await waitFor(()=>{
      const s=window.__stormtrackerMultiRadarDiagnostics?.();
      return s?.primaryUtc && s.primaryUtc!==loadedUtc;
    },60000);
    note("real-history-scrub",stepped);
    await screenshot("history-scrub");
  }else note("history-scrub-not-available",{sliderMax});

  await page.locator("#clearMultiRadars").click();
  state=await inspect();
  assert.deepEqual(state.secondary,[]);
  assert.deepEqual(state.visibleSupplemental,[]);
  note("primary-only-reset",state);
  await page.locator("#closeMultiRadarPanel").click();
  await screenshot("primary-only-after-clear");

  assert.equal(await page.locator("#dopplerOverlayRadar").inputValue(),"66",
    "Multi-site display must never take control of primary Doppler selection");
  note("passed",{
    browser:engine,primaryUtc:state.primaryUtc,
    passedChecks:evidence.events.map(x=>x.name)
  });
}finally{
  evidence.endedAt=new Date().toISOString();
  writeFileSync("qa-screenshots/"+engine+"-browser-report.json",
    JSON.stringify(evidence,null,2)+"\n");
  await page.close();
  await browser.close();
}
