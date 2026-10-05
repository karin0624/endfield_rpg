import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function renderQualitySummary({ exitCode, revision, head, base, unit, browser, coverage, comparisons }) {
  const lines = [
    `## Game quality: ${exitCode === 0 ? "passed" : "failed"} (exit ${exitCode})`,
    "",
    `Tested checkout: \`${revision}\``,
    ...(head ? [`PR head: \`${head}\``] : []),
    ...(base ? [`PR base: \`${base}\``] : []),
    "",
    "The single workspace reuses the normal build from check; debug and direct-state entries are built once each with production minification and hidden source maps. Tests collect native V8 coverage during the required execution. No artifact storage is used.",
    "",
    "| Runner | Reported cases | Passed | Failed | Skipped / pending | Retried | Per-case V8 records |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  if (unit) {
    lines.push(
      `| Vitest | ${unit.numTotalTests} | ${unit.numPassedTests} | ${unit.numFailedTests} | ${unit.numPendingTests} | enforced by execution reporter | n/a |`,
    );
  } else lines.push("| Vitest | report not generated | — | — | — | — | — |");
  if (browser) {
    const projects = new Map(browser.config.projects.map(({ name }) => [name, []]));
    function visit(suites) {
      for (const suite of suites) {
        for (const spec of suite.specs ?? [])
          for (const test of spec.tests) {
            if (!projects.has(test.projectName)) projects.set(test.projectName, []);
            projects.get(test.projectName).push(test);
          }
        visit(suite.suites ?? []);
      }
    }
    visit(browser.suites);
    for (const [name, cases] of projects) {
      const passed = cases.filter((test) => test.results.at(-1)?.status === "passed").length;
      const skipped = cases.filter((test) => !test.results.length || test.results.at(-1)?.status === "skipped").length;
      const retried = cases.filter(
        (test) => test.results.length > 1 || test.results.some(({ retry }) => retry > 0),
      ).length;
      const collected = cases.filter((test) =>
        test.annotations?.some(({ type }) => type === "browser-coverage"),
      ).length;
      lines.push(
        `| Playwright ${name} | ${cases.length} | ${passed} | ${cases.length - passed - skipped} | ${skipped} | ${retried} | ${collected} |`,
      );
    }
    lines.push(
      "",
      `Playwright global errors: ${browser.errors.length}. Configured workers: ${browser.config.workers}. Native runner wall: ${(browser.stats.duration / 1000).toFixed(3)}s.`,
    );
  } else lines.push("| Playwright | report not generated | — | — | — | — | — |");
  lines.push(
    "",
    "Exit 0 requires the existing coverage thresholds, unfiltered collection/execution and project/per-case coverage gates to pass. Missing reports or partial execution do not count as completion. On failure, the original check exit code is preserved.",
    "",
    "| Coverage | Sources including zero-hit | Statements covered / total | Functions covered / total | Branches covered / total | Lines covered / total |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
  );
  for (const { name, summary, sources } of coverage) {
    const cell = (key) => `${summary.total[key].covered} / ${summary.total[key].total} (${summary.total[key].pct}%)`;
    lines.push(
      `| ${name} | ${sources} | ${cell("statements")} | ${cell("functions")} | ${cell("branches")} | ${cell("lines")} |`,
    );
  }
  if (!coverage.length) lines.push("| none generated | — | — | — | — | — |");
  if (comparisons.length) {
    lines.push(
      "",
      "Approved concept comparisons are diagnostics for review, separate from the approved VRT gates and WCAG conformance.",
      "",
      "| Concept | Native resolution | Raw differing pixels |",
      "| --- | --- | ---: |",
    );
    for (const item of comparisons)
      lines.push(
        `| ${item.name} | ${item.resolution.join(" × ")} | ${item.full.different_pixels} / ${item.full.pixels} |`,
      );
  }
  return `${lines.join("\n")}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const exitCode = Number(process.argv[2]);
  if (!Number.isInteger(exitCode) || exitCode < 0) throw new Error("Usage: report-quality.mjs exit-code");
  const read = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null);
  const coverage = [];
  const collectCoverage = (name, directory) => {
    const summary = read(`${directory}/coverage-summary.json`);
    if (summary)
      coverage.push({ name, summary, sources: Object.keys(read(`${directory}/coverage-final.json`) ?? {}).length });
  };
  collectCoverage("unit", "coverage/unit");
  if (existsSync("coverage/browser"))
    for (const name of readdirSync("coverage/browser")) collectCoverage(name, `coverage/browser/${name}`);
  const comparisons = [];
  if (existsSync("test-results/approved-comparison"))
    for (const name of readdirSync("test-results/approved-comparison")) {
      const result = read(`test-results/approved-comparison/${name}/results.json`);
      if (result) comparisons.push({ name, ...result });
    }
  const summary = renderQualitySummary({
    exitCode,
    revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    head: process.env.PR_HEAD,
    base: process.env.PR_BASE,
    unit: read("test-results/vitest.json"),
    browser: read("test-results/playwright.json"),
    coverage,
    comparisons,
  });
  process.stdout.write(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}
