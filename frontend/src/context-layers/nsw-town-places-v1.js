// NSW Spatial Services public, official population centre points. The API is
// queried directly by the browser; no proxy, paid account or static snapshots.
// These identifiers are prefixed to avoid collisions with Queensland objectids.
export const NSW_TOWNS_QUERY_URL =
  "https://spatial.industry.nsw.gov.au/arcgis/rest/services/PUBLIC/TopoBaseMap/MapServer/1/query";
export const NSW_CITY_QUERY_URL =
  "https://spatial.industry.nsw.gov.au/arcgis/rest/services/PUBLIC/TopoBaseMap/MapServer/0/query";
export const NSW_VILLAGES_QUERY_URL =
  "https://spatial.industry.nsw.gov.au/arcgis/rest/services/PUBLIC/TopoBaseMap/MapServer/2/query";
export const NSW_SETTLEMENT_LAYERS = Object.freeze([
  Object.freeze({id:0,url:NSW_CITY_QUERY_URL,kind:"city"}),
  Object.freeze({id:1,url:NSW_TOWNS_QUERY_URL,kind:"town"}),
  Object.freeze({id:2,url:NSW_VILLAGES_QUERY_URL,kind:"village"})
]);
export const NSW_TOWNS_PAGE_SIZE = 1000;
export const NSW_TOWNS_MAX_PAGES = 12;
const NSW = Object.freeze({west:140.5,east:159.3,south:-38,north:-27.5});

export function nswTownsQueryUrl({
  offset=0,pageSize=NSW_TOWNS_PAGE_SIZE,baseUrl=NSW_TOWNS_QUERY_URL,
  kind="town"
}={}) {
  const params=new URLSearchParams({
    where:"generalname IS NOT NULL",
    outFields:kind==="town"
      ?"objectid,generalname,population,placetype_desc"
      :"objectid,generalname",
    returnGeometry:"true",outSR:"4326",
    orderByFields:"objectid ASC",
    resultOffset:String(offset),resultRecordCount:String(pageSize),
    f:"geojson"
  });
  return baseUrl+"?"+params.toString();
}
export function normaliseNswTowns(payload,{kind="town"}={}) {
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
      id:"nsw-"+kind+":"+objectid,name,longitude:lon,latitude:lat,
      population:Number.isFinite(population)&&population>0?Math.round(population):0,
      isMajor:kind==="city",fromNsw:true
    });
  }
  return [...items.values()];
}
async function fetchNswSettlementLayer({
  fetchImpl,baseUrl,kind,pageSize,maxPages,timeoutMs
}) {
  const places=new Map();
  let complete=false;
  for(let page=0;page<maxPages;page++){
    const controller=typeof AbortController==="function"?new AbortController():null;
    const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
    let payload;
    try{
      const response=await fetchImpl(nswTownsQueryUrl({
        offset:page*pageSize,pageSize,baseUrl,kind
      }),{headers:{Accept:"application/geo+json,application/json"},signal:controller?.signal});
      if(!response.ok)throw Error("NSW "+kind+" HTTP "+response.status);
      payload=await response.json();
    }finally{if(timer!==null)clearTimeout(timer);}
    for(const item of normaliseNswTowns(payload,{kind}))places.set(item.id,item);
    if(payload.features.length<pageSize||payload.exceededTransferLimit===false){
      complete=true;break;
    }
  }
  if(!complete)throw Error("NSW "+kind+" pagination exceeded limit; not publishing partial places");
  return [...places.values()];
}
export async function fetchNswTowns({
  fetchImpl=globalThis.fetch,
  pageSize=NSW_TOWNS_PAGE_SIZE,maxPages=NSW_TOWNS_MAX_PAGES,timeoutMs=18000
}={}) {
  if(typeof fetchImpl!=="function")throw Error("NSW town fetch unavailable");
  // City, town and village are distinct authoritative source layers. Run
  // concurrently; temporary failure of one cannot erase the other two.
  const results=await Promise.allSettled(NSW_SETTLEMENT_LAYERS.map(layer=>
    fetchNswSettlementLayer({fetchImpl,baseUrl:layer.url,kind:layer.kind,
      pageSize,maxPages,timeoutMs})));
  const records=[],failures=[];
  for(let i=0;i<results.length;i++){
    const result=results[i];
    if(result.status==="fulfilled")records.push(...result.value);
    else failures.push(NSW_SETTLEMENT_LAYERS[i].kind+": "+result.reason?.message);
  }
  if(!records.length)throw Error("NSW cities, towns and villages unavailable: "+failures.join("; "));
  if(failures.length)console.warn("Some NSW settlement classes temporarily unavailable",failures);
  return records;
}
