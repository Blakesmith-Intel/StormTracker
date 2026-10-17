// Real source probe for the ONE existing production Doppler transport.
const host="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev";
const requireRoute=process.argv.includes("--require-production-route");
const sources=[
  ["Brewarrina Doppler history",host+"/radar-history?product=IDR93I"],
  ["Brewarrina native latest",host+"/radar?product=IDR93I"],
  ["QLD Doppler history",host+"/radar-history?product=IDR66I"]
];
let fail=false;
for(const [name,url] of sources){
  const controller=new AbortController();
  const started=Date.now();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(url,{signal:controller.signal,headers:{
      Accept:"*/*",Origin:"https://blakesmith-intel.github.io"
    }});
    const type=response.headers.get("content-type")||"unknown";
    const product=response.headers.get("X-StormTracker-Product");
    const body=type.startsWith("image/")?"":(await response.text()).slice(0,4096);
    let frames=0,latest=null;
    if(response.ok&&body){try{
      const o=JSON.parse(body);
      frames=Array.isArray(o.frames)?o.frames.length:0;
      latest=o.frames?.at(-1)?.observedUtc??null;
    }catch{}}
    const blocked=response.status===403&&/Doppler product not allowed/.test(body);
    const missing=response.status===404;
    if((blocked||missing)&&requireRoute)fail=true;
    console.log(JSON.stringify({name,status:response.status,transportRouteAllowed:!blocked&&!missing,
      frames,latest,product,type,ms:Date.now()-started,
      note:blocked?"Stale production product allowlist":
        missing?"Production Worker missing":
        response.status===502?"Upstream BoM unavailable":
        response.ok?"Production transport reached":"Inspect BoM source",
      bodyStart:body.slice(0,160)}));
  }catch(error){console.error(name+" failed: "+String(error));if(requireRoute)fail=true;}
  finally{clearTimeout(timeout);}
}
if(fail){console.error("The existing production Doppler relay is still missing an approved product or unreachable");process.exitCode=1;}
