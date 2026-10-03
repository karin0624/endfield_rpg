import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const key = ({ runner, project = "", file, title }) => JSON.stringify([runner, project, file, title]);
export function vitestCases(report, root = process.cwd()) {
  return report.testResults.flatMap((file) =>
    file.assertionResults.map((test) => ({
      runner: "vitest",
      file: relative(root, file.name),
      title: test.fullName,
      status: test.status,
    })),
  );
}
export function playwrightCases(report) {
  const cases = [];
  function visit(suites, ancestors = []) {
    for (const suite of suites) {
      const titles = suite.column ? [...ancestors, suite.title] : ancestors;
      for (const spec of suite.specs ?? [])
        for (const test of spec.tests) {
          cases.push({
            runner: "playwright",
            project: test.projectName,
            file: `tests/e2e/${spec.file}`,
            title: [...titles, spec.title].join(" > "),
            status:
              test.results?.length && test.results.every((result) => result.status === "passed")
                ? "passed"
                : "not-passed",
          });
        }
      visit(suite.suites ?? [], titles);
    }
  }
  visit(report.suites);
  return cases;
}
export function checkExecution(registry, actual, runner, files) {
  const errors = [];
  const expected = registry.filter((test) => test.runner === runner);
  const index = new Map();
  for (const test of expected) {
    if (index.has(key(test))) errors.push(`Duplicate registered case: ${key(test)}`);
    index.set(key(test), test);
  }
  const seen = new Set();
  for (const test of actual) {
    const id = key(test);
    if (seen.has(id)) errors.push(`Duplicate runtime case (give parameter rows unique titles): ${id}`);
    seen.add(id);
    if (!index.has(id)) errors.push(`Unregistered runtime test: ${id}`);
    if (test.status !== "passed") errors.push(`Not executed successfully: ${id} (${test.status})`);
  }
  for (const [id, test] of index) if (!seen.has(id)) errors.push(`Not discovered/executed: ${test.id} ${id}`);
  const discoveredFiles = new Set(actual.map((test) => test.file));
  for (const file of files)
    if (!discoveredFiles.has(file)) errors.push(`Test file excluded by runner or empty: ${file}`);
  return errors;
}
export function checkCatalog(catalog, registry) {
  const errors = [];
  if (!catalog.length) errors.push("Specification catalog must not be empty");
  const testIds = new Set();
  for (const test of registry) {
    if (!test.id || testIds.has(test.id)) errors.push(`Missing/duplicate test ID: ${test.id}`);
    testIds.add(test.id);
  }
  const specIds = new Set();
  for (const spec of catalog) {
    if (!spec.id || specIds.has(spec.id)) errors.push(`Missing/duplicate specification ID: ${spec.id}`);
    specIds.add(spec.id);
    if (!["covered", "partial", "missing", "unaudited", "contradiction", "planned"].includes(spec.status))
      errors.push(`Invalid status: ${spec.id}`);
    if (!spec.source || !spec.contract) errors.push(`Missing source/contract: ${spec.id}`);
    if (spec.status === "covered" && !spec.evidence?.length) errors.push(`Covered without assertions: ${spec.id}`);
    for (const evidence of spec.evidence ?? []) {
      if (!testIds.has(evidence.test)) errors.push(`Unknown test ID: ${spec.id} -> ${evidence.test}`);
      if (!evidence.assertion || !evidence.layer) errors.push(`Missing assertion/layer: ${spec.id}`);
    }
  }
  return errors;
}

if (process.argv[1]?.endsWith("check-test-contracts.mjs")) {
  const [mode, reportPath] = process.argv.slice(2);
  const registry = read("docs/testing/test-registry.json");
  const catalog = read("docs/testing/spec-contracts.json");
  const errors = checkCatalog(catalog, registry);
  const sourceFiles = new Set(
    catalog.flatMap((spec) =>
      (Array.isArray(spec.source) ? spec.source : [spec.source]).map((source) => source.split(/[:#]/)[0]),
    ),
  );
  for (const source of sourceFiles)
    if (!existsSync(source)) errors.push(`Specification source does not exist: ${source}`);
  for (const file of execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "specs"], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")) {
    if (file.endsWith(".md") && !sourceFiles.has(file)) errors.push(`Unregistered specification file: ${file}`);
  }

  if (mode === "vitest" || mode === "playwright") {
    const report = read(reportPath);
    const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter((file) =>
        mode === "vitest"
          ? /\.test\.[cm]?[jt]sx?$/.test(file)
          : !file.startsWith("tests/evidence/") && /\.spec\.[cm]?[jt]sx?$/.test(file),
      );
    errors.push(
      ...checkExecution(registry, mode === "vitest" ? vitestCases(report) : playwrightCases(report), mode, files),
    );
    if (mode === "vitest" && report.success !== true) errors.push("Vitest runner failed");
    if (mode === "playwright" && report.errors?.length) errors.push("Playwright runner errors");
  } else if (mode === "merge") {
    for (const spec of catalog)
      if (!["covered", "planned"].includes(spec.status))
        errors.push(`Merge blocked: ${spec.id} ${spec.status} — ${spec.contract}`);
  } else if (mode !== "catalog")
    errors.push("Usage: node scripts/check-test-contracts.mjs {catalog|merge|vitest|playwright} [report.json]");
  if (errors.length) {
    process.stderr.write(`${errors.join("\n")}\n`);
    process.exitCode = 1;
  } else process.stdout.write(`Test contracts ${mode}: OK\n`);
}
