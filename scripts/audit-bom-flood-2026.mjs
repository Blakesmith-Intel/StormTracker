import {spawnSync} from "node:child_process";
const source="https://www.bom.gov.au/sites/default/files/2026-05/service-level-specification-flood-forecasting-warning-services-queensland-v3.7.pdf";
const response=await fetch(source,{signal:AbortSignal.timeout(30000)});
console.log("Official May 2026 PDF HTTP",response.status,response.headers.get("content-type"));
if(!response.ok)throw Error("Current BoM service classification PDF unavailable");
const buffer=Buffer.from(await response.arrayBuffer());
if(buffer.toString("ascii",0,4)!=="%PDF")throw Error("Not an authentic PDF");
const parsed=spawnSync("pdftotext",["-layout","-","-"],{
 input:buffer,maxBuffer:8*1024*1024,encoding:"utf8"
});
if(parsed.status!==0)throw Error("pdftotext unavailable: "+String(parsed.stderr).slice(0,300));
const txt=parsed.stdout;
console.log("PDF text chars",txt.length);
const lines=txt.split("\n");
for(const id of ["540610","540097","540057","539066","540646","544058","535142"]){
 let hits=[];
 for(let i=0;i<lines.length;i++)
   if(lines[i].includes(id))hits.push({line:i,text:lines[i].slice(0,230)});
 console.log("MATCH",id,JSON.stringify(hits.slice(0,16)));
}
for(const title of ["Schedule 3: Information locations with flood class levels defined","Schedule 4:"]){
 const idx=txt.indexOf(title);console.log("SECTION",title,"first char",idx);
 if(idx>=0)console.log("SECTION CONTEXT",JSON.stringify(txt.slice(idx,idx+850)));
}
const index=lines.findIndex(l=>l.includes("540610")&&l.includes("HINZE"));
if(index>=0)console.log("ROWS AROUND HINZE",JSON.stringify(lines.slice(index-9,index+11)));
const ix=lines.findIndex(l=>l.includes("539066")&&l.includes("JONES"));
if(ix>=0)console.log("ROWS AROUND JONES",JSON.stringify(lines.slice(ix-8,ix+12)));
