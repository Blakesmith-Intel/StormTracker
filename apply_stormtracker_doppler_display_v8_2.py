from pathlib import Path
import base64
import subprocess
import tempfile

ROOT = Path("/workspaces/StormTracker")
FRONTEND = ROOT / "frontend"
SRC = FRONTEND / "src"
TESTS = FRONTEND / "tests"
SOURCE_JS = SRC / "live3d-core-v8-1.js"
SOURCE_HTML = FRONTEND / "live3d-core-v8-1.html"
TARGET_JS = SRC / "live3d-core-v8-2.js"
TARGET_HTML = FRONTEND / "live3d-core-v8-2.html"
HELPER = SRC / "bom-doppler-display-v2.js"
TEST = TESTS / "run-doppler-display-v2-tests.mjs"

helper_js = base64.b64decode('aW1wb3J0IHsKICBoaXN0b3JpY2FsUGFuZWxMYXlvdXQKfSBmcm9tICIuL2JvbS1kb3BwbGVyLWhpc3Rvcnktc3BhdGlhbC12MS5qcz92PWRpc3BsYXktdjIiOwoKaW1wb3J0IHsKICBkb3BwbGVyUGl4ZWxDZW50cmVUb0xvbkxhdAp9IGZyb20gIi4vYm9tLWRvcHBsZXItZ2VvcmVmLXYxLmpzP3Y9ZGlzcGxheS12MiI7CgpmdW5jdGlvbiBzcXVhcmVkUmdiRGlzdGFuY2UoCiAgYSwKICBiCikgewogIGNvbnN0IGRyID0gTnVtYmVyKGFbMF0pIC0gTnVtYmVyKGJbMF0pOwogIGNvbnN0IGRnID0gTnVtYmVyKGFbMV0pIC0gTnVtYmVyKGJbMV0pOwogIGNvbnN0IGRiID0gTnVtYmVyKGFbMl0pIC0gTnVtYmVyKGJbMl0pOwoKICByZXR1cm4gZHIgKiBkciArIGRnICogZGcgKyBkYiAqIGRiOwp9CgpmdW5jdGlvbiBjaHJvbWEoCiAgcmdiCikgewogIHJldHVybiAoCiAgICBNYXRoLm1heCguLi5yZ2IpCiAgICAtIE1hdGgubWluKC4uLnJnYikKICApOwp9CgpmdW5jdGlvbiBkaXJlY3Rpb25Db21wYXRpYmxlKAogIHJnYiwKICB2ZWxvY2l0eQopIHsKICBjb25zdCBbciwgZywgYl0gPSByZ2I7CgogIGlmICh2ZWxvY2l0eSA8IDApIHsKICAgIHJldHVybiAoCiAgICAgIGIgPj0gciArIDQKICAgICAgJiYgYiA+PSBnIC0gMTAKICAgICk7CiAgfQoKICBpZiAodmVsb2NpdHkgPiAwKSB7CiAgICByZXR1cm4gKAogICAgICByID49IGIgKyA4CiAgICAgICYmICgKICAgICAgICByID49IDkwCiAgICAgICAgfHwgZyA+PSA5MAogICAgICApCiAgICApOwogIH0KCiAgcmV0dXJuIGNocm9tYShyZ2IpIDw9IDQ1Owp9CgpleHBvcnQgZnVuY3Rpb24gbmVhcmVzdFBhbGV0dGVNYXRjaCgKICByZ2IsCiAgcGFsZXR0ZSwKICB7CiAgICBleGFjdERpc3RhbmNlID0gMCwKICAgIHJlbGF4ZWREaXN0YW5jZSA9IDI0CiAgfSA9IHt9CikgewogIGxldCBiZXN0ID0gbnVsbDsKCiAgZm9yICgKICAgIGNvbnN0IHN3YXRjaAogICAgb2YgcGFsZXR0ZT8uc3dhdGNoZXMKICAgID8/IFtdCiAgKSB7CiAgICBjb25zdCBkaXN0YW5jZVNxdWFyZWQgPQogICAgICBzcXVhcmVkUmdiRGlzdGFuY2UoCiAgICAgICAgcmdiLAogICAgICAgIHN3YXRjaC5yZ2IKICAgICAgKTsKCiAgICBpZiAoCiAgICAgICFiZXN0CiAgICAgIHx8IGRpc3RhbmNlU3F1YXJlZAogICAgICAgIDwgYmVzdC5kaXN0YW5jZVNxdWFyZWQKICAgICkgewogICAgICBiZXN0ID0gewogICAgICAgIHN3YXRjaCwKICAgICAgICBkaXN0YW5jZVNxdWFyZWQKICAgICAgfTsKICAgIH0KICB9CgogIGlmICghYmVzdCkgewogICAgcmV0dXJuIG51bGw7CiAgfQoKICBjb25zdCBkaXN0YW5jZSA9CiAgICBNYXRoLnNxcnQoCiAgICAgIGJlc3QuZGlzdGFuY2VTcXVhcmVkCiAgICApOwoKICBpZiAoZGlzdGFuY2UgPD0gZXhhY3REaXN0YW5jZSkgewogICAgcmV0dXJuIHsKICAgICAgLi4uYmVzdC5zd2F0Y2gsCiAgICAgIG1hdGNoX2Rpc3RhbmNlOiBkaXN0YW5jZSwKICAgICAgbWF0Y2hfbW9kZTogImV4YWN0IgogICAgfTsKICB9CgogIGlmICgKICAgIGRpc3RhbmNlIDw9IHJlbGF4ZWREaXN0YW5jZQogICAgJiYgZGlyZWN0aW9uQ29tcGF0aWJsZSgKICAgICAgcmdiLAogICAgICBiZXN0LnN3YXRjaC52ZWxvY2l0eV9rbWgKICAgICkKICApIHsKICAgIHJldHVybiB7CiAgICAgIC4uLmJlc3Quc3dhdGNoLAogICAgICBtYXRjaF9kaXN0YW5jZTogZGlzdGFuY2UsCiAgICAgIG1hdGNoX21vZGU6ICJuZWFyIgogICAgfTsKICB9CgogIHJldHVybiBudWxsOwp9CgpleHBvcnQgZnVuY3Rpb24gZ2VvbG9jYXRlZERvcHBsZXJEaXNwbGF5U2FtcGxlcygKICByYWRhcklkLAogIGltYWdlRGF0YSwKICBwYWxldHRlLAogIHsKICAgIGluY2x1ZGVaZXJvID0gZmFsc2UsCiAgICBzdHJpZGUgPSAxLAogICAgcmVsYXhlZERpc3RhbmNlID0gMjQKICB9ID0ge30KKSB7CiAgY29uc3QgbGF5b3V0ID0KICAgIGhpc3RvcmljYWxQYW5lbExheW91dCgKICAgICAgaW1hZ2VEYXRhLndpZHRoLAogICAgICBpbWFnZURhdGEuaGVpZ2h0CiAgICApOwoKICBjb25zdCBzYW1wbGVzID0gW107CgogIGxldCBleGFjdENvdW50ID0gMDsKICBsZXQgbmVhckNvdW50ID0gMDsKCiAgZm9yICgKICAgIGxldCByb3cgPSAwOwogICAgcm93IDwgbGF5b3V0LnBhbmVsU2l6ZTsKICAgIHJvdyArPSBzdHJpZGUKICApIHsKICAgIGZvciAoCiAgICAgIGxldCBjb2x1bW4gPSAwOwogICAgICBjb2x1bW4gPCBsYXlvdXQucGFuZWxTaXplOwogICAgICBjb2x1bW4gKz0gc3RyaWRlCiAgICApIHsKICAgICAgY29uc3QgeCA9IGxheW91dC5wYW5lbFggKyBjb2x1bW47CiAgICAgIGNvbnN0IHkgPSBsYXlvdXQucGFuZWxZICsgcm93OwoKICAgICAgY29uc3Qgb2Zmc2V0ID0KICAgICAgICAoCiAgICAgICAgICB5CiAgICAgICAgICAqIGltYWdlRGF0YS53aWR0aAogICAgICAgICAgKyB4CiAgICAgICAgKQogICAgICAgICogNDsKCiAgICAgIGlmICgKICAgICAgICBpbWFnZURhdGEuZGF0YVsKICAgICAgICAgIG9mZnNldCArIDMKICAgICAgICBdID09PSAwCiAgICAgICkgewogICAgICAgIGNvbnRpbnVlOwogICAgICB9CgogICAgICBjb25zdCByZ2IgPSBbCiAgICAgICAgaW1hZ2VEYXRhLmRhdGFbb2Zmc2V0XSwKICAgICAgICBpbWFnZURhdGEuZGF0YVtvZmZzZXQgKyAxXSwKICAgICAgICBpbWFnZURhdGEuZGF0YVtvZmZzZXQgKyAyXQogICAgICBdOwoKICAgICAgY29uc3QgbWF0Y2ggPQogICAgICAgIG5lYXJlc3RQYWxldHRlTWF0Y2goCiAgICAgICAgICByZ2IsCiAgICAgICAgICBwYWxldHRlLAogICAgICAgICAgewogICAgICAgICAgICByZWxheGVkRGlzdGFuY2UKICAgICAgICAgIH0KICAgICAgICApOwoKICAgICAgaWYgKCFtYXRjaCkgewogICAgICAgIGNvbnRpbnVlOwogICAgICB9CgogICAgICBpZiAoCiAgICAgICAgIWluY2x1ZGVaZXJvCiAgICAgICAgJiYgbWF0Y2gudmVsb2NpdHlfa21oID09PSAwCiAgICAgICkgewogICAgICAgIGNvbnRpbnVlOwogICAgICB9CgogICAgICBjb25zdCBwb3NpdGlvbiA9CiAgICAgICAgZG9wcGxlclBpeGVsQ2VudHJlVG9Mb25MYXQoCiAgICAgICAgICByYWRhcklkLAogICAgICAgICAgY29sdW1uLAogICAgICAgICAgcm93CiAgICAgICAgKTsKCiAgICAgIGlmIChtYXRjaC5tYXRjaF9tb2RlID09PSAiZXhhY3QiKSB7CiAgICAgICAgZXhhY3RDb3VudCsrOwogICAgICB9IGVsc2UgewogICAgICAgIG5lYXJDb3VudCsrOwogICAgICB9CgogICAgICBzYW1wbGVzLnB1c2goewogICAgICAgIGNvbHVtbiwKICAgICAgICByb3csCiAgICAgICAgdmVsb2NpdHlfa21oOiBtYXRjaC52ZWxvY2l0eV9rbWgsCiAgICAgICAgcGFsZXR0ZV9yZ2I6IFsKICAgICAgICAgIG1hdGNoLnJnYlswXSwKICAgICAgICAgIG1hdGNoLnJnYlsxXSwKICAgICAgICAgIG1hdGNoLnJnYlsyXQogICAgICAgIF0sCiAgICAgICAgbWF0Y2hfZGlzdGFuY2U6IG1hdGNoLm1hdGNoX2Rpc3RhbmNlLAogICAgICAgIG1hdGNoX21vZGU6IG1hdGNoLm1hdGNoX21vZGUsCiAgICAgICAgbG9uZ2l0dWRlOiBwb3NpdGlvbi5sb25naXR1ZGUsCiAgICAgICAgbGF0aXR1ZGU6IHBvc2l0aW9uLmxhdGl0dWRlCiAgICAgIH0pOwogICAgfQogIH0KCiAgcmV0dXJuIHsKICAgIHJhZGFySWQ6IFN0cmluZyhyYWRhcklkKSwKICAgIHdpZHRoOiBsYXlvdXQucGFuZWxTaXplLAogICAgaGVpZ2h0OiBsYXlvdXQucGFuZWxTaXplLAogICAgZXhhY3RDb3VudCwKICAgIG5lYXJDb3VudCwKICAgIGRpc3BsYXlQaXhlbENvdW50OiBzYW1wbGVzLmxlbmd0aCwKICAgIHNhbXBsZXMKICB9Owp9Cg==').decode('utf-8')
test_js = base64.b64decode('aW1wb3J0IGFzc2VydCBmcm9tICJub2RlOmFzc2VydC9zdHJpY3QiOwoKaW1wb3J0IHsKICBuZWFyZXN0UGFsZXR0ZU1hdGNoCn0gZnJvbSAiLi4vc3JjL2JvbS1kb3BwbGVyLWRpc3BsYXktdjIuanMiOwoKY29uc3QgcGFsZXR0ZSA9IHsKICBzd2F0Y2hlczogWwogICAgewogICAgICByZ2I6WzQwLDgwLDIwMF0sCiAgICAgIHZlbG9jaXR5X2ttaDotMjAKICAgIH0sCiAgICB7CiAgICAgIHJnYjpbMjM1LDIzNSwyMzVdLAogICAgICB2ZWxvY2l0eV9rbWg6MAogICAgfSwKICAgIHsKICAgICAgcmdiOlsyNDAsMTc1LDM1XSwKICAgICAgdmVsb2NpdHlfa21oOjIwCiAgICB9CiAgXQp9OwoKY29uc3QgZXhhY3QgPQogIG5lYXJlc3RQYWxldHRlTWF0Y2goCiAgICBbNDAsODAsMjAwXSwKICAgIHBhbGV0dGUKICApOwoKYXNzZXJ0LmVxdWFsKAogIGV4YWN0LnZlbG9jaXR5X2ttaCwKICAtMjAKKTsKCmFzc2VydC5lcXVhbCgKICBleGFjdC5tYXRjaF9tb2RlLAogICJleGFjdCIKKTsKCmNvbnN0IG5lYXJCbHVlID0KICBuZWFyZXN0UGFsZXR0ZU1hdGNoKAogICAgWzQ1LDgyLDE5NF0sCiAgICBwYWxldHRlCiAgKTsKCmFzc2VydC5lcXVhbCgKICBuZWFyQmx1ZS52ZWxvY2l0eV9rbWgsCiAgLTIwCik7Cgphc3NlcnQuZXF1YWwoCiAgbmVhckJsdWUubWF0Y2hfbW9kZSwKICAibmVhciIKKTsKCmNvbnN0IG5lYXJXYXJtID0KICBuZWFyZXN0UGFsZXR0ZU1hdGNoKAogICAgWzIzNSwxNzEsNDJdLAogICAgcGFsZXR0ZQogICk7Cgphc3NlcnQuZXF1YWwoCiAgbmVhcldhcm0udmVsb2NpdHlfa21oLAogIDIwCik7Cgpjb25zdCB1bnJlbGF0ZWQgPQogIG5lYXJlc3RQYWxldHRlTWF0Y2goCiAgICBbMTIwLDE4MCwxMjBdLAogICAgcGFsZXR0ZQogICk7Cgphc3NlcnQuZXF1YWwoCiAgdW5yZWxhdGVkLAogIG51bGwKKTsKCmNvbnN0IGZhckJsdWUgPQogIG5lYXJlc3RQYWxldHRlTWF0Y2goCiAgICBbOTAsMTI1LDI1MF0sCiAgICBwYWxldHRlLAogICAgewogICAgICByZWxheGVkRGlzdGFuY2U6MjQKICAgIH0KICApOwoKYXNzZXJ0LmVxdWFsKAogIGZhckJsdWUsCiAgbnVsbAopOwoKY29uc29sZS5sb2coCiAgIjcgRG9wcGxlciBkaXNwbGF5LWNsYXNzaWZpZXIgdGVzdHMgcGFzc2VkLiIKKTsK').decode('utf-8')
OLD_IMPORT = 'import {\n  geolocatedHistoricalDopplerSamples,\n  paletteFromLatestDopplerImage\n} from "./bom-doppler-history-spatial-v1.js?v=history-spatial-v1";'
NEW_IMPORT = 'import {\n  geolocatedHistoricalDopplerSamples,\n  paletteFromLatestDopplerImage\n} from "./bom-doppler-history-spatial-v1.js?v=history-spatial-v1";\n\nimport {\n  geolocatedDopplerDisplaySamples\n} from "./bom-doppler-display-v2.js?v=display-v2";'
OLD_HIST_DECODE = '        const decoded =\n          geolocatedHistoricalDopplerSamples(\n            radarId,\n            canvasImageData(\n              source.canvas\n            ),\n            palette,\n            {\n              stride:\n                1,\n\n              includeZero:\n                false\n            }\n          );\n\n        return {'
NEW_HIST_DECODE = '        const sourceImageData =\n          canvasImageData(\n            source.canvas\n          );\n\n        const decoded =\n          geolocatedHistoricalDopplerSamples(\n            radarId,\n            sourceImageData,\n            palette,\n            {\n              stride:\n                1,\n\n              includeZero:\n                false\n            }\n          );\n\n        const displayDecoded =\n          geolocatedDopplerDisplaySamples(\n            radarId,\n            sourceImageData,\n            palette,\n            {\n              stride:\n                1,\n\n              includeZero:\n                false,\n\n              relaxedDistance:\n                24\n            }\n          );\n\n        return {'
OLD_HIST_RETURN = '          nonZeroPixelCount:\n            decoded.nonZeroPixelCount,\n\n          samples:\n            decoded.samples'
NEW_HIST_RETURN = '          nonZeroPixelCount:\n            decoded.nonZeroPixelCount,\n\n          samples:\n            decoded.samples,\n\n          displayPixelCount:\n            displayDecoded.displayPixelCount,\n\n          displaySamples:\n            displayDecoded.samples'
OLD_LATEST_DECODE = '          const decodedLatest =\n            geolocatedHistoricalDopplerSamples(\n              radarId,\n              latestImageData,\n              palette,\n              {\n                stride:\n                  1,\n\n                includeZero:\n                  false\n              }\n            );\n\n          return {'
NEW_LATEST_DECODE = '          const decodedLatest =\n            geolocatedHistoricalDopplerSamples(\n              radarId,\n              latestImageData,\n              palette,\n              {\n                stride:\n                  1,\n\n                includeZero:\n                  false\n              }\n            );\n\n          const displayLatest =\n            geolocatedDopplerDisplaySamples(\n              radarId,\n              latestImageData,\n              palette,\n              {\n                stride:\n                  1,\n\n                includeZero:\n                  false,\n\n                relaxedDistance:\n                  24\n              }\n            );\n\n          return {'
OLD_LATEST_RETURN = '              nonZeroPixelCount:\n                decodedLatest.nonZeroPixelCount,\n\n              samples:\n                decodedLatest.samples'
NEW_LATEST_RETURN = '              nonZeroPixelCount:\n                decodedLatest.nonZeroPixelCount,\n\n              samples:\n                decodedLatest.samples,\n\n              displayPixelCount:\n                displayLatest.displayPixelCount,\n\n              displaySamples:\n                displayLatest.samples'
OLD_OVERLAY = '  dopplerOverlayCollection =\n    scene.primitives.add(\n      new Cesium\n        .PointPrimitiveCollection()\n    );\n\n  let rendered =\n    0;\n\n  for (\n    const sample\n    of record.samples\n  ) {\n    dopplerOverlayCollection.add({\n      position:\n        Cesium.Cartesian3\n          .fromDegrees(\n            sample.longitude,\n            sample.latitude,\n            180\n          ),\n\n      color:\n        dopplerDisplayColour(\n          sample.velocity_kmh\n        ),\n\n      pixelSize:\n        3,\n\n      disableDepthTestDistance:\n        Number.POSITIVE_INFINITY\n    });\n\n    rendered++;\n  }'
NEW_OVERLAY = '  renderDopplerVelocityLegend(\n    radarId\n  );\n\n  dopplerOverlayCollection =\n    scene.primitives.add(\n      new Cesium\n        .PointPrimitiveCollection()\n    );\n\n  const displaySamples =\n    record.displaySamples\n    ?? record.samples\n    ?? [];\n\n  let rendered =\n    0;\n\n  for (\n    const sample\n    of displaySamples\n  ) {\n    const rgb =\n      sample.palette_rgb;\n\n    const colour =\n      rgb\n        ? Cesium.Color.fromBytes(\n            rgb[0],\n            rgb[1],\n            rgb[2],\n            205\n          )\n        : dopplerDisplayColour(\n            sample.velocity_kmh\n          );\n\n    dopplerOverlayCollection.add({\n      position:\n        Cesium.Cartesian3\n          .fromDegrees(\n            sample.longitude,\n            sample.latitude,\n            180\n          ),\n\n      color:\n        colour,\n\n      pixelSize:\n        4,\n\n      disableDepthTestDistance:\n        Number.POSITIVE_INFINITY\n    });\n\n    rendered++;\n  }'
LEGEND_FUNCTION = 'function renderDopplerVelocityLegend(\n  radarId\n) {\n  const output =\n    $("dopplerVelocityLegend");\n\n  if (!output) {\n    return;\n  }\n\n  const palette =\n    dopplerPalettes\n      .get(\n        String(\n          radarId\n        )\n      );\n\n  if (\n    !palette\n    || !palette.swatches\n      ?.length\n  ) {\n    output.innerHTML =\n      \'<span class="hybrid-muted">Doppler velocity palette unavailable.</span>\';\n\n    return;\n  }\n\n  output.innerHTML =\n    palette.swatches\n      .map(\n        swatch => {\n          const [\n            r,\n            g,\n            b\n          ] =\n            swatch.rgb;\n\n          const label =\n            swatch.velocity_kmh > 0\n              ? `+${swatch.velocity_kmh}`\n              : String(\n                  swatch.velocity_kmh\n                );\n\n          return (\n            `<span style="display:inline-flex;align-items:center;gap:3px;margin:2px 5px 2px 0;white-space:nowrap">` +\n              `<span style="width:10px;height:10px;border:1px solid rgba(255,255,255,.35);background:rgb(${r},${g},${b})"></span>` +\n              `<span>${label}</span>` +\n            `</span>`\n          );\n        }\n      )\n      .join("");\n}\n\n'
OLD_NOTE = '      <div class="uncertainty-note">\n        Doppler is sampled only where exact geolocated non-zero radial-velocity\n        pixels intersect the measured ≥40 dBZ component for an ST track.\n        Toward/away span is calculated within one radar only. Doppler does not\n        create storm identity, move the centroid, or diagnose rotation by itself.\n      </div>'
NEW_NOTE = '      <div class="uncertainty-note">\n        Storm analysis remains conservative: only strict decoded radial-velocity\n        samples intersecting a measured ≥40 dBZ ST footprint contribute to track\n        metrics. The visible overlay uses a separate display decoder so the full\n        low-to-high non-zero Doppler field is not reduced to sparse exact matches.\n      </div>'
OLD_SELECT_END = '      </select>\n\n      <div\n        class="metric"\n        style="margin-top:8px"\n      >'
NEW_SELECT_END = '      </select>\n\n      <div\n        id="dopplerVelocityLegend"\n        style="\n          margin-top:8px;\n          padding:6px;\n          border:1px solid #31424d;\n          border-radius:6px;\n          font-size:9px;\n          line-height:1.25\n        "\n      >\n        <strong style="display:block;margin-bottom:4px">\n          Radial velocity (km/h)\n        </strong>\n        <span class="hybrid-muted">\n          Load/select a Doppler radar to populate the Bureau velocity palette.\n        </span>\n      </div>\n\n      <div\n        class="metric"\n        style="margin-top:8px"\n      >'

