#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/StormTracker"
cd "$ROOT"

PYFILE="scripts/validate_inferred_volume_morphology_v2.py"
SHELLFILE="validate_stormtracker_morphology_inferred_3d_v2.sh"

echo "StormTracker — morphology validation bug fix"
echo

if [ ! -f "$PYFILE" ]; then
  echo "ERROR: $PYFILE not found."
  exit 1
fi

python3 - <<'PY'
from pathlib import Path

targets = [
    Path("scripts/validate_inferred_volume_morphology_v2.py"),
]

shell = Path("validate_stormtracker_morphology_inferred_3d_v2.sh")
if shell.exists():
    targets.append(shell)

old = "    regime_count=len(REGIMES)"
new = '    regime_count=int(accumulator["column_counts"].shape[0])'

for path in targets:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)

    if count == 0:
        if new in text:
            print(f"{path}: already fixed")
            continue
        raise SystemExit(
            f"ERROR: expected buggy line not found in {path}"
        )

    if count != 1:
        raise SystemExit(
            f"ERROR: expected exactly one buggy line in {path}, found {count}"
        )

    text = text.replace(old, new, 1)
    path.write_text(text, encoding="utf-8")
    print(f"{path}: fixed")
PY

echo
echo "Checking Python syntax..."
python3 -m py_compile "$PYFILE"

echo
echo "Re-running morphology-conditioned validation..."
python3 "$PYFILE"

echo
echo "DONE"
echo
echo "Send me:"
echo "  • each held-out event candidate/baseline block"
echo "  • the CROSS-EVENT COMPARISON block"
echo "  • MORPHOLOGY-CONDITIONED VALIDATION: COMPLETE"
