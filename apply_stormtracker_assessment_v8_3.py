from pathlib import Path
import base64
import subprocess
import tempfile

ROOT = Path("/workspaces/StormTracker")
FRONTEND = ROOT / "frontend"
SRC = FRONTEND / "src"
TESTS = FRONTEND / "tests"
SOURCE_JS = SRC / "live3d-core-v8-2.js"
SOURCE_HTML = FRONTEND / "live3d-core-v8-2.html"
TARGET_JS = SRC / "live3d-core-v8-3.js"
TARGET_HTML = FRONTEND / "live3d-core-v8-3.html"
ASSESSMENT = SRC / "track-assessment-v2.js"
TEST = TESTS / "run-track-assessment-v2-tests.mjs"

assessment_js = base64.b64decode('aW1wb3J0IHsKICBidWlsZFRyYWNrTGlrZWxpaG9vZAp9IGZyb20gIi4vbGlnaHRuaW5nLmpzIjsKCmV4cG9ydCBmdW5jdGlvbiBzdHJpY3REb3BwbGVyVmFsdWVzRnJvbVRyYWNrQ29udGV4dCgKICBjb250ZXh0CikgewogIGNvbnN0IHByaW1hcnkgPQogICAgY29udGV4dD8ucHJpbWFyeQogICAgPz8gbnVsbDsKCiAgaWYgKCFwcmltYXJ5KSB7CiAgICByZXR1cm4gW107CiAgfQoKICBjb25zdCB2YWx1ZXMgPQogICAgW107CgogIGNvbnN0IHRvd2FyZCA9CiAgICBOdW1iZXIoCiAgICAgIHByaW1hcnkuc3Ryb25nZXN0X3Rvd2FyZF9rbWgKICAgICk7CgogIGNvbnN0IGF3YXkgPQogICAgTnVtYmVyKAogICAgICBwcmltYXJ5LnN0cm9uZ2VzdF9hd2F5X2ttaAogICAgKTsKCiAgaWYgKAogICAgTnVtYmVyLmlzRmluaXRlKAogICAgICB0b3dhcmQKICAgICkKICAgICYmIHRvd2FyZCAhPT0gMAogICkgewogICAgdmFsdWVzLnB1c2goCiAgICAgIHRvd2FyZAogICAgKTsKICB9CgogIGlmICgKICAgIE51bWJlci5pc0Zpbml0ZSgKICAgICAgYXdheQogICAgKQogICAgJiYgYXdheSAhPT0gMAogICkgewogICAgdmFsdWVzLnB1c2goCiAgICAgIGF3YXkKICAgICk7CiAgfQoKICByZXR1cm4gdmFsdWVzOwp9CgpleHBvcnQgZnVuY3Rpb24gYnVpbGRGb290cHJpbnRSZXN0cmljdGVkVHJhY2tBc3Nlc3NtZW50KAogIHRyYWNrLAogIGRvcHBsZXJDb250ZXh0LAogIHsKICAgIHJlZmVyZW5jZVRpbWUgPQogICAgICBuZXcgRGF0ZSgpCiAgfSA9IHt9CikgewogIGNvbnN0IHByaW1hcnkgPQogICAgZG9wcGxlckNvbnRleHQ/LnByaW1hcnkKICAgID8/IG51bGw7CgogIGNvbnN0IGRvcHBsZXJWYWx1ZXMgPQogICAgc3RyaWN0RG9wcGxlclZhbHVlc0Zyb21UcmFja0NvbnRleHQoCiAgICAgIGRvcHBsZXJDb250ZXh0CiAgICApOwoKICBjb25zdCBhc3Nlc3NtZW50ID0KICAgIGJ1aWxkVHJhY2tMaWtlbGlob29kKAogICAgICB0cmFjaywKICAgICAgewogICAgICAgIGRvcHBsZXJWYWx1ZXMsCiAgICAgICAgcmVmZXJlbmNlVGltZQogICAgICB9CiAgICApOwoKICBjb25zdCBkb3BwbGVyQ29tcG9uZW50ID0KICAgIGFzc2Vzc21lbnQuY29tcG9uZW50cwogICAgICAuZmluZCgKICAgICAgICBjb21wb25lbnQgPT4KICAgICAgICAgIGNvbXBvbmVudC5uYW1lCiAgICAgICAgICA9PT0gImRvcHBsZXItZHluYW1pY3MiCiAgICAgICkKICAgID8/IG51bGw7CgogIHJldHVybiB7CiAgICAuLi5hc3Nlc3NtZW50LAoKICAgIGRvcHBsZXJfaW50ZWdyYXRlZDoKICAgICAgQm9vbGVhbigKICAgICAgICBwcmltYXJ5CiAgICAgICAgJiYgZG9wcGxlclZhbHVlcy5sZW5ndGgKICAgICAgKSwKCiAgICBkb3BwbGVyX3JhZGFyX2lkOgogICAgICBwcmltYXJ5Py5yYWRhcl9pZAogICAgICA/PyBudWxsLAoKICAgIGRvcHBsZXJfc2FtcGxlX2NvdW50OgogICAgICBwcmltYXJ5Py5zYW1wbGVfY291bnQKICAgICAgPz8gMCwKCiAgICBkb3BwbGVyX3NvdXJjZV90aW1lX3V0YzoKICAgICAgcHJpbWFyeT8uc291cmNlX3RpbWVfdXRjCiAgICAgID8/IG51bGwsCgogICAgZG9wcGxlcl90aW1lX2RlbHRhX21pbnV0ZXM6CiAgICAgIHByaW1hcnk/LnRpbWVfZGVsdGFfbWludXRlcwogICAgICA/PyBudWxsLAoKICAgIGRvcHBsZXJfY29tcG9uZW50X3Njb3JlOgogICAgICBkb3BwbGVyQ29tcG9uZW50Py5zY29yZQogICAgICA/PyAwLAoKICAgIGRvcHBsZXJfY29tcG9uZW50X21heGltdW06CiAgICAgIGRvcHBsZXJDb21wb25lbnQ/Lm1heGltdW0KICAgICAgPz8gMTUsCgogICAgYXNzZXNzbWVudF9iYXNpczoKICAgICAgIk1lYXN1cmVkIDItRCByZWZsZWN0aXZpdHkgdHJhY2sgKyB0aW1lLW1hdGNoZWQgc3RyaWN0IERvcHBsZXIgc2FtcGxlcyBpbnNpZGUgdGhlIG1lYXN1cmVkID49NDAgZEJaIFNUIGZvb3RwcmludC4gRG9wcGxlciBkb2VzIG5vdCBjcmVhdGUgb3IgbW92ZSB0aGUgdHJhY2suIiwKCiAgICBpbnRlcnByZXRhdGlvbjoKICAgICAgIk9yZGluYWwgaW5mZXJyZWQgY29udmVjdGl2ZS9saWdodG5pbmcgbGlrZWxpaG9vZC4gSXQgaXMgbm90IGEgbGlnaHRuaW5nLXN0cmlrZSBvYnNlcnZhdGlvbiwgbm90IGEgY2FsaWJyYXRlZCBwcm9iYWJpbGl0eSwgYW5kIERvcHBsZXIgaXMgbm90IHRyZWF0ZWQgYXMgaG9yaXpvbnRhbCBzdG9ybSBtb3Rpb24gb3IgYSByb3RhdGlvbiBkaWFnbm9zaXMuIgogIH07Cn0K').decode('utf-8')
test_js = base64.b64decode('aW1wb3J0IGFzc2VydCBmcm9tICJub2RlOmFzc2VydC9zdHJpY3QiOwoKaW1wb3J0IHsKICBidWlsZEZvb3RwcmludFJlc3RyaWN0ZWRUcmFja0Fzc2Vzc21lbnQsCiAgc3RyaWN0RG9wcGxlclZhbHVlc0Zyb21UcmFja0NvbnRleHQKfSBmcm9tICIuLi9zcmMvdHJhY2stYXNzZXNzbWVudC12Mi5qcyI7Cgpjb25zdCB0cmFjayA9IHsKICB0cmFja19pZDoKICAgICJTVDAwMDciLAoKICBvYnNlcnZhdGlvbl9jb3VudDoKICAgIDQsCgogIGxhdGVzdDogewogICAgb2JzZXJ2ZWRfdXRjOgogICAgICAiMjAyNi0xMC0wNFQwMToxNTowMC4wMDBaIiwKCiAgICBjZW50cm9pZF9sb25naXR1ZGU6CiAgICAgIDE1My4xMCwKCiAgICBjZW50cm9pZF9sYXRpdHVkZToKICAgICAgLTI3LjYwLAoKICAgIHNhbXBsZWRfYXJlYV9rbTI6CiAgICAgIDgwLAoKICAgIG1heGltdW1fY2F0ZWdvcnk6CiAgICAgIDEyLAoKICAgIG11bHRpX3JhZGFyX2NvbmZpcm1lZDoKICAgICAgdHJ1ZQogIH0sCgogIGhpc3Rvcnk6IFsKICAgIHsKICAgICAgb2JzZXJ2ZWRfdXRjOgogICAgICAgICIyMDI2LTEwLTA0VDAxOjAwOjAwLjAwMFoiLAoKICAgICAgc2FtcGxlZF9hcmVhX2ttMjoKICAgICAgICA0MCwKCiAgICAgIG1heGltdW1fY2F0ZWdvcnk6CiAgICAgICAgMTAsCgogICAgICBtdWx0aV9yYWRhcl9jb25maXJtZWQ6CiAgICAgICAgZmFsc2UKICAgIH0sCiAgICB7CiAgICAgIG9ic2VydmVkX3V0YzoKICAgICAgICAiMjAyNi0xMC0wNFQwMTowNTowMC4wMDBaIiwKCiAgICAgIHNhbXBsZWRfYXJlYV9rbTI6CiAgICAgICAgNTAsCgogICAgICBtYXhpbXVtX2NhdGVnb3J5OgogICAgICAgIDEwLAoKICAgICAgbXVsdGlfcmFkYXJfY29uZmlybWVkOgogICAgICAgIGZhbHNlCiAgICB9LAogICAgewogICAgICBvYnNlcnZlZF91dGM6CiAgICAgICAgIjIwMjYtMTAtMDRUMDE6MTA6MDAuMDAwWiIsCgogICAgICBzYW1wbGVkX2FyZWFfa20yOgogICAgICAgIDYwLAoKICAgICAgbWF4aW11bV9jYXRlZ29yeToKICAgICAgICAxMSwKCiAgICAgIG11bHRpX3JhZGFyX2NvbmZpcm1lZDoKICAgICAgICB0cnVlCiAgICB9LAogICAgewogICAgICBvYnNlcnZlZF91dGM6CiAgICAgICAgIjIwMjYtMTAtMDRUMDE6MTU6MDAuMDAwWiIsCgogICAgICBzYW1wbGVkX2FyZWFfa20yOgogICAgICAgIDgwLAoKICAgICAgbWF4aW11bV9jYXRlZ29yeToKICAgICAgICAxMiwKCiAgICAgIG11bHRpX3JhZGFyX2NvbmZpcm1lZDoKICAgICAgICB0cnVlCiAgICB9CiAgXQp9OwoKY29uc3QgZG9wcGxlckNvbnRleHQgPSB7CiAgcHJpbWFyeTogewogICAgcmFkYXJfaWQ6CiAgICAgICI2NiIsCgogICAgc291cmNlX3RpbWVfdXRjOgogICAgICAiMjAyNi0xMC0wNFQwMToxNDowMC4wMDBaIiwKCiAgICB0aW1lX2RlbHRhX21pbnV0ZXM6CiAgICAgIDEsCgogICAgc2FtcGxlX2NvdW50OgogICAgICA0MiwKCiAgICBzdHJvbmdlc3RfdG93YXJkX2ttaDoKICAgICAgLTYwLAoKICAgIHN0cm9uZ2VzdF9hd2F5X2ttaDoKICAgICAgNDAsCgogICAgcmFkaWFsX3NwYW5fa21oOgogICAgICAxMDAsCgogICAgbWF4aW11bV9hYnNvbHV0ZV9rbWg6CiAgICAgIDYwCiAgfSwKCiAgcmFkYXJzOiBbCiAgICB7CiAgICAgIHJhZGFyX2lkOiI2NiIKICAgIH0sCiAgICB7CiAgICAgIHJhZGFyX2lkOiI1MCIsCiAgICAgIHN0cm9uZ2VzdF90b3dhcmRfa21oOi03MCwKICAgICAgc3Ryb25nZXN0X2F3YXlfa21oOjcwCiAgICB9CiAgXQp9OwoKYXNzZXJ0LmRlZXBFcXVhbCgKICBzdHJpY3REb3BwbGVyVmFsdWVzRnJvbVRyYWNrQ29udGV4dCgKICAgIGRvcHBsZXJDb250ZXh0CiAgKSwKICBbCiAgICAtNjAsCiAgICA0MAogIF0KKTsKCmNvbnN0IG9yaWdpbmFsID0KICBKU09OLnN0cmluZ2lmeSgKICAgIHRyYWNrCiAgKTsKCmNvbnN0IHdpdGhEb3BwbGVyID0KICBidWlsZEZvb3RwcmludFJlc3RyaWN0ZWRUcmFja0Fzc2Vzc21lbnQoCiAgICB0cmFjaywKICAgIGRvcHBsZXJDb250ZXh0LAogICAgewogICAgICByZWZlcmVuY2VUaW1lOgogICAgICAgIG5ldyBEYXRlKAogICAgICAgICAgIjIwMjYtMTAtMDRUMDE6MTU6MDAuMDAwWiIKICAgICAgICApCiAgICB9CiAgKTsKCmNvbnN0IHdpdGhvdXREb3BwbGVyID0KICBidWlsZEZvb3RwcmludFJlc3RyaWN0ZWRUcmFja0Fzc2Vzc21lbnQoCiAgICB0cmFjaywKICAgIG51bGwsCiAgICB7CiAgICAgIHJlZmVyZW5jZVRpbWU6CiAgICAgICAgbmV3IERhdGUoCiAgICAgICAgICAiMjAyNi0xMC0wNFQwMToxNTowMC4wMDBaIgogICAgICAgICkKICAgIH0KICApOwoKYXNzZXJ0LmVxdWFsKAogIHdpdGhEb3BwbGVyLmRvcHBsZXJfaW50ZWdyYXRlZCwKICB0cnVlCik7Cgphc3NlcnQuZXF1YWwoCiAgd2l0aERvcHBsZXIuZG9wcGxlcl9yYWRhcl9pZCwKICAiNjYiCik7Cgphc3NlcnQuZXF1YWwoCiAgd2l0aERvcHBsZXIuZG9wcGxlcl9zYW1wbGVfY291bnQsCiAgNDIKKTsKCmFzc2VydC5lcXVhbCgKICB3aXRoRG9wcGxlci5kb3BwbGVyX2NvbXBvbmVudF9zY29yZSwKICAxMQopOwoKYXNzZXJ0LmVxdWFsKAogIHdpdGhEb3BwbGVyLnNjb3JlCiAgICAtIHdpdGhvdXREb3BwbGVyLnNjb3JlLAogIDExCik7Cgphc3NlcnQuZXF1YWwoCiAgd2l0aG91dERvcHBsZXIuZG9wcGxlcl9pbnRlZ3JhdGVkLAogIGZhbHNlCik7Cgphc3NlcnQuZXF1YWwoCiAgSlNPTi5zdHJpbmdpZnkoCiAgICB0cmFjawogICksCiAgb3JpZ2luYWwKKTsKCmNvbnNvbGUubG9nKAogICI4IGZvb3RwcmludC1yZXN0cmljdGVkIHRyYWNrLWFzc2Vzc21lbnQgdGVzdHMgcGFzc2VkLiIKKTsK').decode('utf-8')
IMPORT_ANCHOR = 'import {\n  buildTrackDopplerContexts\n} from "./track-doppler-context-v1.js?v=track-context-v1";'
IMPORT_NEW = 'import {\n  buildTrackDopplerContexts\n} from "./track-doppler-context-v1.js?v=track-context-v1";\n\nimport {\n  buildFootprintRestrictedTrackAssessment\n} from "./track-assessment-v2.js?v=assessment-v2";'
DOPPLER_SUMMARY = '      const dopplerSummary =\n        primaryDoppler\n          ? (\n              `Doppler ${primaryDoppler.radar_id}: ` +\n              `${formatSignedKmh(primaryDoppler.strongest_toward_kmh)} toward / ` +\n              `${formatSignedKmh(primaryDoppler.strongest_away_kmh)} away; ` +\n              `span ${\n                primaryDoppler.radial_span_kmh == null\n                  ? "—"\n                  : `${primaryDoppler.radial_span_kmh.toFixed(0)} km/h`\n              }; ${primaryDoppler.sample_count} footprint samples`\n            )\n          : "Doppler — no time-matched non-zero samples in this measured footprint";'
ASSESSMENT_BLOCK = '      const dopplerSummary =\n        primaryDoppler\n          ? (\n              `Doppler ${primaryDoppler.radar_id}: ` +\n              `${formatSignedKmh(primaryDoppler.strongest_toward_kmh)} toward / ` +\n              `${formatSignedKmh(primaryDoppler.strongest_away_kmh)} away; ` +\n              `span ${\n                primaryDoppler.radial_span_kmh == null\n                  ? "—"\n                  : `${primaryDoppler.radial_span_kmh.toFixed(0)} km/h`\n              }; ${primaryDoppler.sample_count} footprint samples`\n            )\n          : "Doppler — no time-matched non-zero samples in this measured footprint";\n\n      const assessment =\n        buildFootprintRestrictedTrackAssessment(\n          track,\n          dopplerContext,\n          {\n            referenceTime:\n              new Date(\n                hybridFrames[index].observedUtc\n              )\n          }\n        );\n\n      const dopplerAssessmentText =\n        assessment.doppler_integrated\n          ? (\n              `Doppler contribution ${assessment.doppler_component_score}/` +\n              `${assessment.doppler_component_maximum} from radar ` +\n              `${assessment.doppler_radar_id} ` +\n              `(${assessment.doppler_sample_count} strict footprint samples)`\n            )\n          : "Doppler contribution unavailable for this ST footprint";\n\n      const assessmentText =\n        `Convective/lightning assessment ${assessment.category} ` +\n        `${assessment.score}/100; confidence ${assessment.confidence}; ` +\n        `evidence ${assessment.evidence_coverage_percent}/100`;'
ROW_OLD = '            <span>support ${supportText}</span>\n            <span>${dopplerSummary}</span>\n          </div>'
ROW_NEW = '            <span>support ${supportText}</span>\n            <span>${dopplerSummary}</span>\n            <span><strong>${assessmentText}</strong></span>\n            <span>${dopplerAssessmentText}</span>\n          </div>'
FINAL_OLD = '    `Each reflectivity frame is independently paired to the nearest available Doppler frame for 66 / 50 / 08; ` +\n    `Doppler remains footprint-matched radial-velocity context only and does not create or move ST tracks.`,\n    "ok"\n  );'
FINAL_NEW = '    `Each reflectivity frame is independently paired to the nearest available Doppler frame for 66 / 50 / 08; ` +\n    `strict footprint-restricted Doppler is now included in the existing ordinal convective/lightning assessment. ` +\n    `Doppler does not create or move ST tracks and is not treated as horizontal storm motion or a rotation diagnosis.`,\n    "ok"\n  );'
HTML_NOTE_OLD = '        Storm analysis remains conservative: only strict decoded radial-velocity\n        samples intersecting a measured ≥40 dBZ ST footprint contribute to track\n        metrics. The visible overlay uses a separate display decoder so the full\n        low-to-high non-zero Doppler field is not reduced to sparse exact matches.'
HTML_NOTE_NEW = '        Storm analysis remains conservative: only strict decoded radial-velocity\n        samples intersecting a measured ≥40 dBZ ST footprint contribute to track\n        metrics and to the existing ordinal convective/lightning assessment.\n        The visible overlay remains display-only and uses the broader display decoder.\n        Doppler never creates or moves an ST track and is not treated as storm motion\n        or as a rotation diagnosis.'

