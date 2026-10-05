from pathlib import Path
import base64
import re
import shutil
import subprocess
import tempfile

ROOT = Path("/workspaces/StormTracker")
FRONTEND = ROOT / "frontend"
SRC = FRONTEND / "src"
TESTS = FRONTEND / "tests"
RELAY = ROOT / "relay"

CORE6_JS = SRC / "live3d-core-v6.js"
CORE6_HTML = FRONTEND / "live3d-core-v6.html"
INTAKE1 = SRC / "bom-doppler-intake-v1.js"

CORE7_JS = SRC / "live3d-core-v7.js"
CORE7_HTML = FRONTEND / "live3d-core-v7.html"
INTAKE2 = SRC / "bom-doppler-intake-v2.js"

for required in [
    CORE6_JS,
    CORE6_HTML,
    INTAKE1,
    SRC / "stormtracker-camera-v1.js",
    SRC / "bom-doppler-spatial-v1.js",
    SRC / "track-doppler-context-v1.js",
]:
    if not required.exists():
        raise SystemExit(
            f"ERROR: missing required file: {required}"
        )

RELAY.mkdir(
    parents=True,
    exist_ok=True
)

TESTS.mkdir(
    parents=True,
    exist_ok=True
)

relay_time_js = base64.b64decode(
    "Y29uc3QgTU9OVEhTID0KICBPYmplY3QuZnJlZXplKHsKICAgIEphbjowLAogICAgRmViOjEsCiAgICBNYXI6MiwKICAgIEFwcjozLAogICAgTWF5OjQsCiAgICBKdW46NSwKICAgIEp1bDo2LAogICAgQXVnOjcsCiAgICBTZXA6OCwKICAgIE9jdDo5LAogICAgTm92OjEwLAogICAgRGVjOjExCiAgfSk7CgpleHBvcnQgZnVuY3Rpb24gcGFyc2VCb21SZWNlaXZlZEF0VXRjKAogIGh0bWwKKSB7CiAgY29uc3QgdGV4dCA9CiAgICBTdHJpbmcoCiAgICAgIGh0bWwKICAgICAgPz8gIiIKICAgICkKICAgICAgLnJlcGxhY2UoCiAgICAgICAgLyZuYnNwO3wmIzE2MDsvZ2ksCiAgICAgICAgIiAiCiAgICAgICkKICAgICAgLnJlcGxhY2UoCiAgICAgICAgLzxbXj5dKj4vZywKICAgICAgICAiICIKICAgICAgKQogICAgICAucmVwbGFjZSgKICAgICAgICAvXHMrL2csCiAgICAgICAgIiAiCiAgICAgICkKICAgICAgLnRyaW0oKTsKCiAgY29uc3QgbWF0Y2ggPQogICAgdGV4dC5tYXRjaCgKICAgICAgL1JlY2VpdmVkIGF0OlxzKihcZHsxLDJ9KTooXGR7Mn0pXHMqVVRDXHMqKD86TW9ufFR1ZXxXZWR8VGh1fEZyaXxTYXR8U3VuKVxzKihcZHsxLDJ9KVxzKihKYW58RmVifE1hcnxBcHJ8TWF5fEp1bnxKdWx8QXVnfFNlcHxPY3R8Tm92fERlYylccyooXGR7NH0pL2kKICAgICk7CgogIGlmICghbWF0Y2gpIHsKICAgIHJldHVybiBudWxsOwogIH0KCiAgY29uc3QgWwogICAgLAogICAgaG91clRleHQsCiAgICBtaW51dGVUZXh0LAogICAgZGF5VGV4dCwKICAgIG1vbnRoVGV4dCwKICAgIHllYXJUZXh0CiAgXSA9CiAgICBtYXRjaDsKCiAgY29uc3QgbW9udGhOYW1lID0KICAgIG1vbnRoVGV4dFswXS50b1VwcGVyQ2FzZSgpCiAgICArIG1vbnRoVGV4dAogICAgICAuc2xpY2UoMSkKICAgICAgLnRvTG93ZXJDYXNlKCk7CgogIGNvbnN0IG1vbnRoID0KICAgIE1PTlRIU1sKICAgICAgbW9udGhOYW1lCiAgICBdOwoKICBpZiAoCiAgICBtb250aCA9PSBudWxsCiAgKSB7CiAgICByZXR1cm4gbnVsbDsKICB9CgogIGNvbnN0IHllYXIgPQogICAgTnVtYmVyKAogICAgICB5ZWFyVGV4dAogICAgKTsKCiAgY29uc3QgZGF5ID0KICAgIE51bWJlcigKICAgICAgZGF5VGV4dAogICAgKTsKCiAgY29uc3QgaG91ciA9CiAgICBOdW1iZXIoCiAgICAgIGhvdXJUZXh0CiAgICApOwoKICBjb25zdCBtaW51dGUgPQogICAgTnVtYmVyKAogICAgICBtaW51dGVUZXh0CiAgICApOwoKICBjb25zdCBlcG9jaCA9CiAgICBEYXRlLlVUQygKICAgICAgeWVhciwKICAgICAgbW9udGgsCiAgICAgIGRheSwKICAgICAgaG91ciwKICAgICAgbWludXRlLAogICAgICAwLAogICAgICAwCiAgICApOwoKICBpZiAoCiAgICAhTnVtYmVyLmlzRmluaXRlKAogICAgICBlcG9jaAogICAgKQogICkgewogICAgcmV0dXJuIG51bGw7CiAgfQoKICBjb25zdCBkYXRlID0KICAgIG5ldyBEYXRlKAogICAgICBlcG9jaAogICAgKTsKCiAgaWYgKAogICAgZGF0ZS5nZXRVVENGdWxsWWVhcigpCiAgICAgICE9PSB5ZWFyCiAgICB8fCBkYXRlLmdldFVUQ01vbnRoKCkKICAgICAgIT09IG1vbnRoCiAgICB8fCBkYXRlLmdldFVUQ0RhdGUoKQogICAgICAhPT0gZGF5CiAgICB8fCBkYXRlLmdldFVUQ0hvdXJzKCkKICAgICAgIT09IGhvdXIKICAgIHx8IGRhdGUuZ2V0VVRDTWludXRlcygpCiAgICAgICE9PSBtaW51dGUKICApIHsKICAgIHJldHVybiBudWxsOwogIH0KCiAgcmV0dXJuIGRhdGUKICAgIC50b0lTT1N0cmluZygpOwp9Cg=="
).decode("utf-8")

