import urllib.request,re,json
validated_sites=set()
for site in ["08","50","66","28"]:
 for url in [f"https://www.bom.gov.au/products/IDR{site}3.loop.shtml",f"https://www.bom.gov.au/products/IDR{site}3.shtml"]:
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"StormTracker source audit"}),timeout=10) as r: data=r.read(350000).decode("utf8","replace"); code=r.status
   matches=re.findall(r"IDR"+site+r"3\.T\.\d{12}\.png",data)
   print("HISTORY_SOURCE",json.dumps({"site":site,"url":url,"status":code,"count":len(matches),"samples":matches[-3:]}))
   if len(matches)>=3:validated_sites.add(site)
  except Exception as e:print("HISTORY_SOURCE",json.dumps({"site":site,"url":url,"error":str(e)}))

required={"08","50","66","28"}
assert required==validated_sites,"RELEASE BLOCKED: No source-confirmed numbered reflectivity timestamp history for "+",".join(sorted(required-validated_sites))