def replace_once(text, old, new, label):
    count = text.count(old)

    if count != 1:
        raise SystemExit(
            f"ERROR: expected exactly one {label}, found {count}. "
            "No V8.2 application files were written."
        )

    return text.replace(old, new, 1)

for required in [
    SOURCE_JS,
    SOURCE_HTML,
    SRC / "bom-doppler-history-spatial-v1.js",
    SRC / "bom-doppler-georef-v1.js",
    SRC / "stormtracker-camera-v1.js",
]:
    if not required.exists():
        raise SystemExit(
            f"ERROR: missing required file: {required}"
        )

print("StormTracker — Doppler display fidelity V8.2")
print("Analytical ST Doppler remains strict; visual Doppler becomes full-field.")
print()

js = SOURCE_JS.read_text(encoding="utf-8")
html = SOURCE_HTML.read_text(encoding="utf-8")

js = replace_once(js, OLD_IMPORT, NEW_IMPORT, "display decoder import")
js = replace_once(js, OLD_HIST_DECODE, NEW_HIST_DECODE, "historical display decode")
js = replace_once(js, OLD_HIST_RETURN, NEW_HIST_RETURN, "historical display samples")
js = replace_once(js, OLD_LATEST_DECODE, NEW_LATEST_DECODE, "current display decode")
js = replace_once(js, OLD_LATEST_RETURN, NEW_LATEST_RETURN, "current display samples")

