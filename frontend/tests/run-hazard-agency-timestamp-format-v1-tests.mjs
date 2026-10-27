import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {formatAgencyTimestamp} from "../src/context-layers/agency-source-time-v1.js";
import {riverGaugeRoadReferenceRows} from "../src/context-layers/river-gauges-operational-v1.js";
import {formatPowerOutageTime} from "../src/context-layers/power-outages-operational-v1.js";

const at=Date.UTC(2026,9,27,4,43); // 27 Oct 2026 14:43 AEST
assert.equal(formatAgencyTimestamp(at,"bom-gauge"),"14:43 27/10/2026 AEST");
assert.equal(formatAgencyTimestamp(at,"bom-rainfall"),"14:43 27/10/2026 AEST");
assert.equal(formatAgencyTimestamp(at,"bom-issued"),
 "02:43 PM AEST Tuesday 27 October 2026");
assert.equal(formatAgencyTimestamp(at,"energex"),"27 October 2026, 2:43pm AEST");
assert.equal(formatAgencyTimestamp(at,"ergon"),"27 October 2026, 2:43pm AEST");
assert.equal(formatPowerOutageTime(at,"Ergon"),"27 October 2026, 2:43pm AEST");
assert.equal(formatPowerOutageTime(at,"Energex"),"27 October 2026, 2:43pm AEST");
assert.equal(formatAgencyTimestamp(at,"essential-energy"),
 "27/10/2026 15:43:00 AEDT");
assert.equal(formatPowerOutageTime(at,"Essential Energy"),
 "27/10/2026 15:43:00 AEDT");
assert.equal(formatAgencyTimestamp(at,"qldtraffic"),
 "2:43pm 27 October 2026 AEST");
assert.equal(formatAgencyTimestamp(at,"qfd"),
 "27 Oct 2026, 14:43 AEST");
// Sydney changes clocks: never label an Essential Energy summer time as AEST.
const winter=Date.UTC(2026,5,27,4,43);
assert.equal(formatAgencyTimestamp(winter,"essential-energy"),
 "27/06/2026 14:43:00 AEST");
assert.equal(formatAgencyTimestamp(winter,"energex"),
 "27 June 2026, 2:43pm AEST");
// Neither zero, null, nor malformed data becomes the date of the Unix epoch.
assert.equal(formatAgencyTimestamp(null,"energex"),"");
assert.equal(formatAgencyTimestamp("not a source time","qfd"),"not a source time");
assert.equal(formatAgencyTimestamp("","bom-gauge"),"");
// Numeric ArcGIS milliseconds and provider ISO offsets refer to the same instant.
assert.equal(formatPowerOutageTime("2026-10-27T14:43:00+10:00","Energex"),
 formatPowerOutageTime(at,"Energex"));
// The previous approved stale-water calculation stays unchanged except BoM
// timestamp is consistently expressed in the original station-table style.
const rows=Object.fromEntries(riverGaugeRoadReferenceRows({
 crossingType:"A",crossingLevelMetres:6.25,heightMetres:6.74,
 observationStale:true,officialObservedAt:at,crossingReached:false,
 crossingName:"BoM station approaches level"}));
assert.match(rows["Water over approaches"],
 /0\.49 m over published approaches level as at 14:43 27\/10\/2026 AEST/);
assert.match(rows["Water over approaches"],/STALE — current level unverified/);
const root=new URL("../src/context-layers/",import.meta.url);
for(const [path,key] of [
 ["river-gauges-operational-v1.js","bom-gauge"],
 ["significant-rainfall-operational-v1.js","bom-issued"],
 ["power-outages-operational-v1.js","formatAgencyTimestamp(value,provider)"],
 ["flood-road-closures-operational-v1.js","qldtraffic"],
 ["qfd-technical-rescues-operational-v1.js","qfd"]
]){
 const code=readFileSync(new URL(path,root),"utf8");
 assert(code.includes("agency-source-time-v1.js"),path+" must use the shared agency formatter");
 assert(code.includes(key),path+" must select the agency profile");
}
const build=readFileSync(new URL("../../scripts/build-current-site.sh",import.meta.url),"utf8");
assert(build.includes('"agency-source-time-v1.js"'),"Published Pages must ship formatter");
assert(build.includes("agency-time-formats-20261027-v1"),"Browser cache must reload new panel labels");
console.log("PASS BoM gauge/issued, Energex/Ergon, Essential Energy AEDT/AEST, QLDTraffic/QFD presentation, missing timestamps, published modules and unchanged last-measured flood depth");
