import {chromium} from "playwright";
import assert from "node:assert/strict";
const browser=await chromium.launch({headless:true,args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const page=await browser.newPage({viewport:{width:1120,height:800}});
const error=[],csp=[];
page.on("pageerror",e=>error.push(String(e)));
page.on("console",m=>{if(/CORS|Cross-Origin|failed to fetch|Access to fetch/i.test(m.text()))csp.push(m.text().slice(0,300))});
try{
 await page.goto("https://blakesmith-intel.github.io/StormTracker/live3d-operational-v9.html?staticFtpSourceQA=1",{waitUntil:"domcontentloaded",timeout:50000});
 const result=await page.evaluate(async()=>{
  const host="https://raw.githubusercontent.com/Blakesmith-Intel/StormTracker/radar-ftp-feed/";
  const response=await fetch(host+"manifest.json",{cache:"no-store"});
  if(!response.ok)throw Error("Manifest "+response.status);
  const m=await response.json();
  if(m.sourceKind!=="ftp-original-png-byte-identical-static-archive")throw Error("Not verified archived feed");
  const ids=["08","50","66"];
  const recent=ids.map(id=>m.siteFrameHistory[id].map(x=>x.observedUtc));
  const matching=recent[0].filter(x=>recent.every(arr=>arr.includes(x))).sort();
  if(!matching.length)throw Error("No three-site real observation time");
  const time=matching.at(-1);
  const list=[];
  const known=[[245,245,255],[180,180,255],[120,120,255],[20,20,255],[0,216,195],[0,150,144],[0,102,102],[255,255,0],[255,200,0],[255,150,0],[255,100,0],[255,0,0],[200,0,0],[120,0,0],[40,0,0]];
  const lookup=new Set(known.map(x=>x.join(",")));
  for(const id of ids){
   const frame=m.siteFrameHistory[id].find(f=>f.observedUtc===time);
   const imageResponse=await fetch(frame.imageUrl,{cache:"no-store"});
   if(!imageResponse.ok)throw Error("Original FTP PNG HTTP "+imageResponse.status);
   const bytes=await imageResponse.arrayBuffer();
   const bitmap=await createImageBitmap(new Blob([bytes],{type:"image/png"}));
   if(bitmap.width!==512||bitmap.height!==512)throw Error("Wrong image native geometry");
   const canvas=document.createElement("canvas");canvas.width=512;canvas.height=512;
   const ctx=canvas.getContext("2d",{willReadFrequently:true});
   ctx.drawImage(bitmap,0,0);
   const data=ctx.getImageData(0,0,512,512).data;
   let confirmed=0,opaque=0;
   for(let y=0;y<438;y++)for(let x=0;x<512;x++){
     const i=(y*512+x)*4;if(data[i+3]===0)continue;opaque++;
     if(lookup.has([data[i],data[i+1],data[i+2]].join(",")))confirmed++;
   }
   list.push({site:id,filename:frame.filename,observedUtc:time,bytes:bytes.byteLength,
     recognisedReflectivityPixels:confirmed,opaquePixels:opaque,sha256:frame.sha256});
  }
  return {kind:m.sourceKind,generation:m.generatedUtc,time,images:list};
 });
 assert.equal(result.images.length,3);
 assert(result.images.every(x=>x.bytes>100));
 assert.deepEqual(error.filter(x=>/ftp/.test(x.toLowerCase())),[]);
 console.log("GITHUB_DIRECT_FTP_BROWSER_SOURCE_PASS",JSON.stringify({result,csp:csp.slice(-6),pageErrors:error.slice(-4)}));
}catch(e){
 console.log("GITHUB_DIRECT_FTP_BROWSER_SOURCE_FAIL",JSON.stringify({error:String(e),csp:csp.slice(-14),pageErrors:error.slice(-7)}));
 throw e;
}finally{await browser.close()}
