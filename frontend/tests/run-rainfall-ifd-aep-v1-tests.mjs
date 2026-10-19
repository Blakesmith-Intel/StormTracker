import assert from "node:assert/strict";
import fs from "node:fs";
import {classifyRainfallAep,ifdCellKey,since9amWindowMinutes,rainfallWindowMinutes} from "../src/context-layers/rainfall-ifd-aep-v1.js";
const grid=JSON.parse(fs.readFileSync(new URL("../data/ifd-2016-verified-points-v1.json",import.meta.url)));
const gold={latitude:-28.002,longitude:153.424,grid,period:"lastHour",sourceCreatedAt:"2026-10-19T00:15:00Z"};
assert.equal(ifdCellKey(gold.latitude,gold.longitude),"-28.0125,153.4125");
const classify=(mm,options=gold)=>classifyRainfallAep({...options,mm});
assert.equal(classify(50).classification,"below-20pct-aep","50mm / 1h Gold Coast must not be marked ≥20% AEP");
assert.equal(classify(59.3).band,"green");
assert.equal(classify(70.3).band,"yellow");
assert.equal(classify(81.4).band,"orange");
assert.equal(classify(96.8).band,"red");
assert.equal(classify(109).band,"purple");
assert.equal(classify(300).aepDesignThreshold,1);
assert.equal(classify(50,{...gold,latitude:-25.9105,longitude:144.6008}).classification,"unclassified",
 "No fabricated Adavale IFD thresholds");
assert.equal(since9amWindowMinutes("2026-10-19T01:00:00Z"),120,"11am AEST = 2h since9");
assert.equal(rainfallWindowMinutes("since9am","2026-10-19T01:00:00Z"),120);
assert.equal(since9amWindowMinutes("2026-10-18T22:00:00Z"),1380,"8am AEST = 23h since previous 9am");
const twoHour={...gold,period:"since9am",sourceCreatedAt:"2026-10-19T01:00:00Z"};
assert.equal(classify(50,twoHour).band,null);
assert.equal(classify(78.2,twoHour).band,"green");
const partial=classify(100,{...gold,period:"since9am",sourceCreatedAt:"2026-10-19T01:15:00Z"});
assert.equal(partial.durationMinutes,135);
assert.equal(partial.interpolatedDuration,true);
const invalid={...grid,cells:{...grid.cells, "-28.0125,153.4125":{depthsMmByMinutes:{"60":{"20":60,"10":40,"5":80,"2":100,"1":120}}}}};
assert.equal(classifyRainfallAep({...gold,mm:100,grid:invalid}).classification,"unclassified");
assert.equal(classifyRainfallAep({...gold,mm:100,sourceCreatedAt:"not-a-date"}).classification,"unclassified");
// Prove the algorithm distinguishes locations without inventing Adavale
// climatology. Synthetic numbers are a math TEST ONLY, never production data.
const synthetic={schema:grid.schema,source:"SYNTHETIC TEST ONLY",cells:{
 "-25.9125,144.6125":{depthsMmByMinutes:{"60":{"20":15,"10":25,"5":35,"2":45,"1":55}}}}};
const hypothetical=classifyRainfallAep({mm:50,period:"lastHour",sourceCreatedAt:gold.sourceCreatedAt,latitude:-25.9105,longitude:144.6008,grid:synthetic});
assert.equal(hypothetical.band,"red");
console.log("PASS IFD official Gold Coast durations, local rarity grades, AEST since9am, absent-cell quarantine and synthetic algorithm-only regional comparison");
