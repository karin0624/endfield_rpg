import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import type { Reporter, TestModule } from "vitest/node";

// Vitest's JSON status alone hides expected failures and successful retries.
export default class ExecutionPolicyReporter implements Reporter {
  private collected: { file: string; name: string }[] = [];

  onTestRunStart() {
    this.collected = [];
    mkdirSync("test-results", { recursive: true });
    rmSync("test-results/vitest-discovery.json", { force: true });
  }

  onTestModuleCollected(module: TestModule) {
    // Snapshot the native collection before execution mutates outcomes. This
    // includes filtered/skipped cases, unlike `vitest list`'s displayed JSON.
    for (const test of module.children.allTests()) this.collected.push({ file: module.moduleId, name: test.fullName });
  }

  onTestRunEnd(modules: readonly TestModule[]) {
    writeFileSync("test-results/vitest-discovery.json", JSON.stringify(this.collected));
    for (const module of modules) {
      for (const test of module.children.allTests()) {
        const retries = test.diagnostic()?.retryCount ?? 0;
        if (test.options.fails || retries > 0 || test.result().errors?.length) {
          console.error(
            `Execution policy rejected: ${module.moduleId} > ${test.fullName} (fails=${Boolean(test.options.fails)}, retries=${retries})`,
          );
          process.exitCode = 1;
        }
      }
    }
  }
}