relay_worker_js = base64.b64decode(
    "aW1wb3J0IHsKICBwYXJzZUJvbVJlY2VpdmVkQXRVdGMKfSBmcm9tICIuL2RvcHBsZXItdGltZS12MS5qcyI7Cgpjb25zdCBCT01fV01UUyA9CiAgImh0dHBzOi8vYXBpLmJvbS5nb3YuYXUvYXBpa2V5L3YxL21hcHBpbmcvdGltZXNlcmllcy93bXRzIjsKCmNvbnN0IEJPTV9SQURBUl9CQVNFID0KICAiaHR0cHM6Ly93d3cuYm9tLmdvdi5hdS9yYWRhci8iOwoKY29uc3QgQk9NX1BST0RVQ1RfQkFTRSA9CiAgImh0dHBzOi8vd3d3LmJvbS5nb3YuYXUvcHJvZHVjdHMvIjsKCmNvbnN0IEFMTE9XRURfT1JJR0lOUyA9IG5ldyBTZXQoWwogICJodHRwczovL2JsYWtlc21pdGgtaW50ZWwuZ2l0aHViLmlvIiwKXSk7Cgpjb25zdCBBTExPV0VEX0xBWUVSUyA9IG5ldyBTZXQoWwogICJhdG1fc3VyZl9haXJfcHJlY2lwX3JlZmxlY3Rpdml0eV9kYnoiLApdKTsKCmNvbnN0IEFMTE9XRURfRE9QUExFUl9QUk9EVUNUUyA9IG5ldyBTZXQoWwogICJJRFIwOEkiLAogICJJRFI1MEkiLAogICJJRFI2NkkiLApdKTsKCmNvbnN0IEFMTE9XRURfUEFSQU1TID0gbmV3IFNldChbCiAgIlNFUlZJQ0UiLAogICJSRVFVRVNUIiwKICAiVkVSU0lPTiIsCiAgIkxBWUVSIiwKICAiU1RZTEUiLAogICJGT1JNQVQiLAogICJUSUxFTUFUUklYU0VUIiwKICAiVElMRU1BVFJJWCIsCiAgIlRJTEVST1ciLAogICJUSUxFQ09MIiwKICAidGltZSIsCl0pOwoKZnVuY3Rpb24gY29yc0hlYWRlcnMoCiAgb3JpZ2luCikgewogIGNvbnN0IGhlYWRlcnMgPQogICAgbmV3IEhlYWRlcnMoKTsKCiAgaWYgKAogICAgQUxMT1dFRF9PUklHSU5TCiAgICAgIC5oYXMoCiAgICAgICAgb3JpZ2luCiAgICAgICkKICApIHsKICAgIGhlYWRlcnMuc2V0KAogICAgICAiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luIiwKICAgICAgb3JpZ2luCiAgICApOwoKICAgIGhlYWRlcnMuc2V0KAogICAgICAiVmFyeSIsCiAgICAgICJPcmlnaW4iCiAgICApOwogIH0KCiAgaGVhZGVycy5zZXQoCiAgICAiQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyIsCiAgICAiR0VULEhFQUQsT1BUSU9OUyIKICApOwoKICBoZWFkZXJzLnNldCgKICAgICJBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzIiwKICAgICJDb250ZW50LVR5cGUiCiAgKTsKCiAgaGVhZGVycy5zZXQoCiAgICAiQWNjZXNzLUNvbnRyb2wtRXhwb3NlLUhlYWRlcnMiLAogICAgWwogICAgICAiQ29udGVudC1UeXBlIiwKICAgICAgIkxhc3QtTW9kaWZpZWQiLAogICAgICAiRVRhZyIsCiAgICAgICJYLVN0b3JtVHJhY2tlci1Qcm9kdWN0IiwKICAgICAgIlgtU3Rvcm1UcmFja2VyLU9ic2VydmVkLVVUQyIsCiAgICAgICJYLVN0b3JtVHJhY2tlci1UaW1lLVNvdXJjZSIKICAgIF0uam9pbigiLCIpCiAgKTsKCiAgaGVhZGVycy5zZXQoCiAgICAiQWNjZXNzLUNvbnRyb2wtTWF4LUFnZSIsCiAgICAiODY0MDAiCiAgKTsKCiAgcmV0dXJuIGhlYWRlcnM7Cn0KCmZ1bmN0aW9uIGVycm9yUmVzcG9uc2UoCiAgbWVzc2FnZSwKICBzdGF0dXMsCiAgb3JpZ2luCikgewogIGNvbnN0IGhlYWRlcnMgPQogICAgY29yc0hlYWRlcnMoCiAgICAgIG9yaWdpbgogICAgKTsKCiAgaGVhZGVycy5zZXQoCiAgICAiQ29udGVudC1UeXBlIiwKICAgICJ0ZXh0L3BsYWluOyBjaGFyc2V0PXV0Zi04IgogICk7CgogIGhlYWRlcnMuc2V0KAogICAgIkNhY2hlLUNvbnRyb2wiLAogICAgIm5vLXN0b3JlIgogICk7CgogIHJldHVybiBuZXcgUmVzcG9uc2UoCiAgICBtZXNzYWdlLAogICAgewogICAgICBzdGF0dXMsCiAgICAgIGhlYWRlcnMKICAgIH0KICApOwp9Cgphc3luYyBmdW5jdGlvbiByZWxheVdtdHMoCiAgcmVxdWVzdCwKICBpbmNvbWluZywKICBvcmlnaW4KKSB7CiAgY29uc3QgbGF5ZXIgPQogICAgaW5jb21pbmcuc2VhcmNoUGFyYW1zCiAgICAgIC5nZXQoCiAgICAgICAgIkxBWUVSIgogICAgICApOwoKICBpZiAoCiAgICAhQUxMT1dFRF9MQVlFUlMKICAgICAgLmhhcygKICAgICAgICBsYXllcgogICAgICApCiAgKSB7CiAgICByZXR1cm4gZXJyb3JSZXNwb25zZSgKICAgICAgIkxheWVyIG5vdCBhbGxvd2VkIiwKICAgICAgNDAzLAogICAgICBvcmlnaW4KICAgICk7CiAgfQoKICBjb25zdCB0YXJnZXQgPQogICAgbmV3IFVSTCgKICAgICAgQk9NX1dNVFMKICAgICk7CgogIGZvciAoCiAgICBjb25zdCBbCiAgICAgIGtleSwKICAgICAgdmFsdWUKICAgIF0KICAgIG9mIGluY29taW5nCiAgICAgIC5zZWFyY2hQYXJhbXMKICAgICAgLmVudHJpZXMoKQogICkgewogICAgaWYgKAogICAgICBBTExPV0VEX1BBUkFNUwogICAgICAgIC5oYXMoCiAgICAgICAgICBrZXkKICAgICAgICApCiAgICApIHsKICAgICAgdGFyZ2V0LnNlYXJjaFBhcmFtcwogICAgICAgIC5hcHBlbmQoCiAgICAgICAgICBrZXksCiAgICAgICAgICB2YWx1ZQogICAgICAgICk7CiAgICB9CiAgfQoKICBsZXQgdXBzdHJlYW07CgogIHRyeSB7CiAgICB1cHN0cmVhbSA9CiAgICAgIGF3YWl0IGZldGNoKAogICAgICAgIHRhcmdldC50b1N0cmluZygpLAogICAgICAgIHsKICAgICAgICAgIG1ldGhvZDoKICAgICAgICAgICAgcmVxdWVzdC5tZXRob2QsCgogICAgICAgICAgaGVhZGVyczogewogICAgICAgICAgICBBY2NlcHQ6CiAgICAgICAgICAgICAgImltYWdlL3BuZyIsCiAgICAgICAgICB9LAoKICAgICAgICAgIGNmOiB7CiAgICAgICAgICAgIGNhY2hlRXZlcnl0aGluZzoKICAgICAgICAgICAgICB0cnVlLAoKICAgICAgICAgICAgY2FjaGVUdGw6CiAgICAgICAgICAgICAgMzAwLAogICAgICAgICAgfSwKICAgICAgICB9CiAgICAgICk7CiAgfSBjYXRjaCAoZXJyb3IpIHsKICAgIHJldHVybiBlcnJvclJlc3BvbnNlKAogICAgICBgQk9NIFdNVFMgZmV0Y2ggZmFpbGVkOiAkewogICAgICAgIGVycm9yPy5tZXNzYWdlCiAgICAgICAgfHwgU3RyaW5nKAogICAgICAgICAgZXJyb3IKICAgICAgICApCiAgICAgIH1gLAogICAgICA1MDIsCiAgICAgIG9yaWdpbgogICAgKTsKICB9CgogIGNvbnN0IGhlYWRlcnMgPQogICAgbmV3IEhlYWRlcnMoCiAgICAgIHVwc3RyZWFtLmhlYWRlcnMKICAgICk7CgogIGNvbnN0IGNvcnMgPQogICAgY29yc0hlYWRlcnMoCiAgICAgIG9yaWdpbgogICAgKTsKCiAgZm9yICgKICAgIGNvbnN0IFsKICAgICAga2V5LAogICAgICB2YWx1ZQogICAgXQogICAgb2YgY29ycy5lbnRyaWVzKCkKICApIHsKICAgIGhlYWRlcnMuc2V0KAogICAgICBrZXksCiAgICAgIHZhbHVlCiAgICApOwogIH0KCiAgaGVhZGVycy5zZXQoCiAgICAiQ3Jvc3MtT3JpZ2luLVJlc291cmNlLVBvbGljeSIsCiAgICAiY3Jvc3Mtb3JpZ2luIgogICk7CgogIGhlYWRlcnMuc2V0KAogICAgIkNhY2hlLUNvbnRyb2wiLAogICAgInB1YmxpYywgbWF4LWFnZT0zMDAiCiAgKTsKCiAgcmV0dXJuIG5ldyBSZXNwb25zZSgKICAgIHVwc3RyZWFtLmJvZHksCiAgICB7CiAgICAgIHN0YXR1czoKICAgICAgICB1cHN0cmVhbS5zdGF0dXMsCgogICAgICBzdGF0dXNUZXh0OgogICAgICAgIHVwc3RyZWFtLnN0YXR1c1RleHQsCgogICAgICBoZWFkZXJzCiAgICB9CiAgKTsKfQoKYXN5bmMgZnVuY3Rpb24gZmV0Y2hEb3BwbGVyT2JzZXJ2ZWRVdGMoCiAgcHJvZHVjdAopIHsKICBjb25zdCB0YXJnZXQgPQogICAgbmV3IFVSTCgKICAgICAgYCR7cHJvZHVjdH0uc2h0bWxgLAogICAgICBCT01fUFJPRFVDVF9CQVNFCiAgICApOwoKICBjb25zdCByZXNwb25zZSA9CiAgICBhd2FpdCBmZXRjaCgKICAgICAgdGFyZ2V0LnRvU3RyaW5nKCksCiAgICAgIHsKICAgICAgICBtZXRob2Q6CiAgICAgICAgICAiR0VUIiwKCiAgICAgICAgaGVhZGVyczogewogICAgICAgICAgQWNjZXB0OgogICAgICAgICAgICAidGV4dC9odG1sIgogICAgICAgIH0sCgogICAgICAgIGNmOiB7CiAgICAgICAgICBjYWNoZUV2ZXJ5dGhpbmc6CiAgICAgICAgICAgIHRydWUsCgogICAgICAgICAgY2FjaGVUdGw6CiAgICAgICAgICAgIDMwCiAgICAgICAgfQogICAgICB9CiAgICApOwoKICBpZiAoCiAgICAhcmVzcG9uc2Uub2sKICApIHsKICAgIHRocm93IG5ldyBFcnJvcigKICAgICAgYEJPTSBEb3BwbGVyIHByb2R1Y3QgcGFnZSBIVFRQICR7cmVzcG9uc2Uuc3RhdHVzfWAKICAgICk7CiAgfQoKICBjb25zdCBodG1sID0KICAgIGF3YWl0IHJlc3BvbnNlLnRleHQoKTsKCiAgY29uc3Qgb2JzZXJ2ZWRVdGMgPQogICAgcGFyc2VCb21SZWNlaXZlZEF0VXRjKAogICAgICBodG1sCiAgICApOwoKICBpZiAoCiAgICAhb2JzZXJ2ZWRVdGMKICApIHsKICAgIHRocm93IG5ldyBFcnJvcigKICAgICAgIkJPTSBEb3BwbGVyIHByb2R1Y3QgcGFnZSBkaWQgbm90IGNvbnRhaW4gYSBwYXJzZWFibGUgUmVjZWl2ZWQgYXQgVVRDIHRpbWVzdGFtcC4iCiAgICApOwogIH0KCiAgcmV0dXJuIG9ic2VydmVkVXRjOwp9Cgphc3luYyBmdW5jdGlvbiByZWxheURvcHBsZXIoCiAgcmVxdWVzdCwKICBpbmNvbWluZywKICBvcmlnaW4KKSB7CiAgY29uc3QgcHJvZHVjdCA9CiAgICBTdHJpbmcoCiAgICAgIGluY29taW5nCiAgICAgICAgLnNlYXJjaFBhcmFtcwogICAgICAgIC5nZXQoCiAgICAgICAgICAicHJvZHVjdCIKICAgICAgICApCiAgICAgIHx8ICIiCiAgICApCiAgICAgIC50b1VwcGVyQ2FzZSgpOwoKICBpZiAoCiAgICAhQUxMT1dFRF9ET1BQTEVSX1BST0RVQ1RTCiAgICAgIC5oYXMoCiAgICAgICAgcHJvZHVjdAogICAgICApCiAgKSB7CiAgICByZXR1cm4gZXJyb3JSZXNwb25zZSgKICAgICAgIkRvcHBsZXIgcHJvZHVjdCBub3QgYWxsb3dlZCIsCiAgICAgIDQwMywKICAgICAgb3JpZ2luCiAgICApOwogIH0KCiAgY29uc3QgaW1hZ2VUYXJnZXQgPQogICAgbmV3IFVSTCgKICAgICAgYCR7cHJvZHVjdH0uZ2lmYCwKICAgICAgQk9NX1JBREFSX0JBU0UKICAgICk7CgogIGNvbnN0IGltYWdlUHJvbWlzZSA9CiAgICBmZXRjaCgKICAgICAgaW1hZ2VUYXJnZXQudG9TdHJpbmcoKSwKICAgICAgewogICAgICAgIG1ldGhvZDoKICAgICAgICAgIHJlcXVlc3QubWV0aG9kLAoKICAgICAgICBoZWFkZXJzOiB7CiAgICAgICAgICBBY2NlcHQ6CiAgICAgICAgICAgICJpbWFnZS9naWYsaW1hZ2UvKiIsCiAgICAgICAgfSwKCiAgICAgICAgY2Y6IHsKICAgICAgICAgIGNhY2hlRXZlcnl0aGluZzoKICAgICAgICAgICAgdHJ1ZSwKCiAgICAgICAgICBjYWNoZVR0bDoKICAgICAgICAgICAgNjAsCiAgICAgICAgfSwKICAgICAgfQogICAgKTsKCiAgY29uc3QgbWV0YWRhdGFQcm9taXNlID0KICAgIGZldGNoRG9wcGxlck9ic2VydmVkVXRjKAogICAgICBwcm9kdWN0CiAgICApOwoKICBjb25zdCBbCiAgICBpbWFnZVJlc3VsdCwKICAgIG1ldGFkYXRhUmVzdWx0CiAgXSA9CiAgICBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoWwogICAgICBpbWFnZVByb21pc2UsCiAgICAgIG1ldGFkYXRhUHJvbWlzZQogICAgXSk7CgogIGlmICgKICAgIGltYWdlUmVzdWx0LnN0YXR1cwogICAgIT09ICJmdWxmaWxsZWQiCiAgKSB7CiAgICByZXR1cm4gZXJyb3JSZXNwb25zZSgKICAgICAgYEJPTSBEb3BwbGVyIGZldGNoIGZhaWxlZDogJHsKICAgICAgICBpbWFnZVJlc3VsdC5yZWFzb24/Lm1lc3NhZ2UKICAgICAgICB8fCBTdHJpbmcoCiAgICAgICAgICBpbWFnZVJlc3VsdC5yZWFzb24KICAgICAgICApCiAgICAgIH1gLAogICAgICA1MDIsCiAgICAgIG9yaWdpbgogICAgKTsKICB9CgogIGNvbnN0IHVwc3RyZWFtID0KICAgIGltYWdlUmVzdWx0LnZhbHVlOwoKICBjb25zdCBvYnNlcnZlZFV0YyA9CiAgICBtZXRhZGF0YVJlc3VsdC5zdGF0dXMKICAgID09PSAiZnVsZmlsbGVkIgogICAgICA/IG1ldGFkYXRhUmVzdWx0LnZhbHVlCiAgICAgIDogbnVsbDsKCiAgY29uc3QgaGVhZGVycyA9CiAgICBuZXcgSGVhZGVycygKICAgICAgdXBzdHJlYW0uaGVhZGVycwogICAgKTsKCiAgY29uc3QgY29ycyA9CiAgICBjb3JzSGVhZGVycygKICAgICAgb3JpZ2luCiAgICApOwoKICBmb3IgKAogICAgY29uc3QgWwogICAgICBrZXksCiAgICAgIHZhbHVlCiAgICBdCiAgICBvZiBjb3JzLmVudHJpZXMoKQogICkgewogICAgaGVhZGVycy5zZXQoCiAgICAgIGtleSwKICAgICAgdmFsdWUKICAgICk7CiAgfQoKICBoZWFkZXJzLnNldCgKICAgICJDcm9zcy1PcmlnaW4tUmVzb3VyY2UtUG9saWN5IiwKICAgICJjcm9zcy1vcmlnaW4iCiAgKTsKCiAgaGVhZGVycy5zZXQoCiAgICAiQ2FjaGUtQ29udHJvbCIsCiAgICAicHVibGljLCBtYXgtYWdlPTYwIgogICk7CgogIGhlYWRlcnMuc2V0KAogICAgIlgtU3Rvcm1UcmFja2VyLVByb2R1Y3QiLAogICAgcHJvZHVjdAogICk7CgogIGlmICgKICAgIG9ic2VydmVkVXRjCiAgKSB7CiAgICBoZWFkZXJzLnNldCgKICAgICAgIlgtU3Rvcm1UcmFja2VyLU9ic2VydmVkLVVUQyIsCiAgICAgIG9ic2VydmVkVXRjCiAgICApOwoKICAgIGhlYWRlcnMuc2V0KAogICAgICAiWC1TdG9ybVRyYWNrZXItVGltZS1Tb3VyY2UiLAogICAgICAiYm9tLXByb2R1Y3QtcGFnZS1yZWNlaXZlZC1hdCIKICAgICk7CiAgfQoKICByZXR1cm4gbmV3IFJlc3BvbnNlKAogICAgdXBzdHJlYW0uYm9keSwKICAgIHsKICAgICAgc3RhdHVzOgogICAgICAgIHVwc3RyZWFtLnN0YXR1cywKCiAgICAgIHN0YXR1c1RleHQ6CiAgICAgICAgdXBzdHJlYW0uc3RhdHVzVGV4dCwKCiAgICAgIGhlYWRlcnMKICAgIH0KICApOwp9CgpleHBvcnQgZGVmYXVsdCB7CiAgYXN5bmMgZmV0Y2goCiAgICByZXF1ZXN0CiAgKSB7CiAgICBjb25zdCBpbmNvbWluZyA9CiAgICAgIG5ldyBVUkwoCiAgICAgICAgcmVxdWVzdC51cmwKICAgICAgKTsKCiAgICBjb25zdCBvcmlnaW4gPQogICAgICByZXF1ZXN0LmhlYWRlcnMKICAgICAgICAuZ2V0KAogICAgICAgICAgIk9yaWdpbiIKICAgICAgICApCiAgICAgIHx8ICIiOwoKICAgIGlmICgKICAgICAgcmVxdWVzdC5tZXRob2QKICAgICAgPT09ICJPUFRJT05TIgogICAgKSB7CiAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UoCiAgICAgICAgbnVsbCwKICAgICAgICB7CiAgICAgICAgICBzdGF0dXM6CiAgICAgICAgICAgIDIwNCwKCiAgICAgICAgICBoZWFkZXJzOgogICAgICAgICAgICBjb3JzSGVhZGVycygKICAgICAgICAgICAgICBvcmlnaW4KICAgICAgICAgICAgKSwKICAgICAgICB9CiAgICAgICk7CiAgICB9CgogICAgaWYgKAogICAgICByZXF1ZXN0Lm1ldGhvZAogICAgICAhPT0gIkdFVCIKICAgICAgJiYgcmVxdWVzdC5tZXRob2QKICAgICAgICAhPT0gIkhFQUQiCiAgICApIHsKICAgICAgcmV0dXJuIGVycm9yUmVzcG9uc2UoCiAgICAgICAgIk1ldGhvZCBub3QgYWxsb3dlZCIsCiAgICAgICAgNDA1LAogICAgICAgIG9yaWdpbgogICAgICApOwogICAgfQoKICAgIGlmICgKICAgICAgb3JpZ2luCiAgICAgICYmICFBTExPV0VEX09SSUdJTlMKICAgICAgICAuaGFzKAogICAgICAgICAgb3JpZ2luCiAgICAgICAgKQogICAgKSB7CiAgICAgIHJldHVybiBlcnJvclJlc3BvbnNlKAogICAgICAgICJPcmlnaW4gbm90IGFsbG93ZWQiLAogICAgICAgIDQwMywKICAgICAgICBvcmlnaW4KICAgICAgKTsKICAgIH0KCiAgICBpZiAoCiAgICAgIGluY29taW5nLnBhdGhuYW1lCiAgICAgID09PSAiL3dtdHMiCiAgICApIHsKICAgICAgcmV0dXJuIHJlbGF5V210cygKICAgICAgICByZXF1ZXN0LAogICAgICAgIGluY29taW5nLAogICAgICAgIG9yaWdpbgogICAgICApOwogICAgfQoKICAgIGlmICgKICAgICAgaW5jb21pbmcucGF0aG5hbWUKICAgICAgPT09ICIvcmFkYXIiCiAgICApIHsKICAgICAgcmV0dXJuIHJlbGF5RG9wcGxlcigKICAgICAgICByZXF1ZXN0LAogICAgICAgIGluY29taW5nLAogICAgICAgIG9yaWdpbgogICAgICApOwogICAgfQoKICAgIHJldHVybiBlcnJvclJlc3BvbnNlKAogICAgICAiTm90IGZvdW5kIiwKICAgICAgNDA0LAogICAgICBvcmlnaW4KICAgICk7CiAgfSwKfTsK"
).decode("utf-8")

