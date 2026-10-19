import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {rainfallRarityDisplay,significantRainfallDisplay,rainfallMarkerSvg}
 from "../src/context-layers/significant-rainfall-operational-v1.js";
import {rainfallWindowMinutes,classifyRainfallAep}
 from "../src/context-layers/rainfall-ifd-aep-v1.js";
import {
 rainfallBand,parseBomRainfallMap,dedupeSignificantRainfall,
 qldFloodMapCreatedAt,qualifiesRainfallSnapshot
} from "../src/context-layers/significant-rainfall-source-v1.js";
const a=(id,name,mm)=>'<area coords="6,8,9,10" href="javascript:void(0)" '+
 'onmouseover="javascript:PopupRain(&quot;'+name+'&quot;,\''+id+'\',\'-27.71\',\'152.30\',\''+
 mm+'\',\'1\',\'hour\')" />';
const html='<html><img class="mapimage" src="/fwo/IDQ65149.png" id = "since" '+
 'usemap="#IDQ65349.html"/><img class="mapimage" id="m1hr" usemap="#IDQ65350.html"/>'+
 '<map name="IDQ65349.html">'+a("040908","Tewantin RSL Park","50.0")+
 a("540523","Rockside Mt","99.9")+a("040203","A &amp; B","100.0")+
 a("040204","Below","49.9")+a("040205","Missing","-")+
 a("040206","Zero","0.0")+'</map>'+
 '<img class="mapimage" id="m24hr" usemap="#IDQ65351.html"/>'+
 '<map name="IDQ65351.html">'+a("040908","Tewantin RSL Park","180.7")+
 a("540523","Rockside Mt","49.9")+'</map>'+
 '<map name="IDQ65350.html">'+a("040908","Tewantin RSL Park","100.3")+
 a("540523","Rockside Mt","49.9")+'</map>'+
 '<p>This page was created at 07:06 on Sunday 18 October 2026 (UTC)</p></html>';
assert.equal(rainfallWindowMinutes("last24Hours",issuedTime()),1440);
assert.equal(rainfallWindowMinutes("since9am","2026-10-19T18:00:00Z"),1140,
 "At 04:00 AEST the BoM since-9am accumulation is 19 hours old");
const rainfallCode=readFileSync(new URL("../src/context-layers/significant-rainfall-operational-v1.js",import.meta.url),"utf8");
assert.match(rainfallCode,/image:marker\(record\),width:72,height:27,/,
 "Rainfall map billboard should be approximately two-thirds of previous dimensions");

function issuedTime(){return "2026-10-18T07:06:00.000Z"}
for(const [aep,chance,oneIn,label] of [
 [20,"20%","1 in 5","Notable"],[10,"10%","1 in 10","Unusual"],
 [5,"5%","1 in 20","Rare"],[2,"2%","1 in 50","Very rare"],
 [1,"1%","1 in 100","Exceptional"]
]){
 const info=rainfallRarityDisplay({aepDesignThreshold:aep});
 assert.equal(info.chance,chance);
 assert.equal(info.oneIn,oneIn);
 assert.equal(info.short,label);
}
const normal=significantRainfallDisplay({mm:50,
 aep:{classification:"below-20pct-aep"}});
assert.equal(normal.amountBand,"50–99.9 mm");
assert.equal(normal.rarity.short,"Less rare");
const unknown=significantRainfallDisplay({mm:100,
 aep:{classification:"unclassified"}});
assert.equal(unknown.amountBand,"100 mm or more");
assert.equal(unknown.rarity.short,"Unrated");
for(const [mm,expectedColour] of [[99.9,"#ed871b"],[100,"#d92d35"]]){
 const svg=rainfallMarkerSvg({mm,aep:{aepDesignThreshold:5}});
 assert.match(svg,/viewBox="0 0 108 40"/,"Compact rain marker geometry");
 assert(svg.includes('fill="'+expectedColour+'"'),"Measured rain bands remain orange/red");
 assert(svg.includes('fill="#a45c1a"'),"IFD rarity tag separately coloured");
 assert(!svg.includes(">"+mm+"</text>"),"No number printed inside droplet");
 assert(svg.includes(">Rare</text>"),"Plain-language rarity remains visible");
}
assert(rainfallMarkerSvg({mm:100,aep:{classification:"unclassified"}}).includes('fill="#66717b"'),
 "Only missing IFD references should use neutral grey rarity");

