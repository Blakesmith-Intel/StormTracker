// Read-only operational diagnostic. Distinguishes the actual BoM bulletin,
// relay cache and optional recent-history observations BY OFFICIAL STATION ID.
// Never infer readings or match by a nearby station name.
const base="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev";
const summary=[];
for(const path of ["/river-height-bulletins","/river-gauge-metadata"]){
 try{
  const url=base+path+"?stormtracker_qa="+Date.now();
  const r=await fetch(url,{headers:{Origin:"https://blakesmith-intel.github.io",Accept:"application/json"},signal:AbortSignal.timeout(30000)});
  const text=await r.text();
  if(!r.ok){console.log("SOURCE_HTTP",path,r.status,text.slice(0,150));continue;}
  const j=JSON.parse(text);
  console.log("FETCHED",path,r.status,"Age",r.headers.get("age"),"Date",r.headers.get("date"),"Cache",r.headers.get("cache-control"),
   "Loaded",j.loaded_at,"Partial",j.partial,"FailedProducts",j.failed?.map(x=>x.product));
  if(path.includes("bulletins")){
   for(const p of j.products??[])for(const o of p.observations??[]){
    if(/panorama\s*(?:ck|creek)|tarana\s*crossing/i.test(o.stationName??"")){
     const entry={product:p.product,station:o.stationName,stationId:o.stationId,
       height:o.heightMetres,observedText:o.observedText,flood:o.floodClass,
       link:o.recentDataHref,source:p.source};summary.push(entry);console.log("BULLETIN_STATION",JSON.stringify(entry));
    }
   }
  }else{
   for(const f of j.features??[]){let p=f.properties??{};
    if(/panorama\s*(?:ck|creek)|tarana\s*crossing/i.test(p.name??""))
     console.log("METADATA_STATION",JSON.stringify({name:p.name,bom:p.bom_stn_num,awrc:p.awrc_stateid,
       geometry:f.geometry?.coordinates,classification:p.forecast_site_classification}));
   }
  }
 }catch(e){console.log("FETCH_FAILURE",path,String(e));}
}
const seen=new Set();
for(const e of summary){
 const m=String(e.link??"").match(/(IDQ\d+)\.(\d{5,7})\.plt\.shtml/);
 if(!m){console.log("HISTORY_LINK_MISSING",e.station,e.stationId);continue;}
 const key=m[1]+":"+m[2];if(seen.has(key))continue;seen.add(key);
 try{
  const u=new URL(base+"/river-recent-history");u.searchParams.set("product",m[1]);u.searchParams.set("station",m[2]);
  u.searchParams.set("stormtracker_qa",String(Date.now()));
  const r=await fetch(u,{headers:{Origin:"https://blakesmith-intel.github.io"},signal:AbortSignal.timeout(30000)});
  const data=await r.json();
  console.log("RECENT_STATION",JSON.stringify({from:e.station,source:key,status:r.status,
   availability:data.availability,reason:data.code||data.message,
   latest:(data.samples??[]).slice(-4),cacheAge:r.headers.get("Age")}));
 }catch(err){console.log("RECENT_STATION_FAILURE",key,String(err));}
}
