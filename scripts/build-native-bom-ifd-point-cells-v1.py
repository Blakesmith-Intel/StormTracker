#!/usr/bin/env python3
"""Build IFD reference cells from native 2016 BoM-derived ARR point tables.

No fabricated rainfall-frequency values: each grid cell requires its own
individually sourced native-baseline table. Missing sites remain unrated.
"""
import argparse, concurrent.futures, datetime as dt, html, json, math, re
import urllib.parse, urllib.request
from pathlib import Path

COLS={"20":4,"10":6,"5":7,"2":8,"1":9}
WANTED=(60,90,120,180,270,360,540,720,1080,1440)
BASE="https://data.arr-software.org/"
def ifd_cell(value):
 return round(math.floor(round(value/.025,8))*.025+.0125,4)
def key(lat,lon):
 return f"{ifd_cell(lat):.4f},{ifd_cell(lon):.4f}"
def text_only(value):
 return re.sub(r"\s+"," ",html.unescape(re.sub("<[^>]*>"," ",value))).strip()
def parse_native_table(markup):
 lower=markup.lower()
 chosen=None
 for baseline in ("Default Native Baseline","Default Historical (1961-1990) Baseline"):
  pos=lower.find(baseline.lower())
  if pos<0:continue
  section=markup[pos:pos+190000]
  header=section.find("min (h)")
  if header<0:continue
  start=section.rfind("<table",0,header)
  end=section.find("</table>",header)
  if start<0 or end<0:continue
  table=section[start:end+8]
  if "20.0" not in table or "10.0" not in table:continue
  chosen=baseline
  break
 if chosen is None:raise ValueError("No genuine ARR native or historical IFD table")
 rows=re.findall(r"<tr\b[^>]*>(.*?)</tr>",table,re.S|re.I)
 if not rows:raise ValueError("No native IFD rows")
 dataset={}
 for row in rows:
  cells=[text_only(c) for c in re.findall(r"<t[dh]\b[^>]*>(.*?)</t[dh]>",row,re.S|re.I)]
  if len(cells)<10:continue
  dm=re.match(r"^(\d{1,4})\s*\(",cells[0])
  if not dm:continue
  duration=int(dm.group(1))
  if duration not in WANTED:continue
  values={}
  for aep,col in COLS.items():
   m=re.search(r"[-+]?\d+(?:\.\d+)?",cells[col])
   if not m:raise ValueError("Missing published probability depth")
   d=float(m.group())
   if not 0<d<3000:raise ValueError("Physically invalid source design depth")
   values[aep]=d
  depths=[values[x] for x in ["20","10","5","2","1"]]
  if any(depths[i]>depths[i+1] for i in range(4)):
   raise ValueError("Nonmonotonic published probability depths")
  dataset[str(duration)]=values
 if "60" not in dataset or "1440" not in dataset or len(dataset)<7:
  raise ValueError("Insufficient published native IFD durations")
 return dataset,chosen
def fetch_point(lat,lon):
 url=BASE+"?"+urllib.parse.urlencode({"All":"on","lat_coord":lat,"lon_coord":lon})
 request=urllib.request.Request(url,headers={"User-Agent":"StormTracker-IFD-reference/1.0","Accept":"text/html"})
 with urllib.request.urlopen(request,timeout=25) as response:
  if response.status!=200:raise ValueError("IFD HTTP "+str(response.status))
  markup=response.read(9_000_000).decode("utf8","replace")
 if "Default Native Baseline" not in markup or "Default IFD Depths" not in markup:
  raise ValueError("ARR page missing independently published native IFD depth table")
 depths,baseline=parse_native_table(markup)
 return url,depths,baseline
def build(stations,existing,max_new=80,workers=4):
 cells=dict(existing.get("cells",{}))
 candidates={}
 for obs in stations:
  lat=obs.get("latitude");lon=obs.get("longitude")
  if not isinstance(lat,(int,float)) or not isinstance(lon,(int,float)):continue
  if not -30.0<lat<-9.0 or not 137.0<lon<155.0:continue
  cell=key(lat,lon)
  if cell not in cells:candidates[cell]=(lat,lon)
 candidates=list(candidates.items())[:max_new]
 failed=[]
 def work(item):
  k,(lat,lon)=item
  try:
   url,table,baseline=fetch_point(lat,lon)
   return k,{"latitude":ifd_cell(lat),"longitude":ifd_cell(lon),
     "depthsMmByMinutes":table,"referenceUrl":url,"sourceBaseline":baseline+" (BoM IFD-derived; ARR Data Hub)"},None
  except Exception as e:
   return k,None,type(e).__name__+": "+str(e)[:150]
 with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
  for key_name,record,error in ex.map(work,candidates):
   if record:cells[key_name]=record
   else:failed.append((key_name,error))
 print("IFD_NATIVE_POINT_RESULT",json.dumps({"stations":len(stations),"previousCells":len(existing.get("cells",{})),
   "newPoints":len(candidates),"success":len(candidates)-len(failed),"failures":failed[:12]}))
 return {"schema":"StormTrackerBoM2016IFDCellsV1",
   "source":"ARR Data Hub BoM IFD (2016) native where available, otherwise published historical 1961-1990 reference",
   "sourceUrl":BASE,"generatedUtc":dt.datetime.now(dt.timezone.utc).isoformat(),
   "coverage":"Only stations/cells with independently fetched native BoM-derived 2016 depth curves",
   "cells":cells}
def main():
 parser=argparse.ArgumentParser()
 parser.add_argument("--stations");parser.add_argument("--existing");parser.add_argument("--out",required=True)
 parser.add_argument("--max-new",type=int,default=80)
 args=parser.parse_args()
 fixed=[{"latitude":-28.002,"longitude":153.424},{"latitude":-25.91,"longitude":144.60},
  {"latitude":-27.47,"longitude":153.03}]
 if args.stations:
  raw=json.loads(Path(args.stations).read_text())
  if isinstance(raw,list):stations=fixed+raw
  else:stations=fixed+list(raw.get("observations",{}).get("since9am",[]))+list(raw.get("observations",{}).get("lastHour",[]))
 else:
  stations=fixed
 existing=json.loads(Path(args.existing).read_text()) if args.existing and Path(args.existing).exists() else {}
 result=build(stations,existing,max_new=args.max_new)
 if not result["cells"]:raise SystemExit("No verified native BoM IFD site data")
 output=Path(args.out);output.parent.mkdir(parents=True,exist_ok=True)
 output.write_text(json.dumps(result,separators=(",",":"))+"\n")
 print("IFD_POINT_PUBLISHED",len(result["cells"]),str(output))
if __name__=="__main__":main()