def replace_once(text, old, new, label):
    count = text.count(old)

    if count != 1:
        raise SystemExit(
            f"ERROR: expected exactly one {label}, found {count}. "
            "No V8.3 application files were written."
        )

    return text.replace(old, new, 1)

for required in [
    SOURCE_JS,
    SOURCE_HTML,
    SRC / "lightning.js",
    SRC / "track-doppler-context-v1.js",
    SRC / "stormtracker-camera-v1.js",
]:
    if not required.exists():
        raise SystemExit(
            f"ERROR: missing required file: {required}"
        )

print("StormTracker — V8.3 footprint-restricted Doppler assessment integration")
print()
print("Scope:")
print("  • use strict time-matched Doppler already sampled inside each ST footprint")
print("  • feed only the primary same-radar toward/away measurements into the existing 0-15 Doppler component")
print("  • display total ordinal convective/lightning score, confidence and Doppler contribution per ST")
print("  • do not alter tracking, centroids, motion, camera or the broad visual Doppler overlay")
print()

js = SOURCE_JS.read_text(encoding="utf-8")
html = SOURCE_HTML.read_text(encoding="utf-8")

js = replace_once(
    js,
    IMPORT_ANCHOR,
    IMPORT_NEW,
    "track assessment import"
)

js = replace_once(
    js,
    DOPPLER_SUMMARY,
    ASSESSMENT_BLOCK,
    "footprint-restricted assessment calculation"
)

