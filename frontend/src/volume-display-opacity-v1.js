// 3-D display-only opacity. The scientific profile, original reflectivity
// categories, support/confidence and track segmentation remain untouched.
// WeakMap remembers every primitive's source alpha so repeated slider changes
// (including 0 -> 100) cannot progressively darken a storm.
const baseAlpha = new WeakMap();

export function volumeOpacityFactor(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0,Math.min(1,number/100)) : 1;
}

function safeAlpha(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0,Math.min(1,number)) : 1;
}

export function addVolumeDisplayPoint(collection,options,sourceAlpha=1,percent=100) {
  if (!collection || typeof collection.add!=="function" ||
      typeof options?.color?.withAlpha!=="function")
    throw new TypeError("Volume point collection/colour unavailable");
  const alpha=safeAlpha(sourceAlpha);
  const point=collection.add({
    ...options,
    color:options.color.withAlpha(alpha*volumeOpacityFactor(percent))
  });
  baseAlpha.set(point,alpha);
  return point;
}

export function setVolumeDisplayOpacity(collection,percent) {
  if (!collection)return 0;
  if(typeof collection.get!=="function" ||
     !Number.isSafeInteger(collection.length) || collection.length<0)
    throw new TypeError("Invalid Cesium volume point collection");
  const factor=volumeOpacityFactor(percent);
  let touched=0;
  for(let i=0;i<collection.length;i++){
    const point=collection.get(i);
    const source=baseAlpha.get(point);
    if(source===undefined)continue;
    const colour=point.color;
    if(!colour || typeof colour.withAlpha!=="function")continue;
    point.color=colour.withAlpha(source*factor);
    touched++;
  }
  return touched;
}
