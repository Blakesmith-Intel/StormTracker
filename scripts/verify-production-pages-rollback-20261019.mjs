// Confirm the public GitHub Pages deployment no longer loads an FTP module
// missing from the sealed V10.2.0 build. This tests PUBLIC HTTP, not only git.
import assert from "node:assert/strict";

const base="https://blakesmith-intel.github.io/StormTracker/";
const expected="13004a899988fa1515a316794de0a5cff0c294a8";
async function fetchPublished(path){
 const response=await fetch(base+path+(path.includes("?")?"&":"?")+"rollback_check="+Date.now(),{
  headers:{"Cache-Control":"no-cache"},
  signal:AbortSignal.timeout(18000)
 });
 const body=await response.text();
 return {status:response.status,type:response.headers.get("content-type")||"",body};
}
let lastError;
for(let attempt=1;attempt<=18;attempt++){
 try{
  const [module,mainJs,page,build]=await Promise.all([
   fetchPublished("src/bom-wmts-loop-v2.js"),
   fetchPublished("src/live3d-operational-v9.js"),
   fetchPublished("live3d-operational-v9.html"),
   fetchPublished("BUILD.txt")
  ]);
  assert.equal(module.status,200,"WMTS module did not load as HTTP 200");
  assert.match(module.type,/javascript|ecmascript/i,"Radar module not returned as JavaScript");
  assert(!module.body.includes('from "./ftp-reflectivity-operational-v1.js'),
   "CRITICAL: published WMTS module still imports absent FTP file");
  assert(module.body.includes("findLatestBomReflectivityTime"),
   "Expected sealed WMTS discovery functions missing");
  assert.equal(mainJs.status,200);
  assert.match(mainJs.type,/javascript|ecmascript/i);
  assert.equal(page.status,200);
  assert.match(page.type,/html/i);
  assert.equal(build.status,200);
  assert(build.body.includes("SEALED StormTracker V10.2.0"),
   "Published BUILD.txt does not identify sealed V10.2.0");
  console.log("PUBLIC_PAGES_ROLLBACK_PASS",JSON.stringify({
   base,release:build.body.trim(),files:[{path:"src/bom-wmts-loop-v2.js",status:module.status,type:module.type},
   {path:"src/live3d-operational-v9.js",status:mainJs.status,type:mainJs.type},
   {path:"live3d-operational-v9.html",status:page.status,type:page.type}],
   removedBrokenFtpImport:true,verifiedAgainstCommit:expected
  }));
  process.exit(0);
 }catch(e){
  lastError=e;
  console.warn("PUBLIC_PAGES_WAIT",attempt,String(e.message));
  if(attempt<18)await new Promise(r=>setTimeout(r,10000));
 }
}
throw Error("Public Pages rollback NOT verified: "+String(lastError));
