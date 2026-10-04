import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { expect, it } from "vitest";

it("rejects filtered or list-only native CLI runs instead of reusing a previous successful JSON", () => {
  const root = mkdtempSync(join(tmpdir(), "endfield-playwright-cli-"));
  const env = { ...process.env, PATH: `${resolve("node_modules/.bin")}${delimiter}${process.env.PATH}` };
  const run = (mode = "browser", ...options) =>
    spawnSync("sh", [resolve("scripts/run-playwright-quality.sh"), mode, ...options], {
      cwd: root,
      env,
      encoding: "utf8",
    });
  try {
    mkdirSync(join(root, "scripts"));
    mkdirSync(join(root, "test-results"));
    mkdirSync(join(root, "tests/views"), { recursive: true });
    mkdirSync(join(root, "tests/editor"), { recursive: true });
    symlinkSync(resolve("node_modules"), join(root, "node_modules"), "dir");
    copyFileSync("scripts/check-test-execution.mjs", join(root, "scripts/check-test-execution.mjs"));
    expect(spawnSync("git", ["init", "--quiet"], { cwd: root }).status).toBe(0);
    const projects = ["pictures", "resources"];
    writeFileSync(
      join(root, "playwright.config.ts"),
      `export default ${JSON.stringify({
        testDir: "tests/views",
        outputDir: "test-results/browser",
        workers: 1,
        reporter: [["json", { outputFile: "test-results/playwright.json" }]],
        projects: projects.map((name) => ({ name, testMatch: `${name}.spec.mjs` })),
      })};`,
    );
    // These runner-policy fixtures need no browser; they exercise the actual installed CLI/reporters.
    for (const project of projects)
      writeFileSync(
        join(root, `tests/views/${project}.spec.mjs`),
        `import {test,expect} from '@playwright/test'; test('${project}',({},info)=>{
          expect(process.env.COVERAGE_BROWSER).toBe('1');
          info.annotations.push({type:'browser-coverage',description:'runner-policy fixture'});
          expect(1+1).toBe(2);
        });`,
      );
    writeFileSync(
      join(root, "playwright.editor.config.ts"),
      `export default ${JSON.stringify({
        testDir: "tests/editor",
        outputDir: "test-results/editor",
        workers: 1,
        reporter: [["json", { outputFile: "test-results/playwright-editor.json" }]],
        projects: [{ name: "settings", testMatch: "smoke.spec.mjs" }],
      })};`,
    );
    writeFileSync(
      join(root, "tests/editor/smoke.spec.mjs"),
      `import {test,expect} from '@playwright/test';
       for (const name of ['editor-first','editor-second'])
         test(name,({},info)=>{ expect(process.env.COVERAGE_BROWSER).toBe('1'); info.annotations.push({type:'browser-coverage'}); });`,
    );
    const complete = run();
    expect(complete.status, complete.stdout + complete.stderr).toBe(0);
    const report = readFileSync(join(root, "test-results/playwright.json"));
    mkdirSync(join(root, "tests/unregistered"));
    const orphan = join(root, "tests/unregistered/orphan.spec.mjs");
    writeFileSync(orphan, "import {test} from '@playwright/test'; test('orphan',()=>{});");
    const missingFolder = run();
    expect(missingFolder.status, missingFolder.stdout + missingFolder.stderr).toBe(1);
    expect(missingFolder.stderr).toContain("Undiscovered or empty test file: tests/unregistered/orphan.spec.mjs");
    rmSync(orphan);

    const results = [];
    for (const options of [
      ["--grep", "pictures", "--reporter=list"],
      ["--list", "--reporter=list"],
    ]) {
      writeFileSync(join(root, "test-results/playwright.json"), report);
      const result = run("browser", ...options);
      results.push({ options, status: result.status, output: result.stdout + result.stderr });
    }
    expect(
      results.map((result) => result.status),
      JSON.stringify(results),
    ).toEqual([1, 1]);
    writeFileSync(
      join(root, "tests/views/pictures.spec.mjs"),
      "import {test,expect} from '@playwright/test'; test('pictures',()=>expect(1+1).toBe(2));",
    );
    const missingCoverage = run();
    expect(missingCoverage.status, missingCoverage.stdout + missingCoverage.stderr).toBe(1);
    expect(missingCoverage.stderr).toContain("Missing per-case browser coverage collection");
    const editor = run("editor");
    expect(editor.status, editor.stdout + editor.stderr).toBe(0);
    const partialEditor = run("editor", "--grep", "editor-first");
    expect(partialEditor.status, partialEditor.stdout + partialEditor.stderr).toBe(1);
    expect(partialEditor.stderr).toContain("Missing execution result");
    writeFileSync(
      join(root, "tests/editor/omitted.spec.mjs"),
      "import {test,expect} from '@playwright/test'; test('omitted',()=>expect(true).toBe(true));",
    );
    const omittedEditor = run("editor");
    expect(omittedEditor.status, omittedEditor.stdout + omittedEditor.stderr).toBe(1);
    expect(omittedEditor.stderr).toContain("Undiscovered or empty test file: tests/editor/omitted.spec.mjs");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
