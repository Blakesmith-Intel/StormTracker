// Strict internal-only browser handoff for source-decoded original BoM GML.
// Does not fetch a public BoM web page, invent forecast polygons or authenticate
// users. The same-origin feed MUST be access-controlled by the internal host.
export const INTERNAL_CYCLONE_FEED_SCHEMA = "stormtracker-internal-cyclone-source-v1";
export const INTERNAL_GML_SLOTS = Object.freeze([
  "IDQ65248", "IDQ65249", "IDQ65250", "IDQ65252", "IDD65409"
]);
const SLOTS = new Set(INTERNAL_GML_SLOTS);
const ROLES = new Set(["forecast_fix", "observed_fix", "forecast_track",
  "observed_track", "uncertainty_area"]);
const UTC = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/;

function time(value) {
  if (typeof value !== "string" || !UTC.test(value)) return NaN;
  const n = Date.parse(value);
  return Number.isFinite(n) ? n : NaN;
}
function point(p) {
  return Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) &&
    Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
}
function line(points) {
  return Array.isArray(points) && points.length >= 2 &&
    points.length <= 20000 && points.every(point);
}
function poly(rings) {
  return Array.isArray(rings) && rings.length > 0 && rings.length <= 50 &&
    rings.every(r => Array.isArray(r) && r.length >= 4 && r.length <= 20000 &&
      r.every(point) && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]);
}
function geometry(g, role) {
  if (!g || typeof g !== "object") return false;
  if (role.endsWith("_fix")) return g.type === "Point" && point(g.coordinates);
  if (role.endsWith("_track")) return g.type === "LineString" && line(g.coordinates);
  if (role === "uncertainty_area")
    return (g.type === "Polygon" && poly(g.coordinates)) ||
      (g.type === "MultiPolygon" && Array.isArray(g.coordinates) &&
        g.coordinates.length > 0 && g.coordinates.length <= 50 &&
        g.coordinates.every(poly));
  return false;
}
const invalid = message => ({status: "unavailable", message, storms: []});

export function validateInternalCycloneSnapshot(snapshot, {
  nowUtc = new Date().toISOString(), maxSourceAgeMs = 30 * 60 * 1000
} = {}) {
  const now = time(nowUtc);
  if (!Number.isFinite(now)) throw new TypeError("A valid current UTC is required");
  if (!snapshot || snapshot.schema !== INTERNAL_CYCLONE_FEED_SCHEMA)
    return invalid("Internal BoM cyclone feed is unavailable");
  if (!["active", "no-active-products", "source-unavailable"].includes(snapshot.status) ||
    !Array.isArray(snapshot.products) || snapshot.products.length > INTERNAL_GML_SLOTS.length ||
    typeof snapshot.complete !== "boolean")
    return invalid("Malformed internal cyclone manifest");
  const generated = time(snapshot.generatedUtc);
  if (!Number.isFinite(generated) || generated > now + 300000 ||
    generated < now - maxSourceAgeMs)
    return invalid("Internal cyclone feed is stale or has an invalid source clock");
  if (snapshot.status === "source-unavailable")
    return invalid("Internal cyclone source unavailable; never imply no active cyclones");
  if (snapshot.status === "no-active-products")
    return snapshot.complete && snapshot.products.length === 0
      ? {status: "no-active-products", message: "No verified current cyclone GML products", storms: []}
      : invalid("Incomplete cyclone source check; not a verified all-clear");
  if (!snapshot.products.length) return invalid("Missing active cyclone products");
  const storms = [];
  const systemIds = new Set();
  for (const p of snapshot.products) {
    if (!p || !SLOTS.has(p.productId) ||
      typeof p.systemId !== "string" || !/^[A-Za-z0-9_.-]{1,80}$/.test(p.systemId) ||
      systemIds.has(p.systemId) || typeof p.name !== "string" ||
      p.name.length === 0 || p.name.length > 80 ||
      typeof p.sourceSha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(p.sourceSha256) ||
      p.sourceUrl !== `ftp://ftp.bom.gov.au/anon/gen/fwo/${p.productId}.gml`)
      return invalid("Unknown or duplicate original cyclone source");
    const issued = time(p.issueUtc), expires = time(p.expiresUtc);
    if (!Number.isFinite(issued) || !Number.isFinite(expires) ||
      issued > now + 300000 || expires <= now ||
      expires <= issued || expires - issued > 48 * 3600000)
      return invalid("Cyclone issue is expired, future-dated or has invalid validity");
    const collection = p.forecast, props = collection?.properties;
    if (collection?.type !== "FeatureCollection" ||
      props?.publisher !== "Bureau of Meteorology" ||
      props?.productId !== p.productId || props?.issuedUtc !== p.issueUtc ||
      props?.systemId !== p.systemId ||
      props?.systemName !== p.name ||
      !Array.isArray(collection.features) || collection.features.length > 300)
      return invalid("Cyclone original source identity mismatch");
    const features = [];
    for (const f of collection.features) {
      if (!ROLES.has(f?.properties?.role)) continue; // Wind/watch/warning are separate.
      if (!geometry(f.geometry, f.properties.role))
        return invalid("Malformed source cyclone forecast geometry");
      if (f.properties.role === "forecast_fix" &&
        (!Number.isFinite(time(f.properties.validUtc)) ||
         time(f.properties.validUtc) <= time(props.forecastBaseUtc)))
        return invalid("Invalid original BoM forecast centre time");
      let areaKey = null;
      if (f.properties.role === "uncertainty_area") {
        if (f.properties.areaType !== "Likely Tracks Area" ||
          !["Up to 72 hours", "Up to 120 hours"].includes(f.properties.extent))
          return invalid("Unsupported or fabricated uncertainty type");
        areaKey = f.properties.extent === "Up to 72 hours" ? "72" : "120";
      }
      features.push({
        role: f.properties.role,
        geometry: f.geometry,
        areaKey,
        validUtc: f.properties.validUtc ?? null,
        category: Number.isInteger(f.properties.category) ? f.properties.category : null,
        leadHours: f.properties.timeOffset == null ? null : Number(f.properties.timeOffset)
      });
    }
    if (!features.some(f => f.role === "forecast_fix" || f.role === "forecast_track"))
      return invalid("Missing original issued BoM forecast");
    storms.push({
      systemId: p.systemId, cycloneName: p.name, productId: p.productId,
      issueUtc: p.issueUtc, expiresUtc: p.expiresUtc,
      features, sourceUrl: p.sourceUrl
    });
    systemIds.add(p.systemId);
  }
  return {
    status: snapshot.complete ? "active" : "active-partial",
    message: snapshot.complete ? "Verified source-issued forecasts" :
      "PARTIAL: Some BoM cyclone products could not be checked",
    storms
  };
}
