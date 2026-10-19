#!/usr/bin/env python3
"""Pure local fixture: original source SHA reuse, tampered-byte rejection, new scan only."""
import copy
import datetime as dt
import importlib.util
import json
import struct
import tempfile
from pathlib import Path

spec=importlib.util.spec_from_file_location("ftp_stage","scripts/stage-genuine-ftp-png-feed-v1.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
png=b"\x89PNG\r\n\x1a\n"+struct.pack(">I",13)+b"IHDR"+struct.pack(">IIBBBBB",512,512,8,3,0,0,0)+b"\x00"*(132)
baseTime=dt.datetime(2026,10,19,10,15,tzinfo=dt.timezone.utc)
def rec(site,minute):
 name=f"IDR{site}3.T.2026101910{minute:02d}.png"
 return {"filename":name,"observedUtc":f"2026-10-19T10:{minute:02d}:00Z",
         "mapFile":f"IDR{site}3.map"}
def manifest(last=10):
 return {"schema":"StormTrackerBoMFtpReflectivityManifestV1",
  "siteGeoreference":{site:{"controlPoints":{"one":1}} for site in ["08","50","66"]},
  "siteFrameHistory":{site:[rec(site,5),rec(site,last)] for site in ["08","50","66"]}}
class Ftp:
 def __init__(self):self.calls=[]
 def retrbinary(self,cmd,callback,blocksize=65536):
  self.calls.append(cmd)
  callback(png)
with tempfile.TemporaryDirectory() as t:
 root=Path(t);one=root/"first";two=root/"second";three=root/"third"
 for path in [one,two,three]:path.mkdir()
 ftp=Ftp()
 original=module.stage(manifest(),one,baseTime,ftp)
 assert len(ftp.calls)==6,ftp.calls
 ftp2=Ftp()
 second=module.stage(manifest(),two,baseTime,ftp2,
  reuse_dir=one/"frames",prior_manifest=copy.deepcopy(original))
 assert len(ftp2.calls)==0,ftp2.calls
 assert second["siteFrameHistory"]==original["siteFrameHistory"]
 assert all((one/"frames"/p.name).read_bytes()==(two/"frames"/p.name).read_bytes()
            for p in (one/"frames").glob("*.png"))
 # Tamper with one previously archived object: SHA mismatch MUST redownload.
 tamper=(one/"frames"/rec("08",5)["filename"])
 tamper.write_bytes(png+b"tampered")
 ftp3=Ftp()
 third=module.stage(manifest(),three,baseTime,ftp3,
   reuse_dir=one/"frames",prior_manifest=copy.deepcopy(original))
 assert len(ftp3.calls)==1,ftp3.calls
 assert "IDR083.T.202610191005.png" in ftp3.calls[0]
 assert third["siteFrameHistory"]==original["siteFrameHistory"]
print("FTP_REUSE_BYTE_VERIFIED_SOURCE_PASS",{"originalDownloads":6,"reusedDownloads":0,"tamperedRedownloads":1})
