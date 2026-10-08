import assert from "node:assert/strict";
import {
  DEFAULT_RIVER_HEIGHT_RELAY_URL,
  DEFAULT_RIVER_GAUGE_METADATA_RELAY_URL,
  joinRiverGaugeObservations
} from "../frontend/src/context-layers/river-gauge-observations-v1.js";
import {parseQueenslandObservationTime} from "../frontend/src/context-layers/river-flood-signals-v1.js";

const urls=[DEFAULT_RIVER_GAUGE_METADATA_RELAY_URL,DEFAULT_RIVER_HEIGHT_RELAY_URL];
const payloads=await Promise.all(urls.map(async url=>{
  const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{Accept:"application/json"}});
  assert.equal(response.ok,true,`BoM relay failed for ${url}: HTTP ${response.status}`);
  return response.json();
}));
const gauges=payloads[0],bulletins=payloads[1];
const joined=joinRiverGaugeObservations({gauges,bulletins});
const obs=(bulletins.products??[]).flatMap(x=>x.observations??[]);
assert.ok((gauges.features?.length??0)>10,"QLD gauge metadata unexpectedly empty");
assert.ok(obs.length>10,"BoM live river-height bulletin unexpectedly empty");
assert.ok(joined.matchedCount>2,"Station match rate unexpectedly low");
const now=Date.now();
const timestamps=obs.map(x=>({
  time:x.observedText,
  parsed:parseQueenslandObservationTime(x.observedText,now)
}));
const withTime=timestamps.filter(x=>x.parsed!==null).length;
const fraction=withTime/timestamps.length;
const examples=timestamps.slice(0,5).map(x=>({
  reported:x.time,parsed:x.parsed===null?"unusable":new Date(x.parsed).toISOString()
}));
console.log(JSON.stringify({
  gauges:gauges.features.length,observations:obs.length,
  matches:joined.matchedCount,datedRecent:withTime,
  parseFraction:Number(fraction.toFixed(2)),
  examples,
  partial:bulletins.partial,
  failures:(bulletins.failed??[]).length
},null,2));
assert.ok(fraction>=0.65,`Only ${(fraction*100).toFixed(1)}% of BoM bulletin times are interpretable; cannot safely infer rates`);
console.log("Live BoM flood screening compatibility passed: relayed gauge metadata, bulletin matching and dated AEST observations.");
