import assert from "node:assert/strict";
import {parseQldOfficialFloodLevels,observedFloodClass,
  withStationFloodLevels,stationFloodLevels}
  from "../src/context-layers/river-flood-thresholds-v1.js";
import {evaluateFloodSignal} from "../src/context-layers/river-flood-signals-v1.js";
import {reconcileFloodEvents} from "../src/context-layers/river-flood-events-v1.js";
const row=(id,minor,moderate,major)=>{
  const x=Array(122).fill(" ");
  const put=(at,value)=>{for(let i=0;i<value.length;i++)x[at+i]=value[i];};
  put(27,id);put(34,"TARANA CROSSING ALERT");
  put(85,minor);put(100,moderate);put(117,major);
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
