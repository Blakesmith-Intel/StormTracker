import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--use-gl=angle","--use-angle=swiftshader"]});
const page=await browser.newPage();
const errors=[];
page.on("pageerror",e=>errors.push(String(e)));
page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
try{
 await page.goto("http://127.0.0.1:8137/ftp-smoke.html",{waitUntil:"domcontentloaded",timeout:20000});
 const output=await page.evaluate(async()=>{
  globalThis.__STORMTRACKER_FTP_FIRST=true;
  const api=await import("/src/bom-wmts-loop-v2.js");
  const history=await api.discoverBomReflectivityHistory(Date.now(),45,"SEQ");
  if(history.length<1)throw Error("No verified FTP SEQ history");
  const latest=history.at(-1);
  const frame=await api.loadBomReflectivityMosaicAtTime(latest,"SEQ");
  if(frame.sourceId!=="BOM-FTP-MOSAIC")throw Error("FTP primary did not load: "+frame.sourceId);
  if(frame.georef?.projection!=="EPSG:3857")throw Error("FTP raster not georeferenced in Mercator");
  if(frame.width!==1024||frame.height!==1024||frame.categories.length!==1024*1024)
    throw Error("Incorrect integrated FTP frame dimensions");
  if(frame.sourceMetadata?.siteIds?.length!==3)throw Error("Missing supplementary SEQ sites");
  if(frame.sourceMetadata.colouredPixelCount===0)throw Error("FTP pixels not decoded");
  return {sourceId:frame.sourceId,observedUtc:frame.observedUtc,frameCount:history.length,
    dimensions:[frame.width,frame.height],siteIds:frame.sourceMetadata.siteIds,
    strongPixels:frame.sourceMetadata.strongPixelCount,
    nonzeroPixels:frame.sourceMetadata.colouredPixelCount};
 });
 console.log("FTP_FIRST_OPERATIONAL_BROWSER_PASS",JSON.stringify(output));
 if(errors.length)console.log("BROWSER_CONSOLE_ERRORS",JSON.stringify(errors.slice(-10)));
}catch(err){
 console.log("FTP_FIRST_OPERATIONAL_BROWSER_FAIL",JSON.stringify({error:String(err),errors:errors.slice(-20),body:await page.locator("body").innerText().catch(()=>"")}));
 throw err;
}finally{await browser.close()}
