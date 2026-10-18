import assert from "node:assert/strict";
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
 '<map name="IDQ65350.html">'+a("040908","Tewantin RSL Park","100.3")+
 a("540523","Rockside Mt","49.9")+'</map>'+
 '<p>This page was created at 07:06 on Sunday 18 October 2026 (UTC)</p></html>';
assert.equal(rainfallBand(49.9),null);
assert.equal(rainfallBand(50),"orange");
assert.equal(rainfallBand(99.9),"orange");
assert.equal(rainfallBand(100),"red");
assert.equal(rainfallBand(-1),null);
const since=parseBomRainfallMap(html,"since9am","seast");
const hour=parseBomRainfallMap(html,"lastHour","seast");
assert.deepEqual(since.map(x=>[x.id,x.name,x.mm,x.band]),[
 ["040908","Tewantin RSL Park",50,"orange"],
 ["540523","Rockside Mt",99.9,"orange"],
 ["040203","A & B",100,"red"]]);
assert.deepEqual(hour.map(x=>[x.id,x.mm]),[["040908",100.3]]);
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
assert.equal(qualifiesRainfallSnapshot({...hour[0],sourceCreatedAt:issued},"lastHour",now),true);
assert.equal(qualifiesRainfallSnapshot({...hour[0],sourceCreatedAt:issued},"since9am",now),false);
console.log("PASS BoM station ID and coordinates, period-specific 50/100mm thresholds, dedupe and stale AEST 9am period handling.");
