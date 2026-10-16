import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {officialLocalityUrl,parseOfficialLocalities,groupOutagesByLga,
 filterLgaGroups,UNKNOWN_LGA,localityKey}
 from "../src/context-layers/incident-lga-model-v1.js";
import {groupRoadClosuresByLga,searchRoadCouncilGroups}
 from "../src/context-layers/road-closure-lga-model-v1.js";
import {groupOutagesBySuburb} from "../src/context-layers/power-outage-suburb-model-v1.js";
const read=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const json={features:[
 {attributes:{locality:"ORMEAU",lga:"GOLD COAST CITY"}},
 {attributes:{locality:"COOMERA",lga:"GOLD COAST CITY"}},
 {attributes:{locality:"EAGLEBY",lga:"LOGAN CITY"}},
 {attributes:{locality:"SAME PLACE",lga:"COUNCIL A"}},
 {attributes:{locality:"SAME PLACE",lga:"COUNCIL B"}}
]};
const names=["Ormeau","Coomera","Eagleby","Same Place","Not found"];
const resolved=parseOfficialLocalities(json,names);
assert.equal(resolved.get("ORMEAU"),"GOLD COAST CITY");
assert.equal(resolved.get("SAME PLACE"),UNKNOWN_LGA);
assert.equal(resolved.get("NOT FOUND"),UNKNOWN_LGA);
assert.match(officialLocalityUrl(["Ormeau"]),/AdministrativeBoundaries\/MapServer\/2\/query/);
assert.match(officialLocalityUrl(["Ormeau"]),/outFields=locality%2Clga/);
assert.equal(localityKey("Ormeau"),"ORMEAU");
assert.throws(()=>parseOfficialLocalities({features:[],exceededTransferLimit:true},names));
function outage(id,suburbs){
 return {id:"energex:"+id,properties:{
  EVENT_ID:id,TYPE:"Unplanned",STORMTRACKER_PROVIDER:"Energex",
  SUBURBS:suburbs,STATUS:"Active",CUSTOMERS_AFFECTED:44,STREETS:"Main Road"
 }};
}
const suburbGroups=groupOutagesBySuburb([outage(1,"Ormeau, Coomera"),
 outage(2,"Eagleby"),outage(3,"Missing Place")]);
const council=groupOutagesByLga(suburbGroups,resolved);
const gold=council.find(x=>x.name==="GOLD COAST CITY");
assert.equal(gold.items.length,1,"shared event counted only once per LGA");
assert.equal(gold.suburbs.length,2);
assert.equal(council.find(x=>x.name==="LOGAN CITY").items.length,1);
assert.equal(council.at(-1).name,UNKNOWN_LGA);
assert.equal(filterLgaGroups(council,"Coomera").length,1);
assert.equal(filterLgaGroups(council,"GOLD COAST CITY").length,1);
function road(id,localGovernmentArea,locality){
 return {properties:{id,road_summary:{
  road_name:"Pacific Motorway",local_government_area:localGovernmentArea,locality},
  event_type:"Incident",event_due_to:"Vehicle crash",impact:{impact_subtype:"Closed all lanes"}}};
}
const roads=groupRoadClosuresByLga([road("a","GOLD COAST CITY","Ormeau"),
 road("b","LOGAN CITY","Loganholme"),road("a","GOLD COAST CITY","Ormeau")]);
assert.equal(roads.length,2);
assert.equal(roads[0].items.length,1,"do not double-count closure ID");
assert.equal(searchRoadCouncilGroups(roads,"Pacific Motorway").length,2);
assert.equal(searchRoadCouncilGroups(roads,"LOGAN CITY")[0].name,"LOGAN CITY");
const html=read("../live3d-operational-v9.html");
const css=read("../src/lga-sidebar-legend-v1.css");
const controller=read("../src/live3d-operational-v9.js");
const outageUi=read("../src/context-layers/power-outage-suburb-explorer-v1.js");
const roadUi=read("../src/context-layers/road-closure-lga-explorer-v1.js");
const closureIntegration=read("../src/context-layers/flood-road-closures-operational-v1.js");
const legend=read("../src/persistent-weather-legend-v1.js");
for(const id of ["roadLgaExplorer","roadLgaResults","roadLgaSearch",
 "openRoadLgaExplorer","powerOutageExplorer","openPowerOutageExplorer",
 "legendDock","reflectivityLegend","dopplerVelocityLegend"])
 assert.ok(html.includes('id="'+id+'"'),id);
assert.ok(html.indexOf('id="legendDock"')>html.indexOf('id="mapPanel"'),
 "legend must be physically hosted on map rather than scrollaway sidebar");
assert.match(css,/body\.simple-ui #mapPanel #legendDock/);
assert.match(css,/data-mode="rain"/);
assert.match(css,/data-mode="wind"/);
assert.match(css,/sidebar-shortcuts/);
assert.match(legend,/doppler-available/);
assert.match(controller,/mountPersistentWeatherLegend/);
assert.match(closureIntegration,/explorer\.updateFeatures\(features\)/);
assert.match(closureIntegration,/explorer\.updateStatus\(next\)/);
assert.match(closureIntegration,/explorer\.destroy\(\)/);
assert.match(outageUi,/groupOutagesByLga/);
assert.match(outageUi,/resolveQueenslandLocalityLgas/);
assert.match(roadUi,/groupRoadClosuresByLga/);
assert.match(roadUi,/viewer\.camera\.flyTo/);
assert.doesNotMatch(roadUi,/\.drillPick\(/);
assert.doesNotMatch(outageUi,/\.drillPick\(/);
assert.doesNotMatch(roadUi,/setVisible\(/);
console.log("LGA outage/road explorers, official locality mapping, legend and layout contracts passed.");