doppler_helpers_js = base64.b64decode(
    "ZnVuY3Rpb24gZG9wcGxlckRpc3BsYXlDb2xvdXIoCiAgdmVsb2NpdHkKKSB7CiAgY29uc3QgdmFsdWUgPQogICAgTnVtYmVyKAogICAgICB2ZWxvY2l0eQogICAgKTsKCiAgaWYgKAogICAgdmFsdWUgPCAwCiAgKSB7CiAgICBjb25zdCBzdHJlbmd0aCA9CiAgICAgIE1hdGgubWluKAogICAgICAgIDEsCiAgICAgICAgTWF0aC5hYnMoCiAgICAgICAgICB2YWx1ZQogICAgICAgICkgLyA3MAogICAgICApOwoKICAgIHJldHVybiBDZXNpdW0uQ29sb3IKICAgICAgLmZyb21Ic2woCiAgICAgICAgMC41NiwKICAgICAgICAwLjk1LAogICAgICAgIDAuNzIKICAgICAgICAgIC0gc3RyZW5ndGgKICAgICAgICAgICAgKiAwLjMyLAogICAgICAgIDAuNzgKICAgICAgKTsKICB9CgogIGNvbnN0IHN0cmVuZ3RoID0KICAgIE1hdGgubWluKAogICAgICAxLAogICAgICB2YWx1ZSAvIDcwCiAgICApOwoKICByZXR1cm4gQ2VzaXVtLkNvbG9yCiAgICAuZnJvbUhzbCgKICAgICAgMC4xMwogICAgICAgIC0gc3RyZW5ndGgKICAgICAgICAgICogMC4xMiwKICAgICAgMC45NSwKICAgICAgMC42MgogICAgICAgIC0gc3RyZW5ndGgKICAgICAgICAgICogMC4xOCwKICAgICAgMC43OAogICAgKTsKfQoKZnVuY3Rpb24gY2xlYXJEb3BwbGVyT3ZlcmxheSgpIHsKICBpZiAoCiAgICBkb3BwbGVyT3ZlcmxheUNvbGxlY3Rpb24KICApIHsKICAgIHNjZW5lLnByaW1pdGl2ZXMucmVtb3ZlKAogICAgICBkb3BwbGVyT3ZlcmxheUNvbGxlY3Rpb24KICAgICk7CgogICAgZG9wcGxlck92ZXJsYXlDb2xsZWN0aW9uID0KICAgICAgbnVsbDsKICB9CgogIGNvbnN0IGNvdW50ID0KICAgICQoImRvcHBsZXJPdmVybGF5Q291bnQiKTsKCiAgaWYgKGNvdW50KSB7CiAgICBjb3VudC50ZXh0Q29udGVudCA9CiAgICAgICIwIjsKICB9Cn0KCmZ1bmN0aW9uIHNlbGVjdGVkRG9wcGxlclJlY29yZCgpIHsKICBjb25zdCByYWRhcklkID0KICAgICQoImRvcHBsZXJPdmVybGF5UmFkYXIiKQogICAgICA/LnZhbHVlCiAgICA/PyAiNjYiOwoKICByZXR1cm4gKAogICAgbGF0ZXN0RG9wcGxlclJlY29yZHMKICAgICAgLmZpbmQoCiAgICAgICAgcmVjb3JkID0+CiAgICAgICAgICByZWNvcmQucmFkYXJJZAogICAgICAgICAgPT09IHJhZGFySWQKICAgICAgKQogICAgPz8gbnVsbAogICk7Cn0KCmZ1bmN0aW9uIHJlbmRlckRvcHBsZXJPdmVybGF5KCkgewogIGNsZWFyRG9wcGxlck92ZXJsYXkoKTsKCiAgY29uc3Qgc3RhdHVzID0KICAgICQoImRvcHBsZXJPdmVybGF5U3RhdHVzIik7CgogIGlmICgKICAgICEkKCJzaG93RG9wcGxlck92ZXJsYXkiKQogICAgICA/LmNoZWNrZWQKICApIHsKICAgIGlmIChzdGF0dXMpIHsKICAgICAgc3RhdHVzLnRleHRDb250ZW50ID0KICAgICAgICAiaGlkZGVuIjsKICAgIH0KCiAgICByZXR1cm47CiAgfQoKICBpZiAoCiAgICAhaHlicmlkRnJhbWVzLmxlbmd0aAogICAgfHwgaHlicmlkRnJhbWVJbmRleAogICAgICAhPT0gaHlicmlkRnJhbWVzLmxlbmd0aCAtIDEKICApIHsKICAgIGlmIChzdGF0dXMpIHsKICAgICAgc3RhdHVzLnRleHRDb250ZW50ID0KICAgICAgICAibGF0ZXN0IHNlcXVlbmNlIGZyYW1lIG9ubHkiOwogICAgfQoKICAgIHJldHVybjsKICB9CgogIGNvbnN0IHJlY29yZCA9CiAgICBzZWxlY3RlZERvcHBsZXJSZWNvcmQoKTsKCiAgaWYgKCFyZWNvcmQpIHsKICAgIGlmIChzdGF0dXMpIHsKICAgICAgc3RhdHVzLnRleHRDb250ZW50ID0KICAgICAgICAic2VsZWN0ZWQgcmFkYXIgdW5hdmFpbGFibGUiOwogICAgfQoKICAgIHJldHVybjsKICB9CgogIGRvcHBsZXJPdmVybGF5Q29sbGVjdGlvbiA9CiAgICBzY2VuZS5wcmltaXRpdmVzLmFkZCgKICAgICAgbmV3IENlc2l1bQogICAgICAgIC5Qb2ludFByaW1pdGl2ZUNvbGxlY3Rpb24oKQogICAgKTsKCiAgbGV0IHJlbmRlcmVkID0KICAgIDA7CgogIGZvciAoCiAgICBjb25zdCBzYW1wbGUKICAgIG9mIHJlY29yZC5zYW1wbGVzCiAgKSB7CiAgICBkb3BwbGVyT3ZlcmxheUNvbGxlY3Rpb24uYWRkKHsKICAgICAgcG9zaXRpb246CiAgICAgICAgQ2VzaXVtLkNhcnRlc2lhbjMKICAgICAgICAgIC5mcm9tRGVncmVlcygKICAgICAgICAgICAgc2FtcGxlLmxvbmdpdHVkZSwKICAgICAgICAgICAgc2FtcGxlLmxhdGl0dWRlLAogICAgICAgICAgICAxODAKICAgICAgICAgICksCgogICAgICBjb2xvcjoKICAgICAgICBkb3BwbGVyRGlzcGxheUNvbG91cigKICAgICAgICAgIHNhbXBsZS52ZWxvY2l0eV9rbWgKICAgICAgICApLAoKICAgICAgcGl4ZWxTaXplOgogICAgICAgIDMsCgogICAgICBkaXNhYmxlRGVwdGhUZXN0RGlzdGFuY2U6CiAgICAgICAgTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZCiAgICB9KTsKCiAgICByZW5kZXJlZCsrOwogIH0KCiAgJCgiZG9wcGxlck92ZXJsYXlDb3VudCIpCiAgICAudGV4dENvbnRlbnQgPQogICAgICByZW5kZXJlZAogICAgICAgIC50b0xvY2FsZVN0cmluZygpOwoKICBpZiAoc3RhdHVzKSB7CiAgICBzdGF0dXMudGV4dENvbnRlbnQgPQogICAgICBgJHtyZWNvcmQucmFkYXJJZH0gbm9uLXplcm8gZXhhY3QtcGFsZXR0ZSByYWRpYWwgdmVsb2NpdHlgOwogIH0KCiAgc2NlbmUucmVxdWVzdFJlbmRlcigpOwp9CgpmdW5jdGlvbiBmb3JtYXREb3BwbGVyVXRjKAogIHZhbHVlCikgewogIGlmICghdmFsdWUpIHsKICAgIHJldHVybiAidGltZXN0YW1wIHVuYXZhaWxhYmxlIjsKICB9CgogIHJldHVybiB2YWx1ZQogICAgLnJlcGxhY2UoCiAgICAgICJUIiwKICAgICAgIiAiCiAgICApCiAgICAucmVwbGFjZSgKICAgICAgIjowMC4wMDBaIiwKICAgICAgIiBVVEMiCiAgICApCiAgICAucmVwbGFjZSgKICAgICAgIi4wMDBaIiwKICAgICAgIiBVVEMiCiAgICApOwp9CgpmdW5jdGlvbiByZW5kZXJEb3BwbGVyU291cmNlUm93cygpIHsKICBjb25zdCBvdXRwdXQgPQogICAgJCgiZG9wcGxlclNvdXJjZVJvd3MiKTsKCiAgaWYgKAogICAgIW91dHB1dAogICkgewogICAgcmV0dXJuOwogIH0KCiAgY29uc3Qgcm93cyA9CiAgICBoeWJyaWREb3BwbGVyQ29udGV4dAogICAgICA/LnNvdXJjZVN0YXR1cwogICAgICA/PyBbXTsKCiAgaWYgKAogICAgIXJvd3MubGVuZ3RoCiAgKSB7CiAgICBvdXRwdXQuaW5uZXJIVE1MID0KICAgICAgJzxkaXYgY2xhc3M9Imh5YnJpZC1tdXRlZCI+Tm8gRG9wcGxlciBzb3VyY2UgbWV0YWRhdGEgYXZhaWxhYmxlLjwvZGl2Pic7CgogICAgcmV0dXJuOwogIH0KCiAgb3V0cHV0LmlubmVySFRNTCA9CiAgICByb3dzCiAgICAgIC5tYXAoCiAgICAgICAgc291cmNlID0+IHsKICAgICAgICAgIGNvbnN0IGRlbHRhID0KICAgICAgICAgICAgc291cmNlCiAgICAgICAgICAgICAgLnRpbWVfZGVsdGFfbWludXRlczsKCiAgICAgICAgICBjb25zdCBkZWx0YVRleHQgPQogICAgICAgICAgICBkZWx0YSA9PSBudWxsCiAgICAgICAgICAgICAgPyAiZGVsdGEg4oCUIgogICAgICAgICAgICAgIDogYM6UJHtkZWx0YS50b0ZpeGVkKDEpfSBtaW5gOwoKICAgICAgICAgIGNvbnN0IG1hdGNoID0KICAgICAgICAgICAgc291cmNlLnRpbWVfbWF0Y2hlZAogICAgICAgICAgICAgID8gIk1BVENIIgogICAgICAgICAgICAgIDogIk5PIE1BVENIIjsKCiAgICAgICAgICByZXR1cm4gKAogICAgICAgICAgICBgPGRpdiBjbGFzcz0idHJhY2stdm9sdW1lLXJvdyI+YCArCiAgICAgICAgICAgICAgYDxkaXY+YCArCiAgICAgICAgICAgICAgICBgPHN0cm9uZz5SYWRhciAke3NvdXJjZS5yYWRhcl9pZH08L3N0cm9uZz5gICsKICAgICAgICAgICAgICAgIGA8c3Bhbj4ke2Zvcm1hdERvcHBsZXJVdGMoc291cmNlLnNvdXJjZV90aW1lX3V0Yyl9PC9zcGFuPmAgKwogICAgICAgICAgICAgICAgYDxzcGFuPiR7ZGVsdGFUZXh0fTwvc3Bhbj5gICsKICAgICAgICAgICAgICAgIGA8c3Bhbj4ke21hdGNofTwvc3Bhbj5gICsKICAgICAgICAgICAgICBgPC9kaXY+YCArCiAgICAgICAgICAgICAgYDxkaXY+YCArCiAgICAgICAgICAgICAgICBgPHNwYW4+JHtzb3VyY2UudGltZV9iYXNpc308L3NwYW4+YCArCiAgICAgICAgICAgICAgICBgPHNwYW4+JHtOdW1iZXIoc291cmNlLnNhbXBsZV9jb3VudCkudG9Mb2NhbGVTdHJpbmcoKX0gZGVjb2RlZCBub24temVybyBzYW1wbGVzPC9zcGFuPmAgKwogICAgICAgICAgICAgIGA8L2Rpdj5gICsKICAgICAgICAgICAgYDwvZGl2PmAKICAgICAgICAgICk7CiAgICAgICAgfQogICAgICApCiAgICAgIC5qb2luKCIiKTsKfQoK"
).decode("utf-8")

