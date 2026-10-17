#!/usr/bin/env python3
"""Decode original BoM cyclone forecast GML and companion CXML.

Development-only, offline input; no generated cyclone features, guessed buffer
rings, arbitrary network access or automatic redistribution of forecast files.
Source: BoM official warning product user guide, tcData/GML + CXML examples.
Example original issue:
  ftp://ftp.bom.gov.au/anon/sample/catalogue/Warnings/Tropical_Cyclone_Warning/IDD65401.gml
  ftp://ftp.bom.gov.au/anon/sample/catalogue/Warnings/Tropical_Cyclone_Warning/IDD65441.xml
"""
from __future__ import annotations
import argparse
import json
import math
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path

TC = "http://www.bom.gov.au/dtd/tc"
GML = "http://www.opengis.net/gml"
ALLOWED_SRS = {
    "urn:ogc:def:crs:EPSG:6.6:4283",  # GDA94; no silent coordinate axis swap
    "urn:ogc:def:crs:EPSG::4283",
    "urn:ogc:def:crs:EPSG::4326",
    "EPSG:4326",
    "EPSG:4283",
}
LIMIT_BYTES = 3_000_000
LIMIT_FEATURES = 300
LIMIT_VERTICES = 20000
ALLOWED_GML_PRODUCTS = frozenset((
    'IDQ65248', 'IDQ65249', 'IDQ65250', 'IDQ65251', 'IDQ65252',
    'IDD65401', 'IDD65402', 'IDD65408', 'IDD65409',
    'IDW60266', 'IDW60267', 'IDW60268', 'IDW60283'
))


class SourceError(ValueError):
    pass


def tag_name(tag):
    return tag.split("}")[-1].split(":")[-1]


def direct(parent, name):
    return next((c for c in parent if tag_name(c.tag) == name), None)


def direct_text(parent, name, required=True):
    c = direct(parent, name)
    value = c.text.strip() if c is not None and c.text else None
    if required and not value:
        raise SourceError("Missing original BoM field " + name)
    return value


def utc(value):
    if not value or not value.endswith("Z"):
        raise SourceError("UTC time missing Z suffix")
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if result.tzinfo is None:
            raise ValueError("Naive time")
        return result.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    except ValueError as e:
        raise SourceError("Malformed source UTC") from e


def parse_file(path, root_name):
    p = Path(path)
    if p.stat().st_size > LIMIT_BYTES:
        raise SourceError("Oversized original BoM product")
    # ElementTree does not fetch external DTD entities or execute XML.
    root = ET.parse(p).getroot()
    if tag_name(root.tag) != root_name:
        raise SourceError("Wrong product type (expected " + root_name + ")")
    return root


def coordinates(text):
    if not text:
        raise SourceError("Empty original BoM coordinates")
    out = []
    for token in text.replace("\r", " ").replace("\n", " ").split():
        values = token.split(",")
        if len(values) < 2 or len(values) > 3:
            raise SourceError("Unknown GML coordinate tuple")
        try:
            lon, lat = float(values[0]), float(values[1])
        except ValueError as e:
            raise SourceError("Nonnumeric GML coordinate") from e
        if not all(math.isfinite(v) for v in (lon, lat)):
            raise SourceError("Nonfinite GML coordinate")
        if not -180 <= lon <= 180 or not -90 <= lat <= 90:
            raise SourceError("Invalid longitude/latitude; never swap silently")
        out.append([lon, lat])  # Source uses LONGITUDE,LATITUDE (gml:coordinates)
        if len(out) > LIMIT_VERTICES:
            raise SourceError("Oversized source geometry")
    return out


def geometry_srs(node):
    names = {n.attrib["srsName"] for n in node.iter() if "srsName" in n.attrib}
    if not names:
        raise SourceError("Missing original product spatial reference")
    if not names <= ALLOWED_SRS:
        raise SourceError("Unsupported CRS: " + repr(names))
    if len(names) > 1:
        raise SourceError("Mixed CRS in one product feature")
    return names.pop()