assert.equal(rainfallBand(49.9),null);
assert.equal(rainfallBand(50),"orange");
assert.equal(rainfallBand(99.9),"orange");
assert.equal(rainfallBand(100),"red");
assert.equal(rainfallBand(-1),null);
const since=parseBomRainfallMap(html,"since9am","seast");
const hour=parseBomRainfallMap(html,"lastHour","seast");
const fullDay=parseBomRainfallMap(html,"last24Hours","seast");
assert.deepEqual(since.map(x=>[x.id,x.name,x.mm,x.band]),[
 ["040908","Tewantin RSL Park",50,"orange"],
 ["540523","Rockside Mt",99.9,"orange"],
 ["040203","A & B",100,"red"]]);
assert.deepEqual(hour.map(x=>[x.id,x.mm]),[["040908",100.3]]);
assert.deepEqual(fullDay.map(x=>[x.id,x.mm]),[["040908",180.7]]);
assert.equal(fullDay[0].period,"last24Hours");
const issued=qldFloodMapCreatedAt(html);
assert.equal(issued,"2026-10-18T07:06:00.000Z");
assert.equal(qldFloodMapCreatedAt(html.replace(
  "This page was created at 07:06",
  "This page was created at <strong>07:06")),
  "2026-10-18T07:06:00.000Z",
  "Live BoM regional flood pages wrap generated UTC in a strong element");
assert.deepEqual(dedupeSignificantRainfall(since.map(x=>({...x,sourceCreatedAt:issued})),"since9am")
 .map(x=>x.mm),[100,99.9,50]);
assert.equal(parseBomRainfallMap(html.replace("IDQ65350.html","IDQ65359.html"),"since9am").length,3);
assert.throws(()=>parseBomRainfallMap("<html>404</html>","since9am"),/map not published/);
assert.throws(()=>parseBomRainfallMap(html,"unknown"),RangeError);
const observed={...since[0],sourceCreatedAt:issued};
const now=Date.parse("2026-10-18T07:50:00Z");
assert.equal(qualifiesRainfallSnapshot(observed,"since9am",now),true);
assert.equal(qualifiesRainfallSnapshot(observed,"since9am",now+100*60000),false);
assert.equal(qualifiesRainfallSnapshot(observed,"since9am",Date.parse("2026-10-19T00:00:00Z")),false);
// Regression: Mountain Creek (BoM 540220) still belongs to yesterday's
// 09:00 reporting DAY after AEST midnight, even when the actual BoM
// map was published on today's calendar date.
const mountainCreek={id:"540220",name:"Mountain Creek Alert",
 mm:101,period:"since9am",sourceCreatedAt:"2026-10-19T18:00:00Z"};
assert.equal(qualifiesRainfallSnapshot(mountainCreek,"since9am",
 Date.parse("2026-10-19T18:02:00Z")),true,
 "04:02 AEST must retain 101 mm for 19-hour since-9am rainfall");
assert.equal(qualifiesRainfallSnapshot(mountainCreek,"since9am",
 Date.parse("2026-10-19T22:58:00Z")),false,
 "A station publication more than 90 minutes old must still be rejected");
const pre9={...mountainCreek,sourceCreatedAt:"2026-10-19T22:50:00Z"};
assert.equal(qualifiesRainfallSnapshot(pre9,"since9am",
 Date.parse("2026-10-19T22:55:00Z")),true,
 "08:55 AEST retains accumulation started at 9am previous day");
assert.equal(qualifiesRainfallSnapshot(pre9,"since9am",
 Date.parse("2026-10-19T23:05:00Z")),false,
 "09:05 AEST must not carry yesterday's total into today's 9am period");
assert.equal(qualifiesRainfallSnapshot({...pre9,sourceCreatedAt:"2026-10-19T23:03:00Z"},
 "since9am",Date.parse("2026-10-19T23:05:00Z")),true,
 "BoM source issued after 9am must be eligible for the new reporting day");
assert.equal(qualifiesRainfallSnapshot({...mountainCreek,sourceCreatedAt:"2026-10-19T16:55:00Z"},
 "since9am",Date.parse("2026-10-19T17:00:00Z")),true,
 "AEST day rollover at 3am preserves pre-9am BoM report");
assert.equal(qualifiesRainfallSnapshot({...hour[0],sourceCreatedAt:issued},"lastHour",now),true);
assert.equal(qualifiesRainfallSnapshot({...fullDay[0],sourceCreatedAt:issued},"last24Hours",now),true);
assert.equal(qualifiesRainfallSnapshot({...fullDay[0],sourceCreatedAt:issued},"last24Hours",now+100*60000),false);
assert.equal(qualifiesRainfallSnapshot({...fullDay[0],sourceCreatedAt:issued},"since9am",now),false);
assert.equal(qualifiesRainfallSnapshot({...hour[0],sourceCreatedAt:issued},"since9am",now),false);
console.log("PASS BoM separate 1hr, since9am and 24hr original station maps, threshold and freshness controls.");
