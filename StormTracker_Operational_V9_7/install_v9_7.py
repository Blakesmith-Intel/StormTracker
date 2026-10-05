#!/usr/bin/env python3
"""Install prebuilt StormTracker V9.7 files after validating the actual payload."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None

def run_checks(root, manifest):
    for name in manifest['files']:
        if name.endswith(('.js', '.mjs')):
            subprocess.run(['node', '--check', str(root / name)], check=True, cwd=root)
    source = (root / 'frontend/src/live3d-operational-v9.js').read_text()
    html = (root / 'frontend/live3d-operational-v9.html').read_text()
    ids = re.findall(r'\bid="([^"]+)"', html)
    if len(ids) != len(set(ids)):
        raise RuntimeError('Dashboard contains duplicate element IDs.')
    used = set(re.findall(r'\$\("([^"]+)"\)', source))
    if used - set(ids):
        raise RuntimeError(f'Missing dashboard elements: {sorted(used-set(ids))}')
    suites = sorted((root / 'frontend/tests').glob('run-*-tests.mjs'))
    subprocess.run(['node', 'scripts/check-frontend.mjs'], check=True, cwd=root)
    print(f'{len(suites)} regression suites passed.', flush=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path.cwd(), help='StormTracker repository root')
    parser.add_argument('--check-only', action='store_true', help='Validate staged payload without changing repository')
    args = parser.parse_args()
    root = args.root.resolve()
    if not (root / 'frontend/src/tracking.js').is_file():
        raise RuntimeError('Run this command from the StormTracker repository root, or pass --root.')
    if not shutil.which('node'):
        raise RuntimeError('Node.js is required for installation checks (not for normal browser use).')
    manifest = json.loads((HERE / 'manifest.json').read_text())
    originals = {}
    for name, item in manifest['files'].items():
        payload = HERE / 'payload' / name
        if digest(payload) != item['payload_sha256']:
            raise RuntimeError(f'Payload checksum failed: {name}. No repository files changed.')
        actual = digest(root / name)
        if actual not in (item['baseline_sha256'], item['payload_sha256']):
            raise RuntimeError(f'{name} differs from the inspected V9 source. No repository files changed; preserve your edits.')
        originals[name] = (root / name).read_bytes() if (root / name).is_file() else None
    protected = {name: digest(root / name) for name in manifest['protected_files']}
    print('StormTracker V9.7: all Queensland radar sites and site-centred maps.', flush=True)
    print('Validating complete staged files before repository writes…', flush=True)
    with tempfile.TemporaryDirectory(prefix='stormtracker-v9-7-') as temporary:
        staged = Path(temporary)
        shutil.copytree(root / 'frontend', staged / 'frontend')
        shutil.copytree(root / 'relay', staged / 'relay')
        shutil.copy2(root / 'package.json', staged / 'package.json')
        for name in manifest['files']:
            target = staged / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(HERE / 'payload' / name, target)
        run_checks(staged, manifest)
    if args.check_only:
        print('CHECK ONLY: validation passed. No repository files changed.')
        return
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    backup = HERE / f'backup-{stamp}'
    backup.mkdir()
    for name, data in originals.items():
        if data is not None:
            target = backup / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
    (backup / 'original-state.json').write_text(json.dumps({name: data is not None for name,data in originals.items()}, indent=2))
    try:
        for name in manifest['files']:
            target = root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = target.with_name(target.name + '.v9-7-install-tmp')
            temporary.write_bytes((HERE / 'payload' / name).read_bytes())
            os.replace(temporary, target)
        run_checks(root, manifest)
        for name, expected in protected.items():
            if digest(root / name) != expected:
                raise RuntimeError(f'Protected file unexpectedly changed: {name}')
        for name, item in manifest['files'].items():
            if digest(root / name) != item['payload_sha256']:
                raise RuntimeError(f'Installed checksum failed: {name}')
    except BaseException:
        for name, data in originals.items():
            target = root / name
            if data is None:
                target.unlink(missing_ok=True)
            else:
                target.write_bytes(data)
        print('Installation failed. Restored all original target files.', flush=True)
        raise
    print('V9.7 installed and checked. Tracking, assessment, camera and historical-validation sources preserved.')
    print('Deploy the relay with bash scripts/deploy-qld-relay.sh, then commit/push the named frontend, relay, scripts and documentation files from README.txt.')

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        raise SystemExit(f'ERROR: {error}')
