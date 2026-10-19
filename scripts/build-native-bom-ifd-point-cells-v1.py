#!/usr/bin/env python3
"""Build IFD reference cells from native 2016 BoM-derived ARR point tables.

No fabricated rainfall-frequency values: each BoM grid cell requires its own
independently retrieved first-party BoM 2016 IFD point table. Missing sites remain unrated.
"""
import argparse, concurrent.futures, datetime as dt, html, json, math, re
import urllib.parse, urllib.request
from pathlib import Path

COLS={"20":4,"10":6,"5":7,"2":8,"1":9}
WANTED=(60,90,120,180,270,360,540,720,1080,1440)
BASE="https://www.bom.gov.au/water/designRainfalls/revised-ifd/"
def ifd_cell(value):
 return round(math.floor(round(value/.025,8))*.025+.0125,4)
def key(lat,lon):
 return f"{ifd_cell(lat):.4f},{ifd_cell(lon):.4f}"
def text_only(value):
 return re.sub(r"\s+"," ",html.unescape(re.sub("<[^>]*>"," ",value))).strip()
BASELINE = "Bureau of Meteorology 2016 Design Rainfall Data System"
def duration_minutes(label):
 m=re.match(r"^(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?|h|days?|d)\b",label.strip(),re.I)
 if not m:return None
 unit=m.group(2).lower()
 scale=1 if unit.startswith("min") else (1440 if unit.startswith("d") else 60)
 n=float(m.group(1))*scale
 return round(n) if abs(round(n)-n)<1e-6 else None
def parse_bom_ifd_table(markup):
 if not re.search(r"IFD\s+Design\s+Rainfall\s+Depth",markup,re.I):
  raise ValueError("Official BoM IFD depth table missing")
 if "Annual Exceedance Probability" not in text_only(markup):
  raise ValueError("BoM published probability heading missing")
 for table in re.findall(r"<table\b[^>]*>[\s\S]*?</table>",markup,re.I):
  if not all(re.search(r"\b"+a+r"\s*%",text_only(table)) for a in ("20","10","5","2","1")):continue
  dataset={}
  for row in re.findall(r"<tr\b[^>]*>(.*?)</tr>",table,re.S|re.I):
   cells=[text_only(c) for c in re.findall(r"<t[dh]\b[^>]*>(.*?)</t[dh]>",row,re.S|re.I)]
   if len(cells)<8:continue
   minutes=duration_minutes(cells[0])
   if minutes not in WANTED:continue
   # Official Bureau tables also include rows like "1 day winter factor"
   # with dash cells. Those are not design-rainfall depths.
   if "factor" in cells[0].lower():continue
   if any(not re.match(r"^\d+(?:\.\d+)?\b",c) for c in cells[-5:]):
    continue
   values={}
   for aep,cell in zip(("20","10","5","2","1"),cells[-5:]):
    match=re.match(r"^(\d+(?:\.\d+)?)\b",cell)
    if not match:raise ValueError("Official IFD published depth missing")
    mm=float(match.group(1))
    if not (0<mm<3000):raise ValueError("Official IFD value out of range")
    values[aep]=mm
   depths=list(values.values())
   if any(a>b for a,b in zip(depths,depths[1:])):
    raise ValueError("Official BoM IFD probability values out of order")
   dataset[str(minutes)]=values
  if "60" in dataset and "1440" in dataset and len(dataset)>=9:
   for aep in ("20","10","5","2","1"):
    values=[dataset[str(d)][aep] for d in sorted(map(int,dataset))]
    if any(a>b for a,b in zip(values,values[1:])):
     raise ValueError("Official BoM IFD duration values out of order")
   return dataset
 raise ValueError("Complete official 2016 point IFD table unavailable")
def fetch_point(lat,lon):
 url=BASE+"?"+urllib.parse.urlencode({
  "coordinate_type":"dd","latitude":lat,"longitude":lon,
  "design":"ifds","year":"2016","caveat":"true","conditions":"true",
  "sdmin":"true","sdhr":"true","sdday":"true"})
 req=urllib.request.Request(url,headers={
  "User-Agent":"Mozilla/5.0 (compatible; StormTracker-IFD-source-verifier)",
  "Accept":"text/html"})
 with urllib.request.urlopen(req,timeout=30) as response:
  if response.status!=200:raise ValueError("Official BoM IFD HTTP "+str(response.status))
  markup=response.read(6_000_000).decode("utf8","replace")
 return url,parse_bom_ifd_table(markup),BASELINE
def needs_revalidation(record,now):
 """Recheck an established official IFD cell every 30 days without deleting it."""
 stamp=record.get("verifiedUtc")
 if not stamp:return True  # older preserved cells predate verification timestamps
 try:
  verified=dt.datetime.fromisoformat(str(stamp).replace("Z","+00:00"))
  if verified.tzinfo is None:return True
  return now-verified>=dt.timedelta(days=30)
 except (ValueError,TypeError,OverflowError):
  return True
