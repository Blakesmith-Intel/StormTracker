import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseBomCapProductNotice}
 from "../src/context-layers/bom-warning-cap-source-v1.js";
import {reconcileLatestBoMWarnings}
 from "../../relay/bom-warning-product-reconcile-v1.js";
import {describeOfficialBomWarningState}
 from "../src/context-layers/bom-warning-operational-v1.js";

const now=Date.parse("2026-10-27T13:12:00Z");
const official=code=>({
 id:code+":1",official:true,productCode:code,state:"QLD",
 issuedUtc:"2026-10-27T12:15:00Z",
 expiresUtc:"2026-10-27T15:00:00Z",
 geometry:{type:"Polygon",coordinates:[[[153,-27],[153.001,-27],[153,-27.001],[153,-27]]]}
});
const notice=(productCode,issuedUtc,status="issued")=>({productCode,issuedUtc,status});
const earlier={notice:notice("IDQ21035","2026-10-27T12:15:00Z"),
 warnings:[official("IDQ21035")]};
const regional={notice:notice("IDQ21033","2026-10-27T12:33:00Z"),
 warnings:[official("IDQ21033")]};
const cancel={notice:notice("IDQ21035","2026-10-27T13:05:00Z","cancelled"),warnings:[]};
const cancelled=reconcileLatestBoMWarnings([earlier,regional,cancel],{nowMs:now});
assert.equal(cancelled.products.IDQ21035.status,"cancelled");
assert.equal(cancelled.products.IDQ21035.count,0);
assert.deepEqual(cancelled.warnings.map(w=>w.productCode),["IDQ21033"],
 "Product cancellation removes ONLY its polygon, not other products");
const updated={notice:notice("IDQ21035","2026-10-27T13:10:00Z"),
 warnings:[{...official("IDQ21035"),id:"IDQ21035:revised",
   issuedUtc:"2026-10-27T13:10:00Z"}]};
const latest=reconcileLatestBoMWarnings([earlier,cancel,updated],{nowMs:now});
assert.equal(latest.products.IDQ21035.status,"active");
assert.deepEqual(latest.warnings.map(w=>w.id),["IDQ21035:revised"],
 "Revised warning must atomically replace old and cancelled geometry");
const empty=reconcileLatestBoMWarnings([],{nowMs:now,complete:true});
assert.equal(empty.products.IDQ21035.status,"no-active");
assert.equal(empty.products.IDQ21033.status,"no-active");
assert.equal(empty.warnings.length,0);
const timeout=reconcileLatestBoMWarnings([{failed:true}],{nowMs:now,complete:false});
assert.equal(timeout.products.IDQ21035.status,"unavailable");
assert.equal(timeout.products.IDQ21033.status,"unavailable");
assert.equal(timeout.sourceComplete,false);
const badGeometry=reconcileLatestBoMWarnings([{notice:notice("IDQ21033",
 "2026-10-27T13:02:00Z"),warnings:[]}],{nowMs:now});
assert.equal(badGeometry.products.IDQ21033.status,"geometry-unavailable",
 "An issued warning with missing geometry must not be reported as cancelled");
function cap(type,product="IDQ21035"){
 const msgType=type==="cancel"?"Cancel":"Alert";
 return "<alert><identifier>"+product+"-id</identifier>"+
 "<sender>issuer@bom.gov.au</sender><senderName>Bureau of Meteorology</senderName>"+
 "<status>Actual</status><msgType>"+msgType+"</msgType>"+
 "<sent>2026-10-27T13:05:00Z</sent>"+
 "<info><event>Severe Thunderstorm Warning</event>"+
 "<headline>"+(type==="cancel"?"Cancellation of Severe Thunderstorm Warning":"Severe Thunderstorm Warning")+
 "</headline><expires>2026-10-27T15:00:00Z</expires></info></alert>";
}
assert.equal(parseBomCapProductNotice(cap("cancel"),{nowMs:now}).status,"cancelled");
assert.equal(parseBomCapProductNotice(cap("active"),{nowMs:now}).status,"issued");
assert.equal(parseBomCapProductNotice(cap("cancel","IDQ21033"),{nowMs:now}).productCode,"IDQ21033");
const path=new URL("../src/context-layers/bom-warning-operational-v1.js",import.meta.url);
const code=readFileSync(path,"utf8");
assert(code.includes("INTERVAL_MS=15*60*1000"),
 "Automatic BoM polling must be every 15 minutes");
assert(code.includes('refresh({force:true})'),
 "Manual refresh must bypass the 15 minute timer");
assert(code.includes('sourceStatus=data.status')&&code.includes("productStatuses=data.products"),
 "UI must consume status for each BoM warning product");
assert(code.includes('showProductStatus();'),
 "Each automatic/manual response must update the displayed source status");
// Negative reporting is desirable ONLY after source-confirmed cancellations
// or verified no-active state, never after a timeout or absent product record.
const none={IDQ21033:{status:"cancelled"},IDQ21035:{status:"no-active"},
 IDQ21037:{status:"no-active"},IDQ21038:{status:"cancelled"}};
assert.deepEqual(describeOfficialBomWarningState({products:none}).message,
 "No current warnings");
assert.match(describeOfficialBomWarningState({
 products:none,selected:"IDQ21033"}).message,/^No current warnings.*IDQ21033/);
assert.match(describeOfficialBomWarningState({
 products:none,selected:"IDQ21035"}).message,/^No current warnings.*IDQ21035/);
const noneThunder={IDQ21033:{status:"cancelled"},IDQ21035:{status:"cancelled"},
 IDQ21037:{status:"unavailable"},IDQ21038:{status:"unavailable"}};
const thunderEmpty=describeOfficialBomWarningState({products:noneThunder});
assert.match(thunderEmpty.message,/No current thunderstorm warnings/);
assert.match(thunderEmpty.message,/Other severe weather not verified/);
assert.equal(thunderEmpty.kind,"warning");
const allUnavailable=describeOfficialBomWarningState({products:{}});
assert(!/^No current/.test(allUnavailable.message),"Network failure cannot mean all-clear");
assert.equal(allUnavailable.kind,"warning");
assert.match(describeOfficialBomWarningState({
 products:{...noneThunder,IDQ21033:{status:"geometry-unavailable"}},
 selected:"all"}).message,/Active BoM warnings: IDQ21033.*awaiting updated BoM polygon/i);
assert.match(describeOfficialBomWarningState({
 products:{...noneThunder,IDQ21033:{status:"active",count:2}},
 warnings:[official("IDQ21033"),{...official("IDQ21033"),id:"regional2"}]}).message,
 /IDQ21033.*active \(2 polygons\).*IDQ21035: none current/i);
assert.match(describeOfficialBomWarningState({
 products:{...noneThunder,IDQ21035:{status:"active",count:1}},
 warnings:[official("IDQ21035")]}).message,/IDQ21035.*active.*IDQ21033: none current/i);
assert.match(describeOfficialBomWarningState({
 products:{...noneThunder,IDQ21035:{status:"active"},IDQ21033:{status:"active"}},
 warnings:[official("IDQ21035"),official("IDQ21033")]}).message,
 /IDQ21035.*active.*IDQ21033.*active/i);
console.log("PASS 15-minute automatic polling, manual refresh, cancellation removes product polygon, updates replace prior geometry, per-product verified empty/timeout distinction.");
