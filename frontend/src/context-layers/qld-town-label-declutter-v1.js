// Screen-space layout of Queensland town names. All functions in this file
// are deterministic and independent of Cesium, DOM and network access.
export function labelBudget(width, height, cameraHeight, mode = "street", cameraPitchDegrees = -90) {
  if (!Number.isFinite(width) || !Number.isFinite(height) ||
      width < 180 || height < 140) return 0;
  // Do not pepper the horizon with Queensland text at continental/planet scale.
  if (cameraHeight > 1800000) return 0;
  const area = width * height;
  const density = mode === "street" ? 16000 : 11500;
  const cap = width < 600 ? 9 : 28;
  let budget = Math.min(cap, Math.floor(area / density));
  if (cameraHeight > 700000) budget = Math.min(budget, 5);
  else if (cameraHeight > 250000) budget = Math.min(budget, 5);
  // Oblique views compress a large geographic area into a narrow horizon.
  // Reduce the number of labels independently of camera altitude.
  if (cameraPitchDegrees > -20) budget = Math.min(budget, 4);
  else if (cameraPitchDegrees > -40) budget = Math.min(budget, 6);
  // Absolute mobile imagery cap: terrain/heading calculations can differ
  // between camera transforms, but cannot bypass this final safety gate.
  if (mode === "qld-imagery" && width < 600) budget = Math.min(budget, 5);
  return Math.max(0, budget);
}

export function townLabelBox({ name, x, y, fontSize = 12 }) {
  const textWidth = Math.min(220, Math.max(24, name.length * fontSize * 0.60));
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
  const budget = labelBudget(width, height, cameraHeight, mode, cameraPitchDegrees);
  if (!budget) return [];
  const prev = new Set(previousVisible.map(String));
  const margin = 14;
  const boxes = [];
  const picked = [];
  // Dense metropolitan labels should give way to already-present OSM
  // street text. Sticky ranking reduces flicker during a slow pan.
  const sorted = [...candidates].sort((a, b) => {
    const rank = p => (Number(p.priority) || 0) +
      (prev.has(String(p.id)) ? 10 : 0);
    return rank(b) - rank(a) || String(a.id).localeCompare(String(b.id));
  });
  for (const place of sorted) {
    if (picked.length >= budget) break;
    if (!Number.isFinite(place.x) || !Number.isFinite(place.y) ||
        place.x < margin || place.x > width - margin ||
        place.y < margin || place.y > height - margin) continue;
    const rect = townLabelBox({
      name: String(place.name ?? ""), x: place.x, y: place.y,
      fontSize: place.population >= 10000 ? 13 : 12
    });
    if (rect.left < margin || rect.right > width - margin ||
        rect.top < margin || rect.bottom > height - margin) continue;
    if (boxes.some(other => boxesOverlap(rect, other, 9))) continue;
    picked.push(place);
    boxes.push(rect);
  }
  return picked;
}
