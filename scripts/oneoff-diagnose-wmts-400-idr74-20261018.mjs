// One-shot diagnostic: no recurring BoM probing.
const base="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev";
const common={SERVICE:"WMTS",REQUEST:"GetTile",VERSION:"1.0.0",LAYER:"atm_surf_air_precip_reflectivity_dbz",STYLE:"default",FORMAT:"image/png",TILEMATRIXSET:"GoogleMapsCompatible_BoM",TILEMATRIX:"8",TILEROW:"15",TILECOL:"34"};
async function check(name,url,json=false){
 try{
  const r=await fetch(url,{headers:{Origin:"https://blakesmith-intel.github.io"},signal:AbortSignal.timeout(11000)});
  const mime=r.headers.get("content-type")||"";
  const txt=(mime.includes("image/")?"":(await r.text()));
  if(mime.includes("image/"))await r.body?.cancel();
  console.log(JSON.stringify({name,status:r.status,mime,body:txt.slice(0,1000),cors:r.headers.get("access-control-allow-origin")}));
  return json?txt:null;
 }catch(e){console.log(JSON.stringify({name,error:String(e)}));return null;}
}
const caps=await check("BoM WMTS GetCapabilities",base+"/wmts?SERVICE=WMTS&REQUEST=GetCapabilities&VERSION=1.0.0&LAYER=atm_surf_air_precip_reflectivity_dbz",true);
try{
 const {parsePublishedReflectivityTimes}=await import("../frontend/src/bom-wmts-published-times-v1.js");
 const times=parsePublishedReflectivityTimes(caps);
 console.log(JSON.stringify({publishedTimes:times,now:new Date().toISOString()}));
 const q=new URLSearchParams({...common,time:times.at(-1)});
 await check("last published sample WMTS tile",base+"/wmts?"+q.toString());
}catch(e){console.log("CAPS_PARSE",String(e));}
for(const time of ["2026-10-18T05:50:00Z","2026-10-18T05:55:00Z","2026-10-18T06:00:00Z"]){
 const q=new URLSearchParams({...common,time});
 await check("historical WMTS "+time,base+"/wmts?"+q.toString());
}
const hist=await check("IDR74I advertised Doppler loop",base+"/radar-history?product=IDR74I",true);
try{
 const frames=JSON.parse(hist).frames;
 console.log("IDR74_HISTORY",JSON.stringify(frames.map(f=>f.filename)));
 for(const filename of [...new Set(["IDR74I.T.202610180553.png","IDR74I.T.202610180608.png",frames?.at(-1)?.filename])].filter(Boolean)){
  await check("IDR74 "+filename,base+"/radar-frame?product=IDR74I&file="+encodeURIComponent(filename));
 }
}catch(e){console.log("IDR74_PARSE",String(e))}
