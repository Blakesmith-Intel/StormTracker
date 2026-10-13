import assert from "node:assert/strict";
import {createRiverGaugeLayer} from "../src/context-layers/river-gauge-layer-v1.js";
const now=Date.UTC(2026,9,13,11,30);
let requested=0;
const gauges=["539076","540347","540036","539093"].map((station,i)=>({
 id:"bom:"+station,type:"Feature",
 geometry:{type:"Point",coordinates:[153+i*.1,-27-i*.1]},
 properties:{bom_stn_num:station,awrc_stateid:"QLD-"+station,state:"QLD",
 name:"Station "+station,lat:-27-i*.1,long:153+i*.1,
 location_types:"water level gauge;"}
}));
const fetchImpl=async url=>{
 const u=String(url);
 if(u.includes("/river-gauge-metadata"))return {ok:true,json:async()=>({
   type:"FeatureCollection",features:gauges})};
 if(u.includes("/river-height-bulletins"))return {ok:true,json:async()=>({
   partial:false,products:[{product:"IDQ60285",
   observations:gauges.map((g,i)=>({
     stationName:g.properties.name,stationId:g.properties.bom_stn_num,
     heightMetres:1.3+i*.1,tendency:"rising",floodClass:"minor",
     observedText:"9:20 pm Tue 13/10/2026",
     recentDataHref:"/fwo/IDQ65391/IDQ65391."+g.properties.bom_stn_num+".plt.shtml"
   }))}]})};
 if(u.includes("/river-recent-history?")){
   requested++;
   return {ok:false,status:502};
 }
 throw Error("Unexpected URL "+u);
};
class Collection{
 constructor(){this.values=[];}
 suspendEvents(){}
 resumeEvents(){}
 removeAll(){this.values=[];}
 add(item){const obj={...item};this.values.push(obj);return obj;}
}
class Source{constructor(){this.entities=new Collection();this.show=true;}}
const viewer={dataSources:{add(){}},scene:{requestRender(){}}};
const CesiumRef={CustomDataSource:Source,
 Cartesian3:{fromDegrees:(...p)=>p},
 VerticalOrigin:{CENTER:0},HeightReference:{CLAMP_TO_GROUND:1}};
const status=[],warnings=[];
const oldWarn=console.warn;
console.warn=(...args)=>warnings.push(args.join(" "));
try{
 const layer=createRiverGaugeLayer({
   viewer,CesiumRef,fetchImpl,now:()=>now,visible:true,
   storage:{getItem:()=>null,setItem(){}},
   onStatus:x=>status.push(x)
 });
 await layer.refresh();
 for(let i=0;i<50&&requested===0;i++)
   await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(requested,1,"First 502 must stop the parallel river-history burst");
 await new Promise(resolve=>setTimeout(resolve,10));
 await layer.refresh({force:true});
 assert.equal(requested,1,"Gateway cooldown must block the next bulletin refresh");
 assert.equal(warnings.length,1,"Optional history outage produces one consolidated warning");
 assert.ok(status.some(s=>/BoM warnings remain authoritative/.test(s.message??"")));
 assert.ok(layer.features.length===0 || layer.features.every(f=>f.properties));
}finally{console.warn=oldWarn;}
console.log("Optional BoM history HTTP 502 regression passed: max one failure, cooldown, current bulletins retained.");
