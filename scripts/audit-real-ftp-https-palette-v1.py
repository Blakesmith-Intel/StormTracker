import ftplib,io,urllib.request,hashlib,json,re,collections
from PIL import Image
C={(245,245,255),(180,180,255),(120,120,255),(20,20,255),(0,216,195),(0,150,144),(0,102,102),(255,255,0),(255,200,0),(255,150,0),(255,100,0),(255,0,0),(200,0,0),(120,0,0),(40,0,0)}
ftp=ftplib.FTP("ftp.bom.gov.au",timeout=20);ftp.login("anonymous","stormtracker-audit@example.com");ftp.cwd("/anon/gen/radar")
for site in ["08","50","66","28"]:
 files=sorted(x.rsplit("/",1)[-1] for x in ftp.nlst() if re.fullmatch(r"IDR"+site+r"3\.T\.\d{12}\.png",x.rsplit("/",1)[-1]))
 if not files:continue
 file=files[-1];parts=[];ftp.retrbinary("RETR "+file,parts.append);raw=b"".join(parts)
 req=urllib.request.Request("https://www.bom.gov.au/radar/"+file,headers={"Accept":"image/png"})
 try:
  with urllib.request.urlopen(req,timeout=15) as r:direct=r.read()
 except Exception as e:
  print("REAL_FTP_HTTPS_COMPARE",json.dumps({"site":site,"file":file,"http_error":str(e)}));continue
 def inspect(content):
  im=Image.open(io.BytesIO(content)).convert("RGBA")
  count=0;match=0;unknown=collections.Counter()
  for pix in list(im.getdata())[:512*438]:
   if not pix[3]:continue
   count+=1
   if pix[:3] in C:match+=1
   else:unknown[pix[:3]]+=1
  return {"size":im.size,"opaque":count,"matching":match,
   "matchingFraction":round(match/max(1,count),4),"unknownColours":unknown.most_common(6)}
 print("REAL_FTP_HTTPS_COMPARE",json.dumps({"site":site,"file":file,
   "sameBytes":raw==direct,"ftpSha256":hashlib.sha256(raw).hexdigest(),
   "httpsSha256":hashlib.sha256(direct).hexdigest(),
   "ftp":inspect(raw),"https":inspect(direct)}))
ftp.quit()