js = replace_once(
    js,
    "function renderDopplerOverlay() {",
    LEGEND_FUNCTION + "function renderDopplerOverlay() {",
    "Doppler legend function insertion"
)

js = replace_once(js, OLD_OVERLAY, NEW_OVERLAY, "full-field Doppler overlay")

html = replace_once(
    html,
    "StormTracker — Hybrid Storm Volume Core V8.1",
    "StormTracker — Hybrid Storm Volume Core V8.2",
    "page title"
)
html = replace_once(html, OLD_NOTE, NEW_NOTE, "Doppler wording")
html = replace_once(html, OLD_SELECT_END, NEW_SELECT_END, "Doppler velocity legend")
html = replace_once(
    html,
    'src="./src/live3d-core-v8-1.js"',
    'src="./src/live3d-core-v8-2.js"',
    "V8.2 script reference"
)

if './stormtracker-camera-v1.js?v=camera-v1.1-wheel' not in js:
    raise SystemExit(
        "ERROR: shared camera controller import changed unexpectedly."
    )

for required_text in [
    "geolocatedDopplerDisplaySamples",
    "displaySamples",
    "dopplerVelocityLegend",
    "Cesium.Color.fromBytes",
]:
    if required_text not in js:
        raise SystemExit(
            f"ERROR: generated V8.2 missing {required_text!r}."
        )

