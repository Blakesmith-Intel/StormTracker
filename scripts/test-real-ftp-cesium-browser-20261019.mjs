import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--enable-unsafe-swiftshader"]});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const consoleLines=[];page.on("console",m=>{if(/FTP_BROWSER|WebGL|Cesium/.test(m.text()))consoleLines.push(m.text().slice(0,500))});
page.on("pageerror",e=>consoleLines.push("PAGE_ERROR "+String(e)));
try{
 await page.goto("http://127.0.0.1:8137/frontend/qa-ftp-live/",{waitUntil:"domcontentloaded",timeout:35000});
 await page.waitForFunction(()=>window.__ftpBrowserQA?.done===true,null,{timeout:95000});
 const result=await page.evaluate(()=>window.__ftpBrowserQA);
 await page.screenshot({path:"/tmp/stormtracker-ftp-qa/cesium-real-ftp-final.png",fullPage:true});
 console.log("BROWSER_QA_RESULT",JSON.stringify(result));
 console.log("BROWSER_QA_LOGS",JSON.stringify(consoleLines.slice(-30)));
 if(result.errors.length||result.phases.length!==3||result.phases.some(p=>p.imageryLayers!==4||p.primaryGlyphs<1||Object.values(p.secondary).some(n=>n<1)))
   throw Error("Real Cesium browser QA did not meet source/3D acceptance");
}catch(error){console.log("BROWSER_TIMEOUT_DIAGNOSTIC",JSON.stringify({error:String(error),logs:consoleLines.slice(-40),url:page.url(),body:(await page.locator("body").innerText().catch(()=>"(unavailable)")).slice(0,700)}));await page.screenshot({path:"/tmp/stormtracker-ftp-qa/cesium-real-ftp-final.png",fullPage:true}).catch(()=>{});throw error}finally{await browser.close()}
