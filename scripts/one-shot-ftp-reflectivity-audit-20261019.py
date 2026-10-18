# Read-only FTP reflectivity product audit. No permanent service or production change.
import ftplib, io, json, re, datetime, collections
from PIL import Image
HOST="ftp.bom.gov.au"
PREFIXES=("IDR08","IDR19","IDR22","IDR50","IDR66","IDR75","IDR93","IDR53","IDR28")
ftp=ftplib.FTP(timeout=18)
report=[]
try:
 ftp.connect(HOST,21,timeout=18);ftp.login("anonymous","stormtracker-audit@example.com")
 ftp.cwd("/anon/gen/radar")
 names=ftp.nlst()
 print("LISTING",len(names),"PREFIX_SAMPLES",json.dumps([n for n in names if n.upper().startswith("IDR66")][:25]))
 for prefix in PREFIXES:
  matching=[n.split("/")[-1] for n in names if n.split("/")[-1].upper().startswith(prefix) and n.lower().endswith(".png")]
  groups=collections.Counter(re.sub(r"\d{12}", "<UTC>", n) for n in matching)
  recent=sorted([n for n in matching if re.search(r"\.T\.\d{12}\.png$",n)],reverse=True)[:3]
  sample=recent[:1] or sorted(matching,reverse=True)[:1]
  item={"site":prefix,"pngCount":len(matching),"patterns":groups.most_common(12),"latestTimestamped":recent}
  if sample:
   name=sample[0];parts=[];ftp.retrbinary("RETR "+name,parts.append,blocksize=32768);data=b"".join(parts)
   item.update(filename=name,bytes=len(data),magic=data[:8].hex(),png=data[:8]==b"\x89PNG\r\n\x1a\n")
   if item["png"]:
    im=Image.open(io.BytesIO(data));im.load()
    item.update(size=im.size,mode=im.mode,colors=im.convert("RGBA").getcolors(maxcolors=1000000))
    if isinstance(item["colors"],list):
     item["colors"]=sorted(item["colors"],reverse=True)[:25]
  report.append(item)
 print("FTP_REPORT",json.dumps(report))
finally:
 try:ftp.quit()
 except Exception:pass
