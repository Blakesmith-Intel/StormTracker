import assert from "node:assert/strict";
import {parseOfficialIfdPoint,officialIfdCell} from "../relay/ifd-on-demand.js";
const durations=[["1 hour",60],["1.5 hours",90],["2 hours",120],["3 hours",180],["4.5 hours",270],["6 hours",360],["9 hours",540],["12 hours",720],["18 hours",1080],["24 hours",1440]];
let html='<h2>IFD Design Rainfall Depth (mm)</h2><p>Annual Exceedance Probability</p><table><tr><th>Duration</th>'+
 ["63.2%","50%","20%","10%","5%","2%","1%"].map(x=>'<th>'+x+'</th>').join("")+'</tr>';
for(const [i,[label]] of durations.entries()){
 html+='<tr><td>'+label+'</td>'+[10,12,20,30,40,50,60].map(x=>'<td>'+(x+i)+'</td>').join("")+'</tr>';
}
html+='</table>';
const parsed=parseOfficialIfdPoint(html);
assert.equal(Object.keys(parsed).length,10);
assert.equal(parsed["60"]["20"],20);
assert.equal(parsed["1440"]["1"],69);
assert.equal(officialIfdCell(-26.4094),-26.4125);
assert.equal(officialIfdCell(148.655),148.6625);
assert.throws(()=>parseOfficialIfdPoint("<html>403 access denied</html>"));
console.log("PASS on-demand official IFD parser and Kingull cell");
