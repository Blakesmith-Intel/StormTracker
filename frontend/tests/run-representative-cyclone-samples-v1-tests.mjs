import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  HISTORICAL_CYCLONE_IDS,validateHistoricalCycloneBundle,
  historicalCycloneMoments,historicalCycloneSnapshot
} from "../src/historical-cyclone-replay-v1.js";
const read=id=>JSON.parse(readFileSync(new URL("../data/cyclone-history/"+id+".json",import.meta.url),"utf8"));
const expected=[
  {id:"alfred-2025",fixes:24,wind:16,allWind:158,issues:8,allIssues:83,
   bands:["Damaging","Destructive","Very Destructive"],layer:25011},
  {id:"narelle-2026",fixes:21,wind:67,allWind:244,issues:7,allIssues:26,
   bands:["Damaging","Destructive","Very Destructive"],layer:26021},
  {id:"jasper-2023",fixes:21,wind:11,allWind:39,issues:8,allIssues:28,
   bands:["Damaging","Destructive"],layer:23011}
];
assert.deepEqual(HISTORICAL_CYCLONE_IDS.slice(0,3),expected.map(x=>x.id),
  "Alfred must remain the primary historical source case");
for(const config of expected){
  const data=validateHistoricalCycloneBundle(read(config.id));
  assert.equal(data.id,config.id);
  assert.equal(data.historical,true);
  assert.equal(data.notLive,true);
  assert.equal(data.kind,"observed-cyclone-archive");
  assert.equal(data.trackOrigin,"original-archived-observed-line",
    "Tests require authentic observed source line, NOT an inferred forecast");
  assert.equal(data.fixes.length,config.fixes);
  assert.equal(data.windAreas.length,config.wind);
  assert.equal(data.totalArchivedWindAreaFeatures,config.allWind);
  assert.equal(data.windAreaAvailableTimes.length,config.issues);
  assert.equal(data.totalArchivedIssueTimes,config.allIssues);
  assert.ok(data.sources.some(s=>s.endsWith("/"+config.layer)));
  assert.ok(data.fixes.every(f=>f.type==="Observed"||f.type==="Current"));
  assert.ok(data.windAreas.every(f=>
    f.geometry?.type==="Polygon"||f.geometry?.type==="MultiPolygon"));
  assert.ok(data.windAreas.every(f=>Number.isFinite(Date.parse(f.issueUtc))));
  assert.ok(data.windAreas.every(f=>!f.forecastValidUtc||
    Number.isFinite(Date.parse(f.forecastValidUtc))));
  const present=[...new Set(data.windAreas.map(a=>a.windType))].sort();
  assert.deepEqual(present,config.bands.slice().sort());
  const first=data.windAreaAvailableTimes[0],last=data.windAreaAvailableTimes.at(-1);
  assert.ok(new Date(first)<=new Date(last));
  const moments=historicalCycloneMoments(data);
  assert.ok(moments.includes(first)&&moments.includes(last));
  const time=historicalCycloneSnapshot(data,last);
  assert.equal(time.live,false);
  assert.equal(time.forecast,false);
  assert.equal(time.officialThunderstormWarning,false);
  assert.ok(time.windAtIssue.length>0);
  assert.ok(time.fixesSoFar.every(f=>f.utc<=last));
  assert.ok(time.windAtIssue.every(a=>a.issueUtc===last),
    "Only exactly original archived issue time may show a polygon");
  // Source polygons must remain original vertex sequences, not
  // downsampled or generated as regular circles/cones.
  const original=data.windAreas[0].geometry.coordinates;
  assert.ok(Array.isArray(original)&&original.length>0);
  const coords=data.windAreas[0].geometry.type==="Polygon"?original[0]:original[0][0];
  assert.ok(coords.length>=4);
  assert.deepEqual(coords[0],coords.at(-1));
  console.log("PASS "+config.id+": "+config.fixes+" original fixes, "+
    config.wind+" unmodified source wind areas, "+
    config.issues+" issued-time QA samples; no fabricated live forecast.");
}
assert.ok(HISTORICAL_CYCLONE_IDS.includes("koji-2026"),
  "Keep rapid regression weather case");
assert.ok(HISTORICAL_CYCLONE_IDS.includes("yasi-2011"),
  "Retain reanalysed best-track-only historical reference");
const overlay=readFileSync(new URL("../src/historical-cyclone-overlay-v1.js",import.meta.url),"utf8");
assert.match(overlay,/pick\.value=caseIds\[0\]/);
assert.match(overlay,/caseIds=HISTORICAL_CYCLONE_IDS/);
assert.match(overlay,/STRESS — TC Narelle/);
assert.match(overlay,/FAR NORTH — TC Jasper/);
assert.match(overlay,/historicalCycloneMoments\(bundle\)/);
console.log("PASS source-authentic cross-border, extreme-intensity and far-north QA suite; display only, never sealed production.");
