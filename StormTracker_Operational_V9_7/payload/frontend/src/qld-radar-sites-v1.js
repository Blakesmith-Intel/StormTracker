// BoM public radar_sites FeatureServer catalogue, verified 2026-10-04.
// Doppler panel centres use the corresponding BoM product loop metadata.
export const QLD_RADAR_SITES = Object.freeze(Object.fromEntries(
[
  {
    "id": "24",
    "name": "Bowen",
    "latitude": -19.88577,
    "longitude": 148.07568,
    "halfSpanKm": 128,
    "dopplerProduct": null,
    "dopplerLatitude": null,
    "dopplerLongitude": null
  },
  {
    "id": "50",
    "name": "Brisbane (Marburg)",
    "latitude": -27.60634,
    "longitude": 152.54004,
    "halfSpanKm": 128,
    "dopplerProduct": "IDR50I",
    "dopplerLatitude": -27.606,
    "dopplerLongitude": 152.54
  },
  {
    "id": "66",
    "name": "Brisbane (Mt Stapylton)",
    "latitude": -27.71773,
    "longitude": 153.24,
    "halfSpanKm": 128,
    "dopplerProduct": "IDR66I",
    "dopplerLatitude": -27.718,
    "dopplerLongitude": 153.24
  },
  {
    "id": "19",
    "name": "Cairns",
    "latitude": -16.81817,
    "longitude": 145.66303,
    "halfSpanKm": 128,
    "dopplerProduct": "IDR19I",
    "dopplerLatitude": -16.817,
    "dopplerLongitude": 145.683
  },
  {
    "id": "72",
    "name": "Emerald",
    "latitude": -23.54959,
    "longitude": 148.23919,
    "halfSpanKm": 128,
    "dopplerProduct": "IDR72I",
    "dopplerLatitude": -23.55,
    "dopplerLongitude": 148.239
  },
  {
    "id": "23",
    "name": "Gladstone",
    "latitude": -23.85507,
    "longitude": 151.26252,
    "halfSpanKm": 128,
    "dopplerProduct": null,
    "dopplerLatitude": null,
    "dopplerLongitude": null
  },
  {
    "id": "74",
    "name": "Greenvale",
    "latitude": -18.99765,
    "longitude": 144.99586,
    "halfSpanKm": 128,
    "dopplerProduct": "IDR74I",
    "dopplerLatitude": -18.997,
    "dopplerLongitude": 144.996
  },
  {
    "id": "08",
    "name": "Gympie (Mount Kanigan)",
    "latitude": -25.95733,
    "longitude": 152.57692,
    "halfSpanKm": 128,
    "dopplerProduct": "IDR08I",
    "dopplerLatitude": -25.957,
    "dopplerLongitude": 152.577
  },
  {
    "id": "56",
    "name": "Longreach",
    "latitude": -23.43979,
    "longitude": 144.28226,
    "halfSpanKm": 128,
    "dopplerProduct": null,
    "dopplerLatitude": null,
    "dopplerLongitude": null
  },
  {
    "id": "22",
    "name": "Mackay",
    "latitude": -21.11725,
    "longitude": 149.21728,
    "halfSpanKm": 128,
    "dopplerProduct": "IDR22I",
    "dopplerLatitude": -21.117,
    "dopplerLongitude": 149.217
  },
  {
    "id": "36",
    "name": "Mornington Island (Gulf of Carpentaria)",
    "latitude": -16.66409,
    "longitude": 139.18124,
    "halfSpanKm": 128,
    "dopplerProduct": null,
    "dopplerLatitude": null,
    "dopplerLongitude": null
  },
  {
    "id": "75",
    "name": "Mount Isa",
    "latitude": -20.71121,
    "longitude": 139.55529,
    "halfSpanKm": 128,
    "dopplerProduct": "IDR75I",
    "dopplerLatitude": -20.711,
    "dopplerLongitude": 139.555
  },
  {
    "id": "107",
    "name": "Richmond",
    "latitude": -20.75177,
    "longitude": 143.14144,
    "halfSpanKm": 128,
    "dopplerProduct": "IDR107I",
    "dopplerLatitude": -20.751,
    "dopplerLongitude": 143.141
  },
  {
    "id": "98",
    "name": "Taroom",
    "latitude": -25.69617,
    "longitude": 149.89817,
    "halfSpanKm": 128,
    "dopplerProduct": "IDR98I",
    "dopplerLatitude": -25.696,
    "dopplerLongitude": 149.898
  },
  {
    "id": "108",
    "name": "Toowoomba",
    "latitude": -27.27406,
    "longitude": 151.993,
    "halfSpanKm": 128,
    "dopplerProduct": "IDR108I",
    "dopplerLatitude": -27.274,
    "dopplerLongitude": 151.993
  },
  {
    "id": "106",
    "name": "Townsville",
    "latitude": -19.41978,
    "longitude": 146.55096,
    "halfSpanKm": 128,
    "dopplerProduct": "IDR106I",
    "dopplerLatitude": -19.419,
    "dopplerLongitude": 146.551
  },
  {
    "id": "67",
    "name": "Warrego",
    "latitude": -26.44018,
    "longitude": 147.34913,
    "halfSpanKm": 128,
    "dopplerProduct": null,
    "dopplerLatitude": null,
    "dopplerLongitude": null
  },
  {
    "id": "78",
    "name": "Weipa",
    "latitude": -12.66644,
    "longitude": 141.92461,
    "halfSpanKm": 128,
    "dopplerProduct": "IDR78I",
    "dopplerLatitude": -12.666,
    "dopplerLongitude": 141.924
  },
  {
    "id": "41",
    "name": "Willis Island",
    "latitude": -16.28738,
    "longitude": 149.96463,
    "halfSpanKm": 128,
    "dopplerProduct": "IDR41I",
    "dopplerLatitude": -16.3,
    "dopplerLongitude": 149.983
  }
].map(site => [site.id, Object.freeze({...site, analysisGeorefVerified: ["08","50","66"].includes(site.id)})])));
export const QLD_DOPPLER_PRODUCTS = Object.freeze(Object.fromEntries(
  Object.values(QLD_RADAR_SITES).filter(site => site.dopplerProduct)
    .map(site => [site.id, site.dopplerProduct])));
export const SEQ_DOPPLER_RADARS = Object.freeze(['66', '50', '08']);
export function dopplerRadarsForRegion(region = 'SEQ') {
  if (region === 'SEQ') return [...SEQ_DOPPLER_RADARS];
  const site = QLD_RADAR_SITES[region];
  if (!site) throw new Error(`Unknown Queensland radar site: ${region}`);
  return site.dopplerProduct ? [region] : [];
}
