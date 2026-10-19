import ftplib,io,json,re,base64,os,datetime,math
from PIL import Image
SITES=("08","50","66","28")
RGB={(245,245,255):1,(180,180,255):2,(120,120,255):3,(20,20,255):4,(0,216,195):5,(0,150,144):6,(0,102,102):7,(255,255,0):8,(255,200,0):9,(255,150,0):10,(255,100,0):11,(255,0,0):12,(200,0,0):13,(120,0,0):14,(40,0,0):15}
f=ftplib.FTP("ftp.bom.gov.au",timeout=20);f.login("anonymous","stormtracker-qa@example.com")
def read(path):
 b=[];f.retrbinary("RETR "+path,b.append);return b"".join(b)
maps={}
f.cwd("/anon/gen/radar_transparencies/coordinates")
for s in SITES:
 raw=read("IDR"+s+"3.map").decode("utf8","replace")
 v=dict((k,float(x)) for k,x in re.findall(r"(?m)^\s*([a-z_]+[0-3]?)\s*=\s*([-\d.]+)",raw))
 assert "projection = Gnomonic" in raw
 maps[s]=v
f.cwd("/anon/gen/radar");names=f.nlst()
out=[]
for s in SITES:
 files=sorted(n.split("/")[-1] for n in names if re.fullmatch(r"IDR"+s+r"3\.T\.\d{12}\.png",n.split("/")[-1]))[-3:]
 assert len(files)==3
 for name in files:
  stamp=re.search(r"\.T\.(\d{12})\.",name).group(1)
  utc=datetime.datetime.strptime(stamp,"%Y%m%d%H%M").replace(tzinfo=datetime.timezone.utc)
  assert abs((datetime.datetime.now(datetime.timezone.utc)-utc).total_seconds())<2700
  image=Image.open(io.BytesIO(read(name))).convert("RGBA");assert image.size==(512,512)
  categories=bytes(RGB.get(p[:3],0) if p[3]>0 else 0 for p in image.getdata())
  out.append(dict(site=s,filename=name,observedUtc=utc.isoformat().replace("+00:00","Z"),categories=base64.b64encode(categories).decode(),controlPoints=maps[s]))
os.makedirs("/tmp/stormtracker-ftp-qa",exist_ok=True)
with open("/tmp/stormtracker-ftp-qa/frames.json","w") as o:json.dump(out,o)
print("LIVE_FTP_FIXTURES",json.dumps([{k:v for k,v in r.items() if k not in ("categories","controlPoints")} for r in out]))
f.quit()
