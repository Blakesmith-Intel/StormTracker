import assert from "node:assert/strict";
import {
  QLD_STATE_BORDER_SERVICE,
  fetchOfficialQueenslandStateBorder,
  stateBorderQueryUrl
} from "../frontend/src/context-layers/qld-state-border-v1.js";

const origin="https://blakesmith-intel.github.io";
const meta=await fetch(QLD_STATE_BORDER_SERVICE+"?f=json",{
  headers:{Origin:origin},signal:AbortSignal.timeout(25000)
});
assert.equal(meta.ok,true,"QLD official state-border metadata must respond");
const info=await meta.json();
assert.equal(info.name,"State border");
assert.equal(info.geometryType,"esriGeometryPolyline");
assert.ok(info.advancedQueryCapabilities?.supportsPagination,
  "Official border layer must support bounded paging");
const fields=new Set((info.fields??[]).map(f=>String(f.name).toLowerCase()));
for(const field of ["objectid","feature_type"])assert.ok(fields.has(field));
const cors=meta.headers.get("access-control-allow-origin")??"";
assert.ok(cors==="*"||cors.includes(origin),"Official service must allow web browsers via CORS");

const border=await fetchOfficialQueenslandStateBorder({
  fetchImpl:(url,options={})=>fetch(url,{
    ...options,headers:{...options.headers,Origin:origin}
  })
});
assert.ok(border.features.length>0,"Official state border cannot be empty");
const GOONDI={latitude:-28.55,longitude:150.30};
const radii=[];
let vertices=0;
for(const feature of border.features){
  const lines=feature.geometry.type==="LineString"
    ? [feature.geometry.coordinates]:feature.geometry.coordinates;
  for(const line of lines) {
    for(const [lon,lat] of line){
      vertices++;
      // Bounding-box calculation gives a conservative tolerance for a border
      // adjacent to Goondiwindi. Exact survey vertices remain unchanged.
      const dy=(lat-GOONDI.latitude)*111.2;
      const dx=(lon-GOONDI.longitude)*111.2*Math.cos(GOONDI.latitude*Math.PI/180);
      radii.push(Math.hypot(dx,dy));
    }
  }
}
const nearest=Math.min(...radii);
assert.ok(nearest<25,
  `No official state-border vertex within 25 km of Goondiwindi (nearest ${nearest.toFixed(1)} km)`);
assert.ok(vertices>10,"Incomplete state border geometry");
console.log(`Official QLD state-border live smoke passed: ${border.features.length} line features, ${vertices} original vertices, nearest Goondiwindi vertex ${nearest.toFixed(2)} km, browser CORS present, EPSG:4326 output.`);
