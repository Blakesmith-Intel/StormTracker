function rgbAt(data,width,x,y) {
  const i=(y*width+x)*4;
  return [data[i],data[i+1],data[i+2],data[i+3]];
}

function sameRgb(a,b) {
  return a[0]===b[0] && a[1]===b[1] && a[2]===b[2];
}

function rowRuns(imageData,y) {
  const {width,data}=imageData;
  const runs=[];

  let start=0;
  let previous=rgbAt(data,width,0,y);

  for (let x=1;x<=width;x++) {
    const current=x<width?rgbAt(data,width,x,y):null;

    if (current && sameRgb(previous,current)) {
      continue;
    }

    runs.push({
      start,
      end:x-1,
      width:x-start,
      rgb:previous.slice(0,3),
      alpha:previous[3]
    });

    start=x;
    previous=current;
  }

  return runs;
}

function isPaletteLike(rgb) {
  const [r,g,b]=rgb;
  const maximum=Math.max(r,g,b);
  const minimum=Math.min(r,g,b);
  const spread=maximum-minimum;

  // Saturated coloured swatches, including dark blues.
  if (maximum>=35 && spread>=28) {
    return true;
  }

  // Bright neutral / near-white zero-velocity swatch.
  if (minimum>=175) {
    return true;
  }

  return false;
}

function candidateClusters(runs) {
  const eligible=runs.filter(run=>
    run.alpha>0 &&
    run.width>=3 &&
    run.width<=60 &&
    isPaletteLike(run.rgb)
  );

  if (!eligible.length) {
    return [];
  }

  const clusters=[];
  let current=[eligible[0]];

  for (let i=1;i<eligible.length;i++) {
    const previous=current.at(-1);
    const next=eligible[i];
    const gap=next.start-previous.end-1;

    if (gap<=2) {
      current.push(next);
    } else {
      clusters.push(current);
      current=[next];
    }
  }

  clusters.push(current);
  return clusters;
}

function coefficientOfVariation(values) {
  if (!values.length) return Infinity;
  const mean=values.reduce((a,b)=>a+b,0)/values.length;
  if (!(mean>0)) return Infinity;

  const variance=values.reduce(
    (sum,value)=>sum+(value-mean)**2,
    0
  )/values.length;

  return Math.sqrt(variance)/mean;
}

function scoreCluster(cluster) {
  if (cluster.length<6) return -Infinity;

  const widths=cluster.map(run=>run.width);
  const widthCv=coefficientOfVariation(widths);
  const span=cluster.at(-1).end-cluster[0].start+1;

  return (
    cluster.length*150 +
    span*2 -
    widthCv*500
  );
}

export function footerGeometry(imageData) {
  const {width,height}=imageData;

  // BOM radar GIFs used here are a square radar panel plus a footer.
  // For the current public products: 524 x 564 => footer y=524..563.
  const footerStart=Math.min(width,height);

  if (height<=footerStart) {
    throw new Error(
      `No footer area detected: image is ${width}x${height}.`
    );
  }

  return {
    footerStart,
    footerHeight:height-footerStart
  };
}

export function locateFooterVelocityBar(imageData) {
  const {width,height}=imageData;
  const {footerStart}=footerGeometry(imageData);

  let best=null;

  for (let y=footerStart;y<height;y++) {
    const runs=rowRuns(imageData,y);

    for (const cluster of candidateClusters(runs)) {
      const score=scoreCluster(cluster);

      if (!best || score>best.score) {
        best={
          y,
          footerRow:y-footerStart,
          score,
          minX:cluster[0].start,
          maxX:cluster.at(-1).end,
          runs:cluster
        };
      }
    }
  }

  return best;
}

export function createFooterCanvas(sourceCanvas,{scale=8}={}) {
  const width=sourceCanvas.width;
  const height=sourceCanvas.height;
  const footerStart=Math.min(width,height);

  if (height<=footerStart) {
    throw new Error(
      `No footer area in ${width}x${height} image.`
    );
  }

  const footerHeight=height-footerStart;

  const canvas=document.createElement("canvas");
  canvas.width=width*scale;
  canvas.height=footerHeight*scale;

  const context=canvas.getContext("2d");
  context.imageSmoothingEnabled=false;

  context.drawImage(
    sourceCanvas,
    0,
    footerStart,
    width,
    footerHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return {
    canvas,
    footerStart,
    footerHeight,
    scale
  };
}

export function createBarStripCanvas(
  sourceCanvas,
  bar,
  {scale=12,padding=3}={}
) {
  if (!bar) return null;

  const x0=Math.max(0,bar.minX-5);
  const x1=Math.min(sourceCanvas.width-1,bar.maxX+5);
  const y0=Math.max(0,bar.y-padding);
  const y1=Math.min(sourceCanvas.height-1,bar.y+padding);

  const width=x1-x0+1;
  const height=y1-y0+1;

  const canvas=document.createElement("canvas");
  canvas.width=width*scale;
  canvas.height=height*scale;

  const context=canvas.getContext("2d");
  context.imageSmoothingEnabled=false;

  context.drawImage(
    sourceCanvas,
    x0,
    y0,
    width,
    height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas;
}

export function analyseFooterPalette(sourceCanvas) {
  const context=sourceCanvas.getContext(
    "2d",
    {willReadFrequently:true}
  );

  const imageData=context.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height
  );

  const geometry=footerGeometry(imageData);
  const bar=locateFooterVelocityBar(imageData);

  return {
    geometry,
    bar,
    footer:createFooterCanvas(sourceCanvas),
    barCanvas:createBarStripCanvas(sourceCanvas,bar)
  };
}
