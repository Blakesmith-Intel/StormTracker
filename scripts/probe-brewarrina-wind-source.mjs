// Diagnostic only. Verify actual NSW BoM 93I transport from an internet-capable
// CI runner. No invented scans, no production dependencies or forced pass status.
const sources=[
  ["NSW preview history","https://stormtracker-bom-relay-nsw-preview.stormtracker-bom-relay.workers.dev/radar-history?product=IDR93I"],
  ["NSW preview latest","https://stormtracker-bom-relay-nsw-preview.stormtracker-bom-relay.workers.dev/radar?product=IDR93I"],
  ["QLD relay 93 history","https://stormtracker-bom-relay.stormtracker-bom-relay.workers.dev/radar-history?product=IDR93I"],
  ["BoM 93 loop","https://www.bom.gov.au/products/IDR93I.loop.shtml"],
  ["BoM 93 wind image","https://www.bom.gov.au/radar/IDR93I.gif"]
];
for(const [name,url] of sources){
  const started=Date.now();
  try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(url,{signal:controller.signal,headers:{
        "Accept":"*/*","User-Agent":"StormTracker-source-validation/1.0",
        "Origin":"https://blakesmith-intel.github.io"
      }});
      const type=response.headers.get("content-type")??"unknown";
      let details="";
      if(type.includes("json")||type.includes("html")||type.includes("text")){
        const body=(await response.text()).slice(0,100000);
        const timestamps=[...body.matchAll(/IDR93I\\.T\\.(\\d{12})\\.png/g)].map(m=>m[1]);
        details="frames="+new Set(timestamps).size+
          " latest="+(timestamps.sort().at(-1)??"none")+
          " bodyStart="+body.slice(0,220).replaceAll(/\\s+/g," ");
      }else{
        const bytes=(await response.arrayBuffer()).byteLength;
        details="bytes="+bytes+" product="+(response.headers.get("X-StormTracker-Product")??"none")+
          " UTC="+(response.headers.get("X-StormTracker-Observed-UTC")??"none");
      }
      console.log(JSON.stringify({name,status:response.status,type,ms:Date.now()-started,details}));
    }finally{clearTimeout(timeout);}
  }catch(error){console.log(JSON.stringify({name,error:String(error),ms:Date.now()-started}));}
}