def gml_coordinates(node, kind):
    geometries = [n for n in node.iter() if tag_name(n.tag).lower() == kind.lower()]
    if len(geometries) != 1:
        raise SourceError("Missing or ambiguous BoM " + kind)
    entries = [n for n in geometries[0].iter() if tag_name(n.tag) == "coordinates"]
    if len(entries) != 1:
        raise SourceError("Unsupported " + kind + " coordinate syntax")
    return coordinates(entries[0].text)


def feature_rings(element):
    # Exactly the polygon members supplied by BoM. NEVER buffer track fixes.
    polys = [node for node in element.iter() if tag_name(node.tag) == "Polygon"]
    if not polys:
        raise SourceError("No source-issued area polygons")
    full = []
    for poly in polys:
        rings = []
        for name in ("outerBoundaryIs", "innerBoundaryIs"):
            boundaries = [node for node in poly if tag_name(node.tag) == name]
            if name == "outerBoundaryIs" and len(boundaries) != 1:
                raise SourceError("BoM polygon lacks one outer boundary")
            for boundary in boundaries:
                ring = gml_coordinates(boundary, "LinearRing")
                if len(ring) < 4 or ring[0] != ring[-1]:
                    raise SourceError("Source polygon is not closed")
                rings.append(ring)
        if len(rings) == 0:
            raise SourceError("Empty BoM polygon")
        full.append(rings)
    return full


def category(element):
    text = direct_text(element, "category", required=False)
    if text is None:
        return None
    try:
        value = int(text)
    except ValueError as e:
        raise SourceError("Unrecognised cyclone category") from e
    if value < 0 or value > 5:
        raise SourceError("Cyclone category outside 0-5")
    return value


def decode_gml(path):
    product_id = Path(path).stem
    if product_id not in ALLOWED_GML_PRODUCTS:
        raise SourceError("Not a documented BoM cyclone GML product identifier")
    root = parse_file(path, "tcData")
    if not root.tag.startswith("{" + TC + "}"):
        raise SourceError("Unverified cyclone tcData namespace")
    issue = utc(direct_text(root, "issueTime"))
    forecast_base = utc(direct_text(root, "fcastTime"))
    if issue < forecast_base:
        raise SourceError("Issue precedes original forecast base")
    system_id, name = direct_text(root, "distId"), direct_text(root, "distName")
    expiry = direct_text(root, "expiryHrs")
    if not expiry.isdigit() or not 1 <= int(expiry) <= 48:
        raise SourceError("Invalid issue expiry duration")
    features = []
    for i, element in enumerate(root):
        kind = tag_name(element.tag)
        if kind not in {"tcFix", "tcTrack", "tcForecastArea", "tcWatchArea",
                        "tcWarningArea", "tcWindArea"}:
            continue
        geometry_srs(element)
        role = None
        if kind == "tcFix":
            kind_value = direct_text(element, "fixType")
            if kind_value.lower() == "forecast":
                role = "forecast_fix"
            elif kind_value.lower() in ("current", "observed", "analysis"):
                role = "observed_fix"
            else:
                raise SourceError("Unknown fixType " + kind_value)
            when = utc(direct_text(element, "fixTime"))
            base_ms = datetime.fromisoformat(forecast_base.replace("Z", "+00:00"))
            when_ms = datetime.fromisoformat(when.replace("Z", "+00:00"))
            if role == "forecast_fix" and not (base_ms < when_ms <= base_ms + timedelta(hours=121)):
                raise SourceError("Forecast centre outside BoM 120-hour map")
            point = gml_coordinates(element, "Point")
            if len(point) != 1:
                raise SourceError("GML fix must contain exactly one point")
            geometry = {"type": "Point", "coordinates": point[0]}
            props = {"validUtc": when, "category": category(element),
                     "fixType": kind_value,
                     "timeOffset": direct_text(element, "timeOffset", required=False)}
        elif kind == "tcTrack":
            kind_value = direct_text(element, "trackType")
            if kind_value.lower() == "forecast":
                role = "forecast_track"
            elif kind_value.lower() in ("observed", "current", "analysis"):
                role = "observed_track"
            else:
                raise SourceError("Unknown trackType " + kind_value)
            line = gml_coordinates(element, "LineString")
            if len(line) < 2:
                raise SourceError("Original forecast/observed line too short")
            geometry = {"type": "LineString", "coordinates": line}
            props = {"trackType": kind_value, "startUtc": utc(direct_text(element, "startTime")),
                     "endUtc": utc(direct_text(element, "endTime"))}
        else:
            # tcForecastArea is the Bureau-issued range of likely centre
            # positions. Watch, warning and wind areas are NOT that range.
            role = {"tcForecastArea": "uncertainty_area",
                    "tcWatchArea": "watch_area", "tcWarningArea": "warning_area",
                    "tcWindArea": "gale_wind_area"}[kind]
            if kind == "tcForecastArea":
                area_type = direct_text(element, "areaType")
                extent = direct_text(element, "extent")
                if area_type != "Likely Tracks Area" or extent not in (
                        "Up to 72 hours", "Up to 120 hours"):
                    raise SourceError("Unsupported forecast area type; not a verified uncertainty envelope")
            polygons = feature_rings(element)
            geometry = ({"type": "Polygon", "coordinates": polygons[0]} if len(polygons) == 1
                        else {"type": "MultiPolygon", "coordinates": polygons})
            props = {"areaType": direct_text(element, "areaType", required=False),
                     "extent": direct_text(element, "extent", required=False),
                     "windType": direct_text(element, "windType", required=False)}
        props.update({"systemId": system_id, "name": name, "role": role,
                      "issueUtc": issue, "productType": kind, "originalCRS": geometry_srs(element)})
        features.append({"type": "Feature", "id": f"{system_id}:{kind}:{i}",
                         "geometry": geometry, "properties": props})
        if len(features) > LIMIT_FEATURES:
            raise SourceError("Oversized original source feature collection")
    if not features:
        raise SourceError("No original cyclone geometries in product")
    return {"type": "FeatureCollection",
            "properties": {"publisher": "Bureau of Meteorology",
                           "issuedUtc": issue, "forecastBaseUtc": forecast_base,
                           "systemId": system_id, "systemName": name,
                           "expiresAfterHours": int(expiry),
                           "productId": product_id,
                           "sourceFormat": "BoM original tcData GML"},
            "features": features}


