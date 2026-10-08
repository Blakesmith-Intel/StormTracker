import assert from "node:assert/strict";
import {
  classifyQfdRescueJobType,qfdPublicClassificationAvailability,
  QFD_JOB_TYPE_LABELS
} from "../src/context-layers/qfd-rescue-job-types-v1.js";
import {
  normaliseQfdTechnicalRescues,fetchQfdTechnicalRescues,
  qfdTechnicalRescueUrl,qfdRescueSubtypeAvailability
} from "../src/context-layers/qfd-technical-rescues-v1.js";
let checks=0;
function test(name,fn) {
  checks++;
  fn();
  console.log("PASS "+name);
}
test("QFD water rescue types are recognised but not inferred",()=>{
  for(const type of ["Rescue water all types","XE Rescue Water"," rescue  water  all types "]) {
    const result=classifyQfdRescueJobType(type);
    assert.deepEqual(result,{category:"water",rescue:true,requested:true});
  }
  assert.equal(classifyQfdRescueJobType("RESCUE TECHNICAL").requested,false);
  assert.equal(classifyQfdRescueJobType("flooded road").requested,false);
});
test("Vertical rescue is separate from mountain rescue",()=>{
  assert.equal(classifyQfdRescueJobType("Rescue Vertical").category,"vertical");
  assert.equal(classifyQfdRescueJobType("Rescue Mountain Rescue").category,"mountain");
  assert.equal(classifyQfdRescueJobType("Rescue Mountain Rescue").requested,false);
});
test("Weather assistance and large multi RTC never become water or vertical rescue",()=>{
  assert.equal(classifyQfdRescueJobType("Assist Extreme Weather").requested,false);
  assert.equal(classifyQfdRescueJobType("Rescue RTC Large Multi").requested,false);
  assert.equal(classifyQfdRescueJobType("Rescue RTC Large Multi").category,"road-crash");
});
test("Public QFD ESCAD grouped type is insufficient for requested subtypes",()=>{
  const fields=["OBJECTID","Master_Incident_Number","GroupedType","Locality","CurrentStatus"];
  const available=qfdPublicClassificationAvailability(fields);
  assert.equal(available.groupedTypeAvailable,true);
  assert.equal(available.waterRescueDistinguishable,false);
  assert.equal(available.verticalRescueDistinguishable,false);
  assert.equal(available.detailedSubtypeField,null);
  assert.equal(qfdRescueSubtypeAvailability().swiftWater,false);
  assert.equal(qfdRescueSubtypeAvailability().vertical,false);
});
test("Future verified job-type field can be recognised without guessing current classification",()=>{
  const available=qfdPublicClassificationAvailability(["GroupedType","JobType"]);
  assert.equal(available.detailedSubtypeField,"jobtype");
});
test("Query contains published grouped rescue type, not unverified specific labels",()=>{
  const url=new URL(qfdTechnicalRescueUrl());
  assert.equal(url.searchParams.get("where"),"GroupedType = 'RESCUE TECHNICAL'");
  assert.equal(url.searchParams.get("resultRecordCount"),"500");
  assert.equal(url.searchParams.get("outSR"),"4326");
  assert.equal(url.searchParams.get("f"),"geojson");
  assert.throws(()=>qfdTechnicalRescueUrl(4),RangeError);
});
const sample={
  type:"FeatureCollection",
  features:[{
    type:"Feature",geometry:{type:"Point",coordinates:[153.12,-27.5]},
    properties:{Master_Incident_Number:"example-1",GroupedType:"RESCUE TECHNICAL",
      CurrentStatus:"RESPONDING",Locality:"Example",Response_Date:1728320000000,
      VehiclesAssigned:2,VehiclesOnRoute:1,VehiclesOnScene:1}
  },{
    type:"Feature",geometry:{type:"Point",coordinates:[153.1,-27.5]},
    properties:{Master_Incident_Number:"wrong-type",GroupedType:"RESCUE ROAD CRASH"}
  },{
    type:"Feature",geometry:{type:"Point",coordinates:[151,-30]},
    properties:{Master_Incident_Number:"not-qld",GroupedType:"RESCUE TECHNICAL"}
  }]
};
test("QFD source preserves official approximate location and never invents subtype",()=>{
  const result=normaliseQfdTechnicalRescues(sample);
  assert.equal(result.length,1);
  assert.equal(result[0].id,"example-1");
  assert.equal(result[0].category,"technical-unspecified");
  assert.equal(result[0].subtypeVerified,false);
  assert.equal(result[0].longitude,153.12);
  assert.equal(result[0].vehiclesAssigned,2);
});
test("Malformed or provider-error payloads fail closed",()=>{
  assert.throws(()=>normaliseQfdTechnicalRescues({features:[]}),/GeoJSON/);
  assert.throws(()=>normaliseQfdTechnicalRescues({error:{message:"service down"}}),/service down/);
});
await (async()=>{
  checks++;
  const calls=[];
  const features=await fetchQfdTechnicalRescues({fetchImpl:async(url)=>{
    calls.push(url);
    return {ok:true,json:async()=>sample};
  }});
  assert.equal(calls.length,1);
  assert.equal(features.length,1);
  console.log("PASS source adapter single-page fetch");
})();
await (async()=>{
  checks++;
  await assert.rejects(fetchQfdTechnicalRescues({fetchImpl:async()=>({
    ok:false,status:503
  })}),/HTTP 503/);
  console.log("PASS upstream error doesn't masquerade as no incidents");
})();
for(const label of Object.values(QFD_JOB_TYPE_LABELS))assert.ok(label.length>0);
console.log(checks+" QFD rescue classification checks passed.");
