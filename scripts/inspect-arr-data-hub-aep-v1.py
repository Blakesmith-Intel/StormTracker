#!/usr/bin/env python3
"""Diagnostic only: examine ARR Data Hub point AEP with no synthetic values."""
import json,re,urllib.request,html
from html.parser import HTMLParser

SITES={"Gold Coast":(-28.002,153.424),"Adavale":(-25.91,144.6),"Brisbane":(-27.47,153.03)}
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[]
 def handle_starttag(self,tag,attrs):
  if tag=="a":self.links.append(dict(attrs).get("href",""))
for name,(lat,lon) in SITES.items():
 url=f"https://data.arr-software.org/?All=on&lat_coord={lat}&lon_coord={lon}"
 req=urllib.request.Request(url,headers={"User-Agent":"StormTracker-IFD-source-verification/1.0","Accept":"text/html"})
 try:
  with urllib.request.urlopen(req,timeout=25) as r:
   body=r.read(8_000_000).decode("utf8","replace")
   ctype=r.headers.get("Content-Type")
  links=Links();links.feed(body)
  loc=body.find("Default Historical")
  after=body[loc:loc+80000]
  pos=after.find("60 (1.0)")
  excerpt=re.sub(r"<[^>]*>"," ",after[pos:pos+1800]) if pos>=0 else ""
  print("ARR_60MIN_TABLE",json.dumps({"name":name,"text":excerpt[:900],"defaultAt":loc}))
  print("ARR_HEADINGS",json.dumps({"name":name,"heads":[re.sub(r"<[^>]*>"," ",x) for x in re.findall(r"<h[2-6][^>]*>.*?</h[2-6]>",body,re.I|re.S)[:25]]}))
  print("ARR_DATA_AEP",json.dumps({"name":name,"url":url,"bytes":len(body),
   "contentType":ctype,"hasTable":"20.0" in after,
   "historical":re.sub("<[^>]*>"," ",after[:2800])[:850],
   "csvLinks":[x for x in links.links if "csv" in x.lower() or "download" in x.lower()][:15],
   "sourceRefs":list(set(re.findall(r".{0,50}BoM IFD.{0,70}",body[:60000])))[:4]}))
 except Exception as e:print("ARR_DATA_AEP_ERROR",json.dumps({"name":name,"exception":str(e)}))
