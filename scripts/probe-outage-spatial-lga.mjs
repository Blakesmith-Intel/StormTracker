// One-off CI/network diagnostic; not called by the browser.
import {officialLgaPointUrl} from "../frontend/src/context-layers/outage-lga-geographic-fallback-v1.js";
const samples=[
 ["Gold Coast",153.270,-27.770],
 ["Giru",147.096,-19.516],
 ["Cloncurry",140.508,-20.707],
 ["Boogan",146.046,-17.578]
];
for(const [label,longitude,latitude] of samples){
 const url=officialLgaPointUrl({longitude,latitude});
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),13000);
 try{
   const r=await fetch(url,{signal:c.signal,headers:{
     Accept:"application/json",Origin:"https://blakesmith-intel.github.io"
   }});
   const raw=await r.text();let payload;
   try{payload=JSON.parse(raw);}catch{payload={html:raw.slice(0,120)};}
   console.log(JSON.stringify({label,http:r.status,
     cors:r.headers.get("access-control-allow-origin"),
     error:payload.error,
     matches:payload.features?.map(f=>f.attributes?.lga).slice(0,5)
   }));
   if(!r.ok||payload.error)process.exitCode=1;
 }catch(e){console.log(JSON.stringify({label,error:e.message}));process.exitCode=1;}
 finally{clearTimeout(timer);}
}
