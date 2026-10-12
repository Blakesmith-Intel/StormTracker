import {fetchNswRadarPlaceCatalogue} from "./nsw-radar-place-catalogue-v1.js?v=9.18.0";
 
// Existing public NSW ArcGIS feature service is authoritative but its API
// lacks CORS, preventing direct browser fetch. GitHub Pages now serves a
// validated, scoped official dataset from this app's own /data/ directory.
// Load named settlements once per browser session, independent of selected
// radar or basemap; the QLD label renderer remains the only drawing layer.
export async function fetchNswTowns({
  fetchImpl=globalThis.fetch
}={}){
  const records=await fetchNswRadarPlaceCatalogue({fetchImpl});
  return records.filter(place=>place.kind!=="locality");
}
