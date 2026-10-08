import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

mkdirSync("qa-screenshots",{recursive:true});
const browser = await chromium.launch({
  headless:true,
  args:[
    "--no-sandbox","--disable-gpu-sandbox","--use-gl=angle",
    "--use-angle=swiftshader","--enable-webgl","--ignore-gpu-blocklist"
  ]
});
try {
  const page = await browser.newPage({
    viewport:{width:390,height:720},deviceScaleFactor:1,
    isMobile:true,hasTouch:true
  });
  const jsErrors=[];
  page.on("pageerror", error=>jsErrors.push(error.message));
  await page.goto("http://127.0.0.1:8765/tools/qld-town-label-visual-qa.html",{
    waitUntil:"domcontentloaded",timeout:60000
  });
  await page.waitForFunction(()=>window.visualQA?.ready===true,{
    timeout:60000
  });
  const cases=[
    ["birdsville","qld-imagery",-70,9],
    ["birdsville","street",-70,0],
    ["brisbane","qld-imagery",-70,9],
    ["brisbane","street",-70,0],
    ["qld","qld-imagery",-70,5],
    ["qld","qld-imagery",-12,5]
  ];
  for(const [place,mode,pitch,limit] of cases){
    await page.evaluate(([p,m,t])=>{
      window.visualQA.setMode(m);
      window.visualQA.move(p,t);
    },[place,mode,pitch]);
    await page.waitForTimeout(650);
    const data=await page.evaluate(()=>window.visualQA.inspect());
    assert.ok(data.count>=700,`Expected official Queensland town names in ${place}`);
    assert.ok(data.visible<=limit,`${place}: ${data.visible} exceeds ${limit} label budget`);
    if(mode==="street")assert.equal(data.visible,0,"Street cannot render any supplemental labels");
    assert.deepEqual(data.overlaps,[],`Overlapping town label names in ${place}`);
    if(place==="birdsville"&&mode==="qld-imagery")assert.ok(
      data.labels.some(x=>x.name.toLowerCase()==="birdsville"),
      "Birdsville label must remain at its actual map location"
    );
    if(place==="brisbane"&&mode==="qld-imagery")assert.ok(
      data.labels.some(x=>x.name.toLowerCase()==="brisbane"),
      "Brisbane label must appear in imagery mode"
    );
    await page.locator("#map").screenshot({
      path:`qa-screenshots/${place}-${mode}-${pitch}.png`
    });
    console.log(
      `${place}/${mode}/pitch${pitch}: ${data.visible} visible labels, ${data.overlaps.length} collisions, ${data.count} named centres`
    );
  }
  assert.deepEqual(jsErrors,[],"Browser JavaScript exceptions");
  console.log("Visual browser smoke passed: mobile Street has no supplemental labels, imagery retains rural places with zero collisions.");
}finally {
  await browser.close();
}