def decode_cxml(path):
    root = parse_file(path, "cxml")
    header = direct(root, "header")
    data = direct(root, "data")
    if header is None or data is None or data.attrib.get("type") != "forecast":
        raise SourceError("Not an authentic CXML forecast-type product")
    base = utc(direct_text(header, "baseTime"))
    created = utc(direct_text(header, "creationTime"))
    disturbance = direct(data, "disturbance")
    if disturbance is None:
        raise SourceError("No cyclone disturbance")
    name = direct_text(disturbance, "cycloneName")
    fixes = []
    for fix in disturbance:
        if tag_name(fix.tag) != "fix":
            continue
        when = utc(direct_text(fix, "validTime"))
        latEl, lonEl = direct(fix, "latitude"), direct(fix, "longitude")
        if latEl is None or lonEl is None:
            raise SourceError("Missing real CXML centre")
        lat = float(latEl.text.strip()); lon = float(lonEl.text.strip())
        if latEl.attrib.get("units") == "deg S":
            lat = -lat
        elif latEl.attrib.get("units") != "deg N":
            raise SourceError("Unrecognised latitude hemisphere")
        if lonEl.attrib.get("units") == "deg W":
            lon = -lon
        elif lonEl.attrib.get("units") != "deg E":
            raise SourceError("Unrecognised longitude hemisphere")
        if not -90 <= lat <= 90 or not -180 <= lon <= 180:
            raise SourceError("Invalid CXML source centre")
        fixes.append({"validUtc": when, "position": [lon, lat],
                      "leadHours": int(fix.attrib["hour"])})
    if not fixes:
        raise SourceError("No CXML forecast positions")
    return {"name": name, "issueUtc": created, "forecastBaseUtc": base,
            "fixes": fixes, "source": "BoM-issued CXML"}


