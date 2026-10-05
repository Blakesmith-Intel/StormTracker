from pathlib import Path
import shutil
import subprocess

ROOT = Path("/workspaces/StormTracker")
HERE = Path(__file__).resolve().parent

pairs = [
    (
        HERE / "frontend/src/christmas-2023-derecho-scenario-v1.js",
        ROOT / "frontend/src/christmas-2023-derecho-scenario-v1.js"
    ),
    (
        HERE / "frontend/src/christmas-2023-derecho-test-v1.js",
        ROOT / "frontend/src/christmas-2023-derecho-test-v1.js"
    ),
    (
        HERE / "frontend/christmas-2023-derecho-test-v1.html",
        ROOT / "frontend/christmas-2023-derecho-test-v1.html"
    ),
    (
        HERE / "frontend/tests/run-christmas-2023-derecho-scenario-v1-tests.mjs",
        ROOT / "frontend/tests/run-christmas-2023-derecho-scenario-v1-tests.mjs"
    ),
]

required_repo = [
    ROOT / "frontend/src/tracking.js",
    ROOT / "frontend/src/track-assessment-v2.js",
    ROOT / "frontend/src/stormtracker-camera-v1.js",
]

for path in required_repo:
    if not path.exists():
        raise SystemExit(
            f"ERROR: required production module missing: {path}"
        )

for source, destination in pairs:
    if not source.exists():
        raise SystemExit(
            f"ERROR: bundle file missing: {source}"
        )

    destination.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    shutil.copy2(
        source,
        destination
    )

print("Checking scenario JavaScript syntax...")

for relative in [
    "frontend/src/christmas-2023-derecho-scenario-v1.js",
    "frontend/src/christmas-2023-derecho-test-v1.js",
]:
    subprocess.run(
        [
            "node",
            "--check",
            relative
        ],
        cwd=ROOT,
        check=True
    )

print()
print("Running Christmas 2023 tracking simulation tests...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-christmas-2023-derecho-scenario-v1-tests.mjs"
    ],
    cwd=ROOT,
    check=True
)

print()
print("Running existing StormTracker tests...")

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
print("  18 Christmas 2023 severe-storm tracking scenario tests passed.")
print("  14 tests passed.")
print("  11 shared camera controller tests passed.")
print()
print("Commit/push:")
print(
    "git add "
    "frontend/src/christmas-2023-derecho-scenario-v1.js "
    "frontend/src/christmas-2023-derecho-test-v1.js "
    "frontend/christmas-2023-derecho-test-v1.html "
    "frontend/tests/run-christmas-2023-derecho-scenario-v1-tests.mjs"
)
print(
    'git commit -m "Add Christmas 2023 severe storm tracking validation"'
)
print("git push")
print()
print("After Pages deploys:")
print(
    "https://blakesmith-intel.github.io/StormTracker/"
    "christmas-2023-derecho-test-v1.html"
)
