// NSW Spatial Services public, official population centre points. The API is
// queried directly by the browser; no proxy, paid account or static snapshots.
// These identifiers are prefixed to avoid collisions with Queensland objectids.
export const NSW_TOWNS_QUERY_URL =
  "https://spatial.industry.nsw.gov.au/arcgis/rest/services/PUBLIC/TopoBaseMap/MapServer/1/query";
export const NSW_TOWNS_PAGE_SIZE = 1000;
export const NSW_TOWNS_MAX_PAGES = 12;
const NSW = Object.freeze({west:140.5,east:159.3,south:-38,north:-27.5});

export function nswTownsQueryUrl({
  offset=0,pageSize=NSW_TOWNS_PAGE_SIZE,baseUrl=NSW_TOWNS_QUERY_URL
}={}) {
  const params=new URLSearchParams({
    where:"generalname IS NOT NULL",
    outFields:"objectid,generalname,population,placetype_desc",
    returnGeometry:"true",outSR:"4326",
    orderByFields:"objectid ASC",
    resultOffset:String(offset),resultRecordCount:String(pageSize),
    f:"geojson"
  });
  return baseUrl+"?"+params.toString();
}
export function normaliseNswTowns(payload) {
  if(payload?.error)throw Error(payload.error.message??"NSW towns ArcGIS error");
  if(!Array.isArray(payload?.features))throw Error("NSW towns response is not a FeatureCollection");
  const items=new Map();
  for(const f of payload.features){
    if(f?.geometry?.type!=="Point")continue;
    const p=f.properties??{};
    const name=String(p.generalname??"").trim();
    const objectid=String(p.objectid??f.id??"").trim();
    const lon=Number(f.geometry.coordinates?.[0]),lat=Number(f.geometry.coordinates?.[1]);
    if(!name||!objectid||!Number.isFinite(lat)||!Number.isFinite(lon) ||
       lon<NSW.west||lon>NSW.east||lat<NSW.south||lat>NSW.north)continue;
    const population=Number(p.population);
    items.set(objectid,{
      id:"nsw-town:"+objectid,name,longitude:lon,latitude:lat,
      population:Number.isFinite(population)&&population>0?Math.round(population):0,
      fromNsw:true
    });
  }
  return [...items.values()];
}
export async function fetchNswTowns({
  fetchImpl=globalThis.fetch,baseUrl=NSW_TOWNS_QUERY_URL,
  pageSize=NSW_TOWNS_PAGE_SIZE,maxPages=NSW_TOWNS_MAX_PAGES,timeoutMs=18000
}={}) {
  if(typeof fetchImpl!=="function")throw Error("NSW town fetch unavailable");
  const places=new Map();
  let complete=false;
  for(let page=0;page<maxPages;page++){
    const controller=typeof AbortController==="function"?new AbortController():null;
    const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
    let payload;
    try{
      const response=await fetchImpl(nswTownsQueryUrl({
        offset:page*pageSize,pageSize,baseUrl
      }),{headers:{Accept:"application/geo+json,application/json"},signal:controller?.signal});
      if(!response.ok)throw Error("NSW towns HTTP "+response.status);
      payload=await response.json();
    }finally{if(timer!==null)clearTimeout(timer);}
    for(const item of normaliseNswTowns(payload))places.set(item.id,item);
    if(payload.features.length<pageSize||payload.exceededTransferLimit===false){
      complete=true;break;
    }
  }
  if(!complete)throw Error("NSW towns pagination exceeded limit; not publishing partial place names");
  if(!places.size)throw Error("NSW towns source returned no named settlements");
  return [...places.values()];
}
