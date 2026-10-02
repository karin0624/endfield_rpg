import { expect, test } from "@playwright/test";

for (const count of [12, 24]) {
  test(`${count}候補の閲覧と詳細復帰は未確定のまま、確定だけが一度編成を変更する`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`/tests/fixtures/party-selection.html?count=${count}`);
    const before = await page.locator("#state").textContent();
    const slot = page.getByRole("button", { name: "枠 2", exact: true });
    await expect(slot).toHaveAccessibleDescription(/ギルベルタ.*HP 18 \/ 18/);
    await slot.focus();
    await page.keyboard.press("Enter");
    const grid = page.getByRole("group", { name: "候補一覧" });
    await expect(grid.getByRole("button")).toHaveCount(count);
    await expect(grid.getByRole("button", { name: "ロッシ", exact: true })).toHaveAccessibleDescription(
      /HP 20 \/ 20.*編成中/,
    );
    const candidate = grid.getByRole("button", { name: `仲間 ${count}`, exact: true });
    await page.screenshot({ path: testInfo.outputPath(`party-${count}-1920-top.png`) });
    // Real keyboard traversal scrolls the focused candidate into view without selecting it.
    for (let index = 2; index < count; index++) await page.keyboard.press("Tab");
    await expect(candidate).toBeFocused();
    await expect(candidate).toBeInViewport();
    await page.keyboard.press("Enter");
    await candidate.dblclick();
    await expect(candidate).toHaveAttribute("aria-pressed", "true");
    const handle = await grid.elementHandle();
    const scroll = await (await handle?.getProperty("scrollTop"))?.jsonValue();
    const detail = page.getByRole("button", { name: "詳細", exact: true });
    for (let attempt = 0; attempt < 3; attempt++) {
      await detail.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: `仲間 ${count}`, exact: true })).toBeVisible();
      await expect(dialog).toContainText("150 / 150");
      await expect(dialog).toContainText("90%");
      if (attempt === 1) await dialog.getByRole("button", { name: "編成へ戻る" }).click();
      else await page.keyboard.press("Escape");
      await expect(detail).toBeFocused();
      await expect(grid).toHaveJSProperty("scrollTop", scroll);
      await expect(candidate).toHaveAttribute("aria-pressed", "true");
      await expect(slot).toContainText("ギルベルタ");
    }
    for (const choice of await page.locator(".party-slot-choice").all()) await expect(choice).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath(`party-${count}-1920.png`) });
    await page.keyboard.press("Escape");
    await expect(slot).toBeFocused();
    await expect(slot).toContainText("ギルベルタ");
    await page.getByRole("button", { name: "状態を確認" }).click();
    await expect(page.locator("#state")).toHaveText(before ?? "");
    await expect(page.locator("#edits")).toHaveText("0");
    await slot.click();
    await expect(grid.getByRole("button", { name: "ギルベルタ", exact: true })).toHaveAttribute("aria-pressed", "true");
    await candidate.click();
    await page.getByRole("button", { name: "入れ替える", exact: true }).dblclick();
    await expect(slot).toContainText(`仲間 ${count}`);
    await expect(slot).toBeFocused();
    await expect(page.locator("#edits")).toHaveText("1");
  });
}

test("長名・未提供画像・他枠の重複と狭幅・低い画面での確定取消", async ({ page }, testInfo) => {
  await page.goto("/tests/fixtures/party-selection.html?long=1");
  for (const [width, height] of [
    [320, 844],
    [390, 844],
    [900, 700],
    [1150, 800],
    [1151, 800],
    [1920, 500],
  ]) {
    await page.setViewportSize({ width, height });
    const slot = page.getByRole("button", { name: "枠 4", exact: true });
    await slot.click();
    const grid = page.getByRole("group", { name: "候補一覧" });
    await grid.getByRole("button", { name: "ロッシ", exact: true }).click();
    await expect(page.getByRole("button", { name: "入れ替える", exact: true })).toBeDisabled();
    await expect(page.getByText("編成中。先に元の枠を空けてください。")).toBeVisible();
    const candidate = grid.getByRole("button", { name: /^長い名前/ });
    await candidate.click();
    await expect(candidate).toContainText("画像なし");
    const detail = page.getByRole("button", { name: "詳細", exact: true });
    await detail.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: /^長い名前/ })).toBeVisible();
    await dialog.getByText(/肉体疲労・軽度/).scrollIntoViewIfNeeded();
    await expect(dialog.getByText(/肉体疲労・軽度/)).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(detail).toBeFocused();
    const confirm = page.getByRole("button", { name: "入れ替える", exact: true });
    await confirm.scrollIntoViewIfNeeded();
    await expect(confirm).toBeInViewport();
    const bounds = await page.locator(".party-workspace").boundingBox();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? width) + (bounds?.width ?? width)).toBeLessThanOrEqual(width);
    await page.locator(".party-editor").screenshot({ path: testInfo.outputPath(`party-long-${width}-${height}.png`) });
    await page.getByRole("button", { name: "戻る", exact: true }).click();
    await expect(slot).toBeFocused();
    await expect(slot).toContainText("仲間 4");
  }
  await expect(page.locator("#edits")).toHaveText("0");
});
