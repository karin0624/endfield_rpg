import { expect, it } from "vitest";
import { checkExecution, checkPlaywrightProjects, playwrightCases, vitestCases } from "./check-test-execution.mjs";

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
    config: { rootDir: "/repo/tests/views", projects: [{ name: "ui" }] },
    suites: [
      {
        suites: [
          {
            specs: [
              {
                id: "native-id",
                file: "example.spec.ts",
                tests: [{ projectName: "ui", expectedStatus: "passed", ...test }],
              },
            ],
          },
        ],
      },
    ],
  });
  const discovery = playwrightCases(report({ results: [] }), false, "/repo");
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
      checkExecution(["tests/views/example.spec.ts"], discovery, playwrightCases(report(test), false, "/repo")).some(
        (error) => error.startsWith("Not passed"),
      ),
    ).toBe(true);
  expect(
    checkExecution(
      ["tests/views/example.spec.ts"],
      discovery,
      playwrightCases(report({ results: [{ status: "passed", retry: 0 }] }), false, "/repo"),
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

it("rejects passed Vitest JSON cases retaining errors from an earlier attempt", () => {
  const report = {
    testResults: [
      {
        name: "/repo/src/example.test.ts",
        assertionResults: [{ ancestorTitles: [], title: "case", status: "passed", failureMessages: ["first failure"] }],
      },
    ],
  };
  expect(vitestCases(report, false, "/repo")[0].passed).toBe(false);
});

it("tracks case-level browser collection and resolves files from native report rootDir", () => {
  const report = (annotations) => ({
    config: { rootDir: "/repo/tests/editor/views", projects: [{ name: "developer-images" }] },
    suites: [
      {
        specs: [
          {
            id: "case",
            file: "campaign.spec.ts",
            tests: [
              {
                projectName: "built",
                expectedStatus: "passed",
                results: [{ status: "passed", retry: 0 }],
                annotations,
              },
            ],
          },
        ],
      },
    ],
  });
  expect(playwrightCases(report([]))[0].coverageRecorded).toBe(false);
  expect(
    playwrightCases(report([{ type: "browser-coverage", description: "documents=1,mappedEntries=1" }]))[0]
      .coverageRecorded,
  ).toBe(true);
  expect(playwrightCases(report([]), false, "/repo")[0].file).toBe("tests/editor/views/campaign.spec.ts");
});

it("derives every required project from native discovery and rejects empty or different configurations", () => {
  const discovery = {
    config: { rootDir: "/repo/tests", projects: [{ name: "pictures" }, { name: "native-gpu" }] },
    suites: [],
  };
  const result = {
    ...discovery,
    suites: [
      {
        specs: [
          {
            id: "picture",
            file: "views/picture.spec.ts",
            tests: [{ projectName: "pictures", expectedStatus: "passed", results: [{ status: "passed", retry: 0 }] }],
          },
        ],
      },
    ],
  };
  expect(checkPlaywrightProjects(discovery, result)).toEqual(["Missing required project: native-gpu"]);
  expect(
    checkPlaywrightProjects(discovery, { ...result, config: { ...result.config, projects: [{ name: "pictures" }] } }),
  ).toContain("Executed project configuration differs from discovery");
  expect(
    checkPlaywrightProjects(
      { ...discovery, config: { ...discovery.config, projects: [] } },
      { ...result, config: { ...result.config, projects: [] } },
    ),
  ).toContain("Empty project configuration");
});