time_test_js = base64.b64decode(
    "aW1wb3J0IGFzc2VydCBmcm9tICJub2RlOmFzc2VydC9zdHJpY3QiOwoKaW1wb3J0IHsKICBwYXJzZUJvbVJlY2VpdmVkQXRVdGMKfSBmcm9tICIuLi8uLi9yZWxheS9kb3BwbGVyLXRpbWUtdjEuanMiOwoKYXNzZXJ0LmVxdWFsKAogIHBhcnNlQm9tUmVjZWl2ZWRBdFV0YygKICAgICJSZWNlaXZlZCBhdDogICAgIDAwOjU0IFVUQyBNb24gMTAgQXVnIDIwMjYiCiAgKSwKICAiMjAyNi0wOC0xMFQwMDo1NDowMC4wMDBaIgopOwoKYXNzZXJ0LmVxdWFsKAogIHBhcnNlQm9tUmVjZWl2ZWRBdFV0YygKICAgICI8ZGl2PlJlY2VpdmVkIGF0OiZuYnNwOyZuYnNwOzA2OjU0IFVUQyBUdWUgMjEgSnVsIDIwMjY8L2Rpdj4iCiAgKSwKICAiMjAyNi0wNy0yMVQwNjo1NDowMC4wMDBaIgopOwoKYXNzZXJ0LmVxdWFsKAogIHBhcnNlQm9tUmVjZWl2ZWRBdFV0YygKICAgICJSZWNlaXZlZCBhdDogOTo0NCBVVEMgU3VuIDA5IEF1ZyAyMDI2IgogICksCiAgIjIwMjYtMDgtMDlUMDk6NDQ6MDAuMDAwWiIKKTsKCmFzc2VydC5lcXVhbCgKICBwYXJzZUJvbVJlY2VpdmVkQXRVdGMoCiAgICAibm8gdGltZXN0YW1wIGhlcmUiCiAgKSwKICBudWxsCik7Cgpjb25zb2xlLmxvZygKICAiNCBCT00gRG9wcGxlciBwcm9kdWN0IHRpbWVzdGFtcCB0ZXN0cyBwYXNzZWQuIgopOwo="
).decode("utf-8")

