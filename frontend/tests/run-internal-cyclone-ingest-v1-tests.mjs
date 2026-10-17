// This suite is automatically discovered by scripts/check-frontend.mjs.
// The Python source-true decoder and private FTP manifest regression tests run
// entirely offline with explicitly SYNTHETIC cyclone fixture geometry.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const python = process.env.PYTHON || "python3";
const file = fileURLToPath(new URL("../../scripts/test-internal-cyclone-ingest.py", import.meta.url));
const result = spawnSync(python, [file], { encoding: "utf8", timeout: 20000 });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error || result.status !== 0) {
  throw new Error("Internal cyclone ingestion regression failed: " +
    (result.error?.message || "exit " + result.status));
}
console.log("PASS original BoM internal feed fixtures; no public data storage.");
