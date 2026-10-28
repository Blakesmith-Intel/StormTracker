// One-off post-Cloudflare-hotfix public endpoint verification, 28 Oct 2026.
const url="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/bom-official-warning-polygons";
let response=null;
try{
 response=await fetch(url,{signal:AbortSignal.timeout(48000),
  headers:{Origin:"https://blakesmith-intel.github.io",Accept:"application/json"},cache:"no-store"});
 const txt=await response.text();
 let json=null;try{json=JSON.parse(txt);}catch{}
 console.log("LIVE_RELAY",JSON.stringify({
  status:response.status,length:txt.length,contentType:response.headers.get("content-type"),
  schema:json?.schema,feedStatus:json?.status,checkedAt:json?.checkedAt,
  sourceFailures:json?.sourceFailures,gisFailures:json?.gisFailures,
  errorMessage:json?.message,sourceComplete:json?.sourceComplete,
  products:Object.fromEntries(Object.entries(json?.products??{}).map(([code,entry])=>
   [code,{status:entry.status,issuedUtc:entry.issuedUtc,expiresUtc:entry.expiresUtc,count:entry.count}])),
  warnings:json?.warnings?.map(w=>({
   code:w.productCode,sourceProduct:w.sourceProduct,id:w.id,
   lgaStatus:w.lgaStatus,lgaCount:w.lgas?.length,
   ddmgStatus:w.ddmgStatus,ddmgCount:w.ddmgs?.length,
   vertices:w.geometry?.coordinates?.[0]?.[0]?.length
  })),
  shortResponse:json?undefined:txt.slice(0,450)
 }));
}catch(e){console.log("LIVE_RELAY_ERROR",String(e).slice(0,280));process.exitCode=1;}
