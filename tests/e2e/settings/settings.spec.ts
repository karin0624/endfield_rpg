import { collectCoverage, expect, test } from "../coverage";

// Developer editors need a short save/read bridge in the default suite.
// Detailed control, draft, failure and layout checks are explicitly run with test:editor.
for (const example of [
  {
    kind: "battle",
    path: "/tests/fixtures/battle-editor.html",
    panel: "構図設定",
    group: "カメラの初期位置",
    label: "カメラ 高さ",
    value: "8",
    entry: "構図設定",
  },
  {
    kind: "adventure",
    path: "/?debug=1&adventureEdit=1",
    panel: "会話画面の配置設定",
    group: "立ち絵・横画面",
    label: "左の水平位置 (%)",
    value: "32",
    entry: "会話画面の配置設定",
  },
]) {
  test(`${example.kind}設定の代表値を標準保存し通常表示から読み込める`, async ({ page }) => {
    await page.goto(example.path);
    const panel = page.getByRole("complementary", { name: example.panel });
    const save = panel.getByRole("button", { name: "標準として保存", exact: true });
    const input = panel
      .getByRole("group", { name: example.group })
      .getByRole("spinbutton", { name: example.label, exact: true });
    await expect(save).toBeEnabled({ timeout: 60_000 });
    await input.fill(example.value);
    await save.click();
    await expect(panel.getByRole("status")).toContainText("標準として保存しました");
    await collectCoverage(page);
    await page.getByRole("link", { name: "保存済みの通常表示", exact: true }).click();
    if (example.kind === "battle")
      await expect(page.getByRole("button", { name: "通常攻撃", exact: true })).toBeEnabled({ timeout: 60_000 });
    else await expect(page.getByRole("heading", { name: "街の広場", exact: true })).toBeVisible();
    await collectCoverage(page);
    await page.getByRole("link", { name: example.entry, exact: true }).click();
    await expect(input).toHaveValue(example.value, { timeout: 60_000 });
    await expect(panel.getByRole("status")).not.toContainText("復元");
  });
}
