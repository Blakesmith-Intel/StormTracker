// Pure normalized geometry boundary for authentic official severe-thunderstorm
// CAP/GIS products. NOT a live warning source: decoding and issuer identity
// need separate verified source-specific integration before any map display.
const validUtc=s=>typeof s==="string"&&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(s)&&
  Number.isFinite(Date.parse(s))?Date.parse(s):null;
export function capPolygonToGeoJSON(value){
  if(typeof value!=="string"||value.length>500000)
    throw new TypeError("CAP polygon coordinates missing or excessive");
  const vertices=value.trim().split(/\s+/).filter(Boolean);
  if(vertices.length<3||vertices.length>20000)
    throw new RangeError("CAP must supply at least three non-collinear positions");
  const converted=[];
  for(const vertex of vertices){
    const pair=vertex.split(",");
    if(pair.length!==2)throw Error("Invalid CAP lat,lon vertex");
    if(!pair.every(x=>/^-?\d+(?:\.\d+)?$/.test(x)))
      throw Error("CAP polygon coordinate is not a valid number");
    const [lat,lon]=pair.map(Number);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||
      lat< -90||lat>90||lon< -180||lon>180)
      throw Error("CAP position outside geographical coordinate bounds");
    converted.push([lon,lat]);
  }
  const first=converted[0],last=converted.at(-1);
  if(first[0]!==last[0]||first[1]!==last[1])
    converted.push([...first]); // Required topological closure, no weather inference
  if(converted.length<4)throw new Error("CAP polygon has too few distinct vertices");
  const unique=new Set(converted.slice(0,-1).map(p=>p.join(",")));
  if(unique.size<3)throw Error("CAP polygon is degenerate");
  return {type:"Polygon",coordinates:[converted]};
}
function checkGeometry(geometry){
  if(!geometry||geometry.type!=="Polygon"||!Array.isArray(geometry.coordinates))
    return false;
  return geometry.coordinates.every(r=>Array.isArray(r)&&r.length>=4&&
    r.every(p=>Array.isArray(p)&&p.length>=2&&
      Number.isFinite(p[0])&&Number.isFinite(p[1])));
}
function urlFromBom(value){
  try{
    const u=new URL(value);
    return u.protocol==="https:"&&/(^|\.)bom\.gov\.au$/.test(u.hostname)
      ?u.href:null;
  }catch{return null;}
}
// Input is a **source-vetted decoded CAP alert**, not a plain guessed storm
// marker. Source verifies actual BoM issuer and product subtype explicitly.
export function validateOfficialThunderstormWarningProduct(
  warning,{nowUtc,nswRadarCoverageClipper}={}
){
  const now=validUtc(nowUtc);
  if(now===null)throw TypeError("Supply actual current clock UTC");
  const fail=reason=>({status:"unavailable",reason});
  if(warning?.issuer!=="Bureau of Meteorology"||
    !["QLD","NSW"].includes(warning.state)||
    warning.event!=="Severe Thunderstorm Warning"||
    !["regional","detailed"].includes(warning.productType)||
    typeof warning.identifier!=="string"||!warning.identifier.trim())
    return fail("unverified-bom-severe-thunderstorm-product");
  const issued=validUtc(warning.issuedUtc),expires=validUtc(warning.expiresUtc);
  if(issued===null||expires===null||issued>now||expires<=now||
    now-issued>12*3600*1000||expires-issued>24*3600*1000)
    return fail("warning-expired-or-invalid-source-time");
  const bulletinUrl=urlFromBom(warning.bulletinUrl);
  if(!bulletinUrl)return fail("missing-official-bom-bulletin");
  if(!checkGeometry(warning.geometry))return fail("missing-genuine-original-polygon");
  let geometry=warning.geometry;
  if(warning.state==="NSW"){
    // NSW must not render statewide geometry outside coverage of the
    // actual installed radar union; a strict, tested geometry clipper
    // must be installed before accepting any NSW product.
    if(typeof nswRadarCoverageClipper!=="function")
      return fail("nsw-radar-coverage-clipping-not-verified");
    geometry=nswRadarCoverageClipper(geometry);
    if(!checkGeometry(geometry))return fail("nsw-warning-outside-radar-coverage");
  }
  return {
    status:"active",id:warning.identifier,
    issuer:"Bureau of Meteorology",state:warning.state,
    productType:warning.productType,event:warning.event,
    issuedUtc:warning.issuedUtc,expiresUtc:warning.expiresUtc,
    bulletinUrl,geometry,historical:false,
    officialWarning:true,geometryWasSourceSupplied:true
  };
}
