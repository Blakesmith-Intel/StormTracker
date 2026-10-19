#!/usr/bin/env python3
"""Offline first-party BoM 2016 point-data parser regression."""
import importlib.util
from pathlib import Path
p=Path(__file__).with_name("build-native-bom-ifd-point-cells-v1.py")
s=importlib.util.spec_from_file_location("official_ifd",p)
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
pairs=[("1 hour",60),("1.5 hours",90),("2 hours",120),("3 hours",180),
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
assert len(grid)==10 and grid["60"]["20"]==20 and grid["1440"]["1"]==69
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
print("PASS first-party Bureau IFD parser, geographic cell, provenance and no-data handling")
