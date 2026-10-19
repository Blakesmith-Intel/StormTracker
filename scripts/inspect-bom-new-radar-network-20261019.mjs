import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--disable-dev-shm-usage"]});
const page=await browser.newPage({viewport:{width:1390,height:900}});
const hits=[],errors=[];
page.on("request",r=>{const u=r.url();if(/bom\.gov\.au|radar|wmts|timeseries|tile|map/i.test(u))hits.push({type:"request",method:r.method(),url:u.slice(0,500)})});
page.on("response",async r=>{const u=r.url();if(/bom\.gov\.au|wmts|timeseries|radar|tile|map/i.test(u)){let snippet="";if(/json|xml|text/.test(r.headers()["content-type"]||"") && /time|wmts|radar|map|layer|config/i.test(u)){try{snippet=(await r.text()).slice(0,800)}catch{}} hits.push({type:"response",status:r.status(),url:u.slice(0,500),ct:r.headers()["content-type"]||"",snippet})}});
page.on("console",m=>{if(m.type()==="error")errors.push(m.text().slice(0,500))});
page.on("pageerror",e=>errors.push(String(e)));
try{const url="https://www.bom.gov.au/weather-and-climate/rain-radar-and-weather-maps?radar=66-brisbane-(mt-stapylton)";
await page.goto(url,{waitUntil:"domcontentloaded",timeout:45000});
await page.waitForTimeout(16000);
console.log("PAGE_INFO",JSON.stringify({url:page.url(),title:await page.title(),text:(await page.locator("body").innerText()).slice(-1800)}));
console.log("RADAR_NETWORK",JSON.stringify(hits.slice(-180)));
console.log("PAGE_ERRORS",JSON.stringify(errors.slice(-25)));
await page.screenshot({path:"/tmp/bom-new-radar-page-20261019.png",fullPage:false}).catch(()=>{});
}finally{await browser.close()}
