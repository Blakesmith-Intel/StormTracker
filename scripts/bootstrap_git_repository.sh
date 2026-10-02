#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)}"
cd "$ROOT"

if [ ! -f README.md ] || [ ! -d frontend/src ]; then
  echo "Run this from the root of the reconstructed StormTracker package." >&2
  exit 1
fi

if [ ! -d .git ]; then
  git init -b main
fi

git add .
if git diff --cached --quiet; then
  echo "Nothing new to commit."
else
  git commit -m "Reconstruct StormTracker as browser-native application"
fi

cat <<'TXT'

Repository initialised.

Next, create an EMPTY GitHub repository named StormTracker (do not add a README), then run:

  git remote add origin https://github.com/YOUR-USERNAME/StormTracker.git
  git push -u origin main

After the push, enable GitHub Pages using GitHub Actions in Settings -> Pages.
The included workflow deploys only the static frontend/ directory.
TXT