print("StormTracker — Doppler product-time + display overlay V7")
print()
print("Preflight: building every changed file in memory...")

def replace_once(
    text,
    old,
    new,
    label
):
    count = text.count(
        old
    )

    if count != 1:
        raise SystemExit(
            f"ERROR: expected exactly one {label}, found {count}. "
            "No repository files have been changed."
        )

    return text.replace(
        old,
        new,
        1
    )

# ------------------------------------------------------------------
# Build Doppler intake V2 in memory.
# ------------------------------------------------------------------
intake = INTAKE1.read_text(
    encoding="utf-8"
)

header_anchor = """  const lastModified =
    response.headers.get(
      "Last-Modified"
    );

  const product =
    response.headers.get(
      "X-StormTracker-Product"
    );"""

header_new = """  const lastModified =
    response.headers.get(
      "Last-Modified"
    );

  const observedUtc =
    response.headers.get(
      "X-StormTracker-Observed-UTC"
    );

  const timeSource =
    response.headers.get(
      "X-StormTracker-Time-Source"
    );

  const product =
    response.headers.get(
      "X-StormTracker-Product"
    );"""

intake = replace_once(
    intake,
    header_anchor,
    header_new,
    "Doppler intake header block"
)

return_anchor = """    lastModified,

    width:
      imageData.width,"""

