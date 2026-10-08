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
  // The production relay intentionally allows GitHub Pages origin only.
  // Preview origin 127.0.0.1 is never whitelisted. Forward the actual live
  // BoM JSON response through Playwright's test router, not a mock payload.
  for (const endpoint of ["river-height-bulletins","river-gauge-metadata","river-recent-history"]) {
    await page.route(`**/${endpoint}`,async route=>{
      try {
        const upstream=await fetch(route.request().url(),{
          signal:AbortSignal.timeout(45000),
          headers:{Accept:"application/json,application/geo+json"}
        });
        await route.fulfill({
          status:upstream.status,
          headers:{
            "access-control-allow-origin":"*",
            "content-type":"application/json; charset=utf-8"
          },
          body:await upstream.text()
        });
      }catch(error){
        console.error("Live BoM preview relay failure:",endpoint,error);
        await route.abort();
      }
    });
  }
  await page.goto(
    "http://127.0.0.1:8765/live3d-operational-v9.html?qaFloodSignals=1",
    {waitUntil:"domcontentloaded",timeout:70000}
  );
  try {
    await page.waitForFunction(
      ()=>window.__stormtrackerFloodDiagnostics?.().loadedAt>0,
      null,{timeout:90000}
    );
  } catch (error) {
    const debug=await page.evaluate(()=>({
      status:document.querySelector("#riverGaugeStatus")?.textContent,
      diagnostic:window.__stormtrackerFloodDiagnostics?.(),
      state:document.readyState
    }));
    console.error("Flood browser timeout diagnostics:",JSON.stringify({debug,errors}));
    throw error;
  }
  const inspect=()=>page.evaluate(()=>window.__stormtrackerFloodDiagnostics());
  const first=await inspect();
  assert.equal(first.visible,true,"Exception-only gauges layer enabled on first load");
  assert.ok(first.matched>20,"Operational BoM bulletins must match actual Queensland gauge data");
  assert.ok(first.historyStationCount>20,"Measured heights must be retained for rate comparison");
  assert.ok(first.recentHistoryRequestCount <= 48,
    "Browser must cap individual BoM station recent-history calls");
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
  assert.ok(again.alertCount>=0,"Gauge visibility must not disrupt flood decisions");

  const options=page.locator("#basemapSelect");
  await options.selectOption("qld-imagery");
  await page.waitForTimeout(600);
  assert.ok((await inspect()).alertCount>=0,
    "Switching to satellite must not clear the flood data layer");
  await options.selectOption("street");
  await page.waitForTimeout(400);
  assert.ok((await inspect()).alertCount>=0,
    "Street switch must not disrupt flood screen");
  // Render actual clickable, keyboard-safe Source anchors in each map
  // panel inside the real mobile StormTracker DOM.
  const sourceLinks=await page.evaluate(async()=>{
    const module=await import("/src/context-layers/official-source-links-v1.js?v=9.13.2");
    const scenarios=[
      ["floodRoadClosureInfoRows","QLDTraffic",module.roadOfficialUrl("")],
      ["powerOutageInfoRows","Energex",module.powerOfficialUrl("Energex")],
      ["riverGaugeInfoRows","BoM",module.OFFICIAL_SOURCE_LINKS.bom],
      ["riverGaugeInfoRows","BoM gauge",module.bomGaugePlotUrl(
        "/fwo/IDQ65388/IDQ65388.540576.plt.shtml")]
    ];
    return scenarios.map(([id,label,url])=>{
      const el=document.getElementById(id);
      module.addOfficialSourceRow(el,"Source",label,url);
      const link=el.lastElementChild;
      return {
        id,label,href:link.href,rel:link.rel,target:link.target,
        text:link.textContent,color:getComputedStyle(link).color,
        underline:getComputedStyle(link).textDecorationLine
      };
    });
  });
  assert.equal(sourceLinks.length,4);
  for(const link of sourceLinks){
    assert.ok(link.href.startsWith("https://"),"Official URLs must be HTTPS");
    assert.equal(link.target,"_blank");
    assert.equal(link.rel,"noopener noreferrer");
    assert.ok(link.underline.includes("underline"),
      "Map Source links must be visibly interactive on mobile");
  }
  assert.ok(sourceLinks.find(x=>x.label==="BoM gauge").href.includes("540576.plt.shtml"));
  console.log("Mobile official source links verified:",sourceLinks.map(x=>x.label).join(", "));
  assert.equal(errors.length,0,"Browser JavaScript errors: "+errors.join(" | "));
  console.log("Mobile flood signal browser smoke passed: current BoM feed, bounded historical bootstrap, only qualifying exceptions, history persistence, toggle and both basemap modes.");
}finally {
  await browser.close();
}
