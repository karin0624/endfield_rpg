import { expect, it } from "vitest";
import { checkExecution, playwrightCases, vitestCases } from "./check-test-execution.mjs";

const collected = [{ file: "src/example.test.ts", key: "example" }];
const passed = [{ ...collected[0], passed: true }];

it("rejects a repository test file omitted from both runner collection and execution", () => {
  expect(checkExecution(["src/example.test.ts", "tests/new.test.ts"], collected, passed)).toContain(
    "Undiscovered or empty test file: tests/new.test.ts",
  );
});
it("rejects a collected case with a missing execution result", () => {
  expect(checkExecution(["src/example.test.ts"], collected, [])).toContain("Missing execution result: example");
});
it("rejects skipped, todo and failed Vitest outcomes, preserving describe hierarchy", () => {
  const report = (status) => ({
    testResults: [
      {
        name: "/repo/src/example.test.ts",
        assertionResults: [{ ancestorTitles: ["outer", "inner"], title: "case", status }],
      },
    ],
  });
  const discovery = vitestCases([{ file: "/repo/src/example.test.ts", name: "outer > inner > case" }], true, "/repo");
  for (const status of ["pending", "todo", "failed"]) {
    expect(
      checkExecution(["src/example.test.ts"], discovery, vitestCases(report(status), false, "/repo")).some((error) =>
        error.startsWith("Not passed"),
      ),
    ).toBe(true);
  }
  expect(checkExecution(["src/example.test.ts"], discovery, vitestCases(report("passed"), false, "/repo"))).toEqual([]);
});
it("rejects Playwright skipped, expected-failure, retry and absent results even when runner considers them expected", () => {
  const report = (test) => ({
    suites: [
      {
        suites: [
          {
            specs: [
              {
                id: "native-id",
                file: "ui/example.spec.ts",
                tests: [{ projectName: "ui", expectedStatus: "passed", ...test }],
              },
            ],
          },
        ],
      },
    ],
  });
  const discovery = playwrightCases(report({ results: [] }));
  for (const test of [
    { results: [] },
    { results: [{ status: "skipped", retry: 0 }], expectedStatus: "skipped" },
    { results: [{ status: "failed", retry: 0 }], expectedStatus: "failed" },
    {
      results: [
        { status: "failed", retry: 0 },
        { status: "passed", retry: 1 },
      ],
    },
  ])
    expect(
      checkExecution(["tests/e2e/ui/example.spec.ts"], discovery, playwrightCases(report(test))).some((error) =>
        error.startsWith("Not passed"),
      ),
    ).toBe(true);
  expect(
    checkExecution(
      ["tests/e2e/ui/example.spec.ts"],
      discovery,
      playwrightCases(report({ results: [{ status: "passed", retry: 0 }] })),
    ),
  ).toEqual([]);
});
it("rejects ambiguous case identities and results outside collection", () => {
  expect(checkExecution([], [...collected, ...collected], passed)).toContain("Duplicate discovered case: example");
  expect(checkExecution([], collected, [...passed, ...passed])).toContain("Duplicate executed case: example");
  expect(checkExecution([], collected, [{ file: "src/other.test.ts", key: "other", passed: true }])).toContain(
    "Execution absent from collection: other",
  );
});