return_new = """    lastModified,

    observedUtc,

    timeSource,

    width:
      imageData.width,"""

intake = replace_once(
    intake,
    return_anchor,
    return_new,
    "Doppler intake return block"
)

# ------------------------------------------------------------------
# Build Core V7 in memory.
# ------------------------------------------------------------------
js = CORE6_JS.read_text(
    encoding="utf-8"
)

js = replace_once(
    js,
    '"./bom-doppler-intake-v1.js?v=track-context-v1"',
    '"./bom-doppler-intake-v2.js?v=product-time-v1"',
    "Core V7 Doppler intake import"
)

state_anchor = """let hybridDopplerLoadedForFrame =
  null;"""

state_new = state_anchor + """

let latestDopplerRecords =
  [];

let dopplerOverlayCollection =
  null;"""

js = replace_once(
    js,
    state_anchor,
    state_new,
    "Core V7 Doppler display state"
)

load_start = """async function loadOneDopplerRecord(
  radarId
) {"""

load_end = """async function loadLatestTrackDopplerContext() {"""

start = js.find(
    load_start
)

end = js.find(
    load_end,
    start
)

if start < 0 or end < 0:
    raise SystemExit(
        "ERROR: could not locate Core V6 Doppler loader span. "
        "No repository files have been changed."
    )

