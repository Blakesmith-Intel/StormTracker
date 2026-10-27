// Cesium ground imagery provider. Its position IN imageryLayers, below the
// measured radar imagery surface, keeps warning fills UNDER all radar pixels.
// Not Cesium PolygonGraphics: ground entities can obscure radar imagery.
export const WARNING_RECTANGLE=Object.freeze([136,-38,155,-9]);
const rad=180/Math.PI;
const ringsOf=g=>g?.type==="Polygon"?g.coordinates:
 g?.type==="MultiPolygon"?g.coordinates.flatMap(p=>p):[];
export function warningContainsPoint(geometry,longitude,latitude){
 let inside=false;
 for(const poly of geometry?.type==="Polygon"?[geometry.coordinates]:
     geometry?.type==="MultiPolygon"?geometry.coordinates:[]){
  if(!Array.isArray(poly)||!poly.length)continue;
  const within=ring=>{
   let state=false;
   for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if(((a[1]>latitude)!==(b[1]>latitude))&&
      longitude<(b[0]-a[0])*(latitude-a[1])/(b[1]-a[1])+a[0])
       state=!state;
   }
   return state;
  };
  if(within(poly[0])&&!poly.slice(1).some(within))inside=true;
 }
 return inside;
}
export function createWarningImageryProvider(CesiumRef,warnings){
 const tilingScheme=new CesiumRef.GeographicTilingScheme({
  rectangle:CesiumRef.Rectangle.fromDegrees(...WARNING_RECTANGLE),
  numberOfLevelZeroTilesX:1,numberOfLevelZeroTilesY:1
 });
 const tileWidth=512,tileHeight=512;
 const colours={"severe-thunderstorm":["rgba(241,86,43,.20)","#fc803c"],
   "severe-weather":["rgba(248,176,39,.18)","#edbb59"]};
 const image=(x,y,level)=>{
  const rect=tilingScheme.tileXYToRectangle(x,y,level),w=rect.east-rect.west,h=rect.north-rect.south;
  const canvas=document.createElement("canvas");canvas.width=tileWidth;canvas.height=tileHeight;
  const c=canvas.getContext("2d");
  if(!c)return canvas;
  for(const entry of warnings){
   const rings=ringsOf(entry.geometry),style=colours[entry.type];
   if(!style)continue;
   c.beginPath();let has=false;
   for(const ring of rings){
    if(!Array.isArray(ring)||ring.length<4)continue;
    // True source vertices, no Douglas-Peucker simplification or sliver cull.
    for(let i=0;i<ring.length;i++){
     const px=((ring[i][0]/rad)-rect.west)/w*tileWidth;
     const py=(rect.north-(ring[i][1]/rad))/h*tileHeight;
     if(i===0)c.moveTo(px,py);else c.lineTo(px,py);
    }
    c.closePath();has=true;
   }
   if(!has)continue;
   c.fillStyle=style[0];c.fill("evenodd");
   c.strokeStyle=style[1];c.lineWidth=2;c.stroke();
  }
  return canvas;
 };
 const provider={
  tileWidth,tileHeight,minimumLevel:0,maximumLevel:12,
  tilingScheme,rectangle:tilingScheme.rectangle,
  hasAlphaChannel:true,credit:new CesiumRef.Credit("Official Bureau of Meteorology warning areas"),
  ready:true,readyPromise:Promise.resolve(true),
  errorEvent:new CesiumRef.Event(),
  requestImage(x,y,level){return image(x,y,level);},
  pickFeatures(x,y,level,lon,lat){
   const found=warnings.filter(a=>warningContainsPoint(a.geometry,lon*rad,lat*rad));
   return found.map(a=>{
    const item=new CesiumRef.ImageryLayerFeatureInfo();
    item.name=a.headline||a.event;item.data=a;
    item.position=CesiumRef.Cartographic.fromRadians(lon,lat);
    return item;
   });
  }
 };
 return provider;
}
