// Public BoM radar catalogue extension for southern-Queensland border coverage.
// Coordinates and three-digit IDs checked against the BoM NSW radar network.
// Do not add NSW stations to QLD_RADAR_SITES; its 19-site QLD contract remains.
import {QLD_RADAR_SITES} from "./qld-radar-sites-v1.js";

export const NSW_BORDER_RADAR_SITES=Object.freeze({
  "93":Object.freeze({
    id:"93",name:"Brewarrina",state:"NSW",latitude:-29.96,longitude:146.81,
    halfSpanKm:128,dopplerProduct:"IDR93I",dopplerLatitude:-29.96,dopplerLongitude:146.81,
    // BoM's 128 km velocity product IDR93I is genuinely published.
    // Its 512px wind panel is geographically placed using the official
    // radar centre and 128 km Gnomonic coverage. That DISPLAY transform
    // has centre/extent/round-trip QA, but true source-control-point
    // validation remains required before measured circulation SCIENCE.
    dopplerAvailableAtBom:true,dopplerIntegrated:true,
    displayGeorefBasis:"bom-site-centred-gnomonic-128km",
    displayGeorefVerified:false,analysisGeorefVerified:false
  }),
  "53":Object.freeze({
    id:"53",name:"Moree",state:"NSW",latitude:-29.50,longitude:149.85,
    halfSpanKm:128,dopplerProduct:null,dopplerLatitude:null,dopplerLongitude:null,
    dopplerAvailableAtBom:false,dopplerIntegrated:false,analysisGeorefVerified:false
  }),
  "28":Object.freeze({
    id:"28",name:"Grafton",state:"NSW",latitude:-29.62,longitude:152.97,
    halfSpanKm:128,dopplerProduct:null,dopplerLatitude:null,dopplerLongitude:null,
    dopplerAvailableAtBom:false,dopplerIntegrated:false,analysisGeorefVerified:false
  })
});

export const NSW_BORDER_DOPPLER_PRODUCTS=Object.freeze({"93":"IDR93I"});
export const BORDER_RADAR_DOPPLER_PRODUCTS=Object.freeze({
  ...Object.fromEntries(Object.values(QLD_RADAR_SITES)
    .filter(site=>site.dopplerProduct).map(site=>[site.id,site.dopplerProduct])),
  ...NSW_BORDER_DOPPLER_PRODUCTS
});
export const BORDER_RADAR_SITES=Object.freeze({
  ...QLD_RADAR_SITES,
  ...NSW_BORDER_RADAR_SITES
});
export function primaryRadarDopplerSites(id){
  const site=BORDER_RADAR_SITES[id];
  if(!site)throw new RangeError("Unknown primary radar site: "+id);
  return site.dopplerProduct && site.dopplerIntegrated!==false ? [site.id] : [];
}
