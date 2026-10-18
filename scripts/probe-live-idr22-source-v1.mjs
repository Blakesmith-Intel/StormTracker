// Read-only, bounded diagnosis of the reported Mackay frame and WMTS 400.
// Every request gets its own deadline; do not consume binary PNG responses.
const root="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev";
const origin="https://blakesmith-intel.github.io";
async function inspect(label,url,{json=false}={}){
  try{
    const started=Date.now();
    const r=await fetch(url,{
      headers:{Origin:origin,Accept:"*/*"},
      signal:AbortSignal.timeout(10000)
    });
    const type=r.headers.get("content-type")||"";
    const contents=json ? await r.text() :
      (type.includes("image/") ? "" : (await r.text()).slice(0,200));
    if(!json && type.includes("image/"))await r.body?.cancel();
    console.log(JSON.stringify({label,status:r.status,latencyMs:Date.now()-started,
      cors:r.headers.get("access-control-allow-origin"),
      type,reason:contents.slice(0,200).replace(/\s+/g," ")}));
    return json?contents:null;
  }catch(e){
    console.log(JSON.stringify({label,error:String(e)}));
    return null;
  }
}
const hist=await inspect("Mackay IDR22I history",root+"/radar-history?product=IDR22I",{json:true});
try{
 const frames=JSON.parse(hist).frames;
 console.log(JSON.stringify({frames:frames.length,
   first:frames.at(0)?.observedUtc,last:frames.at(-1)?.observedUtc}));
 for(const f of frames){
   await inspect("Mackay "+f.filename,root+"/radar-frame?product=IDR22I&file="+encodeURIComponent(f.filename));
 }
}catch(e){console.log("HISTORY_UNREADABLE",String(e))}
const q=new URLSearchParams({SERVICE:"WMTS",REQUEST:"GetTile",VERSION:"1.0.0",
 LAYER:"atm_surf_air_precip_reflectivity_dbz",STYLE:"default",FORMAT:"image/png",
 TILEMATRIXSET:"GoogleMapsCompatible_BoM",TILEMATRIX:"8",TILEROW:"15",
 TILECOL:"34",time:"2026-10-18T04:35:00Z"});
await inspect("SEQ WMTS 04:35 UTC reported error",root+"/wmts?"+q.toString());
console.log("Done; probe is read-only, no repeated source polling.");
