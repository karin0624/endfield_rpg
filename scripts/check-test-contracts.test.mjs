import { describe, expect, it } from "vitest";
import { checkCatalog, checkExecution, playwrightCases, vitestCases } from "./check-test-contracts.mjs";

const registered = { id: "T-EXAMPLE", runner: "vitest", file: "src/example.test.ts", title: "example" };
const actual = { ...registered, status: "passed" };
const spec = {
  id: "S-EXAMPLE",
  source: "specs/battle.md",
  contract: "example contract",
  status: "covered",
  evidence: [{ test: "T-EXAMPLE", layer: "unit", assertion: "HP is 6" }],
};

describe("specification gate public failures", () => {
  it("accepts a registered executed case and refuses missing, unregistered or duplicate cases and excluded files", () => {
    expect(checkExecution([registered], [actual], "vitest", [registered.file])).toEqual([]);
    expect(checkExecution([registered], [], "vitest", [registered.file])).toHaveLength(2);
    expect(checkExecution([], [actual], "vitest", [registered.file])).toHaveLength(1);
    expect(checkExecution([registered], [actual, actual], "vitest", [registered.file])).toHaveLength(1);
    expect(checkExecution([registered, registered], [actual], "vitest", [registered.file])).toHaveLength(1);
    expect(checkExecution([registered], [actual], "vitest", ["src/excluded.test.ts"])).toHaveLength(1);
  });
  it.each(["skipped", "pending", "todo", "failed", "interrupted"])("rejects %s runtime status", (status) => {
    expect(checkExecution([registered], [{ ...actual, status }], "vitest", [registered.file])).toHaveLength(1);
  });
  it("requires unique IDs, a real registered test, an assertion and a verification layer", () => {
    expect(checkCatalog([spec], [registered])).toEqual([]);
    expect(checkCatalog([spec, spec], [registered])).toHaveLength(1);
    expect(checkCatalog([spec], [registered, registered])).toHaveLength(1);
    expect(checkCatalog([{ ...spec, evidence: [] }], [registered])).toHaveLength(1);
    expect(checkCatalog([spec], [])).toHaveLength(1);
    expect(checkCatalog([{ ...spec, evidence: [{ test: registered.id }] }], [registered])).toHaveLength(1);
  });
  it("reads Vitest statuses and fully qualified names from the actual report", () => {
    expect(
      vitestCases(
        {
          testResults: [
            { name: "/repo/src/example.test.ts", assertionResults: [{ fullName: "suite example", status: "skipped" }] },
          ],
        },
        "/repo",
      ),
    ).toEqual([{ runner: "vitest", file: "src/example.test.ts", title: "suite example", status: "skipped" }]);
  });
  it("requires a successful Playwright attempt, refuses list-only reports and failed retries", () => {
    const report = (results) => ({
      suites: [
        {
          title: "example.spec.ts",
          column: 0,
          suites: [
            {
              title: "suite",
              column: 1,
              specs: [{ title: "example", file: "example.spec.ts", tests: [{ projectName: "ui", results }] }],
            },
          ],
        },
      ],
    });
    expect(playwrightCases(report([{ status: "passed" }]))).toEqual([
      {
        runner: "playwright",
        project: "ui",
        file: "tests/e2e/example.spec.ts",
        title: "suite > example",
        status: "passed",
      },
    ]);
    expect(playwrightCases(report([]))[0].status).toBe("not-passed");
    expect(playwrightCases(report([{ status: "failed" }, { status: "passed" }]))[0].status).toBe("not-passed");
  });
});
