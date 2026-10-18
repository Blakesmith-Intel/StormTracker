// Geographic QA for authentic BoM numbered reflectivity PNGs.
// The Bureau's product naming contract: 1=512 km, 2=256 km, 3=128 km, 4=64 km radius.
// Control points currently recovered from BoM maps for 08,50,66 only.
// This computes an explicit provisional transform, NOT authority to release FTP imagery.
import {BOM_DOPPLER_MAPS,projectedBoundsForRadar,dopplerMapCoordinateToLonLat,lonLatToDopplerMapCoordinate} from "../frontend/src/bom-doppler-georef-v1.js";
import {BORDER_RADAR_SITES} from "../frontend/src/border-radar-sites-v1.js";
const radius={1:512,2:256,3:128,4:64};
let failures=0;const records=[];
for(const id of Object.keys(BORDER_RADAR_SITES)){
 const record={site:id,officialSite:{lat:BORDER_RADAR_SITES[id].latitude,lon:BORDER_RADAR_SITES[id].longitude},rangeKm:128};
 const map=BOM_DOPPLER_MAPS[id];
 if(!map ||map.nominalPanel ||!map.corners){
  record.gate="BLOCKED: no independent BoM control points";
 }else{
  const p=lonLatToDopplerMapCoordinate(id,map.longitude,map.latitude);
  const roundTrip=dopplerMapCoordinateToLonLat(id,p.column,p.row);
  const centreError=Math.hypot(roundTrip.longitude-map.longitude,roundTrip.latitude-map.latitude);
  const b=projectedBoundsForRadar(id);
  record.projection=map.projection;record.boundsMetres=b;
  record.radarCentrePixel=p;record.centreRoundTripDegrees=centreError;
  record.geographicCorners=map.corners;
  record.gate="PROVISIONAL: Doppler map corners not yet verified against reflectivity raster's own footprint";
  if(centreError>1e-5){record.gate="BLOCKED: centre inverse failed";failures++}
 }
 records.push(record);
}
console.log(JSON.stringify({productRangesKm:radius,records},null,2));
if(failures)process.exitCode=1;
