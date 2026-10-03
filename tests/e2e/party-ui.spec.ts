import { expect, test } from "@playwright/test";
import { formationScreenshot, readyFormation } from "./formationEvidence";

for (const count of [12, 24]) {
  test(`${count}候補を仮編集し、欠番保持・詳細復帰・確定一回・Esc反映を確認する`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`/tests/fixtures/party-selection.html?count=${count}`);
    const before = await page.locator("#state").textContent();
    const slot = page.getByRole("button", { name: "枠 2", exact: true });
    await slot.click();
    const grid = page.getByRole("group", { name: "候補一覧" });
    const choices = grid.locator(".party-candidate");
    await expect(choices).toHaveCount(count);
    await choices.last().click();
    await expect(choices.last()).toHaveAttribute("aria-pressed", "false");
    await expect(grid.locator('.party-candidate[aria-pressed="true"]')).toHaveCount(4);
    await expect(choices.first()).toHaveAccessibleDescription(/隊列 1/);
    await expect(page.locator("#state")).toHaveText(before ?? "");
    await expect(page.getByRole("button", { name: "戻る", exact: true })).toBeHidden();
    await choices.nth(1).click();
    await expect(choices.nth(1)).toHaveAttribute("aria-pressed", "false");
    await expect(choices.nth(2)).toHaveAccessibleDescription(/隊列 3/);
    const last = choices.last();
    await choices.nth(1).focus();
    for (let index = 1; index < count - 1; index++) {
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
    }
    await expect(last).toBeFocused();
    await expect(last).toBeInViewport();
    await page.keyboard.press("Space");
    await expect(last).toHaveAccessibleDescription(/隊列 2/);
    const scroll = await grid.evaluate((node) => node.scrollTop);
    const detail = grid.getByRole("button", { name: `仲間 ${count}の詳細`, exact: true });
    await detail.click();
    const dialog = page.locator(".character-details");
    await expect(dialog).toContainText("160 / 160");
    await page.keyboard.press("Escape");
    await expect(detail).toBeFocused();
    await expect(grid).toHaveJSProperty("scrollTop", scroll);
    await expect(last).toHaveAccessibleDescription(/隊列 2/);
    await expect(page.locator("#state")).toHaveText(before ?? "");
    await formationScreenshot(page, testInfo, `party-${count}-1920.png`);
    await page.getByRole("button", { name: "確定", exact: true }).dblclick();
    await expect(slot).toContainText(`仲間 ${count}`);
    await expect(page.locator("#edits")).toHaveText("1");
    await slot.click();
    await choices.first().click();
    await expect(choices.nth(2)).toHaveAccessibleDescription(/隊列 3/);
    await page.keyboard.down("Escape");
    await page.keyboard.down("Escape");
    await page.keyboard.up("Escape");
    await expect(page.getByRole("heading", { name: "出発準備", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "枠 1", exact: true })).toContainText(`仲間 ${count}`);
    await expect(page.locator("#edits")).toHaveText("2");
  });
}

test("長名・未提供画像・狭幅・低い画面で詳細と確定へ到達できる", async ({ page }, testInfo) => {
  for (const [width, height] of [
    [320, 844],
    [390, 844],
    [900, 700],
    [901, 800],
    [1024, 800],
    [1150, 800],
    [1151, 800],
    [1920, 500],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/tests/fixtures/party-selection.html?long=1");
    await page.getByRole("button", { name: "枠 4", exact: true }).click();
    const candidate = page
      .getByRole("group", { name: "候補一覧" })
      .getByRole("button", { name: /^長い名前/, exact: false })
      .first();
    await candidate.scrollIntoViewIfNeeded();
    await expect(candidate).toContainText("画像なし");
    const detail = page.getByRole("button", { name: /^長い名前.*の詳細$/ });
    await detail.click();
    const dialog = page.locator(".character-details");
    await expect(dialog.getByRole("heading", { name: /^長い名前/ })).toBeVisible();
    await dialog.getByText(/肉体疲労・軽度/).scrollIntoViewIfNeeded();
    await expect(dialog.getByText(/肉体疲労・軽度/)).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(detail).toBeFocused();
    const card = candidate.locator("..");
    const cardBox = await card.boundingBox();
    const hpBox = await card.locator(".party-candidate-hp").boundingBox();
    expect((hpBox?.y ?? Infinity) + (hpBox?.height ?? 0)).toBeLessThanOrEqual(
      (cardBox?.y ?? 0) + (cardBox?.height ?? 0),
    );
    const confirm = page.getByRole("button", { name: "確定", exact: true });
    await confirm.scrollIntoViewIfNeeded();
    await expect(confirm).toBeInViewport();
    const bounds = await page.locator(".party-candidates").boundingBox();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? width) + (bounds?.width ?? width)).toBeLessThanOrEqual(width);
    await readyFormation(page);
    await page.screenshot({ path: testInfo.outputPath(`party-long-${width}-${height}.png`) });
    await confirm.click();
    await expect(page.getByRole("button", { name: "枠 4", exact: true })).toContainText("仲間 4");
  }
});

