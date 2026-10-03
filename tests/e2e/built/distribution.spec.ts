import { readdir } from "node:fs/promises";
import { collectCoverage, expect, test } from "../coverage";

test("通常配布はfixture・設定保存API・開発entryを公開しない", async ({ page, request }) => {
  await collectCoverage(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ENDFIELD RPG" })).toBeVisible();
  for (const endpoint of ["battle-settings", "adventure-settings"]) {
    const response = await request.post(`/__dev/${endpoint}`, { data: { version: 1 } });
    expect(response.ok()).toBe(false);
  }
  for (const path of ["/tests/fixtures/battle-ui.html", "/src/web/debugMain.ts", "/?debug=1&edit=1"]) {
    await collectCoverage(page);
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "ENDFIELD RPG" })).toBeVisible();
    await expect(page.getByRole("button", { name: "通常攻撃", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "標準として保存", exact: true })).toHaveCount(0);
  }
  const entries = await readdir(process.env.COVERAGE_BROWSER === "1" ? "dist-coverage" : "dist", { recursive: true });
  expect(entries.some((entry) => /(^|\/)(tests|src|scripts)(\/|$)/.test(entry))).toBe(false);
});
