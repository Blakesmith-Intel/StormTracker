import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {officialPowerOutageBoundaryRings,isCurrentPowerOutage} from "../frontend/src/context-layers/power-outages-v1.js";
import {floodRoadGeometryParts} from "../frontend/src/context-layers/flood-road-closure-filter-v1.js";
import {floodRoadClosureMarkerCoordinate} from "../frontend/src/context-layers/flood-road-closures-v1.js";
const current=Date.parse("2026-10-19T10:52:00Z");
const wynnum={
 type:"Feature",id:"energex:INCD-988236-g",
 properties:{EVENT_ID:"INCD-988236-g",TYPE:"UNPLANNED",STATUS:"Awaiting",SUBURBS:"WYNNUM, WYNNUM WEST",
 CUSTOMERS_AFFECTED:1107,START:current-1e6,FINISH:null},
 geometry:{type:"Polygon",coordinates:[[[153.14,-27.46],[153.17,-27.46],[153.17,-27.44],[153.14,-27.44],[153.14,-27.46]]]}
};
assert(isCurrentPowerOutage(wynnum,current));
const sourceRings=officialPowerOutageBoundaryRings(wynnum);
assert.equal(sourceRings.length,1);
assert.equal(sourceRings[0].length,5);
assert.deepEqual(sourceRings[0][0],[153.14,-27.46]);
assert.deepEqual(officialPowerOutageBoundaryRings({
 geometry:{type:"Point",coordinates:[153.15,-27.45]}}),[],
 "Point-only outage must NEVER be assigned an invented area");
const mockRoad={geometry:{type:"MultiLineString",coordinates:[[[153.10,-27.40],[153.11,-27.40],[153.13,-27.41]]]}};
assert.equal(floodRoadGeometryParts(mockRoad)[0].type,"MultiLineString");
const multiPoint={geometry:{type:"MultiPoint",coordinates:[[153.10,-27.40],[153.12,-27.41]]}};
assert.equal(floodRoadGeometryParts(multiPoint)[0].type,"MultiPoint");
assert.deepEqual(floodRoadClosureMarkerCoordinate(multiPoint),[153.10,-27.40]);
assert(!floodRoadGeometryParts(multiPoint).some(g=>/LineString/.test(g.type)),
 "QLDTraffic event with only MultiPoint must NOT fabricate road line segment");
const outageCode=readFileSync("frontend/src/context-layers/power-outages-v1.js","utf8");
const roadCode=readFileSync("frontend/src/context-layers/flood-road-closures-v1.js","utf8");
assert(outageCode.includes("officialPowerOutageBoundaryRings(feature).entries()"));
assert(roadCode.includes("zIndex:51"));
console.log("PASS_WYNNUM_1107_CUSTOMER_OFFICIAL_OUTAGE_POLYGON_AND_REAL_ROAD_ALIGNMENT");
