// Official BoM Queensland warning bulletin IDs and their corresponding AXF
// geometry products. Source: BoM Warning Products User Guide v2.8, Table 27.
// Never infer detailed/regional classification from polygon size or headline.
export const QLD_WARNING_PRODUCTS=Object.freeze({
  IDQ21035:Object.freeze({kind:"severe-thunderstorm",productType:"detailed",
    title:"Detailed Severe Thunderstorm Warning — Southeast Queensland",
    polygonAxfs:Object.freeze(["IDQ65650"]),
    otherAxfs:Object.freeze(["IDQ65652"])}),
  IDQ21033:Object.freeze({kind:"severe-thunderstorm",productType:"regional",
    title:"Regional Severe Thunderstorm Warning — Queensland",
    polygonAxfs:Object.freeze(["IDQ65654"]),otherAxfs:Object.freeze([])}),
  IDQ21037:Object.freeze({kind:"severe-weather",productType:"severe-weather",
    title:"Severe Weather Warning 1 — Queensland",
    polygonAxfs:Object.freeze(["IDQ65272"]),otherAxfs:Object.freeze([])}),
  IDQ21038:Object.freeze({kind:"severe-weather",productType:"severe-weather",
    title:"Severe Weather Warning 2 — Queensland",
    polygonAxfs:Object.freeze(["IDQ65277"]),otherAxfs:Object.freeze([])})
});
// Identifiers MUST be explicit product references in original source
// metadata. Do not derive from bulletin narrative, district, map extent.
export function qldOfficialWarningProduct(value){
  const code=String(value??"").trim().toUpperCase();
  return Object.hasOwn(QLD_WARNING_PRODUCTS,code)
   ?{code,...QLD_WARNING_PRODUCTS[code]}:null;
}
export function codeFromOriginalBomCapMetadata({identifier="",web="",references="",parameters=[]}={}){
 const candidates=[identifier,web,references,...parameters.map(x=>x?.value??"")];
 const codes=new Set();
 for(const candidate of candidates){
   for(const match of String(candidate).toUpperCase().matchAll(/\bIDQ(?:21035|21033|21037|21038)\b/g))
      codes.add(match[0]);
 }
 if(codes.size!==1)return null;
 return qldOfficialWarningProduct([...codes][0]);
}
