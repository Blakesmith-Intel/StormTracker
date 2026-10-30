import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseBomCapProductNotice,parseOfficialBomCap,bomCapRssLinks}
 from "../src/context-layers/bom-warning-cap-source-v1.js";
import {reconcileLatestBoMWarnings}
 from "../../relay/bom-warning-product-reconcile-v1.js";
const now=Date.parse("2026-10-28T11:53:00Z");
function actualFormat(x={}){
 return '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">'+
 '<identifier>'+(x.identifier??"AusBoM-IDQ21033-2026-10-28T09:45:52+00:00")+'</identifier>'+
 '<sender>CAP.Message@bom.gov.au</sender><status>Actual</status>'+
 '<msgType>'+(x.msgType??"Update")+'</msgType>'+
 '<sent>'+(x.sent??"2026-10-28T09:45:52+00:00")+'</sent>'+
 '<info><language>en-AU</language><event>'+(x.event??"Thunderstorm")+'</event>'+
 '<headline>'+(x.headline??"Severe Thunderstorm Warning for Central Coast and Whitsundays, Capricornia and Central Highlands and Coalfields forecast districts")+'</headline>'+
 '<description>Heavy rainfall and damaging winds in the warning area.</description>'+
 '<instruction>Stay inside and monitor the original BoM warning.</instruction>'+
 '<expires>'+(x.expires??"2026-10-28T12:45:52+00:00")+'</expires>'+
 '<web>http://www.bom.gov.au/australia/warnings</web>'+
 '<area><areaDesc>Queensland: Central Coast and Whitsundays, Central Highlands and Coalfields and Capricornia</areaDesc>'+
 '<geocode><valueName>SomeOfficialCode</valueName><value>101</value></geocode></area>'+
 '</info></alert>';
}
const parsed=parseBomCapProductNotice(actualFormat(),{nowMs:now});
assert(parsed,"Real WMO BoM message uses event Thunderstorm, not Severe Thunderstorm Warning");
assert.equal(parsed.productCode,"IDQ21033");
assert.equal(parsed.status,"issued");
assert.equal(parsed.expiresUtc,"2026-10-28T12:45:52.000Z");
assert.match(parsed.description,/heavy rainfall/i);
assert.match(parsed.headline,/Severe Thunderstorm Warning/);
assert.match(parsed.instruction,/BoM warning/);
assert.match(parsed.areaDescription,/Capricornia/);
assert.equal(parsed.bulletinUrl,"https://www.bom.gov.au/warning/severe-thunderstorm-warning/IDQ21033");
assert.deepEqual(parseOfficialBomCap(actualFormat(),{nowMs:now}),[],
 "WMO CAP does NOT contain a polygon: do NOT reconstruct from forecast districts");
const state=reconcileLatestBoMWarnings([{notice:parsed,warnings:[]}],{nowMs:now,complete:true});
assert.equal(state.products.IDQ21033.status,"geometry-unavailable");
assert.equal(state.products.IDQ21033.headline,parsed.headline);
assert.equal(state.products.IDQ21033.bulletinUrl,parsed.bulletinUrl);
assert.equal(state.warnings.length,0);
assert.equal(state.products.IDQ21035.status,"no-active");
const newerCancel=parseBomCapProductNotice(actualFormat({
 identifier:"AusBoM-IDQ21033-2026-10-28T10:35:00+00:00",
 sent:"2026-10-28T10:35:00+00:00",msgType:"Cancel",
 headline:"Cancellation of Severe Thunderstorm Warning for Capricornia"
}),{nowMs:now});
assert.equal(newerCancel.status,"cancelled");
const after=reconcileLatestBoMWarnings([
 {notice:parsed,warnings:[]},{notice:newerCancel,warnings:[]}
],{nowMs:now});
assert.equal(after.products.IDQ21033.status,"cancelled");
assert.equal(after.warnings.length,0);
assert.equal(parseBomCapProductNotice(actualFormat({identifier:"generic-id"}),{nowMs:now}),null);
assert.equal(parseBomCapProductNotice(actualFormat({headline:"Mild Thunderstorm Advisory"}),{nowMs:now}),null);
assert.equal(parseBomCapProductNotice(actualFormat({event:"Tropical Cyclone"}),{nowMs:now}),null);
const rss='<rss><channel><item><title>Severe Thunderstorm Warning for parts of Queensland</title>'+
 '<link>https://severeweather.wmo.int/v2/cap-alerts/au-bom-en/2026/10/28/09/45/52-a.xml</link>'+
 '<pubDate>Wed, 28 Oct 2026 10:18:14 GMT</pubDate></item></channel></rss>';
assert.equal(bomCapRssLinks(rss,{nowMs:now}).length,1);
const ui=readFileSync(new URL("../src/context-layers/bom-warning-operational-v1.js",import.meta.url),"utf8");
assert(ui.includes("CURRENT BoM warning"));
assert(ui.includes("INTERVAL_MS=15*60*1000"));
assert(ui.includes("Verified BoM warning bulletin"));
assert(ui.includes("LDMG/DDMG intersections cannot be calculated"));
console.log("PASS real 28-Oct BoM IDQ21033 WMO CAP event semantics, missing original polygon provenance, official bulletin details, cancellation and fail-safe status");
