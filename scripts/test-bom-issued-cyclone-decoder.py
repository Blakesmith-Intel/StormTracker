#!/usr/bin/env python3
"""Offline TEST fixtures, not real cyclone advisories or distributable warning polygons.

The separate on-demand Fina FTP archive audit exercises genuine dated BoM
source GML/CXML; these tiny fabricated fixtures test decoder safety only.
"""
import importlib.util
import tempfile
import unittest
from pathlib import Path

module_path = Path(__file__).with_name("decode-bom-issued-cyclone-gml.py")
spec = importlib.util.spec_from_file_location("bom_tc_decoder", module_path)
decoder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(decoder)

utc = "2025-11-20T"
POLYGON = """<geometry srsName="urn:ogc:def:crs:EPSG:6.6:4283">
<gml:polygonMember><gml:Polygon><gml:outerBoundaryIs>
<gml:LinearRing><gml:coordinates>131.0,-11.0 132.5,-11.0 132.5,-12.0
131.0,-12.0 131.0,-11.0</gml:coordinates></gml:LinearRing>
</gml:outerBoundaryIs></gml:Polygon></gml:polygonMember></geometry>"""


def forecast_area(extent):
    return (f'<tcForecastArea>{POLYGON}<areaType>Likely Tracks Area</areaType>'
            f'<extent>{extent}</extent></tcForecastArea>')


def fix(hours, date, lon, lat):
    return (f'<tcFix><point srsName="urn:ogc:def:crs:EPSG:6.6:4283">'
            f'<gml:coordinates>{lon},{lat}</gml:coordinates></point>'
            f'<fixType>Forecast</fixType><fixTime>{date}</fixTime>'
            f'<category>2</category><timeOffset>{hours}</timeOffset></tcFix>')


def gml():
    return f"""<?xml version="1.0"?>
<tcData xmlns="http://www.bom.gov.au/dtd/tc" xmlns:gml="http://www.opengis.net/gml">
<fcastTime>2025-11-20T06:00:00Z</fcastTime>
<issueTime>2025-11-20T06:53:03Z</issueTime>
<expiryHrs>8</expiryHrs><distId>TEST_FIXTURE</distId>
<distName>TEST FIXTURE — NOT REAL</distName>
{forecast_area("Up to 72 hours")}
{forecast_area("Up to 120 hours")}
<tcTrack><lineString srsName="urn:ogc:def:crs:EPSG:6.6:4283">
<gml:coordinates>132.0,-10.0 131.5,-10.5 131.0,-11.0</gml:coordinates>
</lineString><trackType>Forecast</trackType>
<startTime>2025-11-20T06:00:00Z</startTime>
<endTime>2025-11-21T18:00:00Z</endTime></tcTrack>
{fix(12,"2025-11-20T18:00:00Z",131.0,-11.0)}
{fix(24,"2025-11-21T06:00:00Z",130.5,-11.5)}
{fix(36,"2025-11-21T18:00:00Z",130.0,-12.0)}
<tcWarningArea>{POLYGON}<areaType>Warning</areaType></tcWarningArea>
</tcData>"""


def cxml():
    def cfix(hours, date, lat, lon):
        return (f'<fix hour="{hours}"><validTime>{date}</validTime>'
                f'<latitude units="deg S">{lat}</latitude>'
                f'<longitude units="deg E">{lon}</longitude></fix>')
    return f"""<?xml version="1.0"?>
<cxml><header><baseTime>2025-11-20T06:00:00Z</baseTime>
<creationTime>2025-11-20T07:03:51Z</creationTime></header>
<data type="forecast"><disturbance ID="TEST">
<cycloneName>TEST FIXTURE — NOT REAL</cycloneName>
{cfix(12,"2025-11-20T18:00:00Z",11,131)}
{cfix(24,"2025-11-21T06:00:00Z",11.5,130.5)}
{cfix(36,"2025-11-21T18:00:00Z",12,130)}
</disturbance></data></cxml>"""


class SourceIntegrity(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.gml = Path(self.temp.name) / "IDD65401.gml"
        self.cxml = Path(self.temp.name) / "IDD65441.xml"
        self.gml.write_text(gml(), encoding="utf-8")
        self.cxml.write_text(cxml(), encoding="utf-8")

    def test_original_positions_and_both_source_areas(self):
        decoded = decoder.decode_gml(self.gml)
        self.assertEqual(decoded["properties"]["issuedUtc"],"2025-11-20T06:53:03Z")
        roles = [x["properties"]["role"] for x in decoded["features"]]
        self.assertEqual(roles.count("forecast_fix"), 3)
        self.assertEqual(roles.count("uncertainty_area"), 2)
        self.assertEqual(roles.count("warning_area"), 1)
        self.assertEqual(roles.count("forecast_track"), 1)
        self.assertEqual(decoded["features"][0]["geometry"]["coordinates"][0][0],
                         [[131,-11],[132.5,-11],[132.5,-12],[131,-12],[131,-11]])
        self.assertEqual(decoded["features"][3]["geometry"]["coordinates"],
                         [[132,-10],[131.5,-10.5],[131,-11]])
        matching = decoder.validate_companion(decoded,decoder.decode_cxml(self.cxml))
        self.assertEqual(matching["matchingForecastFixes"], 3)
        self.assertEqual(matching["maxLonLatComponentDifferenceDeg"], 0)

    def test_never_generate_absent_uncertainty(self):
        original = gml().replace(forecast_area("Up to 72 hours"),"").replace(
            forecast_area("Up to 120 hours"),"")
        self.gml.write_text(original,encoding="utf-8")
        out = decoder.decode_gml(self.gml)
        self.assertTrue(out["features"])
        self.assertFalse(any(x["properties"]["role"]=="uncertainty_area"
                             for x in out["features"]))

    def test_unknown_forecast_area_type_rejected(self):
        self.gml.write_text(gml().replace("Likely Tracks Area","Calculated Cone"),
                            encoding="utf-8")
        with self.assertRaisesRegex(decoder.SourceError,"Unsupported forecast area"):
            decoder.decode_gml(self.gml)

    def test_unknown_crs_rejected(self):
        self.gml.write_text(gml().replace("EPSG:6.6:4283","EPSG:6.6:9999"),
                            encoding="utf-8")
        with self.assertRaisesRegex(decoder.SourceError,"Unsupported CRS"):
            decoder.decode_gml(self.gml)

    def test_bad_longitude_latitude_never_swapped(self):
        self.gml.write_text(gml().replace("131.0,-11.0","-11.0,131.0"),
                            encoding="utf-8")
        with self.assertRaisesRegex(decoder.SourceError,"Invalid longitude/latitude"):
            decoder.decode_gml(self.gml)

    def test_unverified_product_id_rejected(self):
        other=self.gml.with_name("IDQ00000.gml")
        other.write_text(gml(),encoding="utf-8")
        with self.assertRaisesRegex(decoder.SourceError,"Not a documented"):
            decoder.decode_gml(other)


if __name__=="__main__":
    unittest.main()
