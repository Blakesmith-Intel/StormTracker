// Nearby NSW official locality names from NSW Spatial Services TopoBaseMap.
// The same viewport-only/small-zoom rule as the Queensland gazetteer avoids
// pulling thousands of distant names and keeps mobile playback responsive.
export const NSW_LOCALITY_QUERY_URL =
  "https://spatial.industry.nsw.gov.au/arcgis/rest/services/PUBLIC/TopoBaseMap/MapServer/3/query";
export const NSW_LOCALITY_BOUNDS = Object.freeze({
  west:140.5,east:159.3,south:-38,north:-27.5
});
const NSW_LOCALITY_LIMIT=900;
export function nswLocalityViewBounds(camera,CesiumRef,ellipsoid) {
  if(typeof camera?.computeViewRectangle!=="function" ||
    typeof CesiumRef?.Math?.toDegrees!=="function" ||
    Number(camera?.positionCartographic?.height)>250000)return null;
  const rect=camera.computeViewRectangle(ellipsoid);
  if(!rect)return null;
  const toDeg=CesiumRef.Math.toDegrees;
  const r={west:toDeg(rect.west),east:toDeg(rect.east),
    south:toDeg(rect.south),north:toDeg(rect.north)};
  if(!Object.values(r).every(Number.isFinite)||r.west>=r.east||
    r.south>=r.north||r.east-r.west>5||r.north-r.south>4)return null;
  const b=NSW_LOCALITY_BOUNDS;
  const clipped={west:Math.max(r.west,b.west),east:Math.min(r.east,b.east),
    south:Math.max(r.south,b.south),north:Math.min(r.north,b.north)};
  return clipped.west<clipped.east&&clipped.south<clipped.north?clipped:null;
}
export function expandNswLocalityBounds(b) {
  const {west,east,south,north}=NSW_LOCALITY_BOUNDS;
  const x=Math.max(.12,(b.east-b.west)*.35);
  const y=Math.max(.12,(b.north-b.south)*.35);
  return {west:Math.max(west,b.west-x),east:Math.min(east,b.east+x),
    south:Math.max(south,b.south-y),north:Math.min(north,b.north+y)};
}
export function nswLocalityQueryUrl(bounds,baseUrl=NSW_LOCALITY_QUERY_URL) {
  if(!bounds||!Object.values(bounds).every(Number.isFinite)||
    bounds.west>=bounds.east||bounds.south>=bounds.north)throw TypeError("NSW bounds required");
  const params=new URLSearchParams({
    where:"generalname IS NOT NULL",
    geometry:[bounds.west,bounds.south,bounds.east,bounds.north].join(","),
    geometryType:"esriGeometryEnvelope",
    spatialRel:"esriSpatialRelIntersects",
    inSR:"4326",outFields:"objectid,generalname",returnGeometry:"true",outSR:"4326",
    orderByFields:"objectid ASC",
    resultRecordCount:String(NSW_LOCALITY_LIMIT),f:"geojson"
  });
  return baseUrl+"?"+params.toString();
}
export function normaliseNswLocalities(payload) {
  if(payload?.error)throw Error(payload.error.message??"NSW locality query failed");
  if(!Array.isArray(payload?.features))throw TypeError("NSW locality GeoJSON features missing");
  if(payload.exceededTransferLimit===true||payload.features.length>=NSW_LOCALITY_LIMIT)
    throw Error("NSW localities exceeded bounded query limit");
  const unique=new Map();
  for(const f of payload.features){
    if(f?.geometry?.type!=="Point")continue;
    const id=Number(f.properties?.objectid??f.id);
    const name=String(f.properties?.generalname??"").trim();
    const lon=Number(f.geometry.coordinates?.[0]),lat=Number(f.geometry.coordinates?.[1]);
    const b=NSW_LOCALITY_BOUNDS;
    if(!Number.isInteger(id)||!name||!Number.isFinite(lon)||!Number.isFinite(lat)||
       lon<b.west||lon>b.east||lat<b.south||lat>b.north)continue;
    unique.set(id,{id:"nsw-locality:"+id,name,longitude:lon,latitude:lat,
      population:0,priority:44,fromNsw:true,kind:"LOCALITY"});
  }
  return [...unique.values()];
}
export async function fetchNswNearbyLocalities({
  bounds,fetchImpl=globalThis.fetch,timeoutMs=13000,baseUrl=NSW_LOCALITY_QUERY_URL
}={}) {
  if(typeof fetchImpl!=="function")throw Error("NSW locality fetch unavailable");
  const controller=typeof AbortController==="function"?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
  try{
    const response=await fetchImpl(nswLocalityQueryUrl(bounds,baseUrl),{
      headers:{Accept:"application/geo+json,application/json"},signal:controller?.signal
    });
    if(!response.ok)throw Error("NSW locality HTTP "+response.status);
    return normaliseNswLocalities(await response.json());
  }finally{if(timer!==null)clearTimeout(timer);}
}
