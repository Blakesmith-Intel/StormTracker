#!/usr/bin/env python3
"""Read official documented products ONLY; no scraping of BoM's website."""
import ftplib, urllib.request, re, datetime, json, socket
socket.setdefaulttimeout(20)
url="https://api.bom.gov.au/apikey/v1/mapping/timeseries/wmts?SERVICE=WMTS&REQUEST=GetCapabilities&VERSION=1.0.0&LAYER=atm_surf_air_precip_reflectivity_dbz"
try:
  request=urllib.request.Request(url,headers={"Accept":"application/xml,text/xml","Cache-Control":"no-cache"})
  with urllib.request.urlopen(request,timeout=20) as f:
    xml=f.read(1_000_000).decode("utf-8","replace")
    times=re.findall(r"<Value>\s*(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ)\s*</Value>",xml)
    print("DIRECT_BOM_WMTS_CAPABILITIES",json.dumps({"status":f.status,"bytes":len(xml),"times":times[-12:],"head":xml[:180]}))
except Exception as e: print("DIRECT_BOM_WMTS_ERROR",repr(e))
try:
  with ftplib.FTP("ftp.bom.gov.au",timeout=20) as ftp:
    ftp.login("anonymous","stormtracker-ops@example.com")
    ftp.cwd("/anon/gen/radar")
    print("ANONYMOUS_BOM_FTP_LOGIN_PASS")
    lines=ftp.nlst()
    candidates=[x for x in lines if re.search(r"IDR00004|IDR0000|IDR1073\.T\.",x)]
    print("ANONYMOUS_BOM_NATIONAL_PRODUCT_LIST",json.dumps({"matched":candidates[-40:],"nationalCount":sum('IDR00004' in x for x in candidates),"listingCount":len(lines)}))
    national=next((x for x in reversed(candidates) if 'IDR00004' in x),None)
    if national:
      bytecount=[0];first=[b""]
      def receive(b):
        bytecount[0]+=len(b)
        if len(first[0])<40:first[0]+=b[:40-len(first[0])]
      ftp.retrbinary("RETR "+national,receive)
      print("ANONYMOUS_BOM_NATIONAL_PRODUCT_FRAME",json.dumps({"name":national,"bytes":bytecount[0],"magic":first[0][:12].hex(),"width":int.from_bytes(first[0][16:20],"big"),"height":int.from_bytes(first[0][20:24],"big")}))
except Exception as e:print("ANONYMOUS_BOM_FTP_ERROR",repr(e))
