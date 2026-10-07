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
  await page.screenshot({
    path:"qa-screenshots/full-ui-street-before-pan.png"
  });
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
  await page.screenshot({
    path:"qa-screenshots/full-ui-street-after-pan.png"
  });
  await page.locator("#basemapSelect").selectOption("qld-imagery");
  await page.waitForTimeout(1000);
  state=await inspect();
  verify(state,"After imagery basemap switch");
  assert.equal(state.mode,"qld-imagery");
  // Once imagery tiles start refining, Chromium cannot obtain a stable
  // WebGL screenshot. The live imagery-mode collision and count assertions
  // above are still required; preserve before/after drag screenshots.
  console.log("Imagery basemap switched successfully; town labels remain bounded and collision-free.");
  assert.ok(await page.locator("#showPowerOutages").count()===1);
  assert.ok(await page.locator("#showFloodRoadClosures").count()===1);
  assert.ok(await page.locator("#showRiverGauges").count()===1);
  console.log(`Full StormTracker UI browser smoke passed: ${state.count} town records, ${state.visible.length} visible after pan/switch, zero collisions; road/outage/gauge controls intact.`);
}finally{await browser.close();}
