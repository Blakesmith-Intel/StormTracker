#!/usr/bin/env python3
"""Synthetic BoM ASCII-format fixture validates the parser, NOT IFD estimates."""
import subprocess,sys,tempfile,zipfile,json
from pathlib import Path
with tempfile.TemporaryDirectory() as temp:
 root=Path(temp);source=root/"official-format-test.zip"
 header="ncols 2\nnrows 2\nxllcorner 153.4\nyllcorner -28.025\ncellsize 0.025\nNODATA_value -9999\n"
 with zipfile.ZipFile(source,"w") as z:
  for probability,mm in [("20000",59.3),("10000",70.3),("05000",81.4),("02000",96.8),("01000",109)]:
   z.writestr(f"catchment_depth_60min_{probability}aep.txt.asc",header+f"{mm} {mm}\n{mm} {mm}\n")
 target=root/"valid.json"
 subprocess.run([sys.executable,"scripts/import-bom-ifd-extent-grids-v1.py","--zip",str(source),"--out",str(target)],check=True)
 result=json.loads(target.read_text());assert len(result["cells"])==4
 assert result["cells"]["-28.0125,153.4125"]["depthsMmByMinutes"]["60"]["20"]==59.3
 assert result["cells"]["-28.0125,153.4125"]["depthsMmByMinutes"]["60"]["1"]==109
 print("PASS official-format 0.025-degree ASCII extent grid import; fixture synthetic, not public IFD measurement")
