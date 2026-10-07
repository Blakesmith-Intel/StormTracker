import assert from "node:assert/strict";

import {
  parseAestDateTime,
  parseEssentialEnergyKml
} from "../src/context-layers/essential-energy-kml-v1.js";

assert.equal(
  parseAestDateTime(
    "29/07/2025 08:30:00"
  ),
  "2025-07-29T08:30:00+10:00"
);

assert.equal(
  parseAestDateTime(
    ""
  ),
  ""
);

const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <Placemark>
    <name>Coffs Harbour</name>
    <styleUrl>#unplanned-outage</styleUrl>
    <description><![CDATA[
      <span>Time Off:</span>29/07/2025 08:30:00
      <span>Est. Time On:</span>29/07/2025 14:30:00
      <span>No. of Customers affected:</span>281
      <span>Reason:</span>We are investigating
      <span>Last Updated:</span>29/07/2025 08:39:23
      <span>Incident ID</span>INCD-107941-r
    ]]></description>
    <Polygon>
      <outerBoundaryIs>
        <LinearRing>
          <coordinates>
            153.10,-30.30,0
            153.20,-30.30,0
            153.20,-30.40,0
            153.10,-30.30,0
          </coordinates>
        </LinearRing>
      </outerBoundaryIs>
    </Polygon>
  </Placemark>

  <Placemark>
    <name>Tamworth</name>
    <styleUrl>#planned-outage</styleUrl>
    <description><![CDATA[
      <span>Time Off:</span>03/07/2025 09:30:00
      <span>Est. Time On:</span>03/07/2025 13:30:00
      <span>No. of Customers affected:</span>64
      <span>Reason:</span>General network maintenance
      <span>Last Updated:</span>03/07/2025 09:34:43
      <span>Incident ID:</span>INCD-107145-r
    ]]></description>
    <MultiGeometry>
      <Polygon>
        <outerBoundaryIs><LinearRing><coordinates>
          150.90,-31.10,0 150.91,-31.10,0 150.91,-31.11,0 150.90,-31.10,0
        </coordinates></LinearRing></outerBoundaryIs>
      </Polygon>
      <Polygon>
        <outerBoundaryIs><LinearRing><coordinates>
          150.92,-31.12,0 150.93,-31.12,0 150.93,-31.13,0 150.92,-31.12,0
        </coordinates></LinearRing></outerBoundaryIs>
      </Polygon>
    </MultiGeometry>
  </Placemark>

  <Placemark>
    <name>No geometry</name>
    <styleUrl>#unplanned-outage</styleUrl>
    <description><![CDATA[
      <span>Incident ID:</span>IGNORED-1
    ]]></description>
  </Placemark>
</Document>
</kml>`;

const parsed =
  parseEssentialEnergyKml(
    kml
  );

assert.equal(
  parsed.type,
  "FeatureCollection"
);

assert.equal(
  parsed.features.length,
  2
);

const unplanned =
  parsed.features[0];

assert.equal(
  unplanned.id,
  "essential:INCD-107941-r"
);

assert.equal(
  unplanned.properties
    .STORMTRACKER_PROVIDER,
  "Essential Energy"
);

assert.equal(
  unplanned.properties.TYPE,
  "UNPLANNED"
);

assert.equal(
  unplanned.properties
    .CUSTOMERS_AFFECTED,
  281
);

assert.equal(
  unplanned.properties.SUBURBS,
  "Coffs Harbour"
);

assert.equal(
  unplanned.properties.START,
  "2025-07-29T08:30:00+10:00"
);

assert.equal(
  unplanned.properties.FINISH,
  "",
  "Estimated restoration must not be treated as a hard outage end-time."
);

assert.equal(
  unplanned.properties
    .EST_FIX_TIME,
  "2025-07-29T14:30:00+10:00"
);

assert.equal(
  unplanned.properties.REASON,
  "We are investigating"
);

assert.equal(
  unplanned.properties.EXTRACTED,
  "2025-07-29T08:39:23+10:00"
);

assert.equal(
  unplanned.geometry.type,
  "Polygon"
);

const planned =
  parsed.features[1];

assert.equal(
  planned.properties.TYPE,
  "PLANNED"
);

assert.equal(
  planned.properties
    .CUSTOMERS_AFFECTED,
  64
);

assert.equal(
  planned.geometry.type,
  "MultiPolygon"
);

assert.equal(
  planned.geometry
    .coordinates
    .length,
  2
);

console.log(
  "Essential Energy KML checks passed: outage fields, AEST timestamps, planned/unplanned styling and polygon geometry convert to StormTracker GeoJSON."
);
