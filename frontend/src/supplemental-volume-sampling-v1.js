// Uniform, source-pixel-stable choice of real ≥40 dBZ supplemental samples.
// The former 'pixelIndex % frozenStride' lattice could select ZERO pixels
// from a real echo when the source mosaic's occupied pixels consistently fell
// between lattice columns. A first quiet scan also froze stride=1 forever,
// biasing subsequent storm sampling to the earliest source rows.
// Bounded min-hash uses genuine source pixels only and keeps survivors stable
// when storms change intensity; no interpolated radar observations are created.
export function hashSupplementalPixel(index) {
  let value=(index ^ 0x9e3779b9)>>>0;
  value=Math.imul(value^(value>>>16),0x85ebca6b)>>>0;
  value=Math.imul(value^(value>>>13),0xc2b2ae35)>>>0;
  return (value^(value>>>16))>>>0;
}

export function selectSupplementalVolumeSampleIndices(
  categories,representativeDbzForCategory,threshold=40,maxColumns=250
) {
  if(!categories || typeof representativeDbzForCategory!=="function")
    throw new TypeError("Expected genuine BoM categories and dBZ palette");
  if(!Number.isInteger(maxColumns)||maxColumns<1)
    throw new RangeError("Expected positive sample-column budget");

  // Max-heap holds the *lowest* priority hashes. A real source pixel's
  // category may change, but its selection rank does not.
  const heap=[];
  const worse=(a,b)=>a.hash>b.hash||(a.hash===b.hash&&a.index>b.index);
  function down(){
    let i=0;
    while(true){
      let child=i*2+1;
      if(child>=heap.length)break;
      if(child+1<heap.length && worse(heap[child+1],heap[child]))
        child++;
      if(!worse(heap[child],heap[i]))break;
      [heap[i],heap[child]]=[heap[child],heap[i]];
      i=child;
    }
  }
  function up(){
    let i=heap.length-1;
    while(i>0){
      const p=(i-1)>>1;
      if(!worse(heap[i],heap[p]))break;
      [heap[p],heap[i]]=[heap[i],heap[p]];
      i=p;
    }
  }
  let eligible=0;
  for(let i=0;i<categories.length;i++){
    const dbz=representativeDbzForCategory(categories[i]);
    if(dbz===null||dbz===undefined||dbz<threshold)continue;
    eligible++;
    const candidate={index:i,hash:hashSupplementalPixel(i)};
    if(heap.length<maxColumns){heap.push(candidate);up();}
    else if(worse(heap[0],candidate)){heap[0]=candidate;down();}
  }
  return {
    eligible,
    indices:heap.map(item=>item.index).sort((a,b)=>a-b)
  };
}