js = replace_once(
    js,
    ROW_OLD,
    ROW_NEW,
    "track assessment display"
)

js = replace_once(
    js,
    FINAL_OLD,
    FINAL_NEW,
    "completion status"
)

html = replace_once(
    html,
    "StormTracker — Hybrid Storm Volume Core V8.2",
    "StormTracker — Hybrid Storm Volume Core V8.3",
    "page title"
)

html = replace_once(
    html,
    HTML_NOTE_OLD,
    HTML_NOTE_NEW,
    "Doppler assessment note"
)

html = replace_once(
    html,
    'src="./src/live3d-core-v8-2.js"',
    'src="./src/live3d-core-v8-3.js"',
    "V8.3 script reference"
)

# Hard safety guardrails.
if './stormtracker-camera-v1.js?v=camera-v1.1-wheel' not in js:
    raise SystemExit(
        "ERROR: validated shared camera import changed unexpectedly."
    )

for forbidden in [
    "updateTracks(",
    "associateFrame(",
    "centroid_longitude =",
    "centroid_latitude =",
]:
    if forbidden in assessment_js:
        raise SystemExit(
            f"ERROR: assessment module contains prohibited tracking mutation: {forbidden}"
        )

for required_text in [
    "buildFootprintRestrictedTrackAssessment",
    "doppler_component_score",
    "Convective/lightning assessment",
    "Doppler contribution",
]:
    if required_text not in js:
        raise SystemExit(
            f"ERROR: generated V8.3 missing {required_text!r}."
        )

