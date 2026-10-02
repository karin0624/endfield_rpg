import { expect, test } from "@playwright/test";

for (const width of [320, 1920]) {
  test(`長文詳細は${width}pxでキー入力だけで末尾へ到達し戻れる`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/tests/fixtures/character-details.html");
    const opener = page.getByRole("button", { name: /長い名前のロッシ.*の詳細/ });
    // Tab to the opener as a user would; no scripted focus or scroll assistance.
    for (let count = 0; count < 12 && !(await opener.evaluate((node) => node === document.activeElement)); count++) {
      await page.keyboard.press("Tab");
    }
    await expect(opener).toBeFocused();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    const info = dialog.getByRole("region", { name: "能力と状態" });
    const last = dialog.locator(".character-details-skill").last();
    await expect(last).not.toBeInViewport();
    await page.keyboard.press("Tab");
    await expect(info).toBeFocused();
    for (let count = 0; count < 20; count++) await page.keyboard.press("PageDown");
    await expect(last.getByRole("heading", { name: "検証用体力補正" })).toBeInViewport({ ratio: 1 });
    await expect(last.getByText("現在の効果：症状前の最大HP +7", { exact: true })).toBeInViewport({ ratio: 1 });
    await expect(last).toContainText("検証用体力補正");
    await expect(dialog.getByRole("button", { name: "編成へ戻る" })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`keyboard-details-${width}.png`) });
    await page.keyboard.press("Home");
    await expect(info).toHaveJSProperty("scrollTop", 0);
    await expect(dialog.getByText("HP", { exact: true })).toBeInViewport();
    if (width === 320) await page.keyboard.press("PageDown");
    await expect(dialog.getByText("レベル", { exact: true })).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
  });
}

test("応急回復の3択は対応済みの戦闘／分岐を案内して習得できる", async ({ page }) => {
  await page.goto("/tests/fixtures/acceptance-growth.html");
  const choice = page.getByRole("region", { name: "レベルアップのスキル選択" });
  await expect(choice.getByRole("button")).toHaveCount(3);
  const mend = choice.getByRole("button", { name: /検証用応急回復/ });
  await expect(mend).toContainText("新規アクティブ · 精神疲労 +1 · 戦闘／分岐");
  await expect(mend).not.toContainText("未対応");
  await mend.click();
  await expect(page.locator("#learned")).toHaveText("test-strike,test-heal,test-mend");
});
