import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";

const execute = promisify(execFile);

it.each([
  ["ordinary pass", "test('ordinary', () => expect(1).toBe(1))", false],
  ["per-test retry", "let attempts = 0; test('retry', { retry: 1 }, () => expect(++attempts).toBe(2))", true],
  ["expected failure", "test.fails('expected', () => expect(1).toBe(2))", true],
  [
    "inherited expected failure",
    "describe('suite', { fails: true }, () => test('expected', () => expect(1).toBe(2)))",
    true,
  ],
])(
  "native Vitest execution policy handles %s",
  async (_name, source, rejected) => {
    const root = await mkdtemp(join(tmpdir(), "vitest-execution-policy-"));
    try {
      await symlink(resolve("node_modules"), join(root, "node_modules"), "dir");
      await writeFile(join(root, "probe.test.mjs"), `import { describe, expect, test } from 'vitest';\n${source};\n`);
      await writeFile(
        join(root, "vitest.config.mjs"),
        `export default { test: { include: ['probe.test.mjs'], retry: 0, reporters: ['json', ${JSON.stringify(resolve("scripts/vitest-execution-reporter.ts"))}], outputFile: { json: 'result.json' } } };`,
      );
      const result = await execute(process.execPath, [resolve("node_modules/vitest/vitest.mjs"), "run"], { cwd: root })
        .then((output) => ({ ...output, code: 0 }))
        .catch((error) => ({ stderr: error.stderr, code: error.code }));
      const report = JSON.parse(await readFile(join(root, "result.json"), "utf8"));
      // All four look passed in the stock JSON; the runner's actual options/diagnostics must distinguish them.
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
