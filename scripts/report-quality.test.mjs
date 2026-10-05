import { describe, expect, it } from "vitest";
import { renderQualitySummary } from "./report-quality.mjs";

const baseline = { exitCode: 1, revision: "checkout-sha", unit: null, browser: null, coverage: [], comparisons: [] };
const nativeCase = (status, retry = 0, collected = true) => ({
  projectName: "views",
  results: [{ status, retry }],
  annotations: collected ? [{ type: "browser-coverage", description: "{}" }] : [],
});

describe("quality evidence without stored artifacts", () => {
  it("reports an early failure as incomplete rather than borrowing absent results", () => {
    const summary = renderQualitySummary({ ...baseline, head: "pr-head", base: "pr-base" });
    expect(summary).toContain("Game quality: failed (exit 1)");
    expect(summary).toContain("Tested checkout: `checkout-sha`");
    expect(summary).toContain("PR head: `pr-head`");
    expect(summary).toContain("PR base: `pr-base`");
    expect(summary.match(/report not generated/g)).toHaveLength(2);
    expect(summary).toContain("none generated");
    expect(summary).not.toContain("Game quality: passed");
  });

  it("keeps failed, skipped, retried and uncollected Native cases visible by actual project", () => {
    const summary = renderQualitySummary({
      ...baseline,
      browser: {
        config: { projects: [{ name: "views" }, { name: "renderer" }], workers: 1 },
        suites: [
          {
            suites: [
              {
                specs: [
                  {
                    tests: [
                      nativeCase("passed"),
                      nativeCase("failed", 0, false),
                      nativeCase("skipped", 0, false),
                      nativeCase("passed", 1),
                    ],
                  },
                ],
              },
            ],
          },
        ],
        errors: [{ message: "teardown error" }],
        stats: { duration: 1234 },
      },
    });
    expect(summary).toContain("| Playwright views | 4 | 2 | 1 | 1 | 1 | 2 |");
    expect(summary).toContain("| Playwright renderer | 0 | 0 | 0 | 0 | 0 | 0 |");
    expect(summary).toContain("Playwright global errors: 1. Configured workers: 1. Native runner wall: 1.234s.");
    expect(summary).toContain("Game quality: failed");
  });

  it("retains zero-hit source counts and labels concept pixel differences as review diagnostics", () => {
    const metric = { total: 10, covered: 8, pct: 80 };
    const summary = renderQualitySummary({
      ...baseline,
      coverage: [
        {
          name: "views",
          sources: 3,
          summary: { total: { statements: metric, functions: metric, branches: metric, lines: metric } },
        },
      ],
      comparisons: [{ name: "selection", resolution: [1672, 941], full: { different_pixels: 13, pixels: 1573352 } }],
    });
    expect(summary).toContain("| views | 3 | 8 / 10 (80%) | 8 / 10 (80%) | 8 / 10 (80%) | 8 / 10 (80%) |");
    expect(summary).toContain("| selection | 1672 × 941 | 13 / 1573352 |");
    expect(summary).toContain("diagnostics for review, separate from the approved VRT gates and WCAG conformance");
  });
});
