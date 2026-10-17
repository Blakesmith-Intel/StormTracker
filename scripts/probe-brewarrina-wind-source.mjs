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

// Verify actual, timestamped BoM velocity PNG via SAME production relay,
// not merely existence of metadata or a latest annotated GIF.
try {
  const historyResponse=await fetch(host+"/radar-history?product=IDR93I",{
    headers:{Origin:"https://blakesmith-intel.github.io"}
  });
  if(!historyResponse.ok)throw Error("Brewarrina history "+historyResponse.status);
  const history=await historyResponse.json();
  if(history.product!=="IDR93I"||!Array.isArray(history.frames)||!history.frames.length)
    throw Error("No published timestamped Brewarrina frames");
  const frame=history.frames.at(-1);
  if(!/^IDR93I\.T\.\d{12}\.png$/.test(frame.filename))
    throw Error("Unexpected Brewarrina BoM filename");
  const url=host+"/radar-frame?product=IDR93I&file="+encodeURIComponent(frame.filename);
  const response=await fetch(url,{headers:{Origin:"https://blakesmith-intel.github.io"}});
  if(!response.ok)throw Error("Brewarrina velocity frame "+response.status);
  const raw=new Uint8Array(await response.arrayBuffer());
  const isPng=raw.length>=24&&raw.slice(0,8).every((x,i)=>
    x===[137,80,78,71,13,10,26,10][i]);
  const dims=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
  const width=isPng?dims.getUint32(16):null,height=isPng?dims.getUint32(20):null;
  console.log(JSON.stringify({name:"Brewarrina real historical velocity PNG",
    filename:frame.filename,observedUtc:frame.observedUtc,status:response.status,
    bytes:raw.length,contentType:response.headers.get("content-type"),
    width,height,isPng,sourceUtc:response.headers.get("X-StormTracker-Observed-UTC")}));
  if(!isPng||raw.length<500||!width||!height)
    throw Error("BoM wind frame invalid or missing native pixels");
  if(response.headers.get("X-StormTracker-Observed-UTC")!==frame.observedUtc)
    throw Error("BoM frame UTC header mismatches published history");
}catch(error){
  console.error("Authentic Brewarrina scan failed: "+String(error));
  if(requireRoute)process.exitCode=1;
}
