import assert from "node:assert/strict";
import {parsePublishedReflectivityTimes} from "../frontend/src/bom-wmts-published-times-v1.js";
const url="https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/wmts-native-capabilities";
const origin="https://blakesmith-intel.github.io";
const result=await fetch(url,{headers:{Origin:origin,Accept:"application/xml"},signal:AbortSignal.timeout(20000)});
const xml=await result.text();
assert.equal(result.status,200,"Production Worker native WMTS capabilities must be available");
assert.equal(result.headers.get("access-control-allow-origin"),origin);
assert(xml.includes("atm_surf_air_precip_reflectivity_dbz"));
const times=parsePublishedReflectivityTimes(xml);
assert(times.length>=7&&times.length<=12);
const latest=times.at(-1);
const age=Date.now()-Date.parse(latest);
assert(age>=-5*60000&&age<40*60000,
 "Published national mosaic must be current, not stale fallback KVP times");
console.log("NATIVE_BOM_WMTS_RELAY_PRODUCTION_PASS",JSON.stringify({url,published:times,ageMinutes:Math.round(age/60000),bytes:xml.length,origin}));
