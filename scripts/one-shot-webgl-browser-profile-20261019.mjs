// Headless browser profile of the SEALED public StormTracker UI.
// One-shot; does not alter production. Captures counts, not GPU memory bytes.
import { chromium } from "playwright";
const browser=await chromium.launch({headless:true,args:["--enable-webgl","--use-gl=angle","--use-angle=swiftshader","--disable-web-security"]});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on("pageerror",e=>errors.push(String(e).slice(0,150)));
await page.addInitScript(()=>{
 const c={};const handles=new WeakMap();
 for(const type of [window.WebGLRenderingContext,window.WebGL2RenderingContext].filter(Boolean)){
  for(const name of ["createTexture","deleteTexture","generateMipmap","texImage2D","texSubImage2D"]){
   const p=type.prototype,orig=p[name];if(!orig)continue;
   p[name]=function(...args){c[name]=(c[name]||0)+1;return orig.apply(this,args)};
  }
 }
 window.__gpuProfileCounts=c;
});
try{
 await page.goto("https://blakesmith-intel.github.io/StormTracker/",{waitUntil:"domcontentloaded",timeout:25000});
 await page.waitForTimeout(12000);
 const snap=async(label)=>{const data=await page.evaluate(()=>({...window.__gpuProfileCounts})); console.log(JSON.stringify({phase:label,counters:data,textureBalance:(data.createTexture||0)-(data.deleteTexture||0)}))};
 await snap("startup-idle");
 for(let i=0;i<12;i++)await page.mouse.wheel(0,i%2?470:-470);
 await page.waitForTimeout(3000);await snap("rapid-zoom");
 const playback=page.locator("#playButton, #radarPlayButton, [id*='playPause'], button[aria-label*='Play']").first();
 if(await playback.count()){try{await playback.click({timeout:2000});await page.waitForTimeout(7000)}catch{}}
 await snap("playback-attempt");
 const selectors=page.locator("select");const count=await selectors.count();
 for(let i=0;i<Math.min(count,12);i++){const select=selectors.nth(i);const id=await select.getAttribute("id");if(!/radar|site/i.test(id||""))continue;
  const values=await select.locator("option").evaluateAll(opts=>opts.filter(o=>!o.disabled&&o.value).map(o=>o.value));
  for(const value of values.slice(0,2)){try{await select.selectOption(value,{timeout:2000});await page.waitForTimeout(1800)}catch{}}
 }
 await snap("radar-selection-attempt");
 console.log(JSON.stringify({pageErrors:errors.slice(0,12),selectors:count,playControlPresent:await playback.count()}));
}finally{await browser.close()}
