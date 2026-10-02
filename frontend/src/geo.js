const R = 6371008.8;
const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export function toRad(value) { return value * DEG; }
export function toDeg(value) { return value * RAD; }

export function gnomonicPixelToLonLat({ row, col, width, height, radar, halfSpanKm = radar.halfSpanKm ?? 128 }) {
  const halfSpanM = halfSpanKm * 1000;
  const x = ((col + 0.5) / width * 2 - 1) * halfSpanM;
  const y = (1 - (row + 0.5) / height * 2) * halfSpanM;
  return inverseGnomonic(x, y, radar.longitude, radar.latitude);
}

export function gnomonicCornerToLonLat({ row, col, width, height, radar, halfSpanKm = radar.halfSpanKm ?? 128 }) {
  const halfSpanM = halfSpanKm * 1000;
  const x = (col / width * 2 - 1) * halfSpanM;
  const y = (1 - row / height * 2) * halfSpanM;
  return inverseGnomonic(x, y, radar.longitude, radar.latitude);
}

export function inverseGnomonic(xEastM, yNorthM, lon0Deg, lat0Deg) {
  const rho = Math.hypot(xEastM, yNorthM);
  const lat0 = toRad(lat0Deg);
  const lon0 = toRad(lon0Deg);
  if (rho === 0) return { longitude: lon0Deg, latitude: lat0Deg };
  const c = Math.atan(rho / R);
  const sinC = Math.sin(c);
  const cosC = Math.cos(c);
  const latitude = Math.asin(
    cosC * Math.sin(lat0) + (yNorthM * sinC * Math.cos(lat0)) / rho
  );
  const longitude = lon0 + Math.atan2(
    xEastM * sinC,
    rho * Math.cos(lat0) * cosC - yNorthM * Math.sin(lat0) * sinC
  );
  return { longitude: normalizeLongitude(toDeg(longitude)), latitude: toDeg(latitude) };
}

export function normalizeLongitude(lon) {
  let value = lon;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}

export function distanceKm(lon1, lat1, lon2, lat2) {
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dp = toRad(lat2 - lat1);
  const dl = toRad(lon2 - lon1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) / 1000;
}

export function initialBearingDegrees(lon1, lat1, lon2, lat2) {
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dl = toRad(lon2 - lon1);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function directPoint(lonDeg, latDeg, bearingDeg, distanceM) {
  const delta = distanceM / R;
  const theta = toRad(bearingDeg);
  const phi1 = toRad(latDeg);
  const lambda1 = toRad(lonDeg);
  const sinPhi2 = Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta);
  const phi2 = Math.asin(Math.max(-1, Math.min(1, sinPhi2)));
  const lambda2 = lambda1 + Math.atan2(
    Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
    Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
  );
  return { longitude: normalizeLongitude(toDeg(lambda2)), latitude: toDeg(phi2) };
}

export function pixelAreaM2({ row, width, height, radar, halfSpanKm = radar.halfSpanKm ?? 128 }) {
  const c = 0;
  const nw = gnomonicCornerToLonLat({ row, col: c, width, height, radar, halfSpanKm });
  const ne = gnomonicCornerToLonLat({ row, col: c + 1, width, height, radar, halfSpanKm });
  const sw = gnomonicCornerToLonLat({ row: row + 1, col: c, width, height, radar, halfSpanKm });
  const se = gnomonicCornerToLonLat({ row: row + 1, col: c + 1, width, height, radar, halfSpanKm });
  const top = distanceKm(nw.longitude, nw.latitude, ne.longitude, ne.latitude) * 1000;
  const bottom = distanceKm(sw.longitude, sw.latitude, se.longitude, se.latitude) * 1000;
  const left = distanceKm(nw.longitude, nw.latitude, sw.longitude, sw.latitude) * 1000;
  const right = distanceKm(ne.longitude, ne.latitude, se.longitude, se.latitude) * 1000;
  return ((top + bottom) / 2) * ((left + right) / 2);
}
