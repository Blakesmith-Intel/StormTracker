// One-off nonblocking network diagnostic. Read only; never retries/stresses BoM.
const root="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev";
const opts={headers:{Origin:"https://blakesmith-intel.github.io"},
  signal:AbortSignal.timeout(13000)};
async function inspect(label,url,{body=false}={}){
  try{
    const start=Date.now(),r=await fetch(url,opts);
    const data=body ? await r.text() : (await r.text()).slice(0,280);
    const summary={label,status:r.status,latencyMs:Date.now()-start,
      cors:r.headers.get("access-control-allow-origin"),
      contentType:r.headers.get("content-type"),body:data.slice(0,280)};
    console.log(JSON.stringify(summary));
    return {response:r,data};
  }catch(e){console.log(JSON.stringify({label,error:String(e)}));return null;}
}
const history=await inspect("IDR22I history",root+"/radar-history?product=IDR22I",{body:true});
const html=await inspect("BoM Mackay loop", "https://www.bom.gov.au/products/IDR22I.loop.shtml",{body:true});
const candidates=[];
try{
 const frames=JSON.parse(history.data).frames;
 for(const x of [frames.at(0),frames.at(-2),frames.at(-1)])if(x?.filename)candidates.push(x.filename);
 console.log("HISTORY",JSON.stringify({frames:frames.length,selected:candidates,first:frames.at(0)?.observedUtc,last:frames.at(-1)?.observedUtc}));
}catch(e){console.log("HISTORY_UNREADABLE",String(e))}
for(const name of [...new Set(candidates)]){
 await inspect("Relay "+name,root+"/radar-frame?product=IDR22I&file="+encodeURIComponent(name));
 await inspect("Direct BoM "+name,"https://www.bom.gov.au/radar/"+name);
}
const tiles=`SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=atm_surf_air_precip_reflectivity_dbz&STYLE=default&FORMAT=image%2Fpng&TILEMATRIXSET=GoogleMapsCompatible_BoM&TILEMATRIX=8&TILEROW=15&TILECOL=34&time=2026-10-18T04%3A35%3A00Z`;
await inspect("WMTS observed tile at user error time",root+"/wmts?"+tiles);
console.log("Finished read-only Doppler/WMTS source diagnostics");
