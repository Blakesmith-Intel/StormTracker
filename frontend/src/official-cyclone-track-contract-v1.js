// StormTracker official tropical-cyclone source boundary.
//
// This pure adapter runs AFTER a source-specific, verified BoM GML/CXML
// decoder has extracted authentic BoM geometry. It cannot fetch, calculate
// or invent a track, uncertainty envelope, watch or warning area.
// Do not connect this module to live UI without a real BoM product fixture.
export const BOM_CYCLONE_GML_PRODUCTS=Object.freeze([
  "IDQ65248","IDQ65249","IDQ65250","IDQ65252",
  "IDD65401","IDD65402","IDD65409",
  "IDW60266","IDW60267","IDW60268"
]);
export const BOM_CYCLONE_ROLES=Object.freeze([
  "observed_track","observed_fix","forecast_track","forecast_fix",
  "uncertainty_area","watch_area","warning_area",
  "gale_wind_area","destructive_wind_area","very_destructive_wind_area"
]);
const TRACK_ROLES=new Set(["observed_track","forecast_track"]);
const FIX_ROLES=new Set(["observed_fix","forecast_fix"]);
const POLYGON_ROLES=new Set(BOM_CYCLONE_ROLES.filter(x=>
  !TRACK_ROLES.has(x)&&!FIX_ROLES.has(x)));

function validUtc(value){
  if(typeof value!=="string"||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value))return null;
  const date=Date.parse(value);
  return Number.isFinite(date)?date:null;
}
function validVertex(vertex){
  return Array.isArray(vertex)&&vertex.length>=2&&vertex.length<=3&&
    Number.isFinite(vertex[0])&&vertex[0]>=-180&&vertex[0]<=180&&
    Number.isFinite(vertex[1])&&vertex[1]>=-90&&vertex[1]<=90 &&
    (vertex.length===2||Number.isFinite(vertex[2]));
}
function lineValid(line){
  return Array.isArray(line)&&line.length>=2&&line.length<=10000&&
    line.every(validVertex);
}
function polygonValid(rings){
  return Array.isArray(rings)&&rings.length>=1&&rings.length<=40&&
    rings.every(ring=>Array.isArray(ring)&&ring.length>=4&&
      ring.length<=10000&&ring.every(validVertex)&&
      ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1]);
}
export function isOfficialCycloneGeometry(geometry,role){
  if(!geometry||typeof geometry!=="object"||!BOM_CYCLONE_ROLES.includes(role))
    return false;
  if(FIX_ROLES.has(role))return geometry.type==="Point"&&validVertex(geometry.coordinates);
  if(TRACK_ROLES.has(role))return geometry.type==="LineString"?
    lineValid(geometry.coordinates):geometry.type==="MultiLineString"&&
      Array.isArray(geometry.coordinates)&&geometry.coordinates.length>0&&
      geometry.coordinates.length<=40&&geometry.coordinates.every(lineValid);
  if(POLYGON_ROLES.has(role))return geometry.type==="Polygon"?
    polygonValid(geometry.coordinates):geometry.type==="MultiPolygon"&&
      Array.isArray(geometry.coordinates)&&geometry.coordinates.length>0&&
      geometry.coordinates.length<=50&&geometry.coordinates.every(polygonValid);
  return false;
}
function safeIssueUrl(url){
  if(typeof url!=="string")return null;
  try{
    const u=new URL(url);
    if(u.protocol!=="https:"||!/(^|\.)bom\.gov\.au$/.test(u.hostname))return null;
    return u.href;
  }catch{return null;}
}
export function validateOfficialCycloneTrackProduct(
  collection,{nowUtc,maxAgeMinutes=720,maxFeatures=250}={}
){
  const now=typeof nowUtc==="number"?nowUtc:validUtc(nowUtc);
  if(!Number.isFinite(now))
    throw new TypeError("Must supply a measured current UTC, not guess product age");
  if(!Number.isFinite(maxAgeMinutes)||maxAgeMinutes<=0)
    throw new RangeError("Invalid source freshness budget");
  const empty=(reason)=>({status:"unavailable",reason,source:"BoM",features:[]});
  if(!collection||collection.type!=="FeatureCollection"||
    !Array.isArray(collection.features)||
    collection.features.length>maxFeatures)return empty("invalid-collection");
  const meta=collection.properties;
  if(!meta||!BOM_CYCLONE_GML_PRODUCTS.includes(meta.productId))
    return empty("unverified-bom-product-id");
  if(meta.publisher!=="Bureau of Meteorology")
    return empty("unverified-source-publisher");
  const issueMs=validUtc(meta.issuedUtc);
  if(issueMs===null||issueMs>now+120000||
    now-issueMs>maxAgeMinutes*60000)
    return empty("stale-or-invalid-issue-time");
  const bulletinUrl=safeIssueUrl(meta.bulletinUrl);
  if(!bulletinUrl)return empty("missing-official-bom-bulletin-link");
  const features=[],seen=new Set();
  for(const feature of collection.features){
    const p=feature?.properties;
    if(feature?.type!=="Feature"||typeof feature.id!=="string"||
      !feature.id.trim()||seen.has(feature.id)||
      !p||typeof p.systemId!=="string"||!p.systemId.trim()||
      !isOfficialCycloneGeometry(feature.geometry,p.role))
      return empty("unverified-official-geometry");
    seen.add(feature.id);
    const fixTime=p.validUtc===undefined?null:validUtc(p.validUtc);
    if(p.validUtc!==undefined && fixTime===null)
      return empty("invalid-fix-utc");
    // BoM map forecasts generally cover through 120 h; do not invent an
    // extended track on this live track map from stale/outlying features.
    if((p.role==="forecast_fix"||p.role==="forecast_track")&&
      fixTime!==null&&(fixTime<issueMs-3600000||fixTime>issueMs+121*3600000))
      return empty("forecast-outside-official-track-horizon");
    if(p.role==="warning_area"||p.role==="watch_area"){
      const expires=validUtc(p.expiresUtc);
      if(expires===null||expires<=now)continue;
    }
    const category=p.category===undefined?null:Number(p.category);
    if(category!==null&&(!Number.isInteger(category)||category<0||category>5))
      return empty("invalid-source-category");
    features.push(Object.freeze({
      id:feature.id,systemId:p.systemId,
      name:typeof p.name==="string"?p.name.slice(0,100):"",
      role:p.role,geometry:feature.geometry,
      category,validUtc:p.validUtc??null,
      expiresUtc:p.expiresUtc??null,
      bulletinUrl
    }));
  }
  return Object.freeze({
    status:features.length?"active":"no-active-products",
    source:"Bureau of Meteorology",productId:meta.productId,
    issuedUtc:meta.issuedUtc,bulletinUrl,
    features:Object.freeze(features)
  });
}
