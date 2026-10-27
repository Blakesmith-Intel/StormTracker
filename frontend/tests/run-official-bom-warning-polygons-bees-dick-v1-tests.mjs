import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {capPolygonCoordinates,bomCapRssLinks,parseOfficialBomCap}
 from "../src/context-layers/bom-warning-cap-source-v1.js";
import {warningContainsPoint,createWarningImageryProvider}
 from "../src/context-layers/bom-warning-terrain-imagery-v1.js";
import {boundaryIntersectionRequest,enrichWarningBoundaries}
 from "../../relay/bom-warning-polygons-v1.js";
import {isVerifiedActiveBomWarning}
 from "../src/context-layers/bom-warning-operational-v1.js";
const now=Date.parse("2026-10-27T04:45:00Z"),future="2026-10-27T07:00:00Z";
const polygon="-27.701,153.201 -27.701,153.202 -27.700,153.202 -27.700,153.201";
function cap(x={}){
 return "<alert><identifier>IDQ21033-20261027</identifier>"+
 "<sender>warning@"+(x.sender||"bom.gov.au")+"</sender>"+
 "<senderName>Bureau of Meteorology</senderName>"+
 "<status>"+(x.status||"Actual")+"</status>"+
 "<msgType>"+(x.msgType||"Alert")+"</msgType>"+
 "<sent>"+(x.sent||"2026-10-27T03:43:00Z")+"</sent><info>"+
 "<event>"+(x.event||"Severe Thunderstorm Warning")+"</event>"+
 "<expires>"+(x.expires||future)+"</expires>"+
 "<headline>Severe thunderstorms near Springbrook</headline>"+
 "<web>"+(x.web||"https://www.bom.gov.au/weather-and-climate/warnings-and-alerts")+"</web>"+
 "<description>Damaging winds, large hail and heavy rainfall</description>"+
 "<instruction>Consult original BoM warning.</instruction>"+
 "<area><areaDesc>South East Coast</areaDesc><polygon>"+
 (x.polygon||polygon)+"</polygon></area></info></alert>";
}
const parsed=parseOfficialBomCap(cap(),{nowMs:now});
assert.equal(parsed.length,1);
const warning=parsed[0];
assert.equal(warning.issuer,"Bureau of Meteorology");
assert.equal(warning.type,"severe-thunderstorm");
assert.equal(warning.official,true);
assert.equal(warning.geometry.type,"Polygon");
assert.equal(warning.geometry.coordinates[0].length,5);
assert(isVerifiedActiveBomWarning(warning,now));
assert.equal(isVerifiedActiveBomWarning(warning,Date.parse(future)),false);
for(const changed of [
 {status:"Test"},{msgType:"Cancel"},{sent:"2026-10-26T00:00:00Z"},
 {expires:"2026-10-27T04:44:00Z"},{event:"Tropical Cyclone Warning"},
 {web:"https://example.org/unverified"},
 {polygon:"-50,40 -50,41 -49,41"},
 {polygon:"-27.7,153.2 -27.7,153.2 -27.7,153.2"}
]) assert.equal(parseOfficialBomCap(cap(changed),{nowMs:now}).length,0);
assert.equal(parseOfficialBomCap(cap({event:"Severe Weather Warning"}),{nowMs:now})[0].type,"severe-weather");
assert.deepEqual(capPolygonCoordinates(polygon)[0],[153.201,-27.701]);
assert(warningContainsPoint(warning.geometry,153.2015,-27.7005));
assert(!warningContainsPoint(warning.geometry,153.25,-27.70));
const q=boundaryIntersectionRequest(warning.geometry,
 "https://spatial-gis.information.qld.gov.au/arcgis/rest/services/Boundaries/AdministrativeBoundaries/MapServer/1/query","lga");
const params=new URLSearchParams(q.form);
assert.equal(params.get("spatialRel"),"esriSpatialRelIntersects");
assert.equal(params.get("returnGeometry"),"false");
assert.equal(params.get("outFields"),"lga");
assert.equal(params.get("inSR"),"4326");
assert.equal(JSON.parse(params.get("geometry")).rings[0].length,5);
assert(!/(?:minArea|minIntersection|percentThreshold|maxAllowableOffset)/i.test(q.form));
const orig=globalThis.fetch;
globalThis.fetch=async(url)=>({ok:true,async json(){
 return {features:url.includes("/240/")?
 [{attributes:{DISTRICT:"GOLD COAST"}},{attributes:{DISTRICT:"LOGAN"}}]:
 [{attributes:{lga:"Gold Coast"}},{attributes:{lga:"Scenic Rim"}}]};
}});
try{
 const enriched=await enrichWarningBoundaries(warning);
 assert.deepEqual(enriched.lgas,["Gold Coast","Scenic Rim"]);
 assert.deepEqual(enriched.ddmgs,["GOLD COAST","LOGAN"]);
 assert.equal(enriched.lgaStatus,"verified");
 assert.equal(enriched.ddmgStatus,"verified");
 assert.match(enriched.geometryIntersectionsMethod,/no minimum area/i);
}finally{globalThis.fetch=orig;}
const rss="<rss><channel><item><title>Severe Thunderstorm Warning</title>"+
 "<pubDate>Tue, 27 Oct 2026 04:44:00 GMT</pubDate>"+
 "<link>https://severeweather.wmo.int/v2/cap-alerts/au-bom-en/123.xml</link>"+
 "</item><item><title>Flood Warning</title></item></channel></rss>";
assert.deepEqual(bomCapRssLinks(rss,{nowMs:now}),[
 "https://severeweather.wmo.int/v2/cap-alerts/au-bom-en/123.xml"]);
assert.throws(()=>bomCapRssLinks("<html>wrong feed</html>",{nowMs:now}));
const stub={
 GeographicTilingScheme:class{constructor(options){this.rectangle=options.rectangle;}},
 Rectangle:{fromDegrees:(...args)=>args},
 Credit:class{constructor(s){this.text=s}},
 Event:class{}
};
const provider=createWarningImageryProvider(stub,[warning]);
assert.equal(provider.hasAlphaChannel,true);
assert.equal(provider.ready,true);
assert.equal(provider.maximumLevel,12);
const root=new URL("../../",import.meta.url);
const script=readFileSync(new URL("scripts/build-current-site.sh",root),"utf8");
assert(script.includes('"bom-warning-operational-v1.js"'));
assert(script.includes("initialiseOfficialBomWarningPolygons({viewer"));
assert(script.includes("official-bom-warnings-row"));
const worker=readFileSync(new URL("relay/worker.js",root),"utf8");
assert(worker.includes('"/bom-official-warning-polygons"'));
console.log("PASS BoM CAP source authenticity/time, minuscule intersections, LGA/DDMG geometry, below-radar display, fail-closed freshness and sealed build injection");