new_loader = """async function loadOneDopplerRecord(
  radarId
) {
  const source =
    await loadDopplerDiagnostic(
      radarId
    );

  const decoded =
    decodeGeoreferencedDoppler(
      radarId,
      canvasImageData(
        source.canvas
      )
    );

  const samples =
    geolocatedDopplerSamples(
      decoded,
      {
        stride:
          1,

        includeZero:
          false
      }
    );

  return {
    radarId:
      String(
        radarId
      ),

    product:
      source.product,

    observedUtc:
      source.observedUtc
      ?? null,

    timeBasis:
      source.timeSource
      ?? "timestamp-unavailable",

    samples
  };
}

""" + doppler_helpers_js + """
async function loadLatestTrackDopplerContext() {"""

js = (
    js[:start]
    + new_loader
    + js[
        end
        + len(
            load_end
        ):
      ]
)

records_anchor = """  const records =
    settled
      .filter(
        item =>
          item.status
          === "fulfilled"
      )
      .map(
        item =>
          item.value
      );

  hybridDopplerContext ="""

records_new = """  const records =
    settled
      .filter(
        item =>
          item.status
          === "fulfilled"
      )
      .map(
        item =>
          item.value
      );

  latestDopplerRecords =
    records;

  hybridDopplerContext ="""

js = replace_once(
    js,
    records_anchor,
    records_new,
    "Doppler record retention"
)

failures_anchor = """  $("dopplerFailures")
    .textContent =
      String(
        failed
      );
}"""

failures_new = """  $("dopplerFailures")
    .textContent =
      String(
        failed
      );

  renderDopplerSourceRows();

  renderDopplerOverlay();
}"""

js = replace_once(
    js,
    failures_anchor,
    failures_new,
    "Doppler source status rendering"
)

show_anchor = """  renderHybridTracks(
    hybridFrameIndex
  );

  updateHybridSourceMetrics("""

show_new = """  renderHybridTracks(
    hybridFrameIndex
  );

  renderDopplerOverlay();

  updateHybridSourceMetrics("""

js = replace_once(
    js,
    show_anchor,
    show_new,
    "Doppler overlay frame sync"
)

reset_anchor = """  hybridDopplerLoadedForFrame =
    null;

  for ("""

reset_new = """  hybridDopplerLoadedForFrame =
    null;

  latestDopplerRecords =
    [];

  clearDopplerOverlay();

  for ("""

js = replace_once(
    js,
    reset_anchor,
    reset_new,
    "Doppler reset state"
)

listeners_anchor = """$("showTrackVolumes").addEventListener(
  "change",
  () => {
    applyHybridVolumeMode(
      hybridFrameIndex
    );

    renderHybridTracks(
      hybridFrameIndex
    );
  }
);

"""

listeners_new = listeners_anchor + """$("showDopplerOverlay").addEventListener(
  "change",
  () => {
    renderDopplerOverlay();
  }
);

$("dopplerOverlayRadar").addEventListener(
  "change",
  () => {
    renderDopplerOverlay();
  }
);

"""

js = replace_once(
    js,
    listeners_anchor,
    listeners_new,
    "Doppler overlay listeners"
)

# ------------------------------------------------------------------
# Build Core V7 HTML in memory.
# ------------------------------------------------------------------
html = CORE6_HTML.read_text(
    encoding="utf-8"
)

html = replace_once(
    html,
    "StormTracker — Hybrid Storm Volume Core V6",
    "StormTracker — Hybrid Storm Volume Core V7",
    "Core V7 title"
)

