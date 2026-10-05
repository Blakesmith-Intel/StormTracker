#!/usr/bin/env python3
"""Install, commit, tag and push the StormTracker V9.7.2 final baseline."""
from __future__ import annotations
import argparse, subprocess, sys
from pathlib import Path
HERE=Path(__file__).resolve().parent
TAG='v9.7.2'
STAGE=[
 'frontend/index.html','frontend/live3d-operational-v9.html','frontend/src/live3d-operational-v9.js','frontend/src/operational-dashboard-v9-1.css',
 'frontend/tests/run-production-shell-v1-tests.mjs','docs/OPERATIONAL_RELEASE.md','docs/BASELINE_RESTORE.md',
 'frontend/christmas-2023-derecho-test-v1.html','frontend/src/christmas-2023-derecho-test-v1.js','frontend/src/stormtracker-product-mode-v1.js'
]
def run(cmd,cwd,check=True):
    print('+',' '.join(cmd),flush=True);return subprocess.run(cmd,cwd=cwd,text=True,check=check,capture_output=False)
def output(cmd,cwd):return subprocess.check_output(cmd,cwd=cwd,text=True).strip()
def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--root',type=Path,default=Path.cwd());ap.add_argument('--seal',action='store_true');args=ap.parse_args();root=args.root.resolve()
    if not args.seal: raise SystemExit('Use --seal to explicitly authorise install + commit + tag + push.')
    if output(['git','branch','--show-current'],root)!='main': raise SystemExit('ERROR: final baseline must be sealed from main.')
    run([sys.executable,str(HERE/'install_v9_7_2.py'),'--root',str(root)],root)
    run(['git','add','--all','--',*STAGE],root)
    run(['git','diff','--cached','--check'],root)
    staged=output(['git','diff','--cached','--name-only'],root).splitlines()
    allowed=set(STAGE)
    unexpected=[x for x in staged if x not in allowed]
    if unexpected: raise SystemExit(f'ERROR: unexpected staged paths: {unexpected}')
    if not staged: raise SystemExit('ERROR: no baseline changes staged.')
    run(['git','commit','-m','Lock StormTracker operational V9.7.2 baseline'],root)
    sha=output(['git','rev-parse','HEAD'],root)
    existing=output(['git','tag','-l',TAG],root)
    if existing:
        target=output(['git','rev-list','-n','1',TAG],root)
        if target!=sha: raise SystemExit(f'ERROR: {TAG} already points to {target}; refusing to move it.')
    else: run(['git','tag','-a',TAG,'-m','StormTracker Operational V9.7.2 final baseline'],root)
    run(['git','push','origin','main'],root)
    run(['git','push','origin',TAG],root)
    remote_main=output(['git','ls-remote','origin','refs/heads/main'],root).split()[0]
    if remote_main!=sha: raise SystemExit(f'ERROR: remote main is {remote_main}, expected {sha}')
    tag_commit=output(['git','rev-list','-n','1',TAG],root)
    if tag_commit!=sha: raise SystemExit(f'ERROR: tag resolves to {tag_commit}, expected {sha}')
    restore=HERE/'FINAL_RESTORE_POINT.txt'
    restore.write_text(f'StormTracker Operational V9.7.2 final baseline\nCOMMIT: {sha}\nTAG: {TAG}\nRESTORE: git switch -c restore/v9.7.2 {TAG}\n')
    print('\nSEALED BASELINE',flush=True);print('Commit:',sha,flush=True);print('Tag:',TAG,flush=True);print('Restore: git switch -c restore/v9.7.2 v9.7.2',flush=True)
if __name__=='__main__':main()
