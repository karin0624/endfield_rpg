import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { checkExecution, vitestCases } from "./check-test-execution.mjs";

const execute = promisify(execFile);

it.each([
  ["ordinary pass", "test('ordinary', () => expect(1).toBe(1))", false, ["ordinary"]],
  [
    "per-test retry",
    "let attempts = 0; test('retry', { retry: 1 }, () => expect(++attempts).toBe(2))",
    true,
    ["retry"],
  ],
  ["expected failure", "test.fails('expected', () => expect(1).toBe(2))", true, ["expected"]],
  [
    "inherited expected failure",
    "describe('suite', { fails: true }, () => test('expected', () => expect(1).toBe(2)))",
    true,
    ["suite > expected"],
  ],
  [
    "filtered collection",
    "test('kept', () => expect(1).toBe(1)); test('omitted', () => expect(2).toBe(2))",
    false,
    ["kept", "omitted"],
    ["--testNamePattern=kept"],
  ],
])(
  "native Vitest execution policy handles %s",
  async (name, source, rejected, collectedNames, options = []) => {
    const root = await mkdtemp(join(tmpdir(), "vitest-execution-policy-"));
    try {
      await symlink(resolve("node_modules"), join(root, "node_modules"), "dir");
      await writeFile(join(root, "probe.test.mjs"), `import { describe, expect, test } from 'vitest';\n${source};\n`);
      await writeFile(
        join(root, "vitest.config.mjs"),
        `export default { test: { include: ['probe.test.mjs'], retry: 0, reporters: ['json', ${JSON.stringify(resolve("scripts/vitest-execution-reporter.ts"))}], outputFile: { json: 'result.json' } } };`,
      );
      const result = await execute(process.execPath, [resolve("node_modules/vitest/vitest.mjs"), "run", ...options], {
        cwd: root,
      })
        .then((output) => ({ ...output, code: 0 }))
        .catch((error) => ({ stderr: error.stderr, code: error.code }));
      const report = JSON.parse(await readFile(join(root, "result.json"), "utf8"));
      const discovery = JSON.parse(await readFile(join(root, "test-results/vitest-discovery.json"), "utf8"));
      expect(discovery.map((test) => test.name)).toEqual(collectedNames);
      if (name === "filtered collection")
        expect(
          checkExecution(["probe.test.mjs"], vitestCases(discovery, true, root), vitestCases(report, false, root)).some(
            (error) => error.startsWith("Not passed without retry/skip"),
          ),
        ).toBe(true);
      // These first outcomes look passed in stock JSON; actual options/diagnostics distinguish retries/fails.
      expect(report.testResults[0].assertionResults[0].status).toBe("passed");
      expect(result.code).toBe(rejected ? 1 : 0);
      if (rejected) expect(result.stderr).toContain("Execution policy rejected:");
      else expect(result.stderr).not.toContain("Execution policy rejected:");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
  20_000,
);
