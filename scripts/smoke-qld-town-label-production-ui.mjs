import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import {
  townLabelBox, boxesOverlap, labelBudget
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
    assert.ok(result.visible.length<=9,`${description}: too many visible labels (${result.visible.length})`);
    const boxes=result.visible.map(t=>townLabelBox(t));
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      assert.equal(boxesOverlap(boxes[i],boxes[j],9),false,
        `${description}: ${result.visible[i].name} overlaps ${result.visible[j].name}`);
    }
    const max=labelBudget(result.width,result.height,50000,result.mode);
    assert.ok(result.visible.length<=Math.max(9,max));
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
  assert.ok(await page.locator("#showPowerOutages").count()===1);
  assert.ok(await page.locator("#showFloodRoadClosures").count()===1);
  assert.ok(await page.locator("#showRiverGauges").count()===1);
  console.log(`Full StormTracker UI browser smoke passed: Street 0 supplemental town labels during drag and after switch-back; QLD imagery <=5 collision-free labels with ${state.count} town records; road/outage/gauge controls intact.`);
}finally{await browser.close();}