def validate_companion(collection, companion):
    if companion is None:
        return None
    meta = collection["properties"]
    if companion["name"] != meta["systemName"]:
        raise SourceError("Forecast CXML and track map are different storms")
    if companion["forecastBaseUtc"] != meta["forecastBaseUtc"]:
        raise SourceError("CXML and track-map base times differ")
    gml_issued = datetime.fromisoformat(meta["issuedUtc"].replace("Z", "+00:00"))
    cxml_issued = datetime.fromisoformat(companion["issueUtc"].replace("Z", "+00:00"))
    if abs((gml_issued - cxml_issued).total_seconds()) > 5400:
        raise SourceError("Incompatible issued bulletin cycles")
    cxml_by_time = {f["validUtc"]: f for f in companion["fixes"]}
    checked = 0
    max_delta_deg = 0
    for f in collection["features"]:
        if f["properties"]["role"] != "forecast_fix":
            continue
        when = f["properties"]["validUtc"]
        counterpart = cxml_by_time.get(when)
        if counterpart is None:
            continue
        lon_lat = f["geometry"]["coordinates"]
        delta = max(abs(a - b) for a, b in zip(lon_lat, counterpart["position"]))
        if delta > 0.02:
            raise SourceError("GML and CXML forecast centres disagree at original valid UTC")
        max_delta_deg = max(max_delta_deg, delta)
        checked += 1
    if checked < 3:
        raise SourceError("Not enough matched original GML+CXML forecast centres")
    return {"matchingForecastFixes": checked,
            "maxLonLatComponentDifferenceDeg": round(max_delta_deg, 6),
            "comparison": "Original CXML rounded positions, NOT interpolated"}


def summary(collection, companion=None):
    types = {}
    forecasts = []
    areas = []
    for f in collection["features"]:
        r = f["properties"]["role"]
        types[r] = types.get(r, 0) + 1
        p = f["properties"]
        if r == "forecast_fix":
            forecasts.append({"validUtc": p["validUtc"], "lonLat": f["geometry"]["coordinates"],
                              "category": p["category"], "timeOffset": p["timeOffset"]})
        if r == "uncertainty_area":
            coords = f["geometry"]["coordinates"]
            polylist = coords if f["geometry"]["type"] == "MultiPolygon" else [coords]
            vertices = [pt for polygon in polylist for ring in polygon for pt in ring]
            areas.append({"sourceFeature": f["id"], "areaType": p.get("areaType"),
                          "extent": p.get("extent"), "originalCRS": p["originalCRS"],
                          "polygonParts": len(polylist), "sourceVertexCount": len(vertices),
                          "bboxLonLat": [min(p[0] for p in vertices), min(p[1] for p in vertices),
                                         max(p[0] for p in vertices), max(p[1] for p in vertices)]})
    return {"gml": collection["properties"], "roleCounts": types,
            "crossProductChecks": validate_companion(collection, companion),
            "genuineForecastFixes": forecasts[:35],
            "sourceIssuedUncertaintyAreas": areas,
            "cxml": ({"name": companion["name"], "baseUtc": companion["forecastBaseUtc"],
                      "issueUtc": companion["issueUtc"], "fixes": companion["fixes"][:35]}
                     if companion else None),
            "notNow": "ARCHIVE, NEVER LIVE; original issue is historical"}


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--gml", required=True, help="local BoM original .gml file")
    cli.add_argument("--cxml", help="optional original BoM companion .xml file")
    cli.add_argument("--output", help="OPTIONAL local full feature JSON; avoid public redistribution")
    args = cli.parse_args()
    col = decode_gml(args.gml)
    companion = decode_cxml(args.cxml) if args.cxml else None
    validate_companion(col, companion)
    if args.output:
        Path(args.output).write_text(json.dumps(col, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(summary(col, companion), indent=2))


if __name__ == "__main__":
    try:
        main()
    except (SourceError, ET.ParseError, OSError) as exc:
        print("REFUSED ORIGINAL BOM PRODUCT: " + str(exc), file=sys.stderr)
        raise SystemExit(2) from exc
