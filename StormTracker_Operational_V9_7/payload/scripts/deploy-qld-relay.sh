#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
npm test
if [[ -f relay/wrangler.jsonc ]]; then
  npx wrangler deploy relay/worker.js --config relay/wrangler.jsonc --name stormtracker-bom-relay --keep-vars "$@"
elif [[ -f relay/wrangler.toml ]]; then
  npx wrangler deploy relay/worker.js --config relay/wrangler.toml --name stormtracker-bom-relay --keep-vars "$@"
else
  npx wrangler deploy relay/worker.js --name stormtracker-bom-relay --compatibility-date 2025-01-01 --keep-vars "$@"
fi
