// Live BoM anonymous FTP transport inside the EXISTING Cloudflare Worker.
// Do not depend on GitHub Actions cron; fail closed if any source is unavailable.
// All addresses/paths are fixed, and image names are strictly allowlisted.
const HOST="ftp.bom.gov.au", ROOT="/anon/gen/radar";
const STATIC="https://raw.githubusercontent.com/Blakesmith-Intel/StormTracker/radar-ftp-feed/manifest.json";
const RELAY="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev";
const SITES=new Set(["24","50","66","19","72","23","74","08","56","22","36","75","107","98","108","106","67","78","41","93","53","28"]);
const NAME=/^IDR(\d{2,3})3\.T\.(\d{12})\.png$/;
const UTF8=new TextEncoder(),DEC=new TextDecoder();
const MAX_LIST_BYTES=1500000,MAX_PNG_BYTES=2000000;
const MAX_FTP_SECONDS=22;
const positiveResponse=c=>c>=200&&c<400;
function checkName(value){
 const match=NAME.exec(String(value??""));
 return match&&SITES.has(match[1])?match:null;
}
function observedTime(stamp){
 if(!/^\d{12}$/.test(stamp))return null;
 const y=+stamp.slice(0,4),mo=+stamp.slice(4,6),d=+stamp.slice(6,8),h=+stamp.slice(8,10),mi=+stamp.slice(10,12);
 const date=new Date(Date.UTC(y,mo-1,d,h,mi));
 return date.getUTCFullYear()===y&&date.getUTCMonth()+1===mo&&date.getUTCDate()===d&&
   date.getUTCHours()===h&&date.getUTCMinutes()===mi?date.toISOString().replace(".000Z","Z"):null;
}
export function parseFtpRadarNames(text,now=Date.now()){
 const frames={};
 for(const line of String(text??"").split(/\r?\n/)){
  const name=line.trim().split("/").at(-1),m=checkName(name);
  if(!m)continue;
  const observedUtc=observedTime(m[2]),t=Date.parse(observedUtc);
  if(!Number.isFinite(t)||t>now+5*60000||t<now-45*60000)continue;
  (frames[m[1]]??=[]).push({filename:name,observedUtc,
   imageUrl:RELAY+"/ftp-live-frame?file="+encodeURIComponent(name),mapFile:"IDR"+m[1]+"3.map"});
 }
 for(const [site,records] of Object.entries(frames)){
  const distinct=new Map(records.map(x=>[x.filename,x]));
  frames[site]=[...distinct.values()].sort((a,b)=>a.observedUtc.localeCompare(b.observedUtc)).slice(-9);
 }
 return frames;
}
async function ftpRaw(operation,{connectSocket}={}){
 const connectFn=connectSocket||(await import("cloudflare:sockets")).connect;
 const sockets=[];
 let control,ctrlReader,ctrlWriter,buffer="";
 let stage="start";
 let deadlineTimer;
 const deadline=new Promise((_,reject)=>{
  deadlineTimer=setTimeout(()=>{
   for(const sock of sockets){try{sock.close()}catch{}}
   reject(Error("FTP transport deadline exceeded at "+stage));
  },MAX_FTP_SECONDS*1000);
 });
 async function run(){
  try{
   stage="ftp-control-connect";
   control=connectFn({hostname:HOST,port:21});sockets.push(control);
   await control.opened;
   stage="ftp-control-banner";
   ctrlReader=control.readable.getReader();ctrlWriter=control.writable.getWriter();
   async function reply(){
    let multiline=null,readBytes=0;
    for(;;){
     let idx=buffer.indexOf("\n");
     if(idx<0){
      const chunk=await ctrlReader.read();
      if(chunk.done)throw Error("FTP control connection closed unexpectedly");
      readBytes+=chunk.value.byteLength;
      if(readBytes>65000)throw Error("Oversized FTP control reply");
      buffer+=DEC.decode(chunk.value,{stream:true});
      continue;
     }
     const line=buffer.slice(0,idx).trimEnd();buffer=buffer.slice(idx+1);
     const m=/^(\d{3})([- ])/.exec(line);
     if(!m)continue;
     if(!multiline&&m[2]==="-"){multiline=m[1];continue;}
     if(multiline&&(m[1]!==multiline||m[2]!==" "))continue;
     return {code:+m[1],line};
    }
   }
   async function command(line){
    await ctrlWriter.write(UTF8.encode(line+"\r\n"));
    const out=await reply();
    if(out.code>=400)throw Error("FTP source response "+out.code);
    return out;
   }
   if((await reply()).code!==220)throw Error("BoM FTP did not welcome client");
   stage="ftp-login";
   const user=await command("USER anonymous");
   if(user.code===331)await command("PASS stormtracker-public@example.com");
   else if(user.code!==230)throw Error("BoM FTP anonymous login declined");
   stage="ftp-binary";
   if((await command("TYPE I")).code!==200)throw Error("FTP binary type rejected");
   stage="ftp-directory";
   if((await command("CWD "+ROOT)).code!==250)throw Error("BoM radar directory unavailable");
   // BoM's anonymous FTP service can advertise either EPSV or classic PASV.
   stage="ftp-passive-command";
   let passive=null,port=0;
   try{passive=await command("EPSV")}catch{}
   let portMatch=passive?.code===229?/\(\|\|\|(\d+)\|\)/.exec(passive.line):null;
   if(portMatch){port=+portMatch[1]}
   else{
    passive=await command("PASV");
    const parts=/\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/.exec(passive.line);
    if(passive.code!==227||!parts)throw Error("BoM FTP passive mode unavailable");
    port=Number(parts[5])*256+Number(parts[6]);
   }
   if(!Number.isInteger(port)||port<1024||port>65535)throw Error("Invalid FTP passive port");
   stage="ftp-passive-data-connect";
   const data=connectFn({hostname:HOST,port});sockets.push(data);
   await data.opened;
   const reader=data.readable.getReader();
   stage="ftp-transfer-start";
   let preliminary=await command(operation==="list"?"NLST":"RETR "+operation);
   if(preliminary.code!==150&&preliminary.code!==125)
    throw Error("FTP transfer not started: "+preliminary.code);
   const chunks=[];let count=0;
   const limit=operation==="list"?MAX_LIST_BYTES:MAX_PNG_BYTES;
   stage="ftp-transfer-data";
   for(;;){
    const part=await reader.read();
    if(part.done)break;
    count+=part.value.byteLength;
    if(count>limit)throw Error("Oversized BoM FTP transfer");
    chunks.push(part.value);
   }
   try{reader.releaseLock()}catch{}
   const finish=await reply();
   if(finish.code!==226&&finish.code!==250)throw Error("Incomplete FTP transfer: "+finish.code);
   const bytes=new Uint8Array(count);let offset=0;
   for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
   return bytes;
  }finally{
   try{ctrlReader?.releaseLock()}catch{}
   try{ctrlWriter?.releaseLock()}catch{}
   for(const sock of sockets){try{sock.close()}catch{}}
  }
 }
 try{return await Promise.race([run(),deadline]);}
 finally{clearTimeout(deadlineTimer)}
}
function json(body,status,originHeaders,maxAge=0){
 const headers=new Headers(originHeaders);
 headers.set("Content-Type","application/json;charset=utf-8");
 headers.set("Cache-Control",maxAge?"public,max-age="+maxAge:"no-store");
 return new Response(JSON.stringify(body),{status,headers});
}
export async function ftpLiveManifest(request,originHeaders){
 const url=new URL(request.url);
 if(url.search)return json({error:"Query not supported"},400,originHeaders);
 const cache=globalThis.caches?.default;
 const key=new Request(RELAY+"/ftp-live-manifest");
 if(cache){const found=await cache.match(key);if(found)return new Response(found.body,{status:found.status,headers:new Headers([...found.headers,...originHeaders])});}
 try{
  const [names,priorResponse]=await Promise.all([
   ftpRaw("list"),
   fetch(STATIC,{headers:{"Accept":"application/json"}})
  ]);
  if(!priorResponse.ok)throw Error("Verified BoM geographic reference unavailable");
  const prior=await priorResponse.json();
  if(prior.schema!=="StormTrackerBoMFtpReflectivityManifestV1"||
    !prior.siteGeoreference)throw Error("Invalid verified BoM geographic controls");
  const now=Date.now(),frames=parseFtpRadarNames(DEC.decode(names),now);
  for(const site of Object.keys(frames)){
   if(!prior.siteGeoreference[site]?.controlPoints)delete frames[site];
  }
  if(!Object.keys(frames).length)throw Error("No live fresh BoM FTP images");
  const manifest={schema:"StormTrackerBoMFtpReflectivityManifestV1",
   sourceKind:"ftp-live-direct-relay",source:"ftp.bom.gov.au:/anon/gen/radar",
   imageDelivery:"Direct live BoM FTP over Cloudflare TCP relay; never cached GitHub cron data",
   generatedUtc:new Date(now).toISOString(),maxSourceAgeMinutes:45,
   siteFrameHistory:frames,siteGeoreference:prior.siteGeoreference,
   missingOrStaleSites:[...SITES].filter(site=>!frames[site])};
  const response=json(manifest,200,originHeaders,45);
  if(cache)try{await cache.put(key,response.clone())}catch{}
  return response;
 }catch(error){return json({error:"Live BoM FTP directory unavailable",detail:String(error.message).slice(0,180)},503,originHeaders)}
}
export async function ftpLiveFrame(request,incoming,originHeaders){
 const file=incoming.searchParams.get("file");
 if(incoming.searchParams.size!==1||!checkName(file))
  return json({error:"Invalid BoM FTP radar filename"},400,originHeaders);
 const observedUtc=observedTime(checkName(file)[2]);
 const age=Date.now()-Date.parse(observedUtc);
 if(age< -5*60000||age>45*60000)
  return json({error:"BoM observation no longer fresh"},410,originHeaders);
 const cache=globalThis.caches?.default;
 const key=new Request(RELAY+"/ftp-live-frame?file="+encodeURIComponent(file));
 if(cache){const cached=await cache.match(key);if(cached)return new Response(cached.body,{status:cached.status,headers:new Headers([...cached.headers,...originHeaders])});}
 try{
  const bytes=await ftpRaw(file);
  if(bytes.length<24||bytes[0]!==137||bytes[1]!==80||bytes[2]!==78||bytes[3]!==71||
   bytes[4]!==13||bytes[5]!==10||bytes[6]!==26||bytes[7]!==10)
    throw Error("BoM FTP payload not PNG");
  const header=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(header.getUint32(16)!==512||header.getUint32(20)!==512)
    throw Error("Unexpected BoM FTP image dimensions");
  const headers=new Headers(originHeaders);
  headers.set("Content-Type","image/png");
  headers.set("Cache-Control","public,max-age=180");
  headers.set("X-StormTracker-Observed-UTC",observedUtc);
  headers.set("X-StormTracker-Time-Source","bom-ftp-observed-filename-live");
  const result=new Response(bytes,{status:200,headers});
  if(cache)try{await cache.put(key,result.clone())}catch{}
  return result;
 }catch(error){return json({error:"Authentic BoM FTP frame unavailable",detail:String(error.message).slice(0,180)},503,originHeaders)}
}
