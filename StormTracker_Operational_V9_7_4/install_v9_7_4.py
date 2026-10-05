#!/usr/bin/env python3
"""Install StormTracker V9.7.4 consolidated mobile / touch-camera / track-overlay bug fix."""
from __future__ import annotations
import argparse, hashlib, json, os, re, shutil, subprocess, tempfile
from pathlib import Path
from datetime import datetime, timezone
HERE=Path(__file__).resolve().parent

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None

def run_checks(root, manifest):
    for name in manifest['files']:
        if name.endswith(('.js','.mjs')):
            subprocess.run(['node','--check',str(root/name)],check=True,cwd=root)
    html=(root/'frontend/live3d-operational-v9.html').read_text()
    source=(root/'frontend/src/live3d-operational-v9.js').read_text()
    css=(root/'frontend/src/operational-dashboard-v9-1.css').read_text()
    index=(root/'frontend/index.html').read_text()
    ids=re.findall(r'\bid="([^"]+)"',html)
    if len(ids)!=len(set(ids)): raise RuntimeError('Dashboard contains duplicate element IDs.')
    used=set(re.findall(r'\$\("([^"]+)"\)',source))
    missing=used-set(ids)
    if missing: raise RuntimeError(f'Missing dashboard elements: {sorted(missing)}')
    contracts={
      'V9.7.4 entry cache':'live3d-operational-v9.html?v=9.7.4' in index,
      'touch adapter import':'createStormTrackerTouchCameraGestures' in source,
      'Doppler 2px':'pixelSize:\n        2' in source,
      'Doppler depth test':'disableDepthTestDistance:\n        0' in source,
      'radar default 65%':'radarOpacityValue" for="radarOpacity">65%' in html,
      'Doppler default 45%':'dopplerOpacityValue" for="dopplerOpacity">45%' in html,
      'point default 2px':'pointSizeValue">2<' in html,
      'fixed tracking plane':'const altitude =\n        1200;' in source,
      'track depth visibility':source.count('disableDepthTestDistance:\n            Number.POSITIVE_INFINITY') >= 2,
      'trail depth fail':'depthFailMaterial:' in source,
      'mobile map allocation':'42dvh' in css and '#legendDock' in css,
      'functional Reset':'id="resetButton"' in html,
      'static credits':'id="cesiumCredits"' in html and 'creditContainer: $("cesiumCredits")' in source
    }
    failed=[k for k,v in contracts.items() if not v]
    if failed: raise RuntimeError('V9.7.4 contract failure: '+', '.join(failed))
    subprocess.run(['node','scripts/check-frontend.mjs'],check=True,cwd=root)
    print(f"{len(list((root/'frontend/tests').glob('run-*-tests.mjs')))} regression suites passed.",flush=True)

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--root',type=Path,default=Path.cwd());ap.add_argument('--check-only',action='store_true');args=ap.parse_args()
    root=args.root.resolve()
    if not (root/'frontend/src/tracking.js').is_file(): raise RuntimeError('Run from the StormTracker repository root, or pass --root.')
    if not shutil.which('node'): raise RuntimeError('Node.js is required for installation checks.')
    manifest=json.loads((HERE/'manifest.json').read_text())
    originals={}
    for name,item in manifest['files'].items():
        payload=HERE/'payload'/name
        if digest(payload)!=item['payload_sha256']: raise RuntimeError(f'Payload checksum failed: {name}')
        actual=digest(root/name)
        allowed={item['baseline_sha256'],item['payload_sha256']}
        if actual not in allowed: raise RuntimeError(f'{name} differs from sealed V9.7.2; preserve your edits.')
        originals[name]=(root/name).read_bytes() if (root/name).is_file() else None
    protected={name:digest(root/name) for name in manifest['protected_files']}
    if any(value is None for value in protected.values()):
        missing=[name for name,value in protected.items() if value is None]
        raise RuntimeError(f'Protected baseline files missing: {missing}')
    print('StormTracker V9.7.4: consolidated mobile/touch/layer fixes plus restored visible storm-track overlay.',flush=True)
    with tempfile.TemporaryDirectory(prefix='stormtracker-v9-7-4-') as td:
        staged=Path(td)
        for directory in ['frontend','relay','scripts','docs']:
            shutil.copytree(root/directory,staged/directory)
        shutil.copy2(root/'package.json',staged/'package.json')
        for name in manifest['files']:
            target=staged/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(HERE/'payload'/name,target)
        run_checks(staged,manifest)
    if args.check_only:
        print('CHECK ONLY: validation passed. No repository files changed.');return
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');backup=HERE/f'backup-{stamp}';backup.mkdir()
    state={}
    for name,data in originals.items():
        state[name]=data is not None
        if data is not None:
            target=backup/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
    (backup/'original-state.json').write_text(json.dumps(state,indent=2))
    try:
        for name in manifest['files']:
            target=root/name;target.parent.mkdir(parents=True,exist_ok=True)
            temp=target.with_name(target.name+'.v9-7-4-install-tmp');temp.write_bytes((HERE/'payload'/name).read_bytes());os.replace(temp,target)
        run_checks(root,manifest)
        for name,expected in protected.items():
            if digest(root/name)!=expected: raise RuntimeError(f'Protected file unexpectedly changed: {name}')
        for name,item in manifest['files'].items():
            if digest(root/name)!=item['payload_sha256']: raise RuntimeError(f'Installed checksum failed: {name}')
    except BaseException:
        for name,data in originals.items():
            target=root/name
            if data is None: target.unlink(missing_ok=True)
            else: target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
        print('Installation failed. Restored all original V9.7.2 target files.',flush=True);raise
    print('V9.7.4 installed and checked. V9.7.2 remains the sealed restore baseline until live V9.7.4 acceptance.')

if __name__=='__main__':
    try: main()
    except Exception as e: raise SystemExit(f'ERROR: {e}')
