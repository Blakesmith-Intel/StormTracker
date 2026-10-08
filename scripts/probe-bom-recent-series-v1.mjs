import {DEFAULT_RIVER_HEIGHT_RELAY_URL} from "../frontend/src/context-layers/river-gauge-observations-v1.js";
const response=await fetch(DEFAULT_RIVER_HEIGHT_RELAY_URL,{signal:AbortSignal.timeout(35000)});
if(!response.ok)throw Error("Relay not available "+response.status);
const data=await response.json();
const observations=(data.products??[]).flatMap(p=>(p.observations??[]).map(o=>({...o,product:p.product})));
const links=observations.filter(x=>typeof x.recentDataHref==="string"&&x.recentDataHref.includes(".plt")).slice(0,8);
const unique=[...new Map(links.map(x=>[x.recentDataHref,x])).values()];
const allHref=observations.filter(x=>x.recentDataHref).map(x=>x.recentDataHref);
const candidate=observations.filter(x=>
  String(x.tendency).toLowerCase()==="rising" &&
  (x.floodClass==="minor" || x.recentDataHref)
);
const groups={};
for(const href of allHref){
  const m=href.match(/\/fwo\/(IDQ\d{5})\/\1\.(\d{5,7})\.plt\.shtml/i);
  const k=m?m[1]:"not matched";
  groups[k]=(groups[k]??0)+1;
}
console.log("All station plot link groups",JSON.stringify({groupCount:groups,
 validLinks:allHref.length, rising:observations.filter(x=>x.tendency==="rising").length,
 minorRising:observations.filter(x=>x.tendency==="rising"&&x.floodClass==="minor").length,
 candidateCount:candidate.length}));

console.log("River-height bulletin href formats",JSON.stringify({
 count:observations.length,recentCount:observations.filter(x=>x.recentDataHref).length,
 samples:unique.map(x=>({id:x.stationId,href:x.recentDataHref,product:x.product}))
},null,2));
for (const x of unique.slice(0,3)) {
  let url;
  try {url=new URL(x.recentDataHref,"https://www.bom.gov.au");}catch{continue}
  if(url.hostname!=="www.bom.gov.au"||url.protocol!=="https:")continue;
  for(const variant of [url.href,url.href.replace(/\.plt\.shtml$/i,".tbl.shtml")]){
    try {
      const r=await fetch(variant,{signal:AbortSignal.timeout(25000),redirect:"follow"});
      const html=await r.text();
      const filteredLinks=[...html.matchAll(/href=["']([^"']+(?:tbl|plt|csv|json)[^"']*)["']/gi)].slice(0,15).map(m=>m[1]);
      console.log(JSON.stringify({
       variant,status:r.status,type:r.headers.get("content-type"),len:html.length,
       title:html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]??null,
       first:html.slice(0,900),links:filteredLinks,
       sampleTable:html.match(/<table[\s\S]{0,4000}/i)?.[0]?.slice(0,1300)??null,
       hasReadings:/river height|data table|series|observations|water level/gi.test(html)
      }));
    }catch(e){console.log("ERROR "+variant+" "+e.message)}
  }
}
