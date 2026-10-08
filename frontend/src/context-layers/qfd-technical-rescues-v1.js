// QFD ESCAD Current Incidents Public: general-area incident coordinates only.
// GroupedType is a PUBLIC grouped classification, not an internal job subtype.
// Never infer an exact water rescue, vertical rescue, SES attendance or closure.
export const QFD_ESCAD_ENDPOINT =
  "https://services1.arcgis.com/vkTwD8kHw2woKBqV/arcgis/rest/services/ESCAD_Current_Incidents_Public/FeatureServer/0/query";
export const QFD_SOURCE_URL = "https://www.fire.qld.gov.au/Incident-Dashboard";
export const QFD_REFRESH_MS = 10 * 60 * 1000;
export const QFD_MAX_SNAPSHOT_MS = 30 * 60 * 1000;

export const QFD_PUBLIC_GROUPS = Object.freeze({
  "RESCUE TECHNICAL": Object.freeze({
    label:"Technical rescue", category:"technical-rescue", color:"#c78aff"
  }),
  "RESCUE ROAD CRASH": Object.freeze({
    label:"Road crash rescue", category:"road-crash-rescue", color:"#ffae50"
  }),
  "ASSIST PUBLIC": Object.freeze({
    label:"Public assistance", category:"public-assistance", color:"#52d6a1"
  })
});
export const QFD_PUBLIC_GROUP_NAMES = Object.freeze(Object.keys(QFD_PUBLIC_GROUPS));
const PAGE_SIZE = 500;
const MAX_PAGES = 4;
const MIN_LONGITUDE = 137.5, MAX_LONGITUDE = 154;
const MIN_LATITUDE = -29.6, MAX_LATITUDE = -9;
const RETIRED = /^(?:closed|complete|completed|cancelled|canceled|finalised|finalized|stood down|resolved|finished)$/i;

export function qfdPublicIncidentUrl(offset=0, base=QFD_ESCAD_ENDPOINT) {
  if (!Number.isInteger(offset) || offset < 0 || offset % PAGE_SIZE !== 0)
    throw new RangeError("QFD offset must use bounded page sizes");
  const u=new URL(base);
  // This is an allowlist: no other GroupedType should ever enter the map.
  u.search=new URLSearchParams({
    where:"GroupedType IN ('RESCUE TECHNICAL','RESCUE ROAD CRASH','ASSIST PUBLIC')",
    outFields:"OBJECTID,Master_Incident_Number,Response_Date,LastUpdate,CurrentStatus,GroupedType,Locality,Location,Jurisdiction,VehiclesAssigned,VehiclesOnRoute,VehiclesOnScene",
    returnGeometry:"true",outSR:"4326",orderByFields:"OBJECTID ASC",
    resultOffset:String(offset),resultRecordCount:String(PAGE_SIZE),f:"geojson"
  }).toString();
  return u.href;
}

function qfdTime(value) {
  if (value == null || value === "") return null;
  const n=Number(value);
  const parsed=Number.isFinite(n)&&String(value).trim()!=="" ? n : Date.parse(String(value));
  if (!Number.isFinite(parsed) || parsed <= 0 || Math.abs(parsed)>8.64e15) return null;
  return new Date(parsed).toISOString();
}
function limitedText(value,max=100) {
  return String(value??"").trim().slice(0,max);
}
function validCoordinate(point) {
  if (!Array.isArray(point) || point.length < 2) return false;
  const lon=Number(point[0]),lat=Number(point[1]);
  return Number.isFinite(lon)&&Number.isFinite(lat)&&
    lon>=MIN_LONGITUDE&&lon<=MAX_LONGITUDE&&lat>=MIN_LATITUDE&&lat<=MAX_LATITUDE;
}

