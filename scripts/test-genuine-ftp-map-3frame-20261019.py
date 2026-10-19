import ftplib,io,re,json,math,collections,datetime
from PIL import Image
R=6371008.8
SITES=("08","50","66","53","28","93")
RGB={(245,245,255):1,(180,180,255):2,(120,120,255):3,(20,20,255):4,(0,216,195):5,(0,150,144):6,(0,102,102):7,(255,255,0):8,(255,200,0):9,(255,150,0):10,(255,100,0):11,(255,0,0):12,(200,0,0):13,(120,0,0):14,(40,0,0):15}
def inv(x,y,lon,lat):
 l,p=map(math.radians,(lon,lat));rho=math.hypot(x,y)
 if not rho:return(lon,lat)
 t=math.atan(rho/R);s=math.sin(t);c=math.cos(t)
 return (math.degrees(l+math.atan2(x*s,rho*math.cos(p)*c-y*math.sin(p)*s)), math.degrees(math.asin(c*math.sin(p)+y*s*math.cos(p)/rho)))
def fwd(lon,lat,lon0,lat0):
 l,p,l0,p0=map(math.radians,(lon,lat,lon0,lat0))
 d=l-l0;cosc=math.sin(p0)*math.sin(p)+math.cos(p0)*math.cos(p)*math.cos(d)
 return (R*math.cos(p)*math.sin(d)/cosc,R*(math.cos(p0)*math.sin(p)-math.sin(p0)*math.cos(p)*math.cos(d))/cosc)
ftp=ftplib.FTP("ftp.bom.gov.au",timeout=20);ftp.login("anonymous","stormtracker@example.com")
def get(path):
 parts=[];ftp.retrbinary("RETR "+path,parts.append);return b"".join(parts)
ftp.cwd("/anon/gen/radar_transparencies/coordinates")
maps={}
for s in SITES:
 name=f"IDR{s}3.map";raw=get(name).decode("utf-8","replace")
 vals=dict((k.strip(),float(v)) for k,v in re.findall(r"(?m)^\s*([a-z_]+[0-3]?)\s*=\s*([-\d.]+)",raw) if k!="projection")
 assert "projection = Gnomonic" in raw
 pts=[(vals[f"lon{i}"],vals[f"lat{i}"]) for i in range(4)]
 center=(vals["center_longitude"],vals["center_latitude"])
 xy=[fwd(*pt,*center) for pt in pts]
 bounds=(sum(x for x,y in xy[:2])/2,sum(x for x,y in xy[2:])/2,sum(y for x,y in (xy[0],xy[3]))/2,sum(y for x,y in (xy[1],xy[2]))/2)
 # all original corner points must reproject within ~0.05 degrees, accounting source coordinate rounding
 residual=[]
 for index,(longitude,latitude) in enumerate(pts):
  x=bounds[0 if index in (0,1) else 1]; y=bounds[2 if index in (0,3) else 3]
  ll=inv(x,y,*center)
  residual.append(max(abs(ll[0]-longitude),abs(ll[1]-latitude)))
 assert max(residual)<0.02,(s,residual)
 maps[s]=dict(center=center,boundsMetres=bounds,maxCornerResidualDegrees=max(residual))
ftp.cwd("/anon/gen/radar")
names=ftp.nlst()
output=[]
for s in SITES:
 prefix=f"IDR{s}3.T."
 options=sorted(n for n in names if n.split("/")[-1].startswith(prefix) and n.endswith(".png"))
 if len(options)<3:raise Exception("Less than 3 genuine frames "+s)
 samples=[]
 for name in options[-3:]:
  name=name.split("/")[-1];dt=datetime.datetime.strptime(name.split(".T.")[1][:12],"%Y%m%d%H%M").replace(tzinfo=datetime.timezone.utc)
  img=Image.open(io.BytesIO(get(name))).convert("RGBA")
  assert img.size==(512,512)
  pixels=img.getdata();cat=collections.Counter()
  for rgba in pixels:
   if rgba[3]:cat[RGB.get(rgba[:3],0)]+=1
  strong=sum(num for intensity,num in cat.items() if intensity>=7)
  samples.append(dict(filename=name,observedUtc=dt.isoformat(),dbzAtLeast40Pixels=strong,nonzero=sum(v for k,v in cat.items() if k>0)))
 output.append(dict(site=s,reference=maps[s],frames=samples,sourceFrames=3,
   threeDEligible=any(x["dbzAtLeast40Pixels"]>0 for x in samples)))
print("FTP_MAP_AND_3FRAME_REPORT",json.dumps(output))
ftp.quit()
