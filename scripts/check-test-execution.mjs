import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Compare generated runner reports, not a hand-maintained list of specifications.
export function checkExecution(files, discovered, executed) {
  const errors = [];
  const expected = new Map();
  const actual = new Map();
  for (const [label, cases, index] of [
    ["discovered", discovered, expected],
    ["executed", executed, actual],
  ]) {
    for (const item of cases) {
      if (index.has(item.key)) errors.push(`Duplicate ${label} case: ${item.key}`);
      index.set(item.key, item);
    }
  }
  for (const file of files) {
    if (!discovered.some((item) => item.file === file)) errors.push(`Undiscovered or empty test file: ${file}`);
  }
  for (const item of discovered) {
    if (!actual.has(item.key)) errors.push(`Missing execution result: ${item.key}`);
  }
  for (const item of executed) {
    if (!expected.has(item.key)) errors.push(`Execution absent from collection: ${item.key}`);
    if (!item.passed) errors.push(`Not passed without retry/skip: ${item.key}`);
  }
  if (!discovered.length || !executed.length) errors.push("Empty collection or execution report");
  return errors;
}

export function vitestCases(report, discovery = false, root = process.cwd()) {
  if (discovery)
    return report.map((item) => {
      const file = relative(root, item.file);
      return { file, key: JSON.stringify([file, item.name]) };
    });
  return report.testResults.flatMap((fileResult) =>
    fileResult.assertionResults.map((item) => {
      const file = relative(root, fileResult.name);
      return {
        file,
        key: JSON.stringify([file, [...item.ancestorTitles, item.title].join(" > ")]),
        passed: item.status === "passed" && !item.failureMessages?.length,
      };
    }),
  );
}

export function playwrightCases(report, _discovery = false, root = "tests/e2e") {
  const cases = [];
  function visit(suites) {
    for (const suite of suites) {
      for (const spec of suite.specs ?? [])
        for (const test of spec.tests) {
          cases.push({
            file: `${root}/${spec.file}`,
            key: JSON.stringify([test.projectName, spec.id]),
            passed:
              test.expectedStatus === "passed" &&
              test.results.length === 1 &&
              test.results[0].status === "passed" &&
              test.results[0].retry === 0,
            coverageRecorded: test.annotations?.some((annotation) => annotation.type === "browser-coverage") ?? false,
          });
        }
      visit(suite.suites ?? []);
    }
  }
  visit(report.suites);
  return cases;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [runner, discoveryPath, resultPath, mode] = process.argv.slice(2);
  if (
    !["vitest", "playwright"].includes(runner) ||
    !discoveryPath ||
    !resultPath ||
    (mode && !["coverage", "long", "editor"].includes(mode))
  ) {
    throw new Error(
      "Usage: check-test-execution.mjs {vitest|playwright} discovery.json result.json [coverage|long|editor]",
    );
  }
  const read = (path) => JSON.parse(readFileSync(path, "utf8"));
  const inventory = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    encoding: "utf8",
  }).split("\0");
  const pattern = runner === "vitest" ? /\.test\.[cm]?[jt]sx?$/ : /\.spec\.[cm]?[jt]sx?$/;
  const files = [
    ...new Set(
      inventory.filter(
        (file) =>
          pattern.test(file) &&
          existsSync(file) &&
          (runner === "vitest" ||
            (mode === "long"
              ? file.startsWith("tests/long/")
              : mode === "editor"
                ? file.startsWith("tests/editor/")
                : !file.startsWith("tests/long/") &&
                  !file.startsWith("tests/editor/") &&
                  !file.startsWith("tests/evidence/"))),
      ),
    ),
  ];
  const convert =
    runner === "vitest"
      ? vitestCases
      : (report) =>
          playwrightCases(
            report,
            false,
            mode === "long" ? "tests/long" : mode === "editor" ? "tests/editor" : "tests/e2e",
          );
  const discovery = read(discoveryPath);
  const result = read(resultPath);
  const errors = checkExecution(files, convert(discovery, true), convert(result));
  if (runner === "playwright") {
    for (const project of mode === "long"
      ? ["built"]
      : mode === "editor"
        ? ["settings"]
        : ["built", "debug", "ui", "settings"]) {
      if (!playwrightCases(result).some((item) => JSON.parse(item.key)[0] === project))
        errors.push(`Missing required project: ${project}`);
    }
    if (result.errors?.length) errors.push("Playwright reported global errors");
    if (mode === "coverage") {
      for (const test of playwrightCases(result))
        if (!test.coverageRecorded) errors.push(`Missing per-case browser coverage collection: ${test.key}`);
    }
  } else if (!result.success) errors.push("Vitest run was not successful");
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else
    process.stdout.write(
      `${runner}: ${files.length} files, ${convert(result).length} collected cases all executed and passed\n`,
    );
}