# Validate helper/test in the actual repo shape before writing app files.
with tempfile.TemporaryDirectory() as td:
    td = Path(td)
    (td / "frontend/src").mkdir(parents=True)
    (td / "frontend/tests").mkdir(parents=True)

    (td / "frontend/src/bom-doppler-display-v2.js").write_text(
        helper_js,
        encoding="utf-8"
    )
    (td / "frontend/src/bom-doppler-history-spatial-v1.js").write_text(
        "export function historicalPanelLayout(){return {panelX:0,panelY:0,panelSize:512};}\n",
        encoding="utf-8"
    )
    (td / "frontend/src/bom-doppler-georef-v1.js").write_text(
        "export function dopplerPixelCentreToLonLat(){return {longitude:0,latitude:0};}\n",
        encoding="utf-8"
    )
    (td / "frontend/tests/run-doppler-display-v2-tests.mjs").write_text(
        test_js,
        encoding="utf-8"
    )

    subprocess.run(
        ["node", "--check", str(td / "frontend/src/bom-doppler-display-v2.js")],
        check=True
    )
    subprocess.run(
        ["node", str(td / "frontend/tests/run-doppler-display-v2-tests.mjs")],
        cwd=td,
        check=True
    )

# Validate actual generated V8.2 JavaScript before writing.
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

