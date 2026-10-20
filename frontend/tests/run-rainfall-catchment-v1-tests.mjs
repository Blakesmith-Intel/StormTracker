import assert from "node:assert/strict";
import {catchmentForStation} from "../src/context-layers/rainfall-catchment-v1.js";
const registry={schema:"StormTrackerBoMQldRainfallBasinsV1",
 stations:{"543013":{name:"KINGULL TM",basin:"Condamine–Balonne",latitude:-26.409444,longitude:148.655}}};
const point={id:"543013",name:"Kingull",latitude:-26.4094,longitude:148.655};
assert.equal(catchmentForStation(point,registry),"Condamine–Balonne");
assert.equal(catchmentForStation({...point,longitude:153.655},registry),null,
 "A recycled/mislocated station ID must not inherit the wrong basin");
assert.equal(catchmentForStation({...point,id:"999999"},registry),null);
assert.equal(catchmentForStation(point,{schema:"unknown",stations:registry.stations}),null);
console.log("PASS: exact BoM station/catchment matching with coordinate safeguard");
