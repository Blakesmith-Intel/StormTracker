// Diagnostic for official published BoM cyclone products, not a data source
// or permission bypass. Output ONLY status, content-type, root XML tag and
// distinct (namespace-stripped) element names, never bulletin text, positions
// or personal data. No missing product is treated as proof of "no cyclone".
const MAX_BYTES=200000;
const sources=[
 ["BoM CXML documented example","https://www.bom.gov.au/cyclone/cxmlinfo/CXML_example.xml"],
 ["BoM minimal CXML example","https://www.bom.gov.au/cyclone/cxmlinfo/CXML_bare_minimum.xml"],
 ["QLD CXML current #1","https://www.bom.gov.au/fwo/IDQ65255.xml"],
 ["QLD GML forecast map #1","https://www.bom.gov.au/fwo/IDQ65248.gml"],
 ["QLD GML forecast map #2","https://www.bom.gov.au/fwo/IDQ65249.gml"],
 ["NSW cross-border GML","https://www.bom.gov.au/fwo/IDQ65252.gml"]
];
for(const [name,url] of sources){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),7000);
 try{
  const res=await fetch(url,{signal:controller.signal,
    headers:{Accept:"application/gml+xml,application/xml,text/xml,*/*"}});
  const type=res.headers.get("content-type")||"";
  const text=(await res.text()).slice(0,MAX_BYTES);
  const match=text.match(/<([A-Za-z_][\w:.-]*)\b[^>]*>/);
  const elements=[...new Set([...text.matchAll(/<([A-Za-z_][\w:.-]*)\b/g)]
    .map(m=>m[1].split(":").at(-1)))].slice(0,45);
  console.log(JSON.stringify({name,status:res.status,contentType:type,
    byteSample:text.length,root:match?.[1]??null,
    tags:res.ok?elements:[],notPresent:res.status===404,
    note:res.status===403?"Access denied from GitHub runner":
      res.status===404?"Absent product (seasonal or incorrect path)":
      res.ok?"Schema metadata only":"Cannot verify"}));
 }catch(e){console.log(JSON.stringify({name,error:String(e).slice(0,140)}))}
 finally{clearTimeout(timeout);}
}
