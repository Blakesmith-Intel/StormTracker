// Pure source-faithful historical cyclone QA adapter.
// Never display historical observations or archived cyclone wind areas as
// *live* BoM warnings. No interpolation and no synthetic warning polygons.
export const HISTORICAL_CYCLONE_IDS=Object.freeze(["koji-2026","yasi-2011"]);
const windTypes=new Set(["Damaging","Destructive","Very Destructive"]);
const utcMs=value=>typeof value==="string"&&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value)&&
  Number.isFinite(Date.parse(value))?Date.parse(value):null;
const pointValid=p=>Array.isArray(p)&&p.length>=2&&p.length<=3&&
  Number.isFinite(p[0])&&p[0]>=-180&&p[0]<=180&&
  Number.isFinite(p[1])&&p[1]>=-90&&p[1]<=90;
function validLine(line){
  return Array.isArray(line)&&line.length>=2&&line.length<20000&&line.every(pointValid);
}
function validPolygon(rings){
  return Array.isArray(rings)&&rings.length>=1&&rings.length<100&&
    rings.every(r=>Array.isArray(r)&&r.length>=4&&r.length<=20000&&
      r.every(pointValid)&&r[0][0]===r.at(-1)[0]&&r[0][1]===r.at(-1)[1]);
}
export function validateHistoricalCycloneBundle(bundle){
  if(!bundle||bundle.schema!=="stormtracker-historical-cyclone-qa-v1"||
    !HISTORICAL_CYCLONE_IDS.includes(bundle.id)||bundle.historical!==true||
    bundle.notLive!==true||!Array.isArray(bundle.sources)||!bundle.sources.length||
    !Array.isArray(bundle.fixes)||bundle.fixes.length<2||
    !Array.isArray(bundle.track)||!bundle.track.length||
    !Array.isArray(bundle.windAreas)||!Array.isArray(bundle.windAreaAvailableTimes))
    throw new Error("Not a verified archived cyclone QA bundle");
  if(bundle.track.some(t=>t?.geometry?.type!=="LineString"||
    !validLine(t.geometry.coordinates)))
    throw new Error("Invalid historical observed/best-track line");
  const ids=new Set();
  for(const f of bundle.fixes){
    if(!f||typeof f.id!=="string"||ids.has(f.id)||
      utcMs(f.utc)===null||!pointValid(f.position))
      throw new Error("Malformed original cyclone fix");
    ids.add(f.id);
  }
  for(const a of bundle.windAreas){
    const coordinates=a?.geometry?.coordinates;
    if(!windTypes.has(a.windType)||utcMs(a.issueUtc)===null||
      (a.geometry.type==="Polygon"?!validPolygon(coordinates):
      a.geometry.type==="MultiPolygon"?!Array.isArray(coordinates)||
        !coordinates.length||!coordinates.every(validPolygon):true))
      throw new Error("Invalid original cyclone wind polygon");
  }
  if(bundle.id==="yasi-2011" && bundle.windAreas.length)
    throw new Error("Yasi archived storm warning polygons are not verified");
  return bundle;
}
export function historicalCycloneMoments(bundle){
  validateHistoricalCycloneBundle(bundle);
  const times=[...new Set([
    ...bundle.fixes.map(f=>f.utc),
    ...bundle.windAreas.map(a=>a.issueUtc)
  ])].sort();
  return times;
}
export function historicalCycloneSnapshot(bundle,utc){
  const moments=historicalCycloneMoments(bundle);
  if(!moments.includes(utc))throw new RangeError("Not an authentic archived observation/issue time");
  const latestFix=bundle.fixes.filter(f=>f.utc<=utc).sort((a,b)=>
    a.utc.localeCompare(b.utc)).at(-1)??null;
  const fixesSoFar=bundle.fixes.filter(f=>f.utc<=utc);
  // Only display polygons that were actually issued at this exact archived
  // issue timestamp. Do not infer a storm radius or an unverified expiry.
  const windAtIssue=bundle.windAreas.filter(a=>a.issueUtc===utc);
  return Object.freeze({
    utc,latestFix,fixesSoFar,windAtIssue,
    isWindIssue:windAtIssue.length>0,
    originalSourceLabel:bundle.id==="koji-2026"?
      "Queensland Government / BoM archived observed cyclone and wind areas":
      "BoM 2011 reanalysed best track (not warning geometry)",
    live:false,forecast:false,officialThunderstormWarning:false
  });
}
export function nestedHistoricalPolygonPositions(geometry,Cesium){
  function one(rings){
    return new Cesium.PolygonHierarchy(
      Cesium.Cartesian3.fromDegreesArray(rings[0].flatMap(p=>p.slice(0,2))),
      rings.slice(1).map(hole=>one([hole]))
    );
  }
  if(geometry.type==="Polygon")return [one(geometry.coordinates)];
  if(geometry.type==="MultiPolygon")return geometry.coordinates.map(one);
  throw new TypeError("Not source polygon geometry");
}
