from pathlib import Path
import hashlib
import shutil
import subprocess

ROOT = Path("/workspaces/StormTracker")
HERE = Path(__file__).resolve().parent

FRONTEND = ROOT / "frontend"
SRC = FRONTEND / "src"
TESTS = FRONTEND / "tests"

INDEX = FRONTEND / "index.html"
LEGACY = FRONTEND / "index-live-loop-legacy.html"

LIVE_HTML = FRONTEND / "live3d-core-v8-3.html"
LIVE_JS = SRC / "live3d-core-v8-3.js"
VALIDATION_HTML = FRONTEND / "christmas-2023-derecho-test-v1.html"
VALIDATION_UI = SRC / "christmas-2023-derecho-test-v1.js"
VALIDATION_SCENARIO = SRC / "christmas-2023-derecho-scenario-v1.js"
CAMERA = SRC / "stormtracker-camera-v1.js"

payloads = [
    (
        HERE / "frontend/index.html",
        INDEX
    ),
    (
        HERE / "frontend/src/stormtracker-product-mode-v1.js",
        SRC / "stormtracker-product-mode-v1.js"
    ),
    (
        HERE / "frontend/src/christmas-2023-regression-v1.js",
        SRC / "christmas-2023-regression-v1.js"
    ),
    (
        HERE / "frontend/tests/run-christmas-2023-regression-v1-tests.mjs",
        TESTS / "run-christmas-2023-regression-v1-tests.mjs"
    ),
]

required = [
    INDEX,
    LIVE_HTML,
    LIVE_JS,
    VALIDATION_HTML,
    VALIDATION_UI,
    VALIDATION_SCENARIO,
    CAMERA,
    TESTS / "run-christmas-2023-derecho-scenario-v1-tests.mjs",
]

for path in required:
    if not path.exists():
        raise SystemExit(
            f"ERROR: required existing StormTracker file missing: {path}"
        )

for source, destination in payloads:
    if not source.exists():
        raise SystemExit(
            f"ERROR: bundle payload missing: {source}"
        )

def sha256(path):
    return hashlib.sha256(
        path.read_bytes()
    ).hexdigest()

protected = {
    path:
      sha256(path)
    for path in [
        LIVE_HTML,
        LIVE_JS,
        VALIDATION_HTML,
        VALIDATION_UI,
        VALIDATION_SCENARIO,
        CAMERA,
    ]
}

print("StormTracker — main product Live / Historical Validation mode")
print()
print("Architecture:")
print("  • root frontend/index.html becomes the mode shell")
print("  • Live Weather loads the existing V8.3 page unchanged")
print("  • Test / Historical Validation loads the existing Christmas 2023 page unchanged")
print("  • switching modes preserves the already-loaded live iframe state")
print("  • validation mode auto-runs a frozen regression baseline")
print("  • no live radar, tracking, assessment, Doppler or camera module is edited")
print()

# Preserve the previous root page exactly once.
if not LEGACY.exists():
    shutil.copy2(
        INDEX,
        LEGACY
    )

# Validate payload JS before copying.
for relative in [
    "frontend/src/stormtracker-product-mode-v1.js",
    "frontend/src/christmas-2023-regression-v1.js",
]:
    subprocess.run(
        [
            "node",
            "--check",
            str(
                HERE / relative
            )
        ],
        check=True
    )

print("New mode/regression JavaScript syntax: PASS")

# Copy new main-product shell and modules.
for source, destination in payloads:
    destination.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    shutil.copy2(
        source,
        destination
    )

# Existing production/scenario files must be byte-identical.
for path, before in protected.items():
    after = sha256(path)

    if after != before:
        raise SystemExit(
            f"ERROR: protected file changed unexpectedly: {path}"
        )

print("Live V8.3 + historical scenario + shared camera unchanged: PASS")
print()

print("Running new regression-contract tests...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-christmas-2023-regression-v1-tests.mjs"
    ],
    cwd=ROOT,
    check=True
)

print()
print("Running Christmas 2023 production-algorithm scenario tests...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-christmas-2023-derecho-scenario-v1-tests.mjs"
    ],
    cwd=ROOT,
    check=True
)

print()
print("Running existing StormTracker science + camera tests...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-node-tests.mjs"
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

print()
print("SUCCESS")
print("Expected:")
print("  12 main-product historical-regression contract tests passed.")
print("  18 Christmas 2023 severe-storm tracking scenario tests passed.")
print("  14 tests passed.")
print("  11 shared camera controller tests passed.")
print()
print("Commit/push:")
print(
    "git add "
    "frontend/index.html "
    "frontend/index-live-loop-legacy.html "
    "frontend/src/stormtracker-product-mode-v1.js "
    "frontend/src/christmas-2023-regression-v1.js "
    "frontend/tests/run-christmas-2023-regression-v1-tests.mjs"
)
print(
    'git commit -m "Add main-product historical validation mode"'
)
print("git push")
print()
print("After Pages deploys, open the normal StormTracker root.")
print("Default mode is LIVE WEATHER.")
print("Historical validation can also be deep-linked with ?mode=validation.")
