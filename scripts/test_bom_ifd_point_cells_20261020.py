#!/usr/bin/env python3
"""Offline first-party BoM 2016 point-data parser regression."""
import importlib.util
from pathlib import Path
p=Path(__file__).with_name("build-native-bom-ifd-point-cells-v1.py")
s=importlib.util.spec_from_file_location("official_ifd",p)
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
pairs=[("1 min",1),("2 mins",2),("3 mins",3),("4 mins",4),
 ("5 mins",5),("10 mins",10),("15 mins",15),("20 mins",20),
 ("25 mins",25),("30 mins",30),("45 mins",45),("1 hour",60),("1.5 hours",90),("2 hours",120),("3 hours",180),
 ("4.5 hours",270),("6 hours",360),("9 hours",540),("12 hours",720),
 ("18 hours",1080),("24 hours",1440)]
page="<h2>IFD Design Rainfall Depth (mm)</h2><p>Annual Exceedance Probability</p>"
page+="<table><tr><th>Duration</th>"+ "".join(
 "<th>"+v+"</th>" for v in ("63.2%","50%","20%","10%","5%","2%","1%"))+"</tr>"
for i,(label,minutes) in enumerate(pairs):
 page+="<tr><td>"+label+"</td>"+ "".join(
  "<td>"+str(v)+"</td>" for v in (10+i,12+i,20+i,30+i,40+i,50+i,60+i))+"</tr>"
page+="<tr><td>1 day winter factor</td>"+"<td>-</td>"*7+"</tr>"
page+="</table>"
grid=m.parse_bom_ifd_table(page)
assert len(grid)==21 and grid["1"]["20"]==20 and grid["60"]["20"]==31 and grid["1440"]["1"]==80
assert m.key(-28.002,153.424)=="-28.0125,153.4125"
try:m.parse_bom_ifd_table("<html>Denied</html>")
except ValueError:pass
else:raise AssertionError("No verified table should mean no rating")
original=m.fetch_point
try:
 m.fetch_point=lambda lat,lon:("https://www.bom.gov.au/water/designRainfalls/revised-ifd/",grid,m.BASELINE)
 out=m.build([{"latitude":-25.91,"longitude":144.6,"mm":160}],{},max_new=1,workers=1)
 assert len(out["cells"])==1
 assert next(iter(out["cells"].values()))["sourceBaseline"]==m.BASELINE
finally:m.fetch_point=original

# A completed catalogue survives empty live data; recheck official values
# only if their verification is old enough, and retain the old on failure.
cell=m.key(-25.91,144.6)
current={"sourceBaseline":m.BASELINE,"latitude":m.ifd_cell(-25.91),
 "longitude":m.ifd_cell(144.6),"depthsMmByMinutes":grid,
 "referenceUrl":"https://www.bom.gov.au/water/designRainfalls/revised-ifd/?latitude=-25.91&longitude=144.6",
 "verifiedUtc":m.dt.datetime.now(m.dt.timezone.utc).isoformat()}
old={"sourceBaseline":m.BASELINE,"latitude":m.ifd_cell(-25.91),
 "longitude":m.ifd_cell(144.6),"depthsMmByMinutes":grid,
 "referenceUrl":current["referenceUrl"],"verifiedUtc":"2000-01-01T00:00:00+00:00"}
assert not m.needs_revalidation(current,m.dt.datetime.now(m.dt.timezone.utc))
legacy={**current,"depthsMmByMinutes":{k:v for k,v in grid.items() if int(k)>=60}}
original=m.fetch_point
try:
 calls=[0]
 def upgrade(lat,lon):
  calls[0]+=1
  return current["referenceUrl"],grid,m.BASELINE
 m.fetch_point=upgrade
 converted=m.build([{"latitude":-25.91,"longitude":144.6,"mm":120}],
  {"cells":{cell:legacy}},max_new=1,workers=1)
 assert calls[0]==1 and "5" in converted["cells"][cell]["depthsMmByMinutes"]
finally:m.fetch_point=original
assert m.needs_revalidation(old,m.dt.datetime.now(m.dt.timezone.utc))
original=m.fetch_point
try:
 m.fetch_point=lambda lat,lon: (_ for _ in ()).throw(ValueError("temporary BoM failure"))
 unchanged=m.build([],{"cells":{cell:old}},max_new=2,workers=1)
 assert unchanged["cells"][cell]==old, "Transient source failures must not delete verified historic references"
 refreshed=[0]
 def revised(lat,lon):
  refreshed[0]+=1
  data={k:dict(v) for k,v in grid.items()}
  data["60"]["20"]=21
  return current["referenceUrl"],data,m.BASELINE
 m.fetch_point=revised
 unchanged=m.build([],{"cells":{cell:current}},max_new=2,workers=1)
 assert refreshed[0]==0, "Fresh official reference must not be downloaded every hourly run"
 updated=m.build([],{"cells":{cell:old}},max_new=2,workers=1)
 assert updated["cells"][cell]["depthsMmByMinutes"]["60"]["20"]==21
 assert updated["cells"][cell]["verifiedUtc"]!=old["verifiedUtc"]
 assert refreshed[0]==1
finally:m.fetch_point=original

print("PASS first-party Bureau IFD, persistent catalogue, aged-source refresh and source-failure safety")
