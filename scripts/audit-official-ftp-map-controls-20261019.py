import ftplib,json
f=ftplib.FTP("ftp.bom.gov.au",timeout=18);f.login("anonymous","stormtracker@example.com")
f.cwd("/anon/gen/radar_transparencies/coordinates")
names=f.nlst()
print("MAP_COUNT",len(names))
for site in ("08","50","66","53","28","93"):
 for suffix in ("3","4"):
  name="IDR"+site+suffix+".map"
  if name not in [n.split("/")[-1] for n in names]:
   print("MAP_MISSING",name);continue
  pieces=[]
  f.retrbinary("RETR "+name,pieces.append)
  content=b"".join(pieces).decode("utf-8","replace")
  print("MAP_SOURCE",name,json.dumps(content[:5000]))
f.quit()
