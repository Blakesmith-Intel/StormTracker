// Match official BoM Queensland flood-warning rainfall station basin by ID AND location.
// No inference from the broad flood-map publication region.
export const RAINFALL_BASIN_REGISTRY_URL="./data/qld-rainfall-basins-v1.json";
const kmBetween=(a,b,c,d)=>{
 const R=Math.PI/180,p1=a*R,p2=c*R;
 const h=Math.sin((p2-p1)/2)**2+
   Math.cos(p1)*Math.cos(p2)*Math.sin((d-b)*R/2)**2;
 return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));
};
export function catchmentForStation(record,registry,{maxSeparationKm=2}={}){
 if(registry?.schema!=="StormTrackerBoMQldRainfallBasinsV1")return null;
 const station=registry?.stations?.[String(record?.id??"")];
 if(!station||!station.basin||!Number.isFinite(record?.latitude)||
   !Number.isFinite(record?.longitude)||!Number.isFinite(station.latitude)||
   !Number.isFinite(station.longitude))return null;
 const km=kmBetween(record.latitude,record.longitude,station.latitude,station.longitude);
 return km<=maxSeparationKm?station.basin:null;
}