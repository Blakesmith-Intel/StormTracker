import assert from "node:assert/strict";
import {chromium,webkit} from "playwright";
const browsers=[["chromium",chromium],["webkit",webkit]];
for(const [name,launcher] of browsers){
 let browser;
 try{
  browser=await launcher.launch({headless:true,
   ...(name==="chromium"?{args:["--use-gl=angle","--use-angle=swiftshader"]}:{})});
  const page=await browser.newPage({viewport:{width:430,height:920},
   isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await page.goto("http://127.0.0.1:8765/qa-asset.html",
   {waitUntil:"domcontentloaded",timeout:30000});
  const result=await page.evaluate(async()=>{
   const {createRiverGaugeMapMarkerBitmap,createRiverGaugeMarkerImage}=await
    import("./src/context-layers/river-gauge-layer-v1.js");
   const result=[];
   for(const state of ["rapid-rise","elevated","unverified","crossing",
    "minor","moderate","major"]){
    for(const rapid of [false,true]){
     const png=createRiverGaugeMapMarkerBitmap(state,rapid);
     if(!png.startsWith("data:image/png;base64,"))
      throw Error("Safari fallback to SVG: "+state+":"+rapid);
     const image=new Image(); image.src=png; await image.decode();
     const cvs=document.createElement("canvas");cvs.width=160;cvs.height=176;
     const ctx=cvs.getContext("2d",{willReadFrequently:true});
     ctx.drawImage(image,0,0);
     const pixels=ctx.getImageData(0,0,160,176).data;
     let l=160,t=176,r=-1,b=-1,visible=0;
     for(let y=0;y<176;y++)for(let x=0;x<160;x++){
      if(pixels[4*(160*y+x)+3]<128)continue;
      l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
      visible++;
     }
     const svg=createRiverGaugeMarkerImage(state,rapid);
     result.push({state,rapid,format:"png",width:image.width,
      height:image.height,bounds:[l,t,r,b],visible,
      sourceColour:decodeURIComponent(svg.split(",")[1])
       .match(/fill="(#[0-9a-f]{6})"/i)?.[1]??null,
      arrow:decodeURIComponent(svg).includes('cx="61"')});
    }
   }
   return result;
  });
  assert.equal(result.length,14);
  for(const item of result){
   assert.equal(item.width,160);assert.equal(item.height,176);
   assert.ok(item.visible>1000,"Raster flood icon has disappeared: "+item.state);
   assert.ok(item.bounds[0]>=0&&item.bounds[2]<160);
   assert.equal(item.arrow,item.rapid||item.state==="rapid-rise");
  }
  const noArrows=result.filter(x=>!x.rapid&&x.state!=="rapid-rise");
  const base=noArrows.find(x=>x.state==="elevated");
  for(const x of noArrows){
   assert.deepEqual(x.bounds,base.bounds,
    name+": blue monitoring, green, yellow, red and bridge must fill same on-screen image footprint");
  }
  console.log("SAFARI_FLOOD_BITMAP_BROWSER_PASS",JSON.stringify({browser:name,results:result}));
 }finally{await browser?.close();}
}
