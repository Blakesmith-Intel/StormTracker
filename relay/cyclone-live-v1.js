// Source-current BoM cyclone geometry from validated scheduled FTP bridge.
// Cloudflare KV is a short-lived transport, not a source of weather truth.
const SCHEMA="stormtracker-internal-cyclone-source-v1";
const MAX_AGE_MS=30*60*1000;
const MAX_BODY=12_000_000;

export async function cycloneSnapshotResponse(env, origin, corsHeaders,
                                            now=Date.now()){
  const headers=corsHeaders(origin);
  headers.set("Content-Type","application/json; charset=utf-8");
  headers.set("Cache-Control","no-store, max-age=0");
  const fail=(code,message)=>new Response(JSON.stringify({
    schema:SCHEMA,status:"source-unavailable",complete:false,
    products:[],message
  }),{status:code,headers});
  if(!env?.CYCLONE_KV?.get)
    return fail(503,"Cyclone source storage is not connected");
  let value;
  try{value=await env.CYCLONE_KV.get("current","text");}
  catch{return fail(503,"Unable to check BoM cyclone source snapshot");}
  if(typeof value!=="string"||!value||value.length>MAX_BODY)
    return fail(503,"No current verified cyclone source snapshot");
  let data;
  try{data=JSON.parse(value);}catch{return fail(503,"Malformed cyclone source snapshot");}
  const age=now-Date.parse(data?.generatedUtc);
  if(data?.schema!==SCHEMA || !Number.isFinite(age) ||
     age< -5*60*1000||age>MAX_AGE_MS ||
     !Array.isArray(data?.products) || data.products.length>6 ||
     data.sourceDirectoryVerified!==true ||
     !["active","no-active-products","source-unavailable"].includes(data.status))
    return fail(503,"BoM cyclone source check is stale or invalid");
  if(data.status==="no-active-products" &&
    !(data.complete===true && data.warningSummaryConfirmed===true &&
      data.products.length===0 && Array.isArray(data.warningAdviceProductNamesPresent) &&
      data.warningAdviceProductNamesPresent.length===0))
    return fail(503,"Cannot verify a no-cyclone-warning statement");
  if(data.status==="source-unavailable")return fail(503,
    "Unable to verify current tropical cyclone warnings");
  if(data.status==="active" && data.products.length===0)return fail(503,
    "Active source missing its forecast maps");
  return new Response(value,{status:200,headers});
}
