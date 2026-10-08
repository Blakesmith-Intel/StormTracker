import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser=await chromium.launch({
  headless:true,args:["--no-sandbox","--disable-gpu-sandbox",
    "--use-gl=angle","--use-angle=swiftshader",
    "--enable-webgl","--ignore-gpu-blocklist"]
});
try {
  const page=await browser.newPage({
    viewport:{width:390,height:844},deviceScaleFactor:1,
    isMobile:true,hasTouch:true
  });
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(
    "http://127.0.0.1:8765/live3d-operational-v9.html?qaFloodSignals=1",
    {waitUntil:"domcontentloaded",timeout:70000}
  );
  await page.waitForFunction(
    ()=>window.__stormtrackerFloodDiagnostics?.().loadedAt>0,
    null,{timeout:90000}
  );
  const inspect=()=>page.evaluate(()=>window.__stormtrackerFloodDiagnostics());
  const first=await inspect();
  assert.equal(first.visible,true,"Exception-only gauges layer enabled on first load");
  assert.ok(first.matched>20,"Operational BoM bulletins must match actual Queensland gauge data");
  assert.ok(first.historyStationCount>20,"Measured heights must be retained for rate comparison");
  assert.equal(first.alertCount,first.states.length);
  assert.ok(first.counts,"Display must expose qualifying alert counts");
  assert.deepEqual(first.states.filter(s=>![
    "moderate","major","rapid-rise","tidal-anomaly"
  ].includes(s)),[],"Ordinary gauge states must never create map markers");
  const sum=Object.values(first.counts).reduce((n,x)=>n+x,0);
  assert.equal(first.alertCount,sum,"Rendered markers equal exception count");
  console.log(`Flood browser first load: ${first.matched} matched, ${first.historyStationCount} historic stations, ${first.alertCount} qualifying markers`);

  await page.locator("#showRiverGauges").uncheck();
  let hidden=await inspect();
  assert.equal(hidden.visible,false,"Toggle must remove markers without erasing history");
  assert.equal(hidden.historyStationCount,first.historyStationCount);
  await page.locator("#showRiverGauges").check();
  const again=await inspect();
  assert.equal(again.visible,true);
  assert.equal(again.alertCount,first.alertCount,"Switch must preserve the alert decision");

  const options=page.locator("#basemapSelect");
  await options.selectOption("qld-imagery");
  await page.waitForTimeout(600);
  assert.equal((await inspect()).alertCount,first.alertCount,
    "Switching to satellite must not change flood screening decisions");
  await options.selectOption("street");
  await page.waitForTimeout(400);
  assert.equal((await inspect()).alertCount,first.alertCount,
    "Street switch must not alter flood screening");
  assert.equal(errors.length,0,"Browser JavaScript errors: "+errors.join(" | "));
  console.log("Mobile flood signal browser smoke passed: current BoM relay, only qualifying exceptions, persistent history, toggle and both basemap modes.");
}finally {
  await browser.close();
}
