// One-shot live diagnostic. Never downloaded by the StormTracker browser.
// Runs in CI, at most five fixed upstream GETs, with 7-second timeouts.
const upstream="https://api.bom.gov.au/apikey/v1/mapping/timeseries/wmts";
const relay="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/wmts";
const at=Date.now()-15*60000;
const time=new Date(Math.floor(at/300000)*300000).toISOString().replace(".000Z","Z");
const requests=[
  ["UPSTREAM capabilities",upstream,{SERVICE:"WMTS",REQUEST:"GetCapabilities",VERSION:"1.0.0"}],
  ["UPSTREAM z0 tile",upstream,{SERVICE:"WMTS",REQUEST:"GetTile",VERSION:"1.0.0",LAYER:"atm_surf_air_precip_reflectivity_dbz",STYLE:"default",FORMAT:"image/png",TILEMATRIXSET:"GoogleMapsCompatible_BoM",TILEMATRIX:"0",TILEROW:"0",TILECOL:"0",time}],
  ["UPSTREAM z8 tile",upstream,{SERVICE:"WMTS",REQUEST:"GetTile",VERSION:"1.0.0",LAYER:"atm_surf_air_precip_reflectivity_dbz",STYLE:"default",FORMAT:"image/png",TILEMATRIXSET:"GoogleMapsCompatible_BoM",TILEMATRIX:"8",TILEROW:"15",TILECOL:"34",time}],
  ["RELAY z0 tile",relay,{SERVICE:"WMTS",REQUEST:"GetTile",VERSION:"1.0.0",LAYER:"atm_surf_air_precip_reflectivity_dbz",STYLE:"default",FORMAT:"image/png",TILEMATRIXSET:"GoogleMapsCompatible_BoM",TILEMATRIX:"0",TILEROW:"0",TILECOL:"0",time}],
  ["RELAY z8 tile",relay,{SERVICE:"WMTS",REQUEST:"GetTile",VERSION:"1.0.0",LAYER:"atm_surf_air_precip_reflectivity_dbz",STYLE:"default",FORMAT:"image/png",TILEMATRIXSET:"GoogleMapsCompatible_BoM",TILEMATRIX:"8",TILEROW:"15",TILECOL:"34",time}]
];
console.log("UTC",new Date().toISOString(),"tile timestamp",time);
for(const [label,base,p] of requests) {
  const u=new URL(base);
  for(const [key,val] of Object.entries(p))u.searchParams.set(key,val);
  try{
    const r=await fetch(u,{signal:AbortSignal.timeout(7000),headers:{Accept:"application/xml,image/png,*/*"}});
    const type=r.headers.get("content-type")||"";
    let excerpt;
    if(/image\/png/i.test(type)&&r.ok)excerpt="genuine PNG bytes";
    else {
      const raw=(await r.text()).slice(0,750000);
      if(label.includes("capabilities")&&r.ok){
        const layer=raw.indexOf("atm_surf_air_precip_reflectivity_dbz");
        excerpt="capabilities bytes "+raw.length+" reflectivity layer offset "+layer;
        if(layer>=0){
          const context=raw.slice(Math.max(0,layer-800),layer+3500);
          excerpt+=" sample="+context.replace(/\s+/g," ").slice(0,2200);
        }
      } else excerpt=raw.replace(/\s+/g," ").slice(0,900);
    }
    console.log(label, "status",r.status,"content-type",type,"response",excerpt);
  }catch(e){console.log(label,"network/timeout",e?.message??String(e));}
}
