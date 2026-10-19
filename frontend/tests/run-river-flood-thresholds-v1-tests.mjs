import assert from "node:assert/strict";
import {parseQldOfficialFloodLevels,observedFloodClass,
  withStationFloodLevels,stationFloodLevels,VERIFIED_STATEWIDE_FLOOD_LEVELS}
  from "../src/context-layers/river-flood-thresholds-v1.js";
import {evaluateFloodSignal} from "../src/context-layers/river-flood-signals-v1.js";
import {VERIFIED_MAY_2026_STAGES}
  from "../src/context-layers/river-flood-stages-2026-verified-v1.js";
import {reconcileFloodEvents} from "../src/context-layers/river-flood-events-v1.js";
// Regression against the NEWER May 2026 BoM Service Level Specification.
// The 2022 catalogue, a persisted feature or a stale relay must never
// override current explicitly verified flood stage for the same station ID.
for(const [id,expected] of Object.entries({
  "bom:540610":{minor:98.1,moderate:100.7,major:102.3},
  "bom:540057":{minor:76.2,moderate:77.7,major:79.2},
  "bom:539066":{minor:111.5,moderate:115,major:121},
  "bom:540646":{minor:41.5,moderate:42,major:42.5}
})){
  assert.deepEqual(VERIFIED_MAY_2026_STAGES[id],expected);
  assert.deepEqual(stationFloodLevels({id,properties:{
    STORMTRACKER_MINOR_FLOOD_METRES:3,
    STORMTRACKER_MODERATE_FLOOD_METRES:6,
    STORMTRACKER_MAJOR_FLOOD_METRES:7.8
  }},{"bom:540610":{minor:3.6,moderate:6.2,major:7.8}}),expected);
  const staged=withStationFloodLevels([{id,properties:{}}])[0];
  assert.deepEqual([staged.properties.STORMTRACKER_MINOR_FLOOD_METRES,
    staged.properties.STORMTRACKER_MODERATE_FLOOD_METRES,
    staged.properties.STORMTRACKER_MAJOR_FLOOD_METRES],
    [expected.minor,expected.moderate,expected.major]);
  assert.equal(staged.properties.STORMTRACKER_THRESHOLD_SOURCE_DATE,"2026-05");
  assert.equal(observedFloodClass(expected.major-0.01,expected),"moderate");
  assert.equal(observedFloodClass(expected.major,expected),"major");
}
assert.equal(Object.keys(VERIFIED_STATEWIDE_FLOOD_LEVELS).length,1080,
  "Complete source-backed Queensland BoM fixed-width reference must be bundled");
assert.deepEqual(VERIFIED_STATEWIDE_FLOOD_LEVELS["bom:535142"],
  {minor:6,moderate:9,major:12});
assert.deepEqual(VERIFIED_STATEWIDE_FLOOD_LEVELS["bom:544058"],
  {minor:3,moderate:4,major:5});
assert.deepEqual(VERIFIED_STATEWIDE_FLOOD_LEVELS["bom:540319"],
  {minor:1.7,moderate:2.4,major:3.5});
assert.deepEqual(stationFloodLevels({id:"bom:540319",properties:{}}),
  {minor:1.7,moderate:2.4,major:3.5},
  "All stations with published stages must show stages without live relay");
assert.equal(stationFloodLevels({id:"bom:540610",properties:{
  STORMTRACKER_MINOR_FLOOD_METRES:3.6,
  STORMTRACKER_MODERATE_FLOOD_METRES:6.2,
  STORMTRACKER_MAJOR_FLOOD_METRES:7.8
}}).major,102.3,
  "Never read an AHD dam-level station against an obsolete gauge-relative stage");
assert.equal(stationFloodLevels({id:"bom:540097",properties:{name:"OXLEY CREEK"}}).major,6,
  "New Beith station 540097 cannot inherit Oxley Creek 540646's classification");
assert.equal(stationFloodLevels({id:"bom:539066",properties:{}}).major,121);
assert.equal(stationFloodLevels({id:"bom:540057",properties:{}}).major,79.2);
assert.equal(stationFloodLevels({id:"bom:999999",properties:{}}),null,
  "Never invent a stage where source provides none");
const row=(id,minor,moderate,major)=>{
  const x=Array(122).fill(" ");
  const put=(at,value)=>{for(let i=0;i<value.length;i++)x[at+i]=value[i];};
  put(27,id);put(34,"TARANA CROSSING ALERT");
  put(81,minor);put(97,moderate);put(113,major);
  return x.join("");
};
const html="<pre>\n"+row("535142","6.0","9.0","12.0")+"\n"+
  row("540319","1.7","2.4","3.5")+"\n"+
  row("544058","3.0","4.0","5.0")+"\n</pre>";