# Syntax-check the actual generated application file before writing.
with tempfile.NamedTemporaryFile(
    mode="w",
    suffix=".mjs",
    encoding="utf-8",
    delete=False
) as tmp:
    tmp.write(js)
    generated = Path(tmp.name)

try:
    subprocess.run(
        ["node", "--check", str(generated)],
        check=True
    )
finally:
    generated.unlink(missing_ok=True)

print("Generated Core V8.3 JavaScript syntax: PASS")

# Only now write.
ASSESSMENT.write_text(
    assessment_js,
    encoding="utf-8"
)

TEST.write_text(
    test_js,
    encoding="utf-8"
)

TARGET_JS.write_text(
    js,
    encoding="utf-8"
)

TARGET_HTML.write_text(
    html,
    encoding="utf-8"
)

print()
print("Running footprint-restricted assessment tests...")

subprocess.run(
    ["node", "frontend/tests/run-track-assessment-v2-tests.mjs"],
    cwd=ROOT,
    check=True
)

print()
print("Running recovered StormTracker science tests...")

subprocess.run(
    ["node", "frontend/tests/run-node-tests.mjs"],
    cwd=ROOT,
    check=True
)

print()
print("Running shared camera tests...")

subprocess.run(
    ["node", "frontend/tests/run-stormtracker-camera-v1-tests.mjs"],
    cwd=ROOT,
    check=True
)

print()
print("SUCCESS")
print("Expected:")
print("  8 footprint-restricted track-assessment tests passed.")
print("  14 tests passed.")
print("  11 shared camera controller tests passed.")
print()
print("Commit/push:")
print(
    "git add "
    "frontend/src/track-assessment-v2.js "
    "frontend/tests/run-track-assessment-v2-tests.mjs "
    "frontend/src/live3d-core-v8-3.js "
    "frontend/live3d-core-v8-3.html"
)
print(
    'git commit -m "Integrate footprint Doppler into storm assessment"'
)
print("git push")
print()
print("Open:")
print(
    "https://blakesmith-intel.github.io/StormTracker/"
    "live3d-core-v8-3.html"
)
print()
print("When a measured ST track exists, its row now shows:")
print("  • Convective/lightning assessment LOW / MODERATE / HIGH / VERY HIGH")
print("  • total score /100")
print("  • confidence and evidence coverage")
print("  • Doppler contribution /15")
print("  • the primary radar and strict footprint sample count")
print()
print("No qualifying storm today = no ST assessment row, which is correct.")
