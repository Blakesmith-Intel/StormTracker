// Screen-space layout of Queensland town names. All functions in this file
// are deterministic and independent of Cesium, DOM and network access.
export function labelBudget(width, height, cameraHeight, mode = "street", cameraPitchDegrees = -90) {
  if (mode !== "qld-imagery") return 0;
  if (!Number.isFinite(width) || !Number.isFinite(height) ||
      width < 180 || height < 140 || cameraHeight > 1800000) return 0;
  const mobile = width < 600;
  const close = cameraHeight <= 100000;
  // A 1200px desktop map can carry more distinct towns than a 390px phone.
  // Keep collision testing as the final density constraint, not a fixed
  // statewide five-label gate that persists when users zoom in.
  let budget = Math.min(mobile ? 9 : 42, Math.floor(width * height / 14000));
  if (cameraHeight > 700000) budget = Math.min(budget, mobile ? 5 : 9);
  else if (cameraHeight > 250000) budget = Math.min(budget, mobile ? 6 : 17);
  else if (cameraHeight > 100000) budget = Math.min(budget, mobile ? 7 : 26);
  // Near-horizon views get a smaller allowance but do not hide every
  // locality from a large desktop monitor at close range.
  if (cameraPitchDegrees > -20) budget = Math.min(budget, mobile ? 4 : 10);
  else if (cameraPitchDegrees > -40) budget = Math.min(budget, mobile ? 6 : 18);
  if (mobile && !close) budget = Math.min(budget, 6);
  return Math.max(0, budget);
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
  let budget = labelBudget(width, height, cameraHeight, mode, cameraPitchDegrees);
  // Camera altitude and pitch can be misleading after Cesium lookAt transforms.
  // Measure how much of Queensland is actually visible. A view spanning
  // multiple distant regions is always a statewide-scale view, even when
  // the camera is low and almost horizontal.
  const positions = candidates.filter(place =>
    Number.isFinite(place.longitude) && Number.isFinite(place.latitude)
  );
  if (positions.length > 1) {
    const latitudes = positions.map(place => place.latitude);
    const longitudes = positions.map(place => place.longitude);
    const middleLat = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
    const northSouthKm = (Math.max(...latitudes) - Math.min(...latitudes)) * 111.2;
    const eastWestKm = (Math.max(...longitudes) - Math.min(...longitudes)) *
      111.2 * Math.cos(middleLat * Math.PI / 180);
    const spanKm = Math.hypot(northSouthKm, eastWestKm);
    // The number of distant candidates is not a valid measure of ground
    // footprint on a close-up scene. Only constrain truly statewide views.
    // Keep a stricter cap for phones while letting wide desktop map windows
    // label additional rural settlements whenever they do not collide.
    if (spanKm > 1200) budget = Math.min(budget, width < 600 ? 5 : 8);
    else if (spanKm > 700) budget = Math.min(budget, width < 600 ? 5 : 14);
  }
  if (!budget) return [];
  const prev = new Set(previousVisible.map(String));
  const margin = 14;
  const boxes = [];
  const picked = [];
  // Sticky ranking reduces flicker during a slow pan in imagery mode.
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
      fontSize: townLabelTypography(width, place.population).fontSize
    });
    if (rect.left < margin || rect.right > width - margin ||
        rect.top < margin || rect.bottom > height - margin) continue;
    if (boxes.some(other => boxesOverlap(rect, other, 9))) continue;
    picked.push(place);
    boxes.push(rect);
  }
  return picked;
}
