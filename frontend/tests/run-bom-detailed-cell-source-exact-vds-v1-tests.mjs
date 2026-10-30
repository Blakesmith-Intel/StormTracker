import assert from "node:assert/strict";
import {sourceExactQldBomStormLocations,SOURCE_VERIFIED_VERY_DANGEROUS}
 from "../../relay/bom-warning-gis2web-replica-v1.js";
import {readFileSync} from "node:fs";
const now=Date.parse("2026-10-30T05:58:00Z");
const notice={productCode:"IDQ21035",status:"issued",
 issuedUtc:"2026-10-30T05:45:00Z",expiresUtc:"2026-10-30T07:45:00Z",
 headline:"Severe Thunderstorm Warning — Detailed",description:"Very dangerous storms possible",
 bulletinUrl:"https://www.bom.gov.au/warning/severe-thunderstorm-warning/IDQ21035"};
const geometry={type:"Polygon",coordinates:[[
 [152.9,-27.9],[153,-27.9],[153,-27.8],[152.9,-27.8],[152.9,-27.9]
 ]]};
const feature=(product,id,warning="",from="2026-10-30T05:45:00Z")=>({
 type:"Feature",id,geometry,properties:{
  product,gml_id:id,warning,
  validfrom_utc:Date.parse(from),validto_utc:Date.parse("2026-10-30T07:15:00Z"),
  phenomena:"Severe thunderstorms"
 }});
const input={type:"FeatureCollection",features:[
 feature("IDQ65650","general-threat","This thunderstorm is VERY DANGEROUS"),
 feature("IDQ65652","cell-1","This thunderstorm is VERY DANGEROUS"),
 feature("IDQ65652","cell-2","Severe thunderstorms for damaging winds"),
 feature("IDQ65652","old", "This thunderstorm is VERY DANGEROUS","2026-10-29T05:45:00Z"),
 feature("IDQ65652","cell-1","This thunderstorm is VERY DANGEROUS")
]};
const cells=sourceExactQldBomStormLocations(input,notice,{nowMs:now});
assert.equal(cells.length,2,"Do not treat the regional/detailed threat AREA as a cell");
assert(cells.every(x=>x.sourceProduct==="IDQ65652"));
assert(cells.every(x=>x.official===true&&x.productCode==="IDQ21035"));
assert.equal(cells[0].veryDangerous,true,"Explicit original cell-source designation");
assert.equal(cells[1].veryDangerous,false,"Other cells must NOT inherit VDS");
assert.equal(cells[0].cellSourceId,"cell-1");
assert.equal(cells[1].cellSourceId,"cell-2");
assert.equal(cells[0].expiresUtc,"2026-10-30T07:15:00.000Z");
assert(!SOURCE_VERIFIED_VERY_DANGEROUS.test("very dangerous hail possible"));
assert.equal(sourceExactQldBomStormLocations({type:"FeatureCollection",features:[
 feature("IDQ65652","outdated","","2026-10-29T05:45:00Z")
]},notice,{nowMs:now}).length,0);
assert.equal(sourceExactQldBomStormLocations(input,{...notice,status:"cancelled"},{nowMs:now}).length,0);
assert.throws(()=>sourceExactQldBomStormLocations({type:"FeatureCollection",
 features:[],exceededTransferLimit:true},notice,{nowMs:now}));
const root=new URL("../../",import.meta.url);
const ui=readFileSync(new URL("frontend/src/context-layers/bom-warning-operational-v1.js",root),"utf8");
const relay=readFileSync(new URL("relay/bom-warning-polygons-v1.js",root),"utf8");
const img=readFileSync(new URL("frontend/src/context-layers/bom-warning-terrain-imagery-v1.js",root),"utf8");
assert(relay.includes('fetchQldBomStormLocations(detailedNotice'));
assert(relay.includes('stormCellSourceStatus,stormCells,warnings:enriched'));
assert(ui.includes('sourceProduct==="IDQ65652"'));
assert(ui.includes('stormCellSourceStatus==="source-verified"'));
assert(img.includes('entry.veryDangerous===true&&level>=2'));
assert(img.includes('entry.sourceProduct==="IDQ65652"'));
console.log("PASS distinct detailed threat-area vs actual IDQ65652 cell geometry; source-verified per-cell VERY DANGEROUS attribution only, fail-closed expiry and independent source status");