doppler_note = """      <div class="uncertainty-note">
        Doppler is sampled only where exact geolocated non-zero radial-velocity
        pixels intersect the measured ≥40 dBZ component for an ST track.
        Toward/away span is calculated within one radar only. Doppler does not
        create storm identity, move the centroid, or diagnose rotation by itself.
      </div>"""

doppler_controls = doppler_note + """

      <label
        style="
          display:flex;
          gap:7px;
          align-items:center;
          margin-top:10px
        "
      >
        <input
          id="showDopplerOverlay"
          type="checkbox"
        >
        Show latest Doppler overlay
      </label>

      <label for="dopplerOverlayRadar">
        Display radar:
      </label>

      <select
        id="dopplerOverlayRadar"
        style="
          width:100%;
          padding:7px;
          border:1px solid #4a6575;
          border-radius:6px;
          background:#203440;
          color:#f2f7f9
        "
      >
        <option value="66">
          66 — Mt Stapylton
        </option>
        <option value="50">
          50 — Marburg
        </option>
        <option value="08">
          08 — Gympie / Mt Kanigan
        </option>
      </select>

      <div
        class="metric"
        style="margin-top:8px"
      >
        <span>Overlay state</span>
        <strong id="dopplerOverlayStatus">hidden</strong>

        <span>Overlay pixels</span>
        <strong id="dopplerOverlayCount">0</strong>
      </div>

      <div
        id="dopplerSourceRows"
        style="margin-top:8px;font-size:10px"
      >
        <div class="hybrid-muted">
          Load the hybrid sequence to retrieve product timestamps for
          radars 66, 50 and 08.
        </div>
      </div>

      <div class="uncertainty-note">
        The visible overlay is display-only and shows exact decoded non-zero
        radial-velocity palette pixels. Analysis remains restricted to pixels
        intersecting measured ST reflectivity footprints.
      </div>"""

html = replace_once(
    html,
    doppler_note,
    doppler_controls,
    "Core V7 Doppler controls"
)

html = replace_once(
    html,
    'src="./src/live3d-core-v6.js"',
    'src="./src/live3d-core-v7.js"',
    "Core V7 script"
)

# ------------------------------------------------------------------
# Pre-write syntax and unit validation in a staging directory.
# ------------------------------------------------------------------
with tempfile.TemporaryDirectory() as td:
    stage = Path(td)

    relay_stage = stage / "relay"

    src_stage = stage / "frontend" / "src"

    tests_stage = stage / "frontend" / "tests"

    relay_stage.mkdir(
      parents=True
    )

    src_stage.mkdir(
      parents=True
    )

    tests_stage.mkdir(
      parents=True
    )

    (relay_stage / "doppler-time-v1.js").write_text(
      relay_time_js,
      encoding="utf-8"
    )

    (relay_stage / "worker.js").write_text(
      relay_worker_js,
      encoding="utf-8"
    )

    (src_stage / "bom-doppler-intake-v2.js").write_text(
      intake,
      encoding="utf-8"
    )

    (src_stage / "live3d-core-v7.js").write_text(
      js,
      encoding="utf-8"
    )

    (tests_stage / "run-doppler-product-time-v1-tests.mjs").write_text(
      time_test_js,
      encoding="utf-8"
    )

    for file in [
        relay_stage / "doppler-time-v1.js",
        relay_stage / "worker.js",
        src_stage / "bom-doppler-intake-v2.js",
        src_stage / "live3d-core-v7.js",
    ]:
        subprocess.run(
            [
                "node",
                "--check",
                str(file)
            ],
            check=True
        )

    subprocess.run(
        [
            "node",
            str(
              tests_stage
              / "run-doppler-product-time-v1-tests.mjs"
            )
        ],
        cwd=stage,
        check=True
    )

# HTML structural guardrails.
for required_id in [
    'id="showDopplerOverlay"',
    'id="dopplerOverlayRadar"',
    'id="dopplerOverlayStatus"',
    'id="dopplerOverlayCount"',
    'id="dopplerSourceRows"',
]:
    if html.count(required_id) != 1:
        raise SystemExit(
            f"ERROR: generated Core V7 HTML missing/duplicates {required_id}. "
            "No repository files have been changed."
        )

print("Pre-write generated-file checks: PASS")
print("Writing V7 files...")

(RELAY / "doppler-time-v1.js").write_text(
    relay_time_js,
    encoding="utf-8"
)

(RELAY / "worker.js").write_text(
    relay_worker_js,
    encoding="utf-8"
)

INTAKE2.write_text(
    intake,
    encoding="utf-8"
)

CORE7_JS.write_text(
    js,
    encoding="utf-8"
)

CORE7_HTML.write_text(
    html,
    encoding="utf-8"
)

(TESTS / "run-doppler-product-time-v1-tests.mjs").write_text(
    time_test_js,
    encoding="utf-8"
)

print()
print("Running repository checks...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-doppler-product-time-v1-tests.mjs"
    ],
    cwd=ROOT,
    check=True
)

subprocess.run(
    [
        "node",
        "frontend/tests/run-track-doppler-context-v1-tests.mjs"
    ],
    cwd=ROOT,
    check=True
)

subprocess.run(
    [
        "node",
        "frontend/tests/run-stormtracker-camera-v1-tests.mjs"
    ],
    cwd=ROOT,
    check=True
)

subprocess.run(
    [
        "node",
        "frontend/tests/run-node-tests.mjs"
    ],
    cwd=ROOT,
    check=True
)

print()
print("SUCCESS")
print("Expected:")
print("  4 BOM Doppler product timestamp tests passed.")
print("  11 Doppler-to-track context tests passed.")
print("  11 shared camera controller tests passed.")
print("  14 tests passed.")
print()
print("IMPORTANT — deploy the relay first:")
print("  cd /workspaces/StormTracker/relay")
print("  npx wrangler deploy")
print("  cd /workspaces/StormTracker")
print()
print("Then commit/push the application:")
print(
    "git add "
    "relay/worker.js "
    "relay/doppler-time-v1.js "
    "frontend/src/bom-doppler-intake-v2.js "
    "frontend/src/live3d-core-v7.js "
    "frontend/live3d-core-v7.html "
    "frontend/tests/run-doppler-product-time-v1-tests.mjs"
)
print(
    'git commit -m "Use BOM product timestamps and add Doppler overlay"'
)
print("git push")
print()
print("After Pages deploys:")
print(
    "https://blakesmith-intel.github.io/StormTracker/"
    "live3d-core-v7.html"
)
print()
print("Validation:")
print("  1. Load the 30-min hybrid storm sequence.")
print("  2. Confirm radars 66 / 50 / 08 show BOM product-page UTC times.")
print("  3. Confirm each time delta and MATCH/NO MATCH result is visible.")
print("  4. Tick Show latest Doppler overlay.")
print("  5. Switch between 66 / 50 / 08.")
print("  6. Overlay must only appear on the latest sequence frame.")
print("  7. With no storms, overlay still displays; ST Doppler count may correctly remain zero.")
print()
print(
    "The overlay is display-only. ST identity/motion still come solely from "
    "measured reflectivity tracking; Doppler analysis remains footprint-restricted."
)
