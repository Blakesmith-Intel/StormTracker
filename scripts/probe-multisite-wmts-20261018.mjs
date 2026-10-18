// ONE-SHOT source audit; remove CI step after reading results.
const root="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev";
const api="https://api.bom.gov.au/apikey/v1/mapping/timeseries/wmts";
const layer="atm_surf_air_precip_reflectivity_dbz";
async function fetchSummary(label,url,{xml=false,method="GET"}={}){
 try{
   const r=await fetch(url,{method,headers:{Origin:"https://blakesmith-intel.github.io",Accept:"*/*"},
      signal:AbortSignal.timeout(11000)});
   const ct=r.headers.get("content-type")||"";
   let body="";
   if(xml){body=(await r.text()).slice(0,4_000_000);}
   else if(ct.includes("json")||ct.includes("text")){
      body=(await r.text()).slice(0,800);
   }else await r.body?.cancel();
   const out={label,status:r.status,type:ct,bytes:body.length,
      cors:r.headers.get("access-control-allow-origin")};
   if(xml){
      const ix=body.indexOf(layer),lower=body.toLowerCase();
      out.hasLayer=ix>=0;out.timeCount=(lower.match(/<ows:identifier>time<\/ows:identifier>|<identifier>time<\/identifier>/g)||[]).length;
      out.layerSnippet=ix>=0?body.slice(Math.max(0,ix-180),ix+3500):body.slice(0,700);
      const pos=lower.indexOf("dimension",Math.max(0,ix));out.dimensionSnippet=pos>=0?body.slice(pos,pos+3200):"";
      const matches=[...body.matchAll(/\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?Z/g)].map(m=>m[0]);
      out.observationTimes=[...new Set(matches)].slice(-18);
   }else out.body=body.slice(0,210);
   console.log(JSON.stringify(out));
   return body;
 }catch(e){console.log(JSON.stringify({label,error:String(e)}));return null;}
}
const caps=new URL(root+"/wmts");
for(const [k,v] of Object.entries({LAYER:layer,SERVICE:"WMTS",REQUEST:"GetCapabilities",VERSION:"1.0.0"}))caps.searchParams.set(k,v);
await fetchSummary("Existing relay WMTS GetCapabilities",caps,{xml:true});
await fetchSummary("BoM API WMTS GetCapabilities",api+"?SERVICE=WMTS&REQUEST=GetCapabilities&VERSION=1.0.0",{xml:true});
for(const product of ["IDR19I","IDR22I","IDR50I","IDR66I","IDR75I","IDR08I","IDR93I"]){
 const payload=await fetchSummary(product+" Doppler loop",root+"/radar-history?product="+product);
 let frames=[];
 try{frames=JSON.parse(payload).frames||[];}catch{}
 if(frames.length){
   const f=frames.at(-2)||frames.at(-1);
   await fetchSummary(product+" sample PNG",root+"/radar-frame?product="+product+"&file="+encodeURIComponent(f.filename));
 }
}
console.log("ONE SHOT multisite audit finished");
