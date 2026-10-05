from pathlib import Path
import subprocess

ROOT = Path("/workspaces/StormTracker")
MODULE = ROOT / "frontend/src/doppler-palette-full-v4.js"
TEST = ROOT / "frontend/tests/run-doppler-palette-v4-tests.mjs"
ORIGINAL_PATCH = ROOT / "apply_stormtracker_doppler_palette_v4.py"

for path in [MODULE, TEST]:
    if not path.exists():
        raise SystemExit(f"ERROR: missing required file: {path}")

print("StormTracker — Doppler palette V4.1 repair")
print()

corrected_function = r'''export function locateFullVelocityPalette(
  imageData
) {
  const {
    width,
    height
  } = imageData;

  const footerStart =
    Math.min(
      width,
      height
    );

  if (
    height <= footerStart
  ) {
    throw new Error(
      `No Bureau footer detected in ${width}x${height} image.`
    );
  }

  let bestRow = null;

  function selectDirectionalCluster(
    clusters,
    predicate
  ) {
    return (
      clusters
        .map(
          cluster => {
            const selected =
              cluster.filter(
                run =>
                  predicate(
                    run.rgb
                  )
              );

            return {
              cluster:
                selected,

              score:
                selected.length >= 3
                  ? clusterScore(
                      selected
                    )
                  : -Infinity
            };
          }
        )
        .filter(
          item =>
            item.cluster.length >= 3
        )
        .sort(
          (a, b) =>
            b.score
            - a.score
        )[0]
      ?? null
    );
  }

  for (
    let y = footerStart;
    y < height;
    y++
  ) {
    const runs =
      candidateRuns(
        imageData,
        y
      );

    const clusters =
      clusterByGap(
        runs
      );

    const blue =
      selectDirectionalCluster(
        clusters,
        isBlue
      );

    const warm =
      selectDirectionalCluster(
        clusters,
        isWarm
      );

    const neutrals =
      runs.filter(
        run =>
          isNeutral(
            run.rgb
          )
      );

    const score =
      (
        blue
          ?.score
        ?? 0
      )
      + (
        warm
          ?.score
        ?? 0
      )
      + neutrals.length
        * 50;

    if (
      !bestRow
      || score
        > bestRow.score
    ) {
      bestRow = {
        y,
        footerStart,
        score,

        towards:
          blue
            ?.cluster
          ?? [],

        away:
          warm
            ?.cluster
          ?? [],

        neutral:
          neutrals
      };
    }
  }

  return bestRow;
}

'''

def replace_function_in_text(text: str, label: str) -> str:
    start_marker = "export function locateFullVelocityPalette("
    end_marker = "function createCrop("

    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(
            f"ERROR: {label}: locateFullVelocityPalette() not found."
        )

    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(
            f"ERROR: {label}: createCrop() marker not found."
        )

    return (
        text[:start]
        + corrected_function
        + text[end:]
    )

# Repair the generated JS module.
module_text = MODULE.read_text(encoding="utf-8")
MODULE.write_text(
    replace_function_in_text(
        module_text,
        "generated module"
    ),
    encoding="utf-8"
)

print("Repaired frontend/src/doppler-palette-full-v4.js")

# Also repair the original generator if it still exists, so rerunning it
# cannot reintroduce this exact bug.
if ORIGINAL_PATCH.exists():
    generator_text = ORIGINAL_PATCH.read_text(encoding="utf-8")
    ORIGINAL_PATCH.write_text(
        replace_function_in_text(
            generator_text,
            "original generator"
        ),
        encoding="utf-8"
    )
    print("Repaired apply_stormtracker_doppler_palette_v4.py")

print()
print("Checking JavaScript syntax...")

subprocess.run(
    [
        "node",
        "--check",
        "frontend/src/doppler-palette-full-v4.js"
    ],
    cwd=ROOT,
    check=True
)

print()
print("Running Doppler palette V4 tests...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-doppler-palette-v4-tests.mjs"
    ],
    cwd=ROOT,
    check=True
)

print()
print("Running Doppler intake tests...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-doppler-intake-tests.mjs"
    ],
    cwd=ROOT,
    check=True
)

print()
print("Running existing StormTracker tests...")

subprocess.run(
    [
        "node",
        "frontend/tests/run-node-tests.mjs"
    ],
    cwd=ROOT,
    check=True
)

print()
print("SUCCESS")
print("Expected:")
print("  7 Doppler full-palette V4 tests passed.")
print("  5 Doppler intake tests passed.")
print("  14 tests passed.")
print()
print("Then commit and push:")
print(
    "git add "
    "frontend/doppler-palette-v4.html "
    "frontend/src/doppler-palette-full-v4.js "
    "frontend/tests/run-doppler-palette-v4-tests.mjs"
)
print(
    'git commit -m "Fix Doppler directional palette separation"'
)
print("git push")
print()
print("After Pages deploys, open:")
print(
    "https://blakesmith-intel.github.io/StormTracker/"
    "doppler-palette-v4.html"
)
print()
print("Press:")
print("  Load full palette for 66 / 50 / 08")
