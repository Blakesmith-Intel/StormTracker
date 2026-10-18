import assert from "node:assert/strict";
import {classifyReflectivityFailure,resolveSourceDiscovery} from "../frontend/src/radar-source-fallback-v1.js";
assert.deepEqual(classifyReflectivityFailure(Error("BoM WMTS capabilities HTTP 502")),{category:"wmts-metadata-or-publication",status:502,message:"BoM WMTS capabilities HTTP 502"});
assert.equal(classifyReflectivityFailure(Error("BoM WMTS source time preflight failed HTTP 400")).status,400);
assert.equal(resolveSourceDiscovery({outcome:{times:["2026-10-18T23:09:00Z"]}}).times.length,1);
assert.equal(resolveSourceDiscovery({outcome:{error:Error("HTTP 400 tile")},cachedFrames:[{observedUtc:"genuine"}]}).cachedOnly,true);
assert.equal(resolveSourceDiscovery({outcome:{error:Error("HTTP 502 network")},automatic:true}).keepCurrent,true);
assert.throws(()=>resolveSourceDiscovery({outcome:{error:Error("HTTP 400 tile")}}),/source=wmts-tile, HTTP 400/);
console.log("PASS: source classification, cached-frame fallback, auto-refresh preservation, strict failure");
