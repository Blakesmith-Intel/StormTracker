#!/usr/bin/env python3
"""Offline, synthetic regression cases for PRIVATE cyclone FTP ingestion.

These tests do NOT ship or reconstruct BoM-issued cyclone geometry. Every point
and polygon here belongs to an explicitly fake source-format test fixture.
"""
from __future__ import annotations
from datetime import datetime, timezone
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
NAME = HERE / "internal-cyclone-ftp-ingest.py"
spec = importlib.util.spec_from_file_location("internal_cyclone_ingest_test", NAME)
ingest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ingest)

CLOCK = datetime(2026, 10, 17, 4, 0, 0, tzinfo=timezone.utc)


def original_test_xml(issued="2026-10-17T03:00:00Z", system="FAKE-QL-TEST",
                      name="SYNTHETIC ONLY", polygon=True):
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<tc:tcData xmlns:tc="http://www.bom.gov.au/dtd/tc" xmlns:gml="http://www.opengis.net/gml">
<tc:issueTime>{issued}</tc:issueTime>
<tc:fcastTime>2026-10-17T02:00:00Z</tc:fcastTime>
<tc:distId>{system}</tc:distId><tc:distName>{name}</tc:distName><tc:expiryHrs>12</tc:expiryHrs>
<tc:tcFix srsName="EPSG:4283">
<tc:fixType>forecast</tc:fixType><tc:fixTime>2026-10-17T11:00:00Z</tc:fixTime>
<gml:Point srsName="EPSG:4283"><gml:coordinates>150,-20</gml:coordinates></gml:Point>
</tc:tcFix>
{'''<tc:tcForecastArea srsName="EPSG:4283">
<tc:areaType>Likely Tracks Area</tc:areaType>
<tc:extent>Up to 72 hours</tc:extent>
<gml:Polygon srsName="EPSG:4283"><gml:outerBoundaryIs>
<gml:LinearRing><gml:coordinates>149,-19 151,-19 151,-21 149,-19</gml:coordinates></gml:LinearRing>
</gml:outerBoundaryIs></gml:Polygon>
</tc:tcForecastArea>''' if polygon else ''}
</tc:tcData>"""


class PrivateCycloneIngestionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.input = Path(self.temp.name) / "input"
        self.input.mkdir()
        self.decoder = ingest.load_decoder()

    def write(self, product="IDQ65248", **kwargs):
        (self.input / (product + ".gml")).write_text(original_test_xml(**kwargs), encoding="utf-8")

    def manifest(self, now=CLOCK):
        return ingest.build_manifest(self.input, now, self.decoder)

    def test_original_polygon_and_source_identity_untouched(self):
        self.write()
        result = self.manifest()
        self.assertEqual(result["status"], "active")
        self.assertTrue(result["complete"])
        self.assertEqual(result["verifiedProductIds"], ["IDQ65248"])
        self.assertEqual(len(result["products"]), 1)
        p = result["products"][0]
        self.assertEqual(p["productId"], "IDQ65248")
        self.assertEqual(p["issueUtc"], "2026-10-17T03:00:00Z")
        self.assertEqual(p["expiresUtc"], "2026-10-17T15:00:00Z")
        self.assertEqual(p["forecast"]["properties"]["systemId"], "FAKE-QL-TEST")
        cone = [f for f in p["forecast"]["features"] if
                f["properties"]["role"] == "uncertainty_area"]
        self.assertEqual(len(cone), 1)
        self.assertEqual(cone[0]["geometry"]["coordinates"][0],
                         [[149., -19.], [151., -19.], [151., -21.], [149., -19.]])

    def test_duplicate_issue_uses_latest_source_for_same_system(self):
        self.write("IDQ65248", issued="2026-10-17T03:00:00Z")
        self.write("IDQ65249", issued="2026-10-17T03:30:00Z")
        r = self.manifest()
        self.assertEqual(len(r["products"]), 1)
        self.assertEqual(r["products"][0]["productId"], "IDQ65249")

    def test_two_simultaneous_original_events(self):
        self.write("IDQ65248", system="FAKE-A")
        self.write("IDQ65249", system="FAKE-B")
        r = self.manifest()
        self.assertEqual(r["status"], "active")
        self.assertEqual(len(r["products"]), 2)

    def test_absent_products_not_fabricated(self):
        r = self.manifest()
        self.assertEqual(r["status"], "no-active-products")
        self.assertEqual(r["products"], [])

    def test_expired_issue_is_removed_not_reissued(self):
        self.write()
        later = datetime(2026, 10, 18, 6, tzinfo=timezone.utc)
        r = self.manifest(later)
        self.assertEqual(r["products"], [])
        self.assertEqual(r["status"], "no-active-products")

    def test_bad_xml_returns_unavailable_not_false_all_clear(self):
        (self.input / "IDQ65248.gml").write_text("<broken/>", encoding="utf-8")
        r = self.manifest()
        self.assertEqual(r["status"], "source-unavailable")
        self.assertFalse(r["complete"])
        self.assertEqual(r["failedProductIds"], ["IDQ65248"])
        self.assertEqual(r["products"], [])

    def test_future_issue_refused(self):
        self.write(issued="2026-10-17T09:00:00Z")
        r = self.manifest()
        self.assertEqual(r["status"], "source-unavailable")
        self.assertEqual(r["products"], [])

    def test_no_public_repo_output_and_private_permissions(self):
        with self.assertRaises(ValueError):
            ingest.safe_destination(ingest.REPO / "_site" / "privatecyclone")
        private = ingest.safe_destination(Path(self.temp.name) / "internal")
        self.write()
        ingest.atomic_private_json(private, self.manifest())
        file = private / "cyclones.json"
        self.assertEqual(json.loads(file.read_text())["status"], "active")
        self.assertEqual(os.stat(file).st_mode & 0o777, 0o600)
        self.assertEqual(os.stat(private).st_mode & 0o777, 0o700)


if __name__ == "__main__":
    unittest.main()
