import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const root=new URL("../../",import.meta.url);
const build=readFileSync(new URL("scripts/build-current-site.sh",root),"utf8");
const style=readFileSync(new URL("frontend/src/cyclone-subsection-v1.css",root),"utf8");
assert(build.includes("scripts/apply-cyclone-subsection-v1.py"));
assert(build.includes("scripts/apply-cyclone-multi-systems-v1.py"));
assert(build.includes("multiple-systems-20261030-v1"));
assert(style.includes("#internalCycloneSystems"));
const r=spawnSync("python3",["scripts/test-cyclone-subsection-v1.py"],{
  cwd:root.pathname,encoding:"utf8"});
if(r.status!==0){console.error(r.stdout,r.stderr);throw Error("Cyclone real HTML and multi-system JS regression failed");}
console.log(r.stdout.trim());
