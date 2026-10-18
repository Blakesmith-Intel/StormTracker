import ftplib,re,json,io,collections
from PIL import Image
FAMILIES=("08","50","66","53","28","93")
PALETTE={(245,245,255),(180,180,255),(120,120,255),(20,20,255),(0,216,195),(0,150,144),(0,102,102),(255,255,0),(255,200,0),(255,150,0),(255,100,0),(255,0,0),(200,0,0),(120,0,0),(40,0,0)}
ftp=ftplib.FTP("ftp.bom.gov.au",timeout=15);ftp.login("anonymous","stormtracker@example.com");ftp.cwd("/anon/gen/radar")
files=ftp.nlst();results=[]
for site in FAMILIES:
 for variant in "1234":
  prefix="IDR"+site+variant+".T."
  options=sorted([n.split("/")[-1] for n in files if n.split("/")[-1].startswith(prefix) and n.endswith(".png")])
  if not options:continue
  name=options[-1];parts=[];ftp.retrbinary("RETR "+name,parts.append);body=b"".join(parts)
  im=Image.open(io.BytesIO(body)).convert("RGBA")
  hist=collections.Counter(im.getdata())
  opaque=sum(count for color,count in hist.items() if color[3]>0)
  matching=sum(count for color,count in hist.items() if color[3]>0 and color[:3] in PALETTE)
  decorative=sum(count for color,count in hist.items() if color[3]>0 and color[:3] in ((192,192,192),(0,0,0)))
  result={"site":site,"variant":variant,"filename":name,"dimensions":im.size,"bytes":len(body),"opaque":opaque,"paletteExact":matching,"palettePctOfOpaque":round(100*matching/max(opaque,1),3),"decorative":decorative,"top":hist.most_common(13)}
  results.append(result)
print("REFLECTIVITY_VARIANT_REPORT",json.dumps(results))
ftp.quit()
