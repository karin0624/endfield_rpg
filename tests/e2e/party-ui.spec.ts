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
      await expect(dialog).toContainText("160 / 160");
      await expect(dialog).toContainText("92.31%");
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
    await page.getByRole("button", { name: "状態を確認", exact: true }).click();
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

test("共通画面の位置と操作文脈を保ち、選択・focus・非活性を区別する", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/tests/fixtures/party-selection.html?count=2");
  const title = page.getByRole("heading", { name: "出発準備", exact: true });
  const primary = page.getByRole("button", { name: "出発する", exact: true });
  const back = page.getByRole("button", { name: "戻る", exact: true });
  await expect(title).toHaveCSS("font-size", "32px");
  expect(await title.boundingBox()).toMatchObject({ x: 64, y: 48 });
  expect(await primary.boundingBox()).toMatchObject({ x: 1576, y: 968, width: 280, height: 64 });
  expect(await back.boundingBox()).toMatchObject({ x: 64, y: 976, width: 160, height: 48 });
  await expect(page.getByRole("region", { name: "未確定の候補" })).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("formation-departure-1920.png") });
  await page.getByRole("button", { name: "枠 3", exact: true }).click();
  const confirm = page.getByRole("button", { name: "編成する", exact: true });
  await expect(confirm).toBeDisabled();
  await expect(confirm).toHaveCSS("cursor", "default");
  await expect(primary).toBeHidden();
  const candidate = page.getByRole("button", { name: "ギルベルタ", exact: true });
  await candidate.focus();
  await page.keyboard.press("Space");
  await expect(candidate).toHaveAttribute("aria-pressed", "true");
  await expect(candidate).toHaveCSS("outline-width", "2px");
  expect(await confirm.boundingBox()).toMatchObject({ x: 1576, y: 968, width: 280, height: 64 });
  await page.screenshot({ path: testInfo.outputPath("formation-selection-1920.png") });
  await page.getByRole("button", { name: "詳細", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("formation-details-1920.png") });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.goto("/tests/fixtures/party-selection.html?count=2&edit=1");
  await expect(page.getByRole("heading", { name: "編成", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "出発する", exact: true })).toBeHidden();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "枠 2", exact: true }).click();
  await expect(page.getByRole("button", { name: "ギルベルタ", exact: true })).toHaveAttribute("aria-pressed", "true");
});
