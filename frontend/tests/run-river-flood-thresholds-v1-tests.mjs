import assert from "node:assert/strict";
import {parseQldOfficialFloodLevels,observedFloodClass,
  withStationFloodLevels,stationFloodLevels}
  from "../src/context-layers/river-flood-thresholds-v1.js";
import {evaluateFloodSignal} from "../src/context-layers/river-flood-signals-v1.js";
const row=(id,minor,moderate,major)=>{
  const x=Array(122).fill(" ");
  const put=(at,value)=>{for(let i=0;i<value.length;i++)x[at+i]=value[i];};
  put(31,id);put(38,"TARANA CROSSING ALERT");
  put(85,minor);put(100,moderate);put(116,major);
  return x.join("");
};
const html="<pre>\n"+row("535142","6.0","9.0","12.0")+"\n"+
  row("540319","1.7","2.4","3.5")+"\n</pre>";
const catalog=parseQldOfficialFloodLevels(html);
assert.deepEqual(catalog["bom:535142"],{minor:6,moderate:9,major:12});
assert.deepEqual(catalog["bom:540319"],{minor:1.7,moderate:2.4,major:3.5});
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
assert.equal(evaluateFloodSignal(unknown,{},now).state,"minor",
 "Unknown gauge must not inherit Tarana thresholds or falsely clear class");
console.log("PASS BoM exact station thresholds and Tarana true-stage colour transitions.");
