// Pure unit/scale helpers. Horizontal WGS84 distances, never forecast/weather data.
export function formatMapDistance(metres) {
  if (!Number.isFinite(metres) || metres < 0) return "—";
  if (metres < 1000) return `${Math.round(metres)} m`;
  const km = metres / 1000;
  return `${km < 10 ? km.toFixed(2) : km < 100 ? km.toFixed(1) : Math.round(km)} km`;
}

// 1, 2, 5, 10 * powers of ten. Never show false scale if picking failed.
export function chooseScaleDistance(metresPerPixel, desiredWidth = 110) {
  if (!Number.isFinite(metresPerPixel) || metresPerPixel <= 0 ||
      !Number.isFinite(desiredWidth) || desiredWidth <= 0) return null;
  const target = metresPerPixel * desiredWidth;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const candidates = [1, 2, 5, 10].map(x => x * magnitude);
  const metres = candidates.filter(x => x <= target).at(-1) ??
    5 * magnitude / 10;
  return {metres, pixels: metres / metresPerPixel, label:formatMapDistance(metres)};
}

export function sumSurfaceDistances(positions, ellipsoid, Geodesic) {
  if (!Array.isArray(positions) || positions.length < 2) return 0;
  let metres = 0;
  for (let index = 1; index < positions.length; index++) {
    const from = ellipsoid.cartesianToCartographic(positions[index-1]);
    const to = ellipsoid.cartesianToCartographic(positions[index]);
    if (!from || !to) return Number.NaN;
    const segment = new Geodesic(from, to, ellipsoid).surfaceDistance;
    if (!Number.isFinite(segment)) return Number.NaN;
    metres += segment;
  }
  return metres;
}
