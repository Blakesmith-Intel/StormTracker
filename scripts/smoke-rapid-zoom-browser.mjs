// Stress the real Cesium viewer with concentrated wheel and touch input.
// This runs against a branch-only localhost preview, never production Pages.
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import {chromium} from "playwright";

const browser=await chromium.launch({
  headless:true,
  args:["--no-sandbox","--disable-gpu-sandbox","--use-gl=angle",
    "--use-angle=swiftshader","--enable-webgl","--ignore-gpu-blocklist"]
});
const report={platform:"Chromium headless SwiftShader",wheel:[],pinch:null,
  jsErrors:[],crashes:0};
try {
  const page=await browser.newPage({viewport:{width:1366,height:820},deviceScaleFactor:1});
  page.setDefaultTimeout(20000);
  page.on("crash",()=>report.crashes++);
  await page.goto("http://127.0.0.1:8765/live3d-operational-v9.html?qaTownLabels=1",{
    waitUntil:"domcontentloaded",timeout:70000
  });
  await page.waitForFunction(
    ()=>window.__stormtrackerTownLabelDiagnostics?.().count>=700,
    null,{timeout:70000}
  );
  page.on("pageerror",error=>report.jsErrors.push(String(error.message)));
  const before=await page.evaluate(()=>window.__stormtrackerTownLabelDiagnostics().controllerTarget);
  assert.ok(before && Number.isFinite(before.range),"Live camera controller must initialise");

  for(const direction of [-1,1,-1,1]){
    // Dispatch in one browser task: no RAF can fire between 90 wheel events.
    const dispatchMs=await page.evaluate(sign=>{
      const element=document.getElementById("cesiumContainer");
      const started=performance.now();
      for(let i=0;i<90;i++)
        element.dispatchEvent(new WheelEvent("wheel",{
          bubbles:true,cancelable:true,deltaY:sign*100,deltaMode:0
        }));
      return performance.now()-started;
    },direction);
    await page.waitForTimeout(650);
    const state=await page.evaluate(()=>({
      controller:window.__stormtrackerTownLabelDiagnostics().controllerTarget,
      canvasPresent:!!document.querySelector("#cesiumContainer canvas"),
      readyState:document.readyState
    }));
    assert.equal(state.canvasPresent,true,"Cesium WebGL canvas survived wheel burst");
    assert.ok(Number.isFinite(state.controller?.range),"Camera target must remain finite");
    assert.equal(state.controller.range,direction<0?800:5000000,
      "Wheel burst must preserve all zoom input and clamp to safe range");
    report.wheel.push({direction,events:90,dispatchMs:Number(dispatchMs.toFixed(2)),
      range:state.controller.range});
    console.log("90 wheel events",direction<0?"in":"out",
      "dispatch ms",dispatchMs.toFixed(1),"range",state.controller.range);
  }

  // Independently exercise the browser's real touch handler with 80 pinch
  // updates, verifying state remains responsive and no WebGL crash occurs.
  const pinch=await page.evaluate(()=>{
    window.__stormtrackerTownLabelTestCamera(153.2,-27.4,150000,-65);
    const root=document.getElementById("cesiumContainer");
    const fire=(type,id,x,y)=>root.dispatchEvent(new PointerEvent(type,{
      bubbles:true,cancelable:true,pointerType:"touch",pointerId:id,
      isPrimary:id===51,button:0,buttons:type==="pointerup"?0:1,
      clientX:x,clientY:y
    }));
    fire("pointerdown",51,500,300);
    fire("pointerdown",52,620,300);
    const started=performance.now();
    for(let i=0;i<80;i++)fire("pointermove",52,621+i,300);
    const dispatchMs=performance.now()-started;
    fire("pointerup",52,700,300);
    fire("pointerup",51,500,300);
    return {dispatchMs,range:window.__stormtrackerTownLabelDiagnostics().controllerTarget.range};
  });
  assert.ok(pinch.range<150000 && pinch.range>=800,
    "Touch pinch must zoom correctly while retaining a finite range");
  await page.waitForTimeout(750);
  const after=await page.evaluate(()=>({
    target:window.__stormtrackerTownLabelDiagnostics().controllerTarget,
    canvasPresent:!!document.querySelector("#cesiumContainer canvas"),
    labelCalculations:window.__stormtrackerTownLabelDiagnostics().labelCalculations
  }));
  assert.ok(after.canvasPresent && Number.isFinite(after.target.range),
    "Real Cesium scene must survive and respond after rapid pinch");
  report.pinch={updates:80,dispatchMs:Number(pinch.dispatchMs.toFixed(2)),
    finalRange:after.target.range};
  assert.equal(report.crashes,0,"Renderer must not crash");
  assert.deepEqual(report.jsErrors,[],"No unhandled browser JavaScript exceptions after gestures");
  mkdirSync("qa-artifacts",{recursive:true});
  writeFileSync("qa-artifacts/rapid-zoom-browser.json",JSON.stringify(report,null,2));
  console.log("Real Chromium rapid-zoom smoke passed: 360 wheel events, 80 pinch updates, responsive map and no page crash.");
} finally {
  await browser.close();
}
