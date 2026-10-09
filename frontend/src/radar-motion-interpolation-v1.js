// Estimate echo motion from neighbouring real BoM reflectivity rasters.
// Intermediates advect storm cells, not scene opacity; display-only and unmeasured.
export function canMotionInterpolateRadar(a,b) {
  const t=Date.parse(a?.observedUtc),u=Date.parse(b?.observedUtc);
  return Number.isFinite(t)&&Number.isFinite(u)&&u>t&&u-t<=15*60000&&
    a.width===b.width&&a.height===b.height&&a.width>0&&a.height>0&&
    a.categories?.length===a.width*a.height&&b.categories?.length===b.width*b.height&&
    ["projection","minX","maxX","minY","maxY"].every(k=>a.georef?.[k]===b.georef?.[k]);
}
const clamp=(n,l,h)=>Math.max(l,Math.min(h,n));
const sample=(a,w,h,x,y)=>x>=0&&x<w&&y>=0&&y<h?a[y*w+x]:0;
export function createRadarMotionTransition(a,b,{blockSize=64,maxMotionPixels=12}={}){
  if(!canMotionInterpolateRadar(a,b))throw new TypeError("Compatible consecutive observed radar scans required");
  if(!Number.isInteger(blockSize)||blockSize<16||blockSize>256||
     !Number.isInteger(maxMotionPixels)||maxMotionPixels<1||maxMotionPixels>24)
     throw new RangeError("Invalid radar motion search settings");
  const w=a.width,h=a.height,nx=Math.ceil(w/blockSize),ny=Math.ceil(h/blockSize);
  const flow=[];
  for(let gy=0;gy<ny;gy++)for(let gx=0;gx<nx;gx++){
    const left=gx*blockSize,top=gy*blockSize;
    const right=Math.min(w,left+blockSize),bottom=Math.min(h,top+blockSize);
    let count=0;
    for(let y=top;y<bottom;y+=6)for(let x=left;x<right;x+=6)
      if(a.categories[y*w+x]>=2)count++;
    if(count<3){flow.push({dx:0,dy:0,valid:false});continue}
    const error=(dx,dy)=>{
      let sum=0,used=0;
      for(let y=top;y<bottom;y+=6)for(let x=left;x<right;x+=6){
        const v=a.categories[y*w+x];if(v<2)continue;
        const r=sample(b.categories,w,h,x+dx,y+dy);
        sum+=2*Math.abs(v-r)+(r===0?4:0);used++;
      }
      return sum/Math.max(1,used)+.035*(dx*dx+dy*dy);
    };
    let best={dx:0,dy:0,score:error(0,0)};
    for(let dy=-maxMotionPixels;dy<=maxMotionPixels;dy+=4)
      for(let dx=-maxMotionPixels;dx<=maxMotionPixels;dx+=4){
        const score=error(dx,dy);
        if(score<best.score)best={dx,dy,score};
      }
    const coarse={...best};
    for(let dy=Math.max(-maxMotionPixels,coarse.dy-3);dy<=Math.min(maxMotionPixels,coarse.dy+3);dy++)
      for(let dx=Math.max(-maxMotionPixels,coarse.dx-3);dx<=Math.min(maxMotionPixels,coarse.dx+3);dx++){
        const score=error(dx,dy);
        if(score<best.score)best={dx,dy,score};
      }
    flow.push({dx:best.dx,dy:best.dy,valid:true});
  }
  // Neighbour-average flows so moving echoes do not tear at block edges.
  const smooth=flow.map((p,i)=>{
    let dx=0,dy=0,n=0,cx=i%nx,cy=Math.floor(i/nx);
    for(let y=Math.max(0,cy-1);y<=Math.min(ny-1,cy+1);y++)
      for(let x=Math.max(0,cx-1);x<=Math.min(nx-1,cx+1);x++){
        const q=flow[y*nx+x];if(!q.valid)continue;
        const wt=x===cx&&y===cy?4:1;dx+=q.dx*wt;dy+=q.dy*wt;n+=wt;
      }
    return n?{dx:dx/n,dy:dy/n}:{dx:0,dy:0};
  });
  function frame(fraction){
    if(!(fraction>0&&fraction<1))throw new RangeError("Transition fraction must be between 0 and 1");
    const t=fraction, data=new Uint8Array(w*h);
    for(let y=0;y<h;y++){
      let gy=Math.min(ny-1,Math.floor(y/blockSize)),y2=Math.min(ny-1,gy+1);
      const fy=clamp(y/blockSize-gy,0,1);
      for(let x=0;x<w;x++){
        let gx=Math.min(nx-1,Math.floor(x/blockSize)),x2=Math.min(nx-1,gx+1);
        const fx=clamp(x/blockSize-gx,0,1);
        const p=smooth[gy*nx+gx],q=smooth[gy*nx+x2],
          r=smooth[y2*nx+gx],s=smooth[y2*nx+x2];
        const dx=(p.dx*(1-fx)+q.dx*fx)*(1-fy)+(r.dx*(1-fx)+s.dx*fx)*fy;
        const dy=(p.dy*(1-fx)+q.dy*fx)*(1-fy)+(r.dy*(1-fx)+s.dy*fx)*fy;
        const v=sample(a.categories,w,h,Math.round(x-t*dx),Math.round(y-t*dy));
        const z=sample(b.categories,w,h,Math.round(x+(1-t)*dx),Math.round(y+(1-t)*dy));
        // Intensity evolves after spatial compensation; no opacity dissolve.
        data[y*w+x]=clamp(Math.round(v*(1-t)+z*t),0,15);
      }
    }
    const utc=new Date(Date.parse(a.observedUtc)+(Date.parse(b.observedUtc)-Date.parse(a.observedUtc))*t).toISOString();
    return {...a,categories:data,observedUtc:utc,georef:{...a.georef},
      sourceMetadata:{...a.sourceMetadata,volumeStatus:"inferred-temporal-display-only",
        temporalInference:{displayOnly:true,method:"motion-compensated-category-warp",
          beforeUtc:a.observedUtc,afterUtc:b.observedUtc,targetUtc:utc,weight:t}}};
  }
  return {frame,vectorGrid:flow};
}
export const radarMotionStepsForSpeed=speed=>Number(speed)>=2?1:Number(speed)<=.5?3:2;