export function normaliseQfdPublicIncidents(payload) {
  if(payload?.error)throw new Error(limitedText(payload.error.message||"QFD ESCAD service error"));
  if(payload?.type!=="FeatureCollection"||!Array.isArray(payload.features))
    throw new Error("QFD ESCAD GeoJSON FeatureCollection unavailable");
  const found=new Map();
  for(const f of payload.features) {
    const p=f?.properties??{};
    const group=limitedText(p.GroupedType,60).toUpperCase();
    const type=QFD_PUBLIC_GROUPS[group];
    if(!type)continue; // Client-side defence if provider filtering ever changes.
    if(f?.geometry?.type!=="Point"||!validCoordinate(f.geometry.coordinates))continue;
    if(RETIRED.test(limitedText(p.CurrentStatus)))continue;
    const id=limitedText(p.Master_Incident_Number||p.OBJECTID,110);
    if(!id)continue;
    const value={
      id,groupedType:group,category:type.category,groupLabel:type.label,
      subtypeVerified:false,
      locality:limitedText(p.Locality||"Queensland",85),
      location:limitedText(p.Location,100),
      jurisdiction:limitedText(p.Jurisdiction,100),
      status:limitedText(p.CurrentStatus||"Current QFD incident",65),
      responseAt:qfdTime(p.Response_Date),
      lastUpdatedAt:qfdTime(p.LastUpdate),
      // Never recalculate exact rescue addresses from the published general area.
      longitude:Number(f.geometry.coordinates[0]),
      latitude:Number(f.geometry.coordinates[1]),
      vehiclesAssigned:Math.max(0,Math.trunc(Number(p.VehiclesAssigned)||0)),
      vehiclesOnRoute:Math.max(0,Math.trunc(Number(p.VehiclesOnRoute)||0)),
      vehiclesOnScene:Math.max(0,Math.trunc(Number(p.VehiclesOnScene)||0))
    };
    const old=found.get(id);
    if(!old || (Date.parse(value.lastUpdatedAt??"")||0)>=(Date.parse(old.lastUpdatedAt??"")||0))
      found.set(id,value);
  }
  return [...found.values()];
}

export function qfdPublicGroupCounts(features) {
  const counts=Object.fromEntries(QFD_PUBLIC_GROUP_NAMES.map(name=>[name,0]));
  for(const feature of features??[])if(Object.hasOwn(counts,feature.groupedType))
    counts[feature.groupedType]++;
  return counts;
}

// The public GroupedType set permits broad operational incident mapping,
// but does NOT identify specific swift-water, vertical or mountain jobs.
export function qfdRescueSubtypeAvailability() {
  return Object.freeze({swiftWater:false,vertical:false,technicalUnspecified:true});
}

export async function fetchQfdPublicIncidents({
  fetchImpl=globalThis.fetch, endpoint=QFD_ESCAD_ENDPOINT, timeoutMs=12000
}={}) {
  if(typeof fetchImpl!=="function")throw new Error("Browser fetch is unavailable");
  const abort=typeof AbortController==="function"?new AbortController():null;
  const timer=abort?setTimeout(()=>abort.abort(),timeoutMs):null;
  try{
    const results=new Map();
    for(let page=0;page<MAX_PAGES;page++) {
      const response=await fetchImpl(qfdPublicIncidentUrl(page*PAGE_SIZE,endpoint),{
        signal:abort?.signal,headers:{Accept:"application/geo+json,application/json"},
        cache:"no-store"
      });
      if(!response.ok)throw new Error("QFD ESCAD HTTP "+response.status);
      const payload=await response.json();
      if(payload?.error||payload?.type!=="FeatureCollection"||!Array.isArray(payload.features))
        throw new Error("QFD ESCAD returned invalid data");
      for(const item of normaliseQfdPublicIncidents(payload))results.set(item.id,item);
      // Never publish a partly retrieved snapshot.
      if(payload.features.length<PAGE_SIZE&&payload.exceededTransferLimit!==true)
        return [...results.values()];
    }
    throw new Error("QFD ESCAD pagination limit reached; refusing incomplete incidents");
  }finally{if(timer!==null)clearTimeout(timer);}
}
