// Display-only incremental inference geometry. Stable geographic/sample keys
// retain their original Cesium glyphs across consecutive BoM observations.
// Weather science, source UTC and radar categories are never interpolated.
export function createIncrementalVolumeRenderer({
  scene, requestFrame = callback => requestAnimationFrame(callback),
  cancelFrame = id => cancelAnimationFrame(id), durationMs = 170,
  maxMorphGlyphs = 3500
} = {}) {
  if (!scene?.primitives) throw new TypeError("A Cesium scene is required");
  let collection = null;
  let identity = null;
  let active = new Map();
  let seen = new Set();
  let retire = [];
  let entered = [];
  let frameId = null;
  let pending = [];
  let animate = false;
  let touched = 0;
  let updatedGlyphs = 0;

  function finishAnimation() {
    if (frameId !== null) {
      cancelFrame(frameId);
      frameId = null;
    }
    for (const entry of pending) {
      if (entry.outgoing) {
        collection?.remove(entry.point);
      } else {
        entry.point.color = entry.colour;
      }
    }
    pending = [];
  }
  function reset() {
    finishAnimation();
    if (collection) scene.primitives.remove(collection);
    collection = null;
    identity = null;
    active.clear();
    seen.clear();
    retire = [];
    entered = [];
    animate = false;
    touched = 0;
    scene.requestRender?.();
  }
  function begin(nextIdentity, makeCollection, morph = false) {
    finishAnimation();
    if (identity !== nextIdentity || !collection) {
      reset();
      collection = scene.primitives.add(makeCollection());
      identity = nextIdentity;
    }
    animate = Boolean(morph) && active.size > 0;
    seen = new Set();
    retire = [];
    entered = [];
    touched = 0;
    updatedGlyphs = 0;
    return collection;
  }
  function unchanged(key, category) {
    const old = active.get(key);
    return Boolean(old && old.category === category);
  }
  function touch(key, category, points = []) {
    seen.add(key);
    const prior = active.get(key);
    if (prior?.category === category) return false;
    if (prior) retire.push(...prior.points);
    active.set(key, { category, points });
    entered.push(...points);
    touched++;
    return true;
  }
  // The stable production candidate never creates a second overlapping cloud:
  // mutate matched Cesium primitives in place, allocate only when a column
  // adds levels, and retire only genuine disappearing levels.
  function upsert(key,category,specs,create,patch) {
    if(!Array.isArray(specs) || typeof create!=="function" || typeof patch!=="function")
      throw new TypeError("Expected volume descriptors and glyph callbacks");
    seen.add(key);
    const old=active.get(key);
    if(old?.category===category && old.points.length===specs.length)
      return false;
    const previous=old?.points??[];
    const points=[];
    for(let index=0;index<specs.length;index++){
      if(index<previous.length){
        patch(previous[index],specs[index]);
        points.push(previous[index]);
      }else{
        points.push(create(specs[index]));
      }
      updatedGlyphs++;
    }
    for(let index=specs.length;index<previous.length;index++){
      collection.remove(previous[index]);
      updatedGlyphs++;
    }
    active.set(key,{category,points});
    touched++;
    return true;
  }

  function end() {
    for (const [key, prior] of active) {
      if (seen.has(key)) continue;
      retire.push(...prior.points);
      active.delete(key);
      touched++;
    }
    const changes = entered.length + retire.length;
    const totalChanges=changes+updatedGlyphs;
    if (!animate || !changes || changes > maxMorphGlyphs) {
      for (const point of retire) collection.remove(point);
      retire = [];
      entered = [];
      scene.requestRender?.();
      return { changedColumns: touched, animated: false, glyphChanges: totalChanges };
    }
    pending = [
      ...retire.map(point => ({point, colour: point.color, outgoing:true})),
      ...entered.map(point => ({point, colour: point.color, outgoing:false}))
    ];
    for (const entry of pending) {
      if (!entry.outgoing) entry.point.color = entry.colour.withAlpha(0);
    }
    retire = [];
    entered = [];
    const animationEntries = pending;
    let firstTime = null;
    function tick(timestamp) {
      if (pending !== animationEntries) return;
      if (firstTime === null) firstTime = timestamp;
      const t = Math.max(0,Math.min(1,(timestamp-firstTime)/durationMs));
      // Only changed primitives are touched. Never fade an unchanged storm.
      for (const entry of animationEntries) {
        entry.point.color = entry.colour.withAlpha(
          entry.colour.alpha * (entry.outgoing ? 1-t : t)
        );
      }
      scene.requestRender?.();
      if (t < 1) {
        frameId = requestFrame(tick);
      } else {
        frameId = null;
        finishAnimation();
      }
    }
    frameId = requestFrame(tick);
    scene.requestRender?.();
    return { changedColumns: touched, animated: true, glyphChanges: totalChanges };
  }
  return {
    begin, unchanged, touch, upsert, end, reset,
    finishAnimation,
    get collection(){ return collection; },
    get columns(){ return active.size; }
  };
}
