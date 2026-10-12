// Same-origin, public NSW place-name snapshot for BoM radar coverage.
// Official NSW ArcGIS TopoBaseMap query services omit Access-Control-Allow-Origin
// for browser applications. A small JSON snapshot built by GitHub Actions and
// hosted at the SAME Pages origin avoids proxies, accounts and CORS entirely.
// The QLD Cesium foreground renderer retains ownership of all DOM labels.
export const NSW_RADAR_PLACE_CATALOGUE_SCHEMA = "StormTrackerNSWRadarPlacesV1";
export const NSW_RADAR_PLACE_CATALOGUE_URL =
  new URL("../../data/nsw-radar-places-v1.json",import.meta.url).href;
const kinds=new Set(["city","town","village","locality"]);
const pendingByFetch=new WeakMap();

export function normaliseNswRadarPlaceCatalogue(payload){
  if(payload?.schema!==NSW_RADAR_PLACE_CATALOGUE_SCHEMA ||
     !Array.isArray(payload.places))
    throw new TypeError("Official NSW radar-area place-name snapshot invalid");
  const seen=new Set();
  const out=[];
  for(const item of payload.places){
    const id=String(item?.id??"");
    const name=String(item?.name??"").trim();
    const kind=String(item?.kind??"");
    const longitude=Number(item?.longitude),latitude=Number(item?.latitude);
    if(!id.startsWith("nsw-"+kind+":") || !kinds.has(kind) ||
       seen.has(id) || !name || !Number.isFinite(latitude)||
       !Number.isFinite(longitude) || latitude<-38 || latitude>-27 ||
       longitude<140.5 || longitude>159.5)continue;
    seen.add(id);
    const population=Number(item.population);
    out.push({
      id,name,kind,longitude,latitude,
      population:Number.isFinite(population)&&population>0?
        Math.round(population):0,
      isMajor:kind==="city",fromNsw:true
    });
  }
  if(out.length<3)throw new Error("NSW place-name snapshot contains too few valid locations");
  return out;
}

export async function fetchNswRadarPlaceCatalogue({
  fetchImpl=globalThis.fetch,url=NSW_RADAR_PLACE_CATALOGUE_URL
}={}){
  if(typeof fetchImpl!=="function")throw new TypeError("NSW catalogue fetch unavailable");
  const cached=pendingByFetch.get(fetchImpl);
  if(cached?.url===url)return cached.promise;
  const task=(async()=>{
    const response=await fetchImpl(url,{headers:{Accept:"application/json"}});
    if(!response.ok)throw new Error("Same-origin NSW place-name snapshot HTTP "+response.status);
    return normaliseNswRadarPlaceCatalogue(await response.json());
  })();
  pendingByFetch.set(fetchImpl,{url,promise:task});
  try{return await task;}
  catch(error){
    if(pendingByFetch.get(fetchImpl)?.promise===task)pendingByFetch.delete(fetchImpl);
    throw error;
  }
}
