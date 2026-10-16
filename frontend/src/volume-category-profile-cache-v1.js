// Source-exact memoisation of empirical 3-D profiles by original BoM dBZ
// category. A frame can contain millions of pixels, but only 15 categories.
// There is NO spatial inference, altered dBZ, delayed source time or
// interpolation; the existing model, occupancy and style functions are called
// once per unique category/settings combination per render transaction.
export function createVolumeCategoryProfileCache({
  model,occupancyThreshold,displayThresholdDbz,pointSize,
  representativeDbzForCategory,inferColumn,shouldRenderVolumePoint,
  styleForInferredPoint,minimumOutputDbz=30
}) {
  const cached=new Map();
  function get(category) {
    if(cached.has(category))return cached.get(category);
    const inputDbzh=representativeDbzForCategory(category);
    if(inputDbzh==null){
      cached.set(category,null);
      return null;
    }
    const inferred=inferColumn(model,inputDbzh,{
      occupancyThreshold,minimumOutputDbz
    });
    const points=inferred.filter(p=>
      shouldRenderVolumePoint(p.dbzh,displayThresholdDbz));
    const styles=points.map(point=>styleForInferredPoint(point,{
      displayThresholdDbz:30,basePointSize:pointSize
    }));
    const data={inputDbzh,points,styles};
    cached.set(category,data);
    return data;
  }
  return {get,get size(){return cached.size;}};
}
