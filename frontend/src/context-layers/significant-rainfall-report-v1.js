// Read-only operational reporting over the SAME station observations displayed
// by the significant-rainfall layer. Do not filter by map visibility/zoom or
// infer new gauge positions, design depths or rainfall totals.
export const AEP_REPORT_TIERS=Object.freeze([
 {aep:1,label:"Exceptional",chance:"1% AEP"},
 {aep:2,label:"Very rare",chance:"2% AEP"},
 {aep:5,label:"Rare",chance:"5% AEP"},
 {aep:10,label:"Unusual",chance:"10% AEP"},
 {aep:20,label:"Notable",chance:"20% AEP"}
]);
const descendingRain=(a,b)=>b.mm-a.mm||
 String(a.name??"").localeCompare(String(b.name??""))||
 String(a.id??"").localeCompare(String(b.id??""));
export function buildSignificantRainfallReport(records,mode){
 if(!["amount","aep"].includes(mode))throw RangeError("Unknown rainfall report");
 const valid=(Array.isArray(records)?records:[]).filter(row=>
  Number.isFinite(row?.mm)&&row.mm>=50&&
  Number.isFinite(row?.latitude)&&Number.isFinite(row?.longitude));
 const unknownCount=valid.filter(row=>!row.aep?.aepDesignThreshold&&
  row.aep?.classification!=="below-20pct-aep").length;
 const groups=mode==="amount"?
  [
   {title:"100 mm or more",key:"100+",rows:valid.filter(x=>x.mm>=100).sort(descendingRain)},
   {title:"50–99.9 mm",key:"50-99",rows:valid.filter(x=>x.mm>=50&&x.mm<100).sort(descendingRain)}
  ]:
  AEP_REPORT_TIERS.map(tier=>({
   title:tier.label+" · "+tier.chance,
   key:String(tier.aep),
   rows:valid.filter(x=>x.aep?.classification==="meets-ifd-design-depth"&&
      x.aep.aepDesignThreshold===tier.aep).sort(descendingRain)
  }));
 return {mode,groups,total:groups.reduce((sum,group)=>sum+group.rows.length,0),
  observedCount:valid.length,unknownCount};
}