const catalog=parseQldOfficialFloodLevels(html);
assert.deepEqual(catalog["bom:535142"],{minor:6,moderate:9,major:12});
assert.deepEqual(catalog["bom:540319"],{minor:1.7,moderate:2.4,major:3.5});
assert.deepEqual(catalog["bom:544058"],{minor:3,moderate:4,major:5});
for(const [height,stage] of [[2.99,null],[3,"minor"],[3.99,"minor"],
  [4,"moderate"],[4.25,"moderate"],[4.99,"moderate"],[5,"major"]])
  assert.equal(observedFloodClass(height,catalog["bom:544058"]),stage);

// A field with crops/town impact levels must never contaminate
// the genuine minor/moderate/major flood thresholds.
const mixed=row("535142","6.0","9.0","12.0").split("");
mixed.splice(88,4,..."9.0 ");
mixed.splice(106,4,..."4.0 ");
const actual=parseQldOfficialFloodLevels("<pre>"+mixed.join("")+"</pre>");
assert.deepEqual(actual["bom:535142"],{minor:6,moderate:9,major:12});
const thresholds=catalog["bom:535142"];
for(const [metres,stage] of [[0.23,null],[5.99,null],[6,"minor"],
 [8.99,"minor"],[9,"moderate"],[12,"major"]])
 assert.equal(observedFloodClass(metres,thresholds),stage);
assert.equal(observedFloodClass(0.23,null),undefined);
const now=Date.UTC(2026,9,19,13,36);
const gauge=(height,time,id="535142")=>({id:"bom:"+id,type:"Feature",
  geometry:{type:"Point",coordinates:[149.56,-25.79]},
  properties:{bom_stn_num:id,lat:-25.79,long:149.56,
    location_types:"water level gauge;",STORMTRACKER_HEIGHT_METRES:height,
    STORMTRACKER_TENDENCY:"falling",STORMTRACKER_FLOOD_CLASS:"",
    STORMTRACKER_OBSERVED_TEXT:time,
    STORMTRACKER_LAST_CONFIRMED_FLOOD_CLASS:"minor",
    STORMTRACKER_LAST_CONFIRMED_FLOOD_AT:now-90*60000}});
const tarana=withStationFloodLevels([gauge(0.23,"10.57PM Mon")],catalog)[0];
assert.equal(stationFloodLevels(tarana).minor,6);
assert.equal(evaluateFloodSignal(tarana,{},now).show,false,
 "Newer 0.23m reading must remove cached minor alert at 6.00m");
for(const [metres,stage] of [[6,"minor"],[9,"moderate"],[12,"major"]]){
 const sample=withStationFloodLevels([gauge(metres,"11.15PM Mon")],catalog)[0];
 assert.equal(evaluateFloodSignal(sample,{},now).state,stage);
}
const unknown=gauge(0.23,"10.57PM Mon","535999");
assert.equal(evaluateFloodSignal(unknown,{},now).state,"unverified",
 "Newer gauge with no thresholds must not inherit an old green classification");
const warilda=(height,time,reported="minor")=>({
  id:"bom:544058",type:"Feature",
  geometry:{type:"Point",coordinates:[145,-26.6]},
  properties:{bom_stn_num:"544058",lat:-26.6,long:145,
    STORMTRACKER_OBSERVED_TEXT:time,STORMTRACKER_TENDENCY:"rising",
    STORMTRACKER_HEIGHT_METRES:height,STORMTRACKER_FLOOD_CLASS:reported,
    STORMTRACKER_LAST_CONFIRMED_FLOOD_CLASS:"minor",
    STORMTRACKER_LAST_CONFIRMED_FLOOD_AT:now-60*60000}
});
for(const [height,stage] of [[2.99,null],[3,"minor"],[3.99,"minor"],
  [4,"moderate"],[4.25,"moderate"],[4.99,"moderate"],[5,"major"]]){
  const f=withStationFloodLevels([warilda(height,"11.16PM Mon")],catalog)[0];
  const d=evaluateFloodSignal(f,{},now);
  assert.equal(d.show,stage!==null);
  if(stage!==null)assert.equal(d.state,stage,
    "Warilda marker MUST use the latest height, not cached minor colour");
}
const warildaModerate=withStationFloodLevels([warilda(4.25,"11.16PM Mon")],catalog)[0];
assert.equal(reconcileFloodEvents([warildaModerate],{}, {},now).features[0]
  .properties.STORMTRACKER_DISPLAY_STATE,"moderate");
for(const [station,levels] of Object.entries(catalog)){
  for(const [height,expected] of [[levels.minor-0.01,null],
    [levels.minor,"minor"],[levels.moderate,"moderate"],[levels.major,"major"]]){
    if(height<0)continue;
    const f=withStationFloodLevels([gauge(height,"11.15PM Mon",station.slice(4))],catalog)[0];
    assert.equal(evaluateFloodSignal(f,{},now).state??null,expected,
      station+" source level at "+height+"m");
  }
}

console.log("PASS BoM exact station thresholds and Tarana true-stage colour transitions.");
