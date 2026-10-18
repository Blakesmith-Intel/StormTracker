#!/usr/bin/env node
// One Cloudflare KV namespace for current BoM-source-only cyclone map issues.
// Uses the existing relay account/token; never commits source forecasts to Git.
import {readFileSync,writeFileSync,appendFileSync} from "node:fs";

const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const token=process.env.CLOUDFLARE_API_TOKEN;
const title="stormtracker-live-cyclone-snapshots-v1";
if(!account||!token)throw Error("Existing Cloudflare account/token secrets required");
const api="https://api.cloudflare.com/client/v4/accounts/"+encodeURIComponent(account);
async function request(path,method="GET",body=null,contentType="application/json"){
  const r=await fetch(api+path,{
    method,
    headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":contentType}:{})},
    body
  });
  const raw=await r.text();
  let data;
  try{data=JSON.parse(raw);}catch{data={success:false,errors:[{message:"Invalid Cloudflare API response"}]};}
  if(!r.ok||!data.success)throw Error("Cloudflare KV API "+method+" "+r.status+": "+
    JSON.stringify(data.errors??[]).slice(0,500));
  return data.result;
}
async function locate(create=false){
  for(let page=1;page<=10;page++){
    const list=await request("/storage/kv/namespaces?per_page=100&page="+page);
    if(!Array.isArray(list))throw Error("Unexpected KV namespace listing");
    const found=list.find(x=>x.title===title);
    if(found)return found.id;
    if(list.length<100)break;
  }
  if(!create)throw Error("Live cyclone KV namespace not provisioned: deploy relay first");
  const created=await request("/storage/kv/namespaces","POST",JSON.stringify({title}));
  if(!created?.id)throw Error("Cloudflare did not return new KV namespace ID");
  return created.id;
}
const cmd=process.argv[2];
if(cmd==="ensure"){
  const id=await locate(true);
  if(!/^[0-9a-f]{32}$/i.test(id))throw Error("Invalid Cloudflare namespace ID");
  if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,"namespace_id="+id+"\n");
  console.log("Cyclone KV namespace ready (ID redacted)");
}else if(cmd==="configure"){
  const id=process.argv[3];
  if(!/^[0-9a-f]{32}$/i.test(id??""))throw Error("Expected verified KV namespace ID");
  const original=JSON.parse(readFileSync("relay/wrangler.jsonc","utf8"));
  const next={...original,kv_namespaces:[...(original.kv_namespaces??[])
    .filter(k=>k.binding!=="CYCLONE_KV"),{binding:"CYCLONE_KV",id}]};
  writeFileSync("relay/wrangler.cyclone-runtime.json",JSON.stringify(next,null,2));
  console.log("Prepared ephemeral Worker configuration with cyclone source KV binding");
}else if(cmd==="publish"){
  const file=process.argv[3];
  const source=readFileSync(file);
  if(source.length>12_000_000)throw Error("Manifest exceeds application safety limit");
  const manifest=JSON.parse(source.toString("utf8"));
  if(manifest.schema!=="stormtracker-internal-cyclone-source-v1" ||
     !["active","no-active-products","source-unavailable"].includes(manifest.status) ||
     typeof manifest.generatedUtc!=="string"||!Array.isArray(manifest.products))
    throw Error("Invalid source manifest contract");
  if(manifest.status==="no-active-products" &&
    !(manifest.complete&&manifest.sourceDirectoryVerified&&manifest.warningSummaryConfirmed))
    throw Error("Refusing unverified no-cyclone all-clear");
  const id=await locate(false);
  // Single latest snapshot per worker; TTL safety is ALSO checked at each read.
  const r=await fetch(api+"/storage/kv/namespaces/"+id+
      "/values/current",{method:"PUT",
      headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
      body:source});
  const result=await r.json();
  if(!r.ok||!result.success)throw Error("KV source upload failed: "+r.status);
  console.log("Published BoM cyclone source snapshot status="+manifest.status+
              " products="+manifest.products.length+
              " sourceUtc="+manifest.generatedUtc);
}else{throw Error("Usage: cyclone-live-kv.mjs ensure|configure NAMESPACE_ID|publish FILE");}