print("Generated Core V8.2 JavaScript syntax: PASS")

HELPER.write_text(helper_js, encoding="utf-8")
TEST.write_text(test_js, encoding="utf-8")
TARGET_JS.write_text(js, encoding="utf-8")
TARGET_HTML.write_text(html, encoding="utf-8")

subprocess.run(
    ["node", "frontend/tests/run-doppler-display-v2-tests.mjs"],
    cwd=ROOT,
    check=True
)

subprocess.run(
    ["node", "frontend/tests/run-stormtracker-camera-v1-tests.mjs"],
    cwd=ROOT,
    check=True
)

subprocess.run(
    ["node", "frontend/tests/run-node-tests.mjs"],
    cwd=ROOT,
    check=True
)

print()
print("SUCCESS")
print("Expected:")
print("  7 Doppler display-classifier tests passed.")
print("  11 shared camera controller tests passed.")
print("  14 tests passed.")
print()
print("Commit/push:")
print(
    "git add "
    "frontend/src/bom-doppler-display-v2.js "
    "frontend/tests/run-doppler-display-v2-tests.mjs "
    "frontend/src/live3d-core-v8-2.js "
    "frontend/live3d-core-v8-2.html"
)
print(
    'git commit -m "Render full Doppler velocity field and colour scale"'
)
print("git push")
print()
print("Open:")
print(
    "https://blakesmith-intel.github.io/StormTracker/"
    "live3d-core-v8-2.html"
)
