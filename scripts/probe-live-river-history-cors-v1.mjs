// One-time GitHub Actions diagnostic of public relay responses. It does NOT
// poll, and an optional source outage must never fail the radar deployment.
const base="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/river-recent-history";
const origin="https://blakesmith-intel.github.io";
async function probe(label,query){
  const url=base+"?"+new URLSearchParams(query);
  try{
    const r=await fetch(url,{
      headers:{Origin:origin,Accept:"application/json"},
      signal:AbortSignal.timeout(16000)
    });
    const code=r.headers.get("x-stormtracker-error-code")||"";
    const cors=r.headers.get("access-control-allow-origin")||"";
    const type=r.headers.get("content-type")||"";
    const sample=(await r.text()).slice(0,200).replace(/\s+/g," ");
    console.log(JSON.stringify({probe:label,status:r.status,cors,code,
      contentType:type,bodyPreview:sample}));
    return {status:r.status,cors,code};
  }catch(error){
    console.log(JSON.stringify({probe:label,
      transportError:String(error?.message??error)}));
    return null;
  }
}
const invalid=await probe("Worker CORS on invalid station",{
  product:"IDQ65392",station:"bad"
});
if(!invalid || invalid.status!==400 ||
  invalid.cors!==origin) {
  console.log("::warning::Relay health/CORS check not confirmed on invalid request; inspect deployed Worker and Cloudflare edge");
}
const optional=await probe("Optional BoM recent history station 539075",{
  product:"IDQ65392",station:"539075"
});
if(!optional || optional.cors!==origin){
  console.log("::warning::Optional river history currently has an edge/transport CORS failure; source history unavailable, official flood bulletins unaffected");
}else if(optional.status!==200){
  console.log("::warning::Optional river history returned HTTP "+
    optional.status+" with valid Worker CORS; check upstream/code before enabling higher request volume");
}
