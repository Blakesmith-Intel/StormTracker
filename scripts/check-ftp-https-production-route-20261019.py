import ftplib,urllib.request,json,re,datetime
f=ftplib.FTP("ftp.bom.gov.au",timeout=18);f.login("anonymous","stormtracker@example.com");f.cwd("/anon/gen/radar")
names=f.nlst();f.quit()
for site in ["08","50","66","28"]:
 prefix="IDR"+site+"3.T."
 files=sorted(x.split("/")[-1] for x in names if x.split("/")[-1].startswith(prefix) and x.endswith(".png"))
 if not files:raise SystemExit("NO FTP IMAGE "+site)
 filename=files[-1]
 for host in ["https://www.bom.gov.au/radar/","https://www.bom.gov.au/anon/gen/radar/"]:
  req=urllib.request.Request(host+filename,headers={"User-Agent":"StormTracker source-transport QA","Accept":"image/png"})
  try:
   with urllib.request.urlopen(req,timeout=14) as r:body=r.read(16);status=r.status;ctype=r.headers.get("content-type")
  except Exception as e:print("HTTPS_SOURCE",json.dumps({"site":site,"filename":filename,"url":host+filename,"error":str(e)}));continue
  print("HTTPS_SOURCE",json.dumps({"site":site,"filename":filename,"url":host+filename,"status":status,"ctype":ctype,"png":body[:8]==b"\\x89PNG\\r\\n\\x1a\\n"}))
