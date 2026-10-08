import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {
  classifyQfdRescueJobType,qfdPublicClassificationAvailability,QFD_JOB_TYPE_LABELS
} from "../src/context-layers/qfd-rescue-job-types-v1.js";
import {
  normaliseQfdPublicIncidents,fetchQfdPublicIncidents,
  qfdPublicIncidentUrl,QFD_PUBLIC_GROUPS,QFD_PUBLIC_GROUP_NAMES,
  qfdPublicGroupCounts,qfdRescueSubtypeAvailability
} from "../src/context-layers/qfd-technical-rescues-v1.js";
import {
  safeQfdSymbolImage,qfdOfficialSymbolCatalog,provisionalQfdSymbol,
  qfdSymbolFor,fetchQfdPublicSymbolCatalog,QFD_GROUP_ICON_COUNT
} from "../src/context-layers/qfd-public-symbols-v1.js";
let checks=0;
function test(name,fn) {fn();checks++;console.log("PASS "+name);}
function source(rel){return readFileSync(fileURLToPath(new URL(rel,import.meta.url)),"utf8");}
const accepted=["RESCUE TECHNICAL","RESCUE ROAD CRASH","ASSIST PUBLIC"];
test("Only three official GroupedType categories are permitted",()=>{
  assert.deepEqual(QFD_PUBLIC_GROUP_NAMES,accepted);
  assert.equal(Object.keys(QFD_PUBLIC_GROUPS).length,3);
  assert.deepEqual(QFD_PUBLIC_GROUP_NAMES.map(g=>QFD_PUBLIC_GROUPS[g].label),
    ["Technical rescue","Road crash rescue","Public assistance"]);
});
test("The ArcGIS query filters only the exact published groups",()=>{
  const u=new URL(qfdPublicIncidentUrl());
  assert.equal(u.searchParams.get("where"),
    "GroupedType IN ('RESCUE TECHNICAL','RESCUE ROAD CRASH','ASSIST PUBLIC')");
  assert.equal(u.searchParams.get("f"),"geojson");
  assert.equal(u.searchParams.get("outSR"),"4326");
  assert.equal(u.searchParams.get("resultRecordCount"),"500");
  assert.match(u.searchParams.get("outFields"),/GroupedType/);
  assert.match(u.searchParams.get("outFields"),/Jurisdiction/);
  assert.throws(()=>qfdPublicIncidentUrl(-1),RangeError);
  assert.throws(()=>qfdPublicIncidentUrl(25),RangeError);
});
const make=(id,groupedType,coordinates=[153.12,-27.5],overrides={})=>({
  type:"Feature",geometry:{type:"Point",coordinates},
  properties:{Master_Incident_Number:id,GroupedType:groupedType,
    Locality:"Test locality",Location:"General locality",Jurisdiction:"QFD",
    CurrentStatus:"RESPONDING",Response_Date:1728320000000,
    VehiclesAssigned:2,VehiclesOnRoute:1,VehiclesOnScene:1,...overrides}
});
const sample={type:"FeatureCollection",features:[
  make("Q1","RESCUE TECHNICAL"),
  make("Q2","RESCUE ROAD CRASH"),
  make("Q3","ASSIST PUBLIC"),
  make("F1","FIRE VEGETATION"),
  make("E1","EVENTS PLANNED"),
  make("X1","OTHER ALL"),
  make("N1","RESCUE TECHNICAL",[151,-31]),
  make("C1","RESCUE TECHNICAL",[153.2,-27.6],{CurrentStatus:"CLOSED"})
]};
test("Normalization retains exactly the three QFD groups and no unrelated incidents",()=>{
  const v=normaliseQfdPublicIncidents(sample);
  assert.equal(v.length,3);
  assert.deepEqual(v.map(x=>x.id),["Q1","Q2","Q3"]);
  assert.deepEqual(v.map(x=>x.category),
    ["technical-rescue","road-crash-rescue","public-assistance"]);
  assert.ok(v.every(x=>x.subtypeVerified===false));
  assert.equal(v[0].longitude,153.12);
  assert.equal(v[0].vehiclesAssigned,2);
});
test("GroupedType never falsely implies SES tasking, swift water or road closure",()=>{
  const v=normaliseQfdPublicIncidents(sample);
  assert.equal(v[1].groupedType,"RESCUE ROAD CRASH");
  assert.equal(v[2].groupedType,"ASSIST PUBLIC");
  assert.equal(qfdRescueSubtypeAvailability().swiftWater,false);
  assert.equal(qfdRescueSubtypeAvailability().vertical,false);
  assert.ok(v.every(x=>!("roadClosure" in x)&&!("sesAttendance" in x)));
});
test("Counts are by actual published group and ignore unrelated features",()=>{
  assert.deepEqual(qfdPublicGroupCounts(normaliseQfdPublicIncidents(sample)),{
    "RESCUE TECHNICAL":1,"RESCUE ROAD CRASH":1,"ASSIST PUBLIC":1
  });
  assert.deepEqual(qfdPublicGroupCounts([]),{
    "RESCUE TECHNICAL":0,"RESCUE ROAD CRASH":0,"ASSIST PUBLIC":0
  });
});
test("Duplicates preserve the most recently updated QFD record",()=>{
  const records={type:"FeatureCollection",features:[
    make("same","RESCUE TECHNICAL",[153.1,-27.5],{LastUpdate:1728320000000}),
    make("same","RESCUE ROAD CRASH",[153.2,-27.6],{LastUpdate:1728325000000})
  ]};
  const results=normaliseQfdPublicIncidents(records);
  assert.equal(results.length,1);
  assert.equal(results[0].groupedType,"RESCUE ROAD CRASH");
  assert.equal(results[0].longitude,153.2);
});
test("Provider errors and malformed responses fail closed",()=>{
  assert.throws(()=>normaliseQfdPublicIncidents({features:[]}),/GeoJSON/);
  assert.throws(()=>normaliseQfdPublicIncidents({error:{message:"provider error"}}),/provider error/);
});
test("Internal QFD job codes remain advisory not published group identifiers",()=>{
  assert.equal(classifyQfdRescueJobType("RESCUE VERTICAL").category,"vertical");
  assert.equal(classifyQfdRescueJobType("RESCUE MOUNTAIN RESCUE").category,"mountain");
  assert.equal(classifyQfdRescueJobType("RESCUE RTC LARGE MULTI").category,"road-crash");
  assert.equal(classifyQfdRescueJobType("ASSIST EXTREME WEATHER").category,"weather-assistance");
  assert.equal(classifyQfdRescueJobType("RESCUE TECHNICAL").requested,false);
  assert.equal(Object.values(QFD_JOB_TYPE_LABELS).length,6);
  const schema=qfdPublicClassificationAvailability(["GroupedType","Locality"]);
  assert.equal(schema.groupedTypeAvailable,true);
  assert.equal(schema.detailedSubtypeField,null);
});
test("QFD public picture-marker metadata takes precedence over provisional icons",()=>{
  const catalog=qfdOfficialSymbolCatalog({drawingInfo:{renderer:{
    type:"uniqueValue",field1:"GroupedType",uniqueValueInfos:[
      {value:"RESCUE ROAD CRASH",symbol:{type:"esriPMS",imageData:"YWJjZA=="}},
      {value:"FIRE VEGETATION",symbol:{type:"esriPMS",imageData:"YWJjZA=="}}
    ]
  }}});
  assert.deepEqual(Object.keys(catalog),["RESCUE ROAD CRASH"]);
  assert.equal(catalog["RESCUE ROAD CRASH"],"data:image/png;base64,YWJjZA==");
  assert.equal(qfdSymbolFor("RESCUE ROAD CRASH",catalog),catalog["RESCUE ROAD CRASH"]);
  assert.match(qfdSymbolFor("RESCUE TECHNICAL",catalog),/^data:image\/svg\+xml/);
  assert.equal(QFD_GROUP_ICON_COUNT,3);
});
test("Missing public renderer never invents an official QFD icon",()=>{
  assert.deepEqual(qfdOfficialSymbolCatalog({fields:[{name:"GroupedType"}]}),{});
  assert.equal(safeQfdSymbolImage({type:"esriSMS"}),"");
  assert.equal(safeQfdSymbolImage({type:"esriPMS",url:"javascript:alert(1)"}),"");
  assert.equal(safeQfdSymbolImage({type:"esriPMS",url:"https://evil.example/x.png"}),"");
  assert.match(provisionalQfdSymbol("ASSIST PUBLIC"),/^data:image\/svg\+xml/);
  assert.equal(provisionalQfdSymbol("FIRE VEGETATION"),"");
});
await (async()=>{
  const calls=[];
  const records=await fetchQfdPublicIncidents({fetchImpl:async(url)=>{
    calls.push(url);return {ok:true,json:async()=>sample};
  }});
  assert.equal(calls.length,1);
  assert.equal(records.length,3);
  checks++;console.log("PASS publisher snapshot fetch with exact server/client filtering");
})();
await (async()=>{
  await assert.rejects(fetchQfdPublicIncidents({fetchImpl:async()=>({ok:false,status:503})}),/HTTP 503/);
  checks++;console.log("PASS provider fetch failure is not interpreted as no QFD incidents");
})();
await (async()=>{
  const renderer={drawingInfo:{renderer:{type:"uniqueValue",field1:"GroupedType",
    uniqueValueInfos:[{value:"ASSIST PUBLIC",symbol:{type:"esriPMS",imageData:"YWJjZA=="}}]}}};
  const r=await fetchQfdPublicSymbolCatalog({fetchImpl:async()=>({ok:true,json:async()=>renderer})});
  assert.equal(Object.keys(r).length,1);
  const absent=await fetchQfdPublicSymbolCatalog({fetchImpl:async()=>({ok:true,json:async()=>({})})});
  assert.deepEqual(absent,{});
  checks++;console.log("PASS official ArcGIS symbols used only when verified publisher renderer exists");
})();
test("Map controller, legend and popup agree about the three grouped incident symbols",()=>{
  const ui=source("../src/context-layers/qfd-technical-rescues-operational-v1.js");
  const html=source("../live3d-operational-v9.html");
  for(const group of accepted)assert.ok(html.includes('data-qfd-group-icon="'+group+'"'));
  assert.match(ui,/billboard:\s*\{/);
  assert.match(ui,/qfdSymbolFor\(item\.groupedType,officialSymbols\)/);
  assert.match(ui,/fetchQfdPublicIncidents/);
  assert.match(ui,/fetchQfdPublicSymbolCatalog/);
  assert.match(html,/id="qfdSymbolStatus"/);
  assert.match(ui,/Provisional icons/);
});
console.log(checks+" QFD public-group/official-symbol validation checks passed.");
