// Browser-only, viewport-bounded supplement of officially gazetted QLD
// localities. Do not bulk-load natural features or download the whole state.
export const QLD_LOCALITY_QUERY_URL =
  "https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Location/QldPlaceNames/MapServer/1/query";
const TYPES = Object.freeze(["LOCB", "LOCU", "POPL", "SUB"]);
const QLD = {west:137.7,south:-29.6,east:154,north:-9};
const RECORD_LIMIT = 1800;

export function qldLocalityViewBounds(camera, CesiumRef, ellipsoid) {
  if (typeof camera?.computeViewRectangle !== "function" ||
      typeof CesiumRef?.Math?.toDegrees !== "function" ||
      Number(camera?.positionCartographic?.height) > 250000) return null;
  const rect = camera.computeViewRectangle(ellipsoid);
  if (!rect) return null;
  const {toDegrees} = CesiumRef.Math;
  const b = {west:toDegrees(rect.west),east:toDegrees(rect.east),
    south:toDegrees(rect.south),north:toDegrees(rect.north)};
  if (!Object.values(b).every(Number.isFinite) || b.west >= b.east ||
      b.south >= b.north || b.east-b.west > 5 || b.north-b.south > 4) return null;
  const bounds = {west:Math.max(QLD.west,b.west),east:Math.min(QLD.east,b.east),
    south:Math.max(QLD.south,b.south),north:Math.min(QLD.north,b.north)};
  return bounds.east>bounds.west && bounds.north>bounds.south ? bounds : null;
}
export function expandLocalityBounds(b) {
  const x=Math.max(0.12,(b.east-b.west)*0.35);
  const y=Math.max(0.12,(b.north-b.south)*0.35);
  return {west:Math.max(QLD.west,b.west-x),east:Math.min(QLD.east,b.east+x),
    south:Math.max(QLD.south,b.south-y),north:Math.min(QLD.north,b.north+y)};
}
export function localityBoundsContain(outer,inner) {
  return !!outer && !!inner && outer.west<=inner.west &&
    outer.east>=inner.east && outer.south<=inner.south && outer.north>=inner.north;
}
export function qldLocalityQueryUrl(bounds,baseUrl=QLD_LOCALITY_QUERY_URL) {
  if (!bounds || !Object.values(bounds).every(Number.isFinite) ||
      bounds.west>=bounds.east || bounds.south>=bounds.north)
    throw new TypeError("Valid locality bounds required");
  const query = new URLSearchParams({
    where:"type IN ('LOCB','LOCU','POPL','SUB') AND place_name IS NOT NULL",
    geometry:[bounds.west,bounds.south,bounds.east,bounds.north].join(","),
    geometryType:"esriGeometryEnvelope",spatialRel:"esriSpatialRelIntersects",
    inSR:"4326",outFields:"objectid,place_name,type",returnGeometry:"true",
    outSR:"4326",orderByFields:"objectid ASC",
    resultRecordCount:String(RECORD_LIMIT),f:"geojson"
  });
  return baseUrl+"?"+query;
}
export function normaliseQldLocalities(payload) {
  if (payload?.error) throw new Error(payload.error.message || "Gazetteer service error");
  if (!Array.isArray(payload?.features)) throw new TypeError("Gazetteer GeoJSON missing features");
  if (payload.exceededTransferLimit === true || payload.features.length>=RECORD_LIMIT)
    throw new Error("Gazetteer locality search exceeded bounded query limit");
  const result = new Map();
  for (const feature of payload.features) {
    if (feature?.geometry?.type !== "Point") continue;
    const p=feature.properties??{};
    const kind=String(p.type??"").toUpperCase().trim();
    const name=String(p.place_name??"").trim();
    const id=Number(p.objectid??feature.id);
    const lon=Number(feature.geometry.coordinates?.[0]);
    const lat=Number(feature.geometry.coordinates?.[1]);
    if (!TYPES.includes(kind) || !name || !Number.isInteger(id) ||
        !Number.isFinite(lon)||!Number.isFinite(lat)||lon<QLD.west||lon>QLD.east||
        lat<QLD.south||lat>QLD.north) continue;
    result.set(id,{id:"gazetteer:"+id,name,longitude:lon,latitude:lat,
      population:0,kind,priority:kind==="POPL"?51:kind==="LOCB"?45:kind==="SUB"?42:39});
  }
  return [...result.values()];
}
export async function fetchQldNearbyLocalities({bounds,fetchImpl=globalThis.fetch,
    timeoutMs=13000,baseUrl=QLD_LOCALITY_QUERY_URL}={}) {
  if (typeof fetchImpl!=="function") throw new Error("Gazetteer fetch unavailable");
  const controller=typeof AbortController==="function"?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
  try {
    const response=await fetchImpl(qldLocalityQueryUrl(bounds,baseUrl),{
      headers:{Accept:"application/geo+json,application/json"},signal:controller?.signal
    });
    if (!response.ok) throw new Error("Gazetteer HTTP "+response.status);
    return normaliseQldLocalities(await response.json());
  } finally {if(timer!==null) clearTimeout(timer);}
}
