import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=(name)=>readFileSync("frontend/src/context-layers/"+name,"utf8");
const road=root("flood-road-closures-operational-v1.js");
const power=root("power-outages-operational-v1.js");
const gauge=root("river-gauges-operational-v1.js");
const layer=root("river-gauge-layer-v1.js");
const events=root("river-flood-events-v1.js");
const css=readFileSync("frontend/src/operational-dashboard-v9-1.css","utf8");
for(const [name,src] of [["road",road],["power",power],["gauge",gauge]]){
  assert.match(src,/official-source-links-v1\.js\?v=9\.13\.2/,
    `${name} panel must import trusted link builder`);
  assert.match(src,/addOfficialSourceRow\(/,
    `${name} must render clickable Source link, not static text`);
}
assert.match(road,/roadOfficialUrl\(summary\.webLink\)/);
assert.match(power,/powerOfficialUrl\(summary\.provider\)/);
assert.match(gauge,/bomGaugePlotUrl\(summary\.recentDataHref\)/);
assert.match(gauge,/View recent observations and river-height plot/);
assert.match(gauge,/showRiverGaugeInfo\(latest\?\?null\)/,
 "Selected gauge information panel must update on new BoM bulletin");
assert.match(gauge,/Event state/);
assert.match(layer,/reconcileFloodEvents\(/);
assert.match(layer,/FLOOD_EVENTS_STORAGE_KEY/);
assert.match(layer,/persistEventState\(/);
assert.match(events,/RECOVERY_MIN_GAP_MS=15\*60000/);
for(const panel of ["riverGaugeInfoRows","powerOutageInfoRows","floodRoadClosureInfoRows"])
 assert.ok(css.includes("#"+panel+" > a"),
   `Clickable ${panel} source URLs must receive legible styling`);
console.log("Map panel contract passed: trusted official clickable source rows in every operational panel, direct BoM station plot, live selected-gauge refresh, persisted event state and accessible link styling.");
