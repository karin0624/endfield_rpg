import type { Reporter, TestModule } from "vitest/node";

// Vitest's JSON status alone hides expected failures and successful retries.
export default class ExecutionPolicyReporter implements Reporter {
  onTestRunEnd(modules: readonly TestModule[]) {
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