for (const width of [320, 390, 1920]) {
  test(`習得詳細は${width}pxで現在値・長文を読め、帰還初期化後の再開に古い習得を残さない`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1080 });
    await page.goto("/tests/fixtures/character-details.html");
    const before = await page.locator("#state").textContent();
    const opener = page.getByRole("button", { name: /長い名前のロッシ.*の詳細/ });
    await opener.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    const stat = (label: string) =>
      dialog
        .locator(".character-details-stats > div")
        .filter({ has: page.getByText(label, { exact: true }) })
        .locator("dd");
    await expect(stat("レベル")).toHaveText("4");
    await expect(stat("HP")).toContainText("症状前最大HP 39（成長・パッシブ込み）");
    await expect(stat("HP")).toContainText("基礎最大HP 20");
    await expect(stat("攻撃力")).toContainText("11");
    const passive = dialog.locator(".character-details-skill").filter({ hasText: "検証用攻撃力補正" });
    await expect(passive).toContainText("ランク 2 / 上限 3");
    await expect(passive).toContainText("通常攻撃のみの威力補正 +4");
    const active = dialog.locator(".character-details-skill").filter({ hasText: "検証用軽撃" });
    await expect(active).toContainText("レベル保証で習得");
    await expect(active).toContainText("探索中のみ（帰還で失う）");
    await expect(active).not.toContainText("減衰");
    await expect(active).not.toContainText("ランク");
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("region", { name: "能力と状態" })).toBeFocused();
    for (let count = 0; count < 15; count++) await page.keyboard.press("PageDown");
    const last = dialog.locator(".character-details-skill").last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    const bounds = await dialog.boundingBox();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? width) + (bounds?.width ?? width)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`skills-${width}.png`) });
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
    await page.getByRole("button", { name: "状態を確認", exact: true }).click();
    await expect(page.locator("#state")).toHaveText(before ?? "");
    await page.getByRole("button", { name: "帰還時の育成初期化" }).click();
    const reset = await page.locator("#state").textContent();
    await opener.click();
    await expect(stat("レベル")).toHaveText("1");
    await expect(stat("HP")).toContainText("症状前最大HP 20");
    await expect(passive).toContainText("ランク 1 / 上限 3");
    await expect(dialog).not.toContainText("検証用軽撃");
    await expect(dialog).not.toContainText("検証用体力補正");
    await dialog.getByRole("button", { name: "編成へ戻る" }).click();
    await page.getByRole("button", { name: "状態を確認", exact: true }).click();
    await expect(page.locator("#state")).toHaveText(reset ?? "");
  });
}

test("初期習得の未決と空を区別し、タップで詳細を閉じて戻る", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  for (const mode of ["unknown", "empty"]) {
    await page.goto(`/tests/fixtures/character-details.html?mode=${mode}`);
    const opener = page.getByRole("button", { name: /長い名前のロッシ.*の詳細/ });
    await opener.tap();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(mode === "unknown" ? "習得情報は未接続です。" : "習得スキルなし");
    await dialog.getByRole("button", { name: "編成へ戻る" }).tap();
    await expect(opener).toBeFocused();
  }
  await context.close();
});

test("承認画像の4状態を同じfixtureと1672×941で実撮影する", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  for (const [name, mode, selection] of [
    ["departure", "normal", false],
    ["selection", "normal", true],
    ["disabled", "disabled", false],
    ["symptoms", "symptoms", true],
  ] as const) {
    await page.goto(`/tests/fixtures/party-approved.html?mode=${mode}`);
    if (selection) await page.getByRole("button", { name: "枠 1", exact: true }).click();
    await page.mouse.move(1660, 10);
    await formationScreenshot(page, testInfo, `approved-${name}.png`);
    if (name === "disabled") await expect(page.getByRole("button", { name: "出発する", exact: true })).toBeDisabled();
    if (name === "symptoms") {
      const card = page.locator(".party-candidate-card").first();
      await expect(card).toContainText("HP 13/13");
      await expect(card).toContainText("肉体疲労・中度　朦朧・重度");
    }
    if (selection) {
      await expect(page.getByRole("button", { name: "戻る", exact: true })).toBeHidden();
      await expect(page.locator(".party-order")).toHaveText(["1", "2"]);
    }
  }
});

test("主操作はマウス保持とSpace押下中も暗い文字を保つ", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tests/fixtures/party-selection.html?count=2");
  for (const slot of await page.locator(".party-slot.is-occupied").all()) {
    const portrait = await slot.locator(".party-slot-portrait").boundingBox();
    const image = await slot.locator("img").boundingBox();
    const name = await slot.locator(".party-slot-name").boundingBox();
    expect((image?.y ?? Infinity) + (image?.height ?? 0)).toBeLessThanOrEqual(
      (portrait?.y ?? 0) + (portrait?.height ?? 0) + 1,
    );
    expect(name?.y ?? 0).toBeGreaterThanOrEqual((portrait?.y ?? 0) + (portrait?.height ?? 0));
  }
  const primary = page.getByRole("button", { name: "出発する", exact: true });
  await primary.hover();
  await page.mouse.down();
  await expect
    .poll(() => primary.evaluate((button) => getComputedStyle(button, "::after").backgroundColor))
    .toBe("rgb(201, 151, 85)");
  await expect(primary).toHaveCSS("color", "rgb(37, 42, 44)");
  await formationScreenshot(page, testInfo, "formation-primary-pressed-1920.png");
  await page.mouse.up();
  await primary.focus();
  await page.keyboard.down("Space");
  await expect
    .poll(() => primary.evaluate((button) => getComputedStyle(button, "::after").backgroundColor))
    .toBe("rgb(201, 151, 85)");
  await expect(primary).toHaveCSS("color", "rgb(37, 42, 44)");
  await expect(primary).toHaveCSS("outline-color", "rgb(255, 255, 255)");
  await expect(primary).toHaveCSS("outline-width", "2px");
  await expect(primary).toHaveCSS("outline-offset", "4px");
  await formationScreenshot(page, testInfo, "formation-primary-space-focus-1920.png");
  await page.keyboard.up("Space");
});