def reference_position(record):
 """Recheck the same original BoM point where a reference URL is recorded."""
 lat,lon=record.get("latitude"),record.get("longitude")
 try:
  params=urllib.parse.parse_qs(urllib.parse.urlsplit(record.get("referenceUrl","")).query)
  new_lat=float((params.get("latitude") or params.get("lat_coord"))[0])
  new_lon=float((params.get("longitude") or params.get("lon_coord"))[0])
  if key(new_lat,new_lon)==key(lat,lon):return new_lat,new_lon
 except (TypeError,ValueError,IndexError,ZeroDivisionError):
  pass
 return lat,lon
def build(stations,existing,max_new=80,workers=4):
 if not isinstance(existing.get("cells",{}),dict):
  raise ValueError("Existing IFD catalogue missing cell dictionary")
 cells=dict(existing.get("cells",{}))
 now=dt.datetime.now(dt.timezone.utc)
 pending={}
 for obs in stations:
  lat=obs.get("latitude");lon=obs.get("longitude")
  if not isinstance(lat,(int,float)) or not isinstance(lon,(int,float)):continue
  if not -30.0<lat<-9.0 or not 137.0<lon<155.0:continue
  cell=key(lat,lon)
  if cell not in cells or not str(cells[cell].get("sourceBaseline","")).startswith(BASELINE):
   amount=obs.get("mm",0)
   amount=float(amount) if isinstance(amount,(int,float)) else 0.0
   if cell not in pending or amount>pending[cell][2]:
    pending[cell]=(lat,lon,amount)
 # Preserve ALL historical cells even when their gauge no longer appears in
 # the latest rainfall observations. Periodically revalidate first-party
 # reference depths, detecting genuine revisions to the published 2016 IFD.
 stale={}
 for cell,record in cells.items():
  if str(record.get("sourceBaseline","")).startswith(BASELINE) and needs_revalidation(record,now):
   lat,lon=reference_position(record)
   if isinstance(lat,(int,float)) and isinstance(lon,(int,float)) and key(lat,lon)==cell:
    stale[cell]=(lat,lon,0.0)
 missing=sorted(pending.items(),key=lambda kv:(kv[0] in cells,-kv[1][2],kv[0]))
 outdated=sorted(stale.items(),key=lambda kv:(str(cells[kv[0]].get("verifiedUtc","")),kv[0]))
 cap=max(0,int(max_new))
 # While filling gaps, reserve at most one lookup for revision checks.
 # Once complete, unused hourly capacity can revalidate due cells.
 reserve=1 if missing and outdated and cap>1 else 0
 candidates=missing[:max(0,cap-reserve)]+outdated[:(reserve if missing else max(0,cap))]
 failures=[]
 def work(item):
  k,(lat,lon,amount)=item
  try:
   url,table,baseline=fetch_point(lat,lon)
   return k,{"latitude":ifd_cell(lat),"longitude":ifd_cell(lon),
     "depthsMmByMinutes":table,"referenceUrl":url,
     "sourceBaseline":baseline,"verifiedUtc":now.isoformat()},None
  except Exception as e:
   return k,None,type(e).__name__+": "+str(e)[:150]
 with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
  for key_name,record,error in ex.map(work,candidates):
   if record:cells[key_name]=record
   else:failures.append((key_name,error))
 if set(existing.get("cells",{}))-set(cells):
  raise ValueError("Refusing to erase previously verified IFD cells")
 print("OFFICIAL_BOM_IFD_POINT_RESULT",json.dumps({"stations":len(stations),"previousCells":len(existing.get("cells",{})),
   "newPoints":len(candidates),"success":len(candidates)-len(failures),
   "referenceChecks":len(candidates)-len(missing[:max(0,cap-reserve)]),"failures":failures[:12]}))
 return {"schema":"StormTrackerBoM2016IFDCellsV1",
   "source":"Official Bureau of Meteorology BoM IFD 2016 point tables; previously verified references retained pending replacement",
   "sourceUrl":BASE,"generatedUtc":now.isoformat(),
   "coverage":"Only independently verified matching 0.025-degree local IFD cells",
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
  else:stations=fixed+list(raw.get("observations",{}).get("since9am",[]))+list(raw.get("observations",{}).get("lastHour",[]))+list(raw.get("observations",{}).get("last24Hours",[]))
 else:
  stations=fixed
 existing=json.loads(Path(args.existing).read_text()) if args.existing and Path(args.existing).is_file() and Path(args.existing).stat().st_size>0 else {}
 result=build(stations,existing,max_new=args.max_new)
 if not result["cells"]:raise SystemExit("No verified native BoM IFD site data")
 output=Path(args.out);output.parent.mkdir(parents=True,exist_ok=True)
 output.write_text(json.dumps(result,separators=(",",":"))+"\n")
 print("OFFICIAL_BOM_IFD_POINT_PUBLISHED",len(result["cells"]),str(output))
if __name__=="__main__":main()
