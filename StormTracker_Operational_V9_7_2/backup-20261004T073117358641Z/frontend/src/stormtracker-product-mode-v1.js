import {
  runChristmas2023TrackingScenario
} from "./christmas-2023-derecho-scenario-v1.js";

import {
  evaluateChristmas2023Regression
} from "./christmas-2023-regression-v1.js";

const $ =
  id =>
    document.getElementById(
      id
    );

const liveFrame =
  $("liveFrame");

const validationFrame =
  $("validationFrame");

const liveButton =
  $("liveModeButton");

const validationButton =
  $("validationModeButton");

const modeBadge =
  $("modeBadge");

const validationNotice =
  $("validationNotice");

const regressionStatus =
  $("regressionStatus");

const regressionSummary =
  $("regressionSummary");

let currentMode =
  "live";

let validationLoaded =
  false;

function requestedMode() {
  const mode =
    new URL(
      window.location.href
    )
      .searchParams
      .get(
        "mode"
      );

  return mode
    === "validation"
      ? "validation"
      : "live";
}

function ensureValidationLoaded() {
  if (
    validationLoaded
  ) {
    return;
  }

  validationFrame.src =
    validationFrame
      .dataset
      .src;

  validationLoaded =
    true;
}

function updateUrl(
  mode
) {
  const url =
    new URL(
      window.location.href
    );

  if (
    mode === "validation"
  ) {
    url.searchParams.set(
      "mode",
      "validation"
    );
  } else {
    url.searchParams.delete(
      "mode"
    );
  }

  window.history
    .replaceState(
      null,
      "",
      url
    );
}

export function setStormTrackerMode(
  mode
) {
  const next =
    mode === "validation"
      ? "validation"
      : "live";

  currentMode =
    next;

  document.body
    .classList
    .toggle(
      "validation",
      next === "validation"
    );

  liveButton.setAttribute(
    "aria-pressed",
    next === "live"
      ? "true"
      : "false"
  );

  validationButton.setAttribute(
    "aria-pressed",
    next === "validation"
      ? "true"
      : "false"
  );

  if (
    next === "validation"
  ) {
    ensureValidationLoaded();

    liveFrame.hidden =
      true;

    validationFrame.hidden =
      false;

    validationNotice.hidden =
      false;

    modeBadge.textContent =
      "HISTORICAL VALIDATION — NOT LIVE";

    runRegression();
  } else {
    liveFrame.hidden =
      false;

    validationFrame.hidden =
      true;

    validationNotice.hidden =
      true;

    modeBadge.textContent =
      "LIVE WEATHER";
  }

  updateUrl(
    next
  );
}

export function runRegression() {
  regressionStatus.textContent =
    "running…";

  regressionStatus
    .classList
    .remove(
      "pass",
      "fail"
    );

  try {
    const run =
      runChristmas2023TrackingScenario();

    const report =
      evaluateChristmas2023Regression(
        run
      );

    regressionStatus.textContent =
      report.passed
        ? `PASS ${report.passed_count}/${report.total_count}`
        : `FAIL ${report.passed_count}/${report.total_count}`;

    regressionStatus
      .classList
      .add(
        report.passed
          ? "pass"
          : "fail"
      );

    const failures =
      report.checks
        .filter(
          item =>
            !item.pass
        );

    regressionSummary.textContent =
      report.passed
        ? (
            `Christmas 2023 baseline intact — ST0001 persisted; ` +
            `scores ${report.score_sequence.join("→")}; ` +
            `Doppler ${report.doppler_sequence.join("→")}.`
          )
        : failures
            .map(
              item =>
                `${item.label}: ${item.detail}`
            )
            .join(" | ");

    window.StormTrackerValidation =
      Object.freeze({
        mode:
          currentMode,

        lastReport:
          report,

        runRegression,

        setMode:
          setStormTrackerMode
      });

    return report;
  } catch (error) {
    regressionStatus.textContent =
      "FAIL — regression error";

    regressionStatus
      .classList
      .add(
        "fail"
      );

    regressionSummary.textContent =
      error?.message
      || String(
        error
      );

    throw error;
  }
}

liveButton.addEventListener(
  "click",
  () =>
    setStormTrackerMode(
      "live"
    )
);

validationButton.addEventListener(
  "click",
  () =>
    setStormTrackerMode(
      "validation"
    )
);

$("runRegressionButton")
  .addEventListener(
    "click",
    runRegression
  );

window.StormTrackerValidation =
  Object.freeze({
    mode:
      currentMode,

    lastReport:
      null,

    runRegression,

    setMode:
      setStormTrackerMode
  });

setStormTrackerMode(
  requestedMode()
);
