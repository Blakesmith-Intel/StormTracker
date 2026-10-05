#!/usr/bin/env python3
"""Install StormTracker V9.7.2 final production-baseline cleanup."""
from __future__ import annotations
import argparse, hashlib, json, os, re, shutil, subprocess, tempfile
from pathlib import Path
from datetime import datetime, timezone
HERE=Path(__file__).resolve().parent

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None

def git_blob(root,path):
    target=root/path
    if not target.is_file(): return None
    r=subprocess.run(['git','hash-object',str(target)],cwd=root,capture_output=True,text=True,check=True)
    return r.stdout.strip()

def run_checks(root, manifest):
    for name in manifest['files']:
        if name.endswith(('.js','.mjs')): subprocess.run(['node','--check',str(root/name)],check=True,cwd=root)
    source=(root/'frontend/src/live3d-operational-v9.js').read_text()
    html=(root/'frontend/live3d-operational-v9.html').read_text()
    index=(root/'frontend/index.html').read_text()
    css=(root/'frontend/src/operational-dashboard-v9-1.css').read_text()
    ids=re.findall(r'\\bid="([^"]+)"',html)
    if len(ids)!=len(set(ids)): raise RuntimeError('Dashboard contains duplicate element IDs.')
    used=set(re.findall(r'\\$\\("([^"]+)"\\)',source))
    if used-set(ids): raise RuntimeError(f'Missing dashboard elements: {sorted(used-set(ids))}')
    if 'cameraCorrections' in html or 'cameraCorrections' in source: raise RuntimeError('Camera counter still present.')
    if 'id="resetButton"' not in html: raise RuntimeError('Functional Reset view was removed unexpectedly.')
    if 'id="cesiumCredits"' not in html or 'creditContainer: $("cesiumCredits")' not in source: raise RuntimeError('Static Cesium credit container missing.')
    if '#cesiumCredits' not in css or 'z-index:900' not in css: raise RuntimeError('Static Cesium credit layer missing.')
    if 'validationModeButton' in index or 'Historical Validation' in index or 'stormtracker-product-mode' in index: raise RuntimeError('Historical/test mode remains in production entry point.')
    for name in manifest['delete_files']:
        if (root/name).exists(): raise RuntimeError(f'Production validation asset still present: {name}')
    for name in ['frontend/src/christmas-2023-derecho-scenario-v1.js','frontend/src/christmas-2023-regression-v1.js','frontend/tests/run-christmas-2023-derecho-scenario-v1-tests.mjs','frontend/tests/run-christmas-2023-regression-v1-tests.mjs']:
        if not (root/name).is_file(): raise RuntimeError(f'Engineering regression asset missing: {name}')
    subprocess.run(['node','scripts/check-frontend.mjs'],check=True,cwd=root)
    suites=sorted((root/'frontend/tests').glob('run-*-tests.mjs'))
    print(f'{len(suites)} regression suites passed.',flush=True)

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--root',type=Path,default=Path.cwd());ap.add_argument('--check-only',action='store_true');args=ap.parse_args()
    root=args.root.resolve()
    if not (root/'frontend/src/tracking.js').is_file(): raise RuntimeError('Run from the StormTracker repository root, or pass --root.')
    if not shutil.which('node'): raise RuntimeError('Node.js is required for installation checks.')
    manifest=json.loads((HERE/'manifest.json').read_text())
    originals={}; deleted={}
    for name,item in manifest['files'].items():
        payload=HERE/'payload'/name
        if digest(payload)!=item['payload_sha256']: raise RuntimeError(f'Payload checksum failed: {name}')
        actual=digest(root/name)
        if actual not in (item['baseline_sha256'],item['payload_sha256']): raise RuntimeError(f'{name} differs from the inspected V9.7 source; preserve your edits.')
        originals[name]=(root/name).read_bytes() if (root/name).is_file() else None
    for name,expected_blob in manifest['delete_files'].items():
        actual=git_blob(root,name)
        if actual not in (None,expected_blob): raise RuntimeError(f'{name} differs from the inspected V9.7 source; refusing deletion.')
        deleted[name]=(root/name).read_bytes() if (root/name).is_file() else None
    protected={name:digest(root/name) for name in manifest['protected_files']}
    print('StormTracker V9.7.2 final baseline: live-only production UI, static Cesium attribution, functional Reset.',flush=True)
    with tempfile.TemporaryDirectory(prefix='stormtracker-v9-7-2-') as td:
        staged=Path(td);shutil.copytree(root/'frontend',staged/'frontend');shutil.copytree(root/'relay',staged/'relay');shutil.copytree(root/'scripts',staged/'scripts');shutil.copy2(root/'package.json',staged/'package.json')
        for name in manifest['files']:
            t=staged/name;t.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(HERE/'payload'/name,t)
        for name in manifest['delete_files']: (staged/name).unlink(missing_ok=True)
        run_checks(staged,manifest)
    if args.check_only:
        print('CHECK ONLY: validation passed. No repository files changed.');return
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');backup=HERE/f'backup-{stamp}';backup.mkdir()
    state={}
    for group in (originals,deleted):
        for name,data in group.items():
            state[name]=data is not None
            if data is not None:
                t=backup/name;t.parent.mkdir(parents=True,exist_ok=True);t.write_bytes(data)
    (backup/'original-state.json').write_text(json.dumps(state,indent=2))
    try:
        for name in manifest['files']:
            t=root/name;t.parent.mkdir(parents=True,exist_ok=True);tmp=t.with_name(t.name+'.v9-7-2-install-tmp');tmp.write_bytes((HERE/'payload'/name).read_bytes());os.replace(tmp,t)
        for name in manifest['delete_files']: (root/name).unlink(missing_ok=True)
        run_checks(root,manifest)
        for name,expected in protected.items():
            if digest(root/name)!=expected: raise RuntimeError(f'Protected file unexpectedly changed: {name}')
        for name,item in manifest['files'].items():
            if digest(root/name)!=item['payload_sha256']: raise RuntimeError(f'Installed checksum failed: {name}')
    except BaseException:
        for name,data in {**originals,**deleted}.items():
            t=root/name
            if data is None:t.unlink(missing_ok=True)
            else:t.parent.mkdir(parents=True,exist_ok=True);t.write_bytes(data)
        print('Installation failed. Restored all original target files.',flush=True);raise
    print('V9.7.2 installed and checked. Historical regression logic retained internally; production test UI removed.')
    print('Run finalise_v9_7_2.py --seal to commit, tag and push the immutable restore point.')

if __name__=='__main__':
    try:main()
    except Exception as e:raise SystemExit(f'ERROR: {e}')
