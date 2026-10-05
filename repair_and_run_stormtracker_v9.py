from pathlib import Path
import py_compile
import subprocess

ROOT = Path("/workspaces/StormTracker")
BUNDLE = ROOT / "StormTracker_Operational_V9"
BROKEN = BUNDLE / "install_v9.py"
FIXED = BUNDLE / "install_v9_fixed.py"

if not BROKEN.exists():
    raise SystemExit(
        f"ERROR: existing V9 installer not found: {BROKEN}"
    )

text = BROKEN.read_text(
    encoding="utf-8"
)

count = text.count("\\\\n")

if count == 0:
    print(
        "No double-escaped newline defect found in install_v9.py; "
        "running it directly."
    )

    subprocess.run(
        [
            "python",
            str(
                BROKEN
            )
        ],
        cwd=ROOT,
        check=True
    )

    raise SystemExit(0)

text = text.replace(
    "\\\\n",
    "\\n"
)

if "\\\\n" in text:
    raise SystemExit(
        "ERROR: repair did not remove all double-escaped newline sequences."
    )

FIXED.write_text(
    text,
    encoding="utf-8"
)

py_compile.compile(
    str(
        FIXED
    ),
    doraise=True
)

print(
    f"Repaired {count} double-escaped newline sequences."
)

print(
    "Corrected installer Python syntax: PASS"
)

print(
    "Running corrected Operational V9 installer..."
)

subprocess.run(
    [
        "python",
        str(
            FIXED
        )
    ],
    cwd=ROOT,
    check=True
)
