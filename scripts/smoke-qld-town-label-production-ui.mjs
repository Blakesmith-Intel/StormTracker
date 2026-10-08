import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import {
  townLabelBox, boxesOverlap, labelBudget, townLabelTypography
} from "../frontend/src/context-layers/qld-town-label-declutter-v1.js";

mkdirSync("qa-screenshots",{recursive:true});
const browser=await chromium.launch({
  headless:true,
  args:["--no-sandbox","--disable-gpu-sandbox","--use-gl=angle",
    "--use-angle=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]
});
try{
  const page=await browser.newPage({
    viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true
  });
  await page.goto(
    "http://127.0.0.1:8765/live3d-operational-v9.html?qaTownLabels=1",
    {waitUntil:"domcontentloaded",timeout:70000}
  );
  await page.waitForFunction(
    ()=>window.__stormtrackerTownLabelDiagnostics?.().count>=700,
    null,{timeout:70000}
  );
  const inspect=()=>page.evaluate(()=>{
    const result=window.__stormtrackerTownLabelDiagnostics();
    const canvas=document.querySelector("#cesiumContainer canvas");
    return {...result,mode:document.getElementById("basemapSelect").value,
      width:canvas?.clientWidth ?? 0,height:canvas?.clientHeight ?? 0};
  });
  function verify(result,description){
    assert.ok(result.count>=700,`${description}: Queensland names not loaded`);
    const budget=labelBudget(result.width,result.height,
      result.cameraHeight??50000,result.mode,
      result.cameraPitchDegrees??-90);
    assert.ok(result.visible.length<=budget,
      `${description}: too many visible labels (${result.visible.length}/${budget})`);
    const boxes=result.visible.map(t=>townLabelBox({
      ...t,fontSize:townLabelTypography(result.width,t.population).fontSize
    }));
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      assert.equal(boxesOverlap(boxes[i],boxes[j],9),false,
        `${description}: ${result.visible[i].name} overlaps ${result.visible[j].name}`);
    }

  }
  await page.waitForTimeout(1800);
  let state=await inspect();
  verify(state,"Initial full UI");
  assert.equal(state.mode,"street");
  assert.equal(state.labelMode,"street");
  assert.equal(state.visible.length,0,"Initial Street mode must have NO StormTracker town labels");
  const screenshot = async (fileName) => {
    try {
      await page.screenshot({
        path:`qa-screenshots/${fileName}.png`,
        timeout:3500,
        captureBeyondViewport:false,
        animations:"allow"
      });
    } catch (error) {
      // In headless SwiftShader, a busy scene may prevent GPU screenshot
      // capture even though the live UI and scene diagnostics are healthy.
      console.warn(`Full UI screenshot skipped: ${error.message}`);
    }
  };
  await screenshot("full-ui-street-before-pan");
  const rect=await page.locator("#cesiumContainer").boundingBox();
  assert.ok(rect?.width>=300 && rect?.height>=200,"Map canvas must render at mobile size");
  const x=rect.x+rect.width*0.5,y=rect.y+rect.height*0.6;
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.mouse.move(x+11,y+8,{steps:9});
  await page.mouse.up();
  await page.waitForTimeout(650);
  state=await inspect();
  verify(state,"After mobile-sized camera drag");
  assert.equal(state.visible.length,0,"Map interactions in Street mode must never show supplemental town labels");
  await page.locator("#basemapSelect").selectOption("qld-imagery");
  await page.waitForTimeout(1000);
  state=await inspect();
  verify(state,"After imagery basemap switch");
  assert.equal(state.mode,"qld-imagery");
  assert.equal(state.labelMode,"qld-imagery","Imagery must activate the label layer");
  await page.waitForFunction(
    ()=>window.__stormtrackerStateBorderDiagnostics?.().count > 0,
    null,{timeout:65000}
  );
  let border=await page.evaluate(()=>window.__stormtrackerStateBorderDiagnostics());
  assert.equal(border.mode,"qld-imagery");
  assert.equal(border.visible,true,"Official QLD state border must be visible over imagery");
  console.log(`Official QLD state border rendered over imagery: ${border.count} surveyed line features`);
  // Once imagery tiles start refining, Chromium cannot obtain a stable
  // WebGL screenshot. The live imagery-mode collision and count assertions
  // above are still required; preserve before/after drag screenshots.
  console.log("Imagery basemap switched successfully; town labels remain bounded and collision-free.");
  const actualCameraCases = [
    {id:"birdsville",coords:[139.35,-25.9,110000,-70],mode:"qld-imagery",limit:9},
    {id:"birdsville-low-angle",coords:[139.35,-25.9,110000,-12],mode:"qld-imagery",limit:9},
    {id:"brisbane",coords:[153.03,-27.47,110000,-70],mode:"qld-imagery",limit:9},
    {id:"qld-low-angle",coords:[146.0,-23.6,1450000,-12],mode:"qld-imagery",limit:5}
  ];
  for (const scenario of actualCameraCases) {
    await page.evaluate(coords => {
      window.__stormtrackerTownLabelTestCamera(...coords);
    }, scenario.coords);
    await page.waitForTimeout(900);
    const inspection = await inspect();
    console.log(`Full app QA ${scenario.id}: basemap=${inspection.mode}, labels=${inspection.labelMode}, height=${inspection.cameraHeight}, pitch=${inspection.cameraPitchDegrees}, visible=${inspection.visible.map(t=>t.name).join(", ")}`);
    assert.equal(inspection.labelMode, scenario.mode,
      "Label layer basemap mode must match the actual basemap selector");
    assert.ok(inspection.controllerTarget &&
      Math.abs(inspection.controllerTarget.longitude-scenario.coords[0])<0.001 &&
      Math.abs(inspection.controllerTarget.latitude-scenario.coords[1])<0.001,
      `${scenario.id}: camera controller must target the intended coordinates, not a stale view`);
    verify(inspection, scenario.id);
    assert.ok(inspection.visible.length<=scenario.limit,
      `${scenario.id}: ${inspection.visible.length} names at horizon (altitude ${Math.round(inspection.cameraHeight)}m, pitch ${inspection.cameraPitchDegrees.toFixed(1)}°, recalculations ${inspection.labelCalculations})`);
    console.log(`Actual full app ${scenario.id}: ${inspection.visible.length} non-overlapping names [${inspection.visible.map(t=>t.name).join(", ")}]`);
    if (scenario.id === "birdsville") await screenshot("full-ui-birdsville");
    if (scenario.id === "birdsville") {
      assert.ok(inspection.visible.some(t=>t.name.toLowerCase()==="birdsville"),
        `Actual StormTracker Birdsville view must identify Birdsville. Visible: ${inspection.visible.map(t=>t.name).join(", ")}`);
    }
  }
  // The user's specific regression: returning from satellite to Street
  // must eliminate all supplemental place names, even after camera movement.
  await page.locator("#basemapSelect").selectOption("street");
  await page.waitForTimeout(650);
  state=await inspect();
  assert.equal(state.mode,"street");
  assert.equal(state.labelMode,"street");
  assert.equal(state.visible.length,0,"Imagery-to-Street must remove every supplemental town name");
  border=await page.evaluate(()=>window.__stormtrackerStateBorderDiagnostics());
  assert.equal(border.visible,false,"Street OSM map must not show a duplicate border overlay");
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.mouse.move(x+9,y+5,{steps:6});
  await page.mouse.up();
  await page.waitForTimeout(400);
  state=await inspect();
  assert.equal(state.visible.length,0,"Street camera gestures must not resurrect labels");
  await page.locator("#basemapSelect").selectOption("qld-imagery");
  await page.waitForTimeout(550);
  state=await inspect();
  assert.equal(state.labelMode,"qld-imagery");
  assert.ok(state.visible.length<=5,"Returning to QLD imagery must keep the phone clutter cap");
  border=await page.evaluate(()=>window.__stormtrackerStateBorderDiagnostics());
  assert.equal(border.visible,true,"Switching back to QLD imagery restores official interstate line");
  assert.ok(await page.locator("#showPowerOutages").count()===1);
  assert.ok(await page.locator("#showFloodRoadClosures").count()===1);
  assert.ok(await page.locator("#showRiverGauges").count()===1);
  console.log(`Full StormTracker UI browser smoke passed: surveyed QLD state border restored on imagery, hidden in Street, reappears on satellite return; existing town labels, road/outage/gauge controls intact.`);

  // Desktop acceptance specifically targets the user's Birdsville screenshot:
  // the same real StormTracker viewer must render larger bold rural names on
  // QLD imagery and retain the legacy Street/no-labels contract.
  const desktop=await browser.newPage({
    viewport:{width:1440,height:900},deviceScaleFactor:1
  });
  try{
    await desktop.goto(
      "http://127.0.0.1:8765/live3d-operational-v9.html?qaTownLabels=1",
      {waitUntil:"domcontentloaded",timeout:70000}
    );
    await desktop.waitForFunction(
      ()=>window.__stormtrackerTownLabelDiagnostics?.().count>=700,
      null,{timeout:70000}
    );
    await desktop.locator("#basemapSelect").selectOption("qld-imagery");
    await desktop.waitForTimeout(800);
    await desktop.evaluate(()=>{
      window.__stormtrackerTownLabelTestCamera(139.35,-25.9,110000,-70);
    });
    await desktop.waitForTimeout(900);
    let desktopInfo=await desktop.evaluate(()=>{
      const labels=window.__stormtrackerTownLabelDiagnostics();
      const canvas=document.querySelector("#cesiumContainer canvas");
      return {...labels,width:canvas?.clientWidth??0,height:canvas?.clientHeight??0,
        mode:document.getElementById("basemapSelect").value};
    });
    assert.ok(desktopInfo.width>=700,
      "Desktop satellite viewer must not use mobile font metrics");
    assert.equal(desktopInfo.labelMode,"qld-imagery");
    assert.ok(desktopInfo.controllerTarget &&
      Math.abs(desktopInfo.controllerTarget.longitude-139.35)<0.001 &&
      Math.abs(desktopInfo.controllerTarget.latitude+25.9)<0.001,
      "Desktop viewer must genuinely be over Birdsville, not Brisbane");
    const birdsville=desktopInfo.visible.find(x=>x.name.toLowerCase()==="birdsville");
    assert.ok(birdsville,"Birdsville must remain geographically anchored on desktop imagery");
    assert.equal(birdsville.font,"bold 15px sans-serif",
      "Desktop Birdsville must use 15px bold glyphs");
    verify(desktopInfo,"Desktop Birdsville 15px");
    await desktop.locator("#basemapSelect").selectOption("street");
    await desktop.waitForTimeout(450);
    desktopInfo=await desktop.evaluate(()=>{
      const labels=window.__stormtrackerTownLabelDiagnostics();
      return labels;
    });
    assert.equal(desktopInfo.visible.length,0,
      "No additional town labels on desktop Street basemap");
    console.log("Desktop StormTracker imagery QA passed: Birdsville 15px bold, collision-free labels and Street 0 overlays.");
  }finally{
    await desktop.close();
  }
}finally{await browser.close();}
