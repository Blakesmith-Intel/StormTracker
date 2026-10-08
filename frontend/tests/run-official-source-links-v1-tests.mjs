import assert from "node:assert/strict";
import {
  OFFICIAL_SOURCE_LINKS,officialUrl,bomGaugePlotUrl,
  roadOfficialUrl,powerOfficialUrl,addOfficialSourceRow
} from "../src/context-layers/official-source-links-v1.js";
assert.equal(bomGaugePlotUrl("/fwo/IDQ65388/IDQ65388.540576.plt.shtml"),
 "https://www.bom.gov.au/fwo/IDQ65388/IDQ65388.540576.plt.shtml");
for(const invalid of [
 "https://evil.example/fwo/IDQ65388/IDQ65388.540576.plt.shtml",
 "/fwo/IDQ65388/IDQ65399.540576.plt.shtml",
 "/fwo/IDQ65388/IDQ65388.540576.tbl.shtml",
 "/fwo/IDQ65388/IDQ65388.540576.plt.shtml?foo=1",
 "javascript:alert(1)", "//evil.example"
])assert.equal(bomGaugePlotUrl(invalid),"","No arbitrary gauge redirect URLs");
for(const bad of [
 "javascript:alert(1)","http://qldtraffic.qld.gov.au/",
 "https://qldtraffic.qld.gov.au.evil.example/",
 "https://evil.example/",
 "https://user:password@www.bom.gov.au/a",
 "data:text/html,evil"
])assert.equal(officialUrl(bad),"","Only explicitly trusted HTTPS official domains");
for(const [provider,uri] of [
 ["Energex","https://www.energex.com.au/outages/outage-finder/outage-finder-map"],
 ["Ergon","https://www.ergon.com.au/network/outages/outage-finder/outage-finder-map"],
 ["Essential Energy","https://www.essentialenergy.com.au/outages-and-faults/power-outages"]
])assert.equal(powerOfficialUrl(provider),uri);
assert.equal(powerOfficialUrl("Unknown provider"),"");
assert.equal(roadOfficialUrl("https://evil.example"),OFFICIAL_SOURCE_LINKS.road);
assert.equal(roadOfficialUrl("https://qldtraffic.qld.gov.au/?id=123"),
 "https://qldtraffic.qld.gov.au/?id=123");
assert.ok(OFFICIAL_SOURCE_LINKS.bom.includes("rain_river"));
const saved=globalThis.document;
const created=[];
globalThis.document={createElement:(type)=>{
 const el={type,textContent:"",href:"",target:"",rel:"",title:""};
 created.push(el);return el;
}};
try {
 const container={children:[],append(...nodes){this.children.push(...nodes);}};
 assert.equal(addOfficialSourceRow(container,"Source","BoM",OFFICIAL_SOURCE_LINKS.bom),true);
 assert.equal(container.children.length,2);
 assert.equal(container.children[0].type,"span");
 assert.equal(container.children[1].type,"a");
 assert.equal(container.children[1].textContent,"BoM");
 assert.equal(container.children[1].target,"_blank");
 assert.equal(container.children[1].rel,"noopener noreferrer");
 assert.equal(container.children[1].href,OFFICIAL_SOURCE_LINKS.bom);
 assert.equal(addOfficialSourceRow(container,"Source","Unsafe","javascript:alert(1)"),false);
 assert.equal(container.children.length,2);
 assert.equal(addOfficialSourceRow(container,"Source","",OFFICIAL_SOURCE_LINKS.bom),false);
}finally{globalThis.document=saved;}
console.log("Official source link checks passed: BoM direct station plots, official road and three outage suppliers, strict HTTPS allowlist and safe new-tab DOM rendering.");
