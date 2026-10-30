import assert from "node:assert/strict";
import {parseCurrentQldBoMWarningsIndex} from "../../relay/bom-warning-qld-current-index-v1.js";
import {reconcileLatestBoMWarnings} from "../../relay/bom-warning-product-reconcile-v1.js";
import {classifyPublishedBoMThunderstormHazards} from "../src/context-layers/bom-warning-hazard-terms-v1.js";
import {describeOfficialBomWarningState} from "../src/context-layers/bom-warning-operational-v1.js";

const now=Date.parse("2026-10-30T09:48:00Z");
const fakePage=({indexLinks="",created="09:46",complete=true}={})=>
  "<!doctype html><html><title>Queensland Warnings Summary</title>"+
  "x".repeat(1200)+"<ul><li>Warnings current:</li>"+
  '<li><a href="/products/IDQ21033.shtml">Severe Thunderstorm Warning</a></li>'+
  indexLinks+"</ul>"+
  (complete?"<p>This page was created at "+created+" on Friday 30 October 2026 (UTC)</p>":"")+
  "</html>";
const index=parseCurrentQldBoMWarningsIndex(fakePage(),{nowMs:now});
assert(index?.verified);
assert.deepEqual(index.activeCodes,["IDQ21033"]);
assert.equal(index.checkedUtc,"2026-10-30T09:46:00.000Z");
const productStates=reconcileLatestBoMWarnings([],{
 complete:false,nowMs:now,qldCurrentIndex:index
});
assert.equal(productStates.products.IDQ21033.status,"listed-active");
for(const code of ["IDQ21035","IDQ21037","IDQ21038"])
 assert.equal(productStates.products[code].status,"no-active",code);
const detailed=describeOfficialBomWarningState({
 products:productStates.products,selected:"IDQ21035"
});
assert.match(detailed.message,/No current warnings/);
assert.equal(detailed.kind,"normal");
const all=describeOfficialBomWarningState({products:productStates.products,selected:"all"});
assert.match(all.message,/current in BoM listing/);
assert.match(all.message,/IDQ21035: none current/);
assert.doesNotMatch(all.message,/Other products not verified/);

assert.equal(parseCurrentQldBoMWarningsIndex(fakePage({created:"08:00"}),{nowMs:now}),null,
 "Stale BoM listing must not prove an all-clear");
assert.equal(parseCurrentQldBoMWarningsIndex(fakePage({complete:false}),{nowMs:now}),null,
 "Missing official generation timestamp must not prove an all-clear");
assert.equal(parseCurrentQldBoMWarningsIndex("<html>bad</html>",{nowMs:now}),null);
const unknown=reconcileLatestBoMWarnings([],{complete:false,nowMs:now,qldCurrentIndex:null});
assert.equal(unknown.products.IDQ21035.status,"unavailable",
 "An unverified source outage must not masquerade as clear");

const officialNew=parseCurrentQldBoMWarningsIndex(fakePage({
 indexLinks:'<li><a href="/products/IDQ21035.shtml">Detailed warning</a></li>'
}),{nowMs:now});
const listed=reconcileLatestBoMWarnings([],{complete:false,nowMs:now,qldCurrentIndex:officialNew});
assert.equal(listed.products.IDQ21035.status,"listed-active");

const latestNotice={productCode:"IDQ21033",status:"issued",
 issuedUtc:"2026-10-30T09:38:54Z",expiresUtc:"2026-10-30T14:38:48Z",
 headline:"Severe Thunderstorm Warning",
 description:"Severe thunderstorms are likely to produce heavy rainfall that may lead to flash flooding in the warning area over the next several hours.\nHeavy to locally intense rainfall has been reported east of Charleville this afternoon.\n65 mm recorded at Joylands.",
 bulletinUrl:"https://www.bom.gov.au/warning/severe-thunderstorm-warning/IDQ21033"};
const value=reconcileLatestBoMWarnings([{notice:latestNotice,warnings:[]}],
 {complete:false,nowMs:now,qldCurrentIndex:index});
assert.equal(value.products.IDQ21033.status,"geometry-unavailable",
 "Real issued bulletin remains active even if its new GIS polygons are delayed");
assert.equal(value.products.IDQ21035.status,"no-active");
assert.equal(value.products.IDQ21033.hazardAssessment.level,"severe");
assert.deepEqual(value.products.IDQ21033.hazardAssessment.highEnd,[],
 "Already-reported locally intense rain MUST NOT upgrade forecast HEAVY RAINFALL warning");
assert(value.products.IDQ21033.hazardAssessment.hazards.includes("Heavy rainfall"));
assert.equal(classifyPublishedBoMThunderstormHazards({
 description:"Severe thunderstorms are likely to produce intense rainfall."
}).level,"high-end");
assert.equal(classifyPublishedBoMThunderstormHazards({
 phenomena:"R+",description:"Heavy to locally intense rain was recorded."
}).level,"high-end",
 "Explicit original official high-end hazard code is authoritative");

const canceled={...latestNotice,status:"cancelled"};
const statesCancel=reconcileLatestBoMWarnings([{notice:canceled,warnings:[]}],
 {complete:false,nowMs:now,qldCurrentIndex:index});
assert.equal(statesCancel.products.IDQ21033.status,"listed-active",
 "New BoM listing takes precedence over old cancel when not all CAP history included");
const noActiveIndex={...index,activeCodes:[]};
assert.equal(reconcileLatestBoMWarnings([{notice:canceled,warnings:[]}],
 {complete:false,nowMs:now,qldCurrentIndex:noActiveIndex}).products.IDQ21033.status,"cancelled");

console.log("PASS real 30-Oct BoM source scenario: current regional warning and 2 prospective GIS shapes, detailed product no current, observed intense rain not upgraded, independent index all-clear fail-closed");
