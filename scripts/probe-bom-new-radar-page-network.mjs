import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const page=await browser.newPage({viewport:{width:1400,height:900},ignoreHTTPSErrors:true});
const hits=new Map();const bad=[];
page.on("request",req=>{const u=req.url();
 if(/bom\.gov\.au|cloud\.bom|radar|reflectiv|tile|wmt|mapbox|maplibre|mapserver/i.test(u)){
   if(hits.size<150)hits.set(u,{method:req.method(),type:req.resourceType(),u});
 }
});
page.on("response",res=>{
 const u=res.url();if(/wmts|radar|reflectiv|timeseries|maptile|tile/i.test(u)){
  const r=hits.get(u);if(r)r.status=res.status();
 }
});
page.on("requestfailed",req=>{
 if(bad.length<35)bad.push({u:req.url(),failure:req.failure()});
});
try{
 const resp=await page.goto("https://www.bom.gov.au/weather-and-climate/rain-radar-and-weather-maps",
  {waitUntil:"domcontentloaded",timeout:60000});
 console.log("NEW_BOM_RADAR_SITE",resp?.status(),page.url());
 await page.waitForTimeout(18000);
 const inf=await page.evaluate(()=>({
  title:document.title,
  scripts:[...document.querySelectorAll("script[src]")].map(s=>s.src).slice(0,30),
  iframe:[...document.querySelectorAll("iframe")].map(s=>s.src).slice(0,12),
  text:(document.body?.innerText??"").slice(0,600)
 }));
 console.log("NEW_BOM_RADAR_PAGE_INFO",JSON.stringify(inf));
 console.log("NEW_BOM_RADAR_REQUESTS",JSON.stringify([...hits.values()].slice(0,145)));
 console.log("NEW_BOM_RADAR_NETWORK_FAILURES",JSON.stringify(bad));
}catch(e){console.log("NEW_BOM_RADAR_DIAGNOSTIC_ERROR",String(e))}
finally{await browser.close()}
