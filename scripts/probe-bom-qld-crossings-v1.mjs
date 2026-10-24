import assert from "node:assert/strict";
import {QLD_CROSSING_SOURCE,parseBomQueenslandCrossings}
 from "../relay/river-crossing-heights-v1.js";
const response=await fetch(QLD_CROSSING_SOURCE,{
 headers:{Accept:"text/html"},signal:AbortSignal.timeout(20000)
});
assert(response.ok,"Official BoM crossing register HTTP "+response.status);
const html=await response.text();
const entries=parseBomQueenslandCrossings(html);
const count=Object.keys(entries).length;
assert(count>=40,"BoM Section 5 returned fewer than 40 validated bridge/causeway/crossing station numbers: "+count);
assert.equal(entries["bom:540063"]?.heightMetres,2.67,
 "BoM Colleges Crossing same-station X level has changed; review source before production");
assert.equal(entries["bom:540291"]?.heightMetres,-0.03,
 "BoM Clagiraba Road Causeway same-station C level has changed; review source");
assert.equal(entries["bom:540254"]?.heightMetres,4.6,
 "BoM Mudgeeraba Bridge same-station B level has changed; review source");
console.log("PASS BoM authentic Section 5 crossing height catalogue",count,
 "exact station IDs, including road crossing/bridge/causeway examples");
