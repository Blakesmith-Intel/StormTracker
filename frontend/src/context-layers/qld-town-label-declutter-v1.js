// Screen-space layout of Queensland town names. All functions in this file
// are deterministic and independent of Cesium, DOM and network access.
export function labelBudget(width,height,cameraHeight,mode="street",cameraPitchDegrees=-90) {
  if (!Number.isFinite(width) || !Number.isFinite(height) ||
      width<180 || height<140 || cameraHeight>3_800_000) return 0;
  // Physical screen area and collision checks determine useful density.
  // No arbitrary statewide 8-label limit, nor street-mode suppression.
  const mobile=width<600;
  const area=width*height;
  let budget=Math.min(mobile?16:170,
    Math.max(2,Math.floor(area/(mobile?11500:9200))));
  // At the planetary horizon reduce only the proportional share of labels,
  // retaining meaningful named geographical anchors on desktop.
  if(cameraHeight>2_200_000) budget=Math.ceil(budget*.6);
  else if(cameraHeight>1_100_000) budget=Math.ceil(budget*.78);
  if(cameraPitchDegrees>-20) budget=Math.ceil(budget*.8);
  return Math.max(0,budget);
}

// Shared font metrics: Cesium rendering and decluttering must use identical
// typography, particularly after resizing between mobile and desktop widths.
export function townLabelTypography(width, population = 0) {
  const desktop = Number(width) >= 700;
  const major = Number(population) >= 10000;
  const fontSize = desktop ? (major ? 16 : 15) : (major ? 13 : 12);
  return {
    fontSize,
    font: desktop ? `bold ${fontSize}px sans-serif`
      : (major ? "bold 13px sans-serif" : "12px sans-serif")
  };
}

export function townLabelBox({ name, x, y, fontSize = 12 }) {
  // Allow additional width for the heavier desktop glyphs; conservative
  // estimate avoids overlapping rural names at oblique camera angles.
  const textWidth = Math.min(280, Math.max(24, name.length * fontSize *
    (fontSize >= 15 ? 0.66 : 0.60)));
  const halfWidth = textWidth / 2 + 7;
  const halfHeight = fontSize * 0.65 + 4;
  return {
    left: x - halfWidth, right: x + halfWidth,
    top: y - halfHeight, bottom: y + halfHeight
  };
}

export function boxesOverlap(a, b, padding = 7) {
  return a.left < b.right + padding &&
    a.right + padding > b.left &&
    a.top < b.bottom + padding &&
    a.bottom + padding > b.top;
}

// Identify the same physical settlement across the population-centre and
// gazetteer feeds, even when their official point coordinates differ slightly.
export function geographicPlaceNameKey(name) {
  return String(name??"").normalize("NFKC").toLocaleLowerCase("en-AU")
    .replace(/\([^)]*(?:shire|regional|council)[^)]*\)/gi,"")
    .replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
}
export function sameGeographicSettlement(a,b,maximumDistanceKm=25) {
  return !!geographicPlaceNameKey(a?.name) &&
    geographicPlaceNameKey(a?.name)===geographicPlaceNameKey(b?.name) &&
    Number.isFinite(a?.latitude)&&Number.isFinite(a?.longitude) &&
    Number.isFinite(b?.latitude)&&Number.isFinite(b?.longitude) &&
    greatCircleKm(a,b)<=maximumDistanceKm;
}

export function greatCircleKm(a, b) {
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const dLat = lat2 - lat1;
  const dLon = (b.longitude - a.longitude) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function rankQueenslandTowns(towns) {
  const sorted = [...towns].sort((a, b) =>
    (b.population ?? 0) - (a.population ?? 0) ||
    String(a.name).localeCompare(String(b.name))
  );
  return sorted.map((town, index) => {
    let closestLarger = 600;
    for (let j = 0; j < index; j += 1) {
      const d = greatCircleKm(town, sorted[j]);
      if (d < closestLarger) closestLarger = d;
      if (closestLarger < 0.1) break;
    }
    // Remoteness receives extra weight; satellite towns around major
    // metropolitan centres should not swamp rural settlements.
    const population = Math.max(0, Number(town.population) || 0);
    const priority = Math.log10(population + 1) * 20 +
      Math.min(closestLarger, 260) / 5;
    return { ...town, priority, isolationKm: closestLarger };
  });
}

export function layoutTownLabels({
  candidates = [],
  width,
  height,
  cameraHeight = 0,
  mode = "street",
  cameraPitchDegrees = -90,
  previousVisible = []
}) {
  const budget=labelBudget(width,height,cameraHeight,mode,cameraPitchDegrees);
  // Geographic extent and sparse population never impose another global cap:
  // screen-space collision is the real readability constraint.
  if (!budget) return [];
  const prev = new Set(previousVisible.map(String));
  const margin = 14;
  const boxes = [];
  const picked = [];
  const pickedNames = new Map();
  // Sticky ranking reduces flicker during a slow pan in imagery mode.
  const sorted = [...candidates].sort((a,b) => {
    const rank=p=>(Number(p.priority)||0)+(prev.has(String(p.id))?10:0);
    return rank(b)-rank(a) || String(a.id).localeCompare(String(b.id));
  });
  // The first pass gives each distinct part of the *visible screen* one
  // strong geographic anchor; the second fills the free spaces. This prevents
  // a city cluster outranking every western Queensland town at broad zoom.
  const cellWidth=Math.max(110,Math.min(210,width/7));
  const cellHeight=Math.max(75,Math.min(145,height/5));
  const seenCells=new Set(),distributed=[],remaining=[];
  for(const p of sorted){
    const cell=Math.floor(p.x/cellWidth)+":"+Math.floor(p.y/cellHeight);
    if(seenCells.has(cell)) remaining.push(p);
    else {seenCells.add(cell);distributed.push(p);}
  }
  for (const place of [...distributed,...remaining]) {
    if (picked.length >= budget) break;
    if (!Number.isFinite(place.x) || !Number.isFinite(place.y) ||
        place.x < margin || place.x > width - margin ||
        place.y < margin || place.y > height - margin) continue;
    const rect = townLabelBox({
      name: String(place.name ?? ""), x: place.x, y: place.y,
      fontSize: townLabelTypography(width, place.population).fontSize
    });
    if (rect.left < margin || rect.right > width - margin ||
        rect.top < margin || rect.bottom > height - margin) continue;
    if (boxes.some(other => boxesOverlap(rect, other, 9))) continue;
    const nameKey=geographicPlaceNameKey(place.name);
    // Labels with the same name and essentially the same geographic point
    // are one town, not two text objects. Do not remove genuinely distinct
    // same-name towns on opposite sides of Queensland.
    if(nameKey && (pickedNames.get(nameKey)??[]).some(previous=>
      sameGeographicSettlement(previous,place,25)))continue;
    if(nameKey){
      if(!pickedNames.has(nameKey))pickedNames.set(nameKey,[]);
      pickedNames.get(nameKey).push(place);
    }
    picked.push(place);
    boxes.push(rect);
  }
  return picked;
}
