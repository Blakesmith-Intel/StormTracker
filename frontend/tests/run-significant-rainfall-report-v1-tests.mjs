import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildSignificantRainfallReport,AEP_REPORT_TIERS}
 from "../src/context-layers/significant-rainfall-report-v1.js";
const row=(id,name,mm,aep,classification="meets-ifd-design-depth")=>({
 id,name,mm,period:"since9am",latitude:-25.68,longitude:151.60,
 sourceCreatedAt:"2026-10-21T12:00:00Z",
 aep:{aepDesignThreshold:aep,classification}
});
const input=[
 row("053001","Rare locality",151,5),
 row("053002","Less rare locality",165,null,"below-20pct-aep"),
 row("053003","Notable locality",96,20),
 row("053004","Exceptional locality",120,1),
 row("053005","Unrated locality",99,null,"unclassified"),
 row("053006","Unusual locality",75,10),
 row("053007","Very rare locality",110,2),
 row("053008","Minor amount",49,1)
];
assert.deepEqual(AEP_REPORT_TIERS.map(x=>x.aep),[1,2,5,10,20]);
const totals=buildSignificantRainfallReport(input,"amount");
assert.equal(totals.total,7);
assert.deepEqual(totals.groups.map(x=>x.rows.map(y=>y.id)),[
 ["053002","053001","053004","053007"],
 ["053005","053003","053006"]
],"Measured totals report must not drop less-rare or unrated eligible stations");
const rare=buildSignificantRainfallReport(input,"aep");
assert.equal(rare.total,5);
assert.deepEqual(rare.groups.map(x=>x.rows.map(y=>y.id)),[
 ["053004"],["053007"],["053001"],["053006"],["053003"]
],"Every verified Notable+ station appears once, in descending rarity");
assert.equal(rare.unknownCount,1);
assert.equal(rare.observedCount,7);
assert.equal(rare.groups.flatMap(x=>x.rows).every(x=>input.includes(x)),true,
 "Report uses real source objects, not guessed or nearest-neighbour matches");
assert.throws(()=>buildSignificantRainfallReport(input,"other"),RangeError);
assert.equal(buildSignificantRainfallReport(null,"aep").total,0);
const html=readFileSync(new URL("../live3d-operational-v9.html",import.meta.url),"utf8");
const runtime=readFileSync(new URL("../src/context-layers/significant-rainfall-operational-v1.js",import.meta.url),"utf8");
for(const id of ["openRainfallTotalsReport","openRainfallAepReport",
 "significantRainfallReport","significantRainfallReportRows",
 "refreshSignificantRainfallReport","closeSignificantRainfallReport"])
 assert(html.includes('id="'+id+'"'),"Rainfall report UI missing "+id);
const actionStart=html.indexOf('<div class="significant-rainfall-report-actions"');
const actionEnd=html.indexOf('</div>',actionStart);
assert(actionStart>=0&&actionEnd>actionStart,
 "Both reports must share one side-by-side button container");
const reportRow=html.slice(actionStart,actionEnd);
assert(reportRow.includes('id="openRainfallTotalsReport"') &&
 reportRow.includes('id="openRainfallAepReport"'),
 "Both reports must be siblings in the same compact row");
const legendStart=html.indexOf('<details class="significant-rainfall-details">');
const legendEnd=html.indexOf('</details>',legendStart);
assert(legendStart>=0&&legendEnd>legendStart&&!html.slice(legendStart,legendEnd).includes('id="openRainfallAepReport"'),
 "AEP report must not be buried inside the expandable rarity submenu");
assert(runtime.includes('import {buildSignificantRainfallReport}'));
assert.match(runtime,/openReport\("amount"\)/);
assert.match(runtime,/openReport\("aep"\)/);
assert(runtime.includes('reportDialog.showModal()'));
assert(runtime.includes('if(reportDialog?.open)renderReport()'));
assert.match(runtime,/Cartesian3\.fromDegrees\(record\.longitude,record\.latitude\)/);
assert.match(runtime,/image:marker\(record\),width:98,height:40/);
assert(!runtime.includes("pixelOffset:"),"Geographic/icon+label accuracy unchanged");
console.log("PASS complete 50/100mm and Notable+ reports, source IDs, geographic accuracy and on-screen controls");
