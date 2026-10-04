import { collectCoverage, expect, test } from "../coverage";
import { expectRenderedFont, formationScreenshot, readyFormation } from "../formationEvidence";

test("編成integration: campaign配下の通常入力と選択・押し直し解除をcapture込みで通す", async ({ page }) => {
  await collectCoverage(page);
  await page.goto("/");
  await page.getByRole("button", { name: "新規開始", exact: true }).click();
  await page.getByRole("button", { name: "実行する", exact: true }).click();
  await page.getByRole("button", { name: "ホームへ", exact: true }).click();
  const quantity = page.getByRole("spinbutton", { name: "持込み個数（HP回復品）" });
  await quantity.dblclick();
  await expect(quantity).toBeFocused();
  await quantity.fill("0");
  await expect(quantity).toHaveValue("0");
  await page.getByRole("button", { name: "出撃編成を見る", exact: true }).click();
  await page.getByRole("button", { name: "枠 1", exact: true }).click();
  const candidate = page.getByRole("group", { name: "候補一覧" }).getByRole("button", { name: "ロッシ", exact: true });
  await candidate.focus();
  await page.keyboard.press("Space");
  // A single synchronous dispatch sequence includes both real mounted capture ancestors.
  // Synthetic integration input does not replace the native pointer tests below and in campaign.spec.ts.
  const states = await candidate.evaluate((button) =>
    [1, 2, 3].map((detail) => {
      for (const type of ["mousedown", "mouseup", "click"]) {
        const event = new MouseEvent(type, { bubbles: true, cancelable: true, detail });
        button.dispatchEvent(event);
      }
      return button.getAttribute("aria-pressed");
    }),
  );
  expect(states).toEqual(["true", "false", "true"]);
});

test("候補の短間隔4連続クリックと複数カード切替を一回ずつ即時反映する", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await collectCoverage(page);
  await page.goto("/tests/fixtures/party-selection.html?count=12");
  await page.getByRole("button", { name: "枠 1", exact: true }).click();
  const choices = page.locator(".party-candidate");
  const box = await choices.first().boundingBox();
  if (!box) throw new Error("候補カードが表示されていません");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let clickCount = 1; clickCount <= 4; clickCount++) {
    // Real browser click counts, with no sleep, locator actionability wait, or retry assertion between inputs.
    await page.mouse.down({ clickCount });
    await page.mouse.up({ clickCount });
    expect(await choices.first().getAttribute("aria-pressed")).toBe(String(clickCount % 2 === 0));
  }
  for (const [index, selected] of [
    [0, false],
    [1, false],
    [4, true],
    [0, true],
    [4, false],
    [1, true],
  ] as const) {
    const target = await choices.nth(index).boundingBox();
    if (!target) throw new Error("候補カードが表示されていません");
    await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
    expect(await choices.nth(index).getAttribute("aria-pressed")).toBe(String(selected));
  }
  expect(await page.locator("#edits").textContent()).toBe("0");
  await page.getByRole("button", { name: "確定", exact: true }).dblclick();
  await expect(page.locator("#edits")).toHaveText("1");
  await page.getByRole("button", { name: "出発する", exact: true }).dblclick();
  await expect(page.locator("#departures")).toHaveText("1");
});

test("候補の選択・押し直し解除・再選択で枠と番号のVRTが一致する", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await collectCoverage(page);
  await page.goto("/tests/fixtures/party-selection.html?count=2");
  await page.getByRole("button", { name: "枠 1", exact: true }).click();
  await readyFormation(page);
  const candidate = page.locator(".party-candidate").first();
  const card = page.locator(".party-candidate-card").first();
  await candidate.focus();
  await page.keyboard.press("Space");
  const box = await card.boundingBox();
  const buttonBox = await candidate.boundingBox();
  if (!box || !buttonBox) throw new Error("候補カードが表示されていません");
  // Include the outer selection brackets, portrait, number, name, HP/bar, and detail action. No masks.
  const clip = {
    x: Math.floor(box.x) - 8,
    y: Math.floor(box.y) - 8,
    width: Math.ceil(box.width) + 16,
    height: Math.ceil(box.height) + 16,
  };
  await page.mouse.move(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2);
  for (const clickCount of [1, 2, 3]) {
    await page.mouse.down({ clickCount });
    await page.mouse.up({ clickCount });
    expect(await candidate.getAttribute("aria-pressed")).toBe(String(clickCount !== 2));
    await expect(page).toHaveScreenshot(
      clickCount === 2 ? "party-candidate-unselected.png" : "party-candidate-selected.png",
      {
        clip,
        animations: "disabled",
        maxDiffPixels: 0,
      },
    );
  }
});

for (const count of [12, 24]) {
  test(`${count}候補を仮編集し、欠番保持・詳細復帰・確定一回・Esc反映を確認する`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await collectCoverage(page);
    await page.goto(`/tests/fixtures/party-selection.html?count=${count}`);
    const readState = async () => JSON.parse((await page.locator("#state").textContent()) ?? "");
    const before = await readState();
    const slot = page.getByRole("button", { name: "枠 2", exact: true });
    await slot.click();
    const grid = page.getByRole("group", { name: "候補一覧" });
    const choices = grid.locator(".party-candidate");
    await expect(choices).toHaveCount(count);
    await expect(choices.last()).toBeDisabled();
    await expect(choices.last()).toHaveAccessibleDescription(/4人まで/);
    await choices.last().focus();
    await page.keyboard.press("Enter");
    await expect(choices.last()).toHaveAttribute("aria-pressed", "false");
    await expect(grid.locator('.party-candidate[aria-pressed="true"]')).toHaveCount(4);
    await expect(choices.first()).toHaveAccessibleDescription(/隊列 1/);
    // The modal makes the fixture control inert; invoke its public snapshot action without moving focus.
    await page.locator("#snapshot").evaluate((button: HTMLButtonElement) => button.click());
    await expect.poll(readState).toEqual(before);
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
    // The modal makes the fixture control inert; invoke its public snapshot action without moving focus.
    await page.locator("#snapshot").evaluate((button: HTMLButtonElement) => button.click());
    await expect.poll(readState).toEqual(before);
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
    await collectCoverage(page);
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
    await collectCoverage(page);
    await page.goto("/tests/fixtures/character-details.html");
    const readState = async () => JSON.parse((await page.locator("#state").textContent()) ?? "");
    const before = await readState();
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
    // The modal makes the fixture control inert; invoke its public snapshot action without moving focus.
    await page.locator("#snapshot").evaluate((button: HTMLButtonElement) => button.click());
    await expect.poll(readState).toEqual(before);
    await page.getByRole("button", { name: "帰還時の育成初期化" }).click();
    const reset = await readState();
    await opener.click();
    await expect(stat("レベル")).toHaveText("1");
    await expect(stat("HP")).toContainText("症状前最大HP 20");
    await expect(passive).toContainText("ランク 1 / 上限 3");
    await expect(dialog).not.toContainText("検証用軽撃");
    await expect(dialog).not.toContainText("検証用体力補正");
    await dialog.getByRole("button", { name: "編成へ戻る" }).click();
    await page.getByRole("button", { name: "状態を確認", exact: true }).click();
    await expect.poll(readState).toEqual(reset);
  });
}

test.describe(() => {
  test.use({ reducedMotion: "no-preference", hasTouch: true, viewport: { width: 390, height: 844 } });
  test("初期習得の未決と空を区別し、タップで詳細を閉じて戻る", async ({ page }) => {
    for (const mode of ["unknown", "empty"]) {
      await collectCoverage(page);
      await page.goto(`/tests/fixtures/character-details.html?mode=${mode}`);
      const opener = page.getByRole("button", { name: /長い名前のロッシ.*の詳細/ });
      await opener.tap();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText(mode === "unknown" ? "習得情報は未接続です。" : "習得スキルなし");
      await dialog.getByRole("button", { name: "編成へ戻る" }).tap();
      await expect(opener).toBeFocused();
    }
  });
});

test("承認画像に対応する4状態を1672×941のVRTで検証する", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  for (const [name, mode, selection] of [
    ["departure", "normal", false],
    ["selection", "normal", true],
    ["disabled", "disabled", false],
    ["symptoms", "symptoms", true],
  ] as const) {
    await collectCoverage(page);
    await page.goto(`/tests/fixtures/party-approved.html?mode=${mode}`);
    if (selection) await page.getByRole("button", { name: "枠 1", exact: true }).click();
    await page.mouse.move(1660, 10);
    await formationScreenshot(page, testInfo, `approved-${name}.png`);
    await expect(page).toHaveScreenshot(`approved-${name}.png`);
    if (name === "disabled") await expect(page.getByRole("button", { name: "出発する", exact: true })).toBeDisabled();
    if (name === "symptoms") {
      const card = page.locator(".party-candidate-card").first();
      await expect(card).toContainText("HP 13/13");
      await expect(card).toContainText("肉体疲労・中度　朦朧・重度");
    }
    if (selection) {
      for (const card of await page.locator(".party-candidate-card").all())
        await expect(card).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole("button", { name: "戻る", exact: true })).toBeHidden();
      await expect(page.locator(".party-order")).toHaveText(["1", "2"]);
    }
  }
});

test("主操作のマウス保持とSpace押下中の文字・focusをVRTで検証する", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await collectCoverage(page);
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
  await readyFormation(page);
  const geometry = () =>
    primary.evaluate((button) => {
      const bounds = button.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(button);
      return {
        control: [bounds.x, bounds.y, bounds.width, bounds.height],
        text: Array.from(range.getClientRects(), (rect) => [rect.x, rect.y, rect.width, rect.height]),
      };
    });
  const normalGeometry = await geometry();
  await primary.hover();
  expect(await geometry()).toEqual(normalGeometry);
  await expect(page).toHaveScreenshot("formation-primary-hover-1920.png");
  await page.mouse.down();
  expect(await geometry()).toEqual(normalGeometry);
  await readyFormation(page);
  await expect(page).toHaveScreenshot("formation-primary-pressed-1920.png");
  await page.mouse.up();
  await primary.focus();
  await page.keyboard.down("Space");
  await expect(primary).toBeFocused();
  expect(await geometry()).toEqual(normalGeometry);
  await expect(page).toHaveScreenshot("formation-primary-space-focus-1920.png");
  await page.keyboard.up("Space");
});

test("先頭・中段の長名と3症状が後続カードへ重ならず、精神疲労を詳細でも確認できる", async ({ page }, info) => {
  for (const width of [1920, 1024, 390]) {
    await page.setViewportSize({ width, height: 1080 });
    await collectCoverage(page);
    await page.goto("/tests/fixtures/party-selection.html?count=12&stress=1");
    await expect(page.locator(".party-slot-symptoms").first()).toContainText("精神疲労・中度");
    await page.getByRole("button", { name: "枠 1", exact: true }).click();
    const cards = page.locator(".party-candidate-card");
    for (const index of [0, 4, 5]) {
      const card = cards.nth(index);
      const symptoms = card.locator(".party-candidate-symptoms");
      await expect(symptoms).toHaveText("肉体疲労・中度　朦朧・重度　精神疲労・中度");
      expect(await symptoms.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
      await card.getByRole("button", { name: /の詳細$/ }).click();
      await expect(page.locator(".character-details-stats")).toContainText("50（中度）");
      await page.keyboard.press("Escape");
      await symptoms.scrollIntoViewIfNeeded();
      await expect(symptoms).toBeInViewport();
      await page.screenshot({ path: info.outputPath(`party-stress-${width}-${index}.png`) });
    }
    const collisions = await cards.evaluateAll((nodes) =>
      nodes.flatMap((card, index) => {
        const rect = card.getBoundingClientRect();
        const contentBottom = Math.max(
          ...[".party-candidate-name", ".party-candidate-hp", ".party-detail", ".party-candidate-symptoms"].map(
            (selector) => card.querySelector(selector)?.getBoundingClientRect().bottom ?? 0,
          ),
        );
        const next = nodes.slice(index + 1).find((node) => {
          const box = node.getBoundingClientRect();
          return Math.abs(box.x - rect.x) < 1 && box.top > rect.top;
        });
        return contentBottom > rect.bottom + 1 || (next && rect.bottom > next.getBoundingClientRect().top)
          ? [index]
          : [];
      }),
    );
    expect(collisions).toEqual([]);
  }
});

test("満員候補の詳細も読め、Enter選択とmodal隔離・確定後focusを保つ", async ({ page }) => {
  await collectCoverage(page);
  await page.goto("/tests/fixtures/party-selection.html?count=12");
  const opener = page.getByRole("button", { name: "枠 2", exact: true });
  await opener.click();
  const choices = page.locator(".party-candidate");
  await expect(choices.last()).toBeDisabled();
  const detail = page.getByRole("button", { name: "仲間 12の詳細", exact: true });
  await detail.click();
  const dialog = page.locator(".character-details");
  await expect(dialog).toContainText("160 / 160");
  await expect(dialog).toContainText("上限 200 · 街探索1回につき 10 回復");
  // Cycling all focusable controls cannot reach the underlying party selection.
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    // Native Tab may visit browser chrome (activeElement becomes body), never background controls.
    expect(
      await dialog.evaluate(
        (node) => document.activeElement === document.body || node.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.mouse.click(5, 5);
  await expect(dialog).toBeVisible();
  await expect(page.locator("#edits")).toHaveText("0");
  await page.keyboard.press("Escape");
  await expect(detail).toBeFocused();
  await expect(page.locator('.party-candidate[aria-pressed="true"]')).toHaveCount(4);
  await choices.first().focus();
  await page.keyboard.press("Enter");
  await expect(choices.first()).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Enter");
  await expect(choices.first()).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "確定", exact: true }).click();
  await expect(opener).toBeFocused();
  await opener.click();
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
});

test("人物画像のHTTP失敗でも候補選択と詳細・復帰を操作できる", async ({ page }) => {
  await page.route(/\/assets\/characters\//, (route) => route.abort());
  await collectCoverage(page);
  await page.goto("/tests/fixtures/party-selection.html?count=2&mental-low=1");
  await page.getByRole("button", { name: "枠 1", exact: true }).click();
  const card = page.locator(".party-candidate-card").first();
  await expect(card).toContainText("ロッシ");
  await expect(card).toContainText("画像なし");
  await expect(card).toContainText("HP 20/20");
  await expect(card.locator(".party-candidate-symptoms")).toHaveText("精神疲労・なし");
  const detail = card.getByRole("button", { name: "ロッシの詳細", exact: true });
  await detail.click();
  await expect(page.locator(".character-details")).toContainText("画像なし");
  await expect(page.locator(".character-details")).toContainText("20 / 20");
  await expect(page.locator(".character-details")).toContainText("12（なし）");
  await page.keyboard.press("Escape");
  await expect(detail).toBeFocused();
  await card.locator(".party-candidate").click();
  await expect(card.locator(".party-candidate")).toHaveAttribute("aria-pressed", "false");
});

test("出発不可は全員戦闘不能と空編成の理由を操作の説明へ結び付ける", async ({ page }) => {
  await collectCoverage(page);
  await page.goto("/tests/fixtures/party-approved.html?mode=disabled");
  const depart = page.getByRole("button", { name: "出発する", exact: true });
  await expect(depart).toBeDisabled();
  await expect(depart).toHaveAccessibleDescription(/出撃できる仲間がいません。街探索で回復/);
  await collectCoverage(page);
  await page.goto("/tests/fixtures/party-selection.html?count=2");
  await page.getByRole("button", { name: "枠 1", exact: true }).click();
  for (const candidate of await page.locator(".party-candidate").all()) await candidate.click();
  await page.getByRole("button", { name: "確定", exact: true }).click();
  await expect(depart).toBeDisabled();
  await expect(depart).toHaveAccessibleDescription(/出撃する仲間を1人以上/);
});

test("健康な人物詳細は低下がない能力の基礎値と理由を表示しない", async ({ page }) => {
  await collectCoverage(page);
  await page.goto("/tests/fixtures/party-selection.html?count=2");
  await page.getByRole("button", { name: "枠 1", exact: true }).click();
  await page.getByRole("button", { name: "ロッシの詳細", exact: true }).click();
  const details = page.locator(".character-details");
  await expect(details).toContainText("20 / 20");
  // specs/party.md: 基礎値と理由は肉体疲労・朦朧による低下があるときだけ。
  await expect(details).not.toContainText("症状前最大HP");
  await expect(details).not.toContainText("基礎最大HP");
  await expect(details).not.toContainText("基礎命中率");
});

test("編成のHPバーは全快・半分・空・症状後最大HPの割合を実表示とVRTで示す", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await collectCoverage(page);
  await page.goto("/tests/fixtures/party-approved.html?mode=hp-levels");
  const values = ["HP 20/20", "HP 10/20", "HP 0/20", "HP 6.5/13"];
  const ratios = [1, 0.5, 0, 0.5];
  for (const [selection, label] of [
    [false, "departure"],
    [true, "selection"],
  ] as const) {
    if (selection) await page.getByRole("button", { name: "枠 1", exact: true }).click();
    await readyFormation(page);
    const cards = page.locator(selection ? ".party-candidate-card" : ".party-slot.is-occupied");
    await expect(cards).toHaveCount(4);
    for (let index = 0; index < values.length; index++) {
      const card = cards.nth(index);
      await expect(card).toContainText(values[index]);
      const bar = card.locator(".party-hp-bar");
      const trackWidth = await bar.evaluate((node) => node.clientWidth);
      const fill = await bar.locator("i").boundingBox();
      expect(trackWidth).toBeGreaterThan(0);
      expect(fill).not.toBeNull();
      expect((fill?.width ?? -1) / trackWidth).toBeCloseTo(ratios[index], 2);
    }
    await page.mouse.move(1660, 10);
    await expect(page).toHaveScreenshot(`party-hp-levels-${label}.png`, { maxDiffPixels: 0 });
  }
});

test("編成の見出し・名前・本文・詳細数値は同梱書体の実グリフを使う", async ({ page }) => {
  await collectCoverage(page);
  await page.goto("/tests/fixtures/party-approved.html?mode=symptoms");
  await readyFormation(page);
  await expectRenderedFont(page, ".party-heading .ui-title", "Noto Serif JP", 700);
  await expectRenderedFont(page, ".party-slot-name", "Noto Serif JP", 700);
  await expectRenderedFont(page, ".party-slot-hp", "Noto Sans JP", 400);
  await expectRenderedFont(page, ".party-slot-symptoms", "Noto Sans JP", 400);
  await page.getByRole("button", { name: "枠 1", exact: true }).click();
  await expectRenderedFont(page, ".party-candidate-name", "Noto Serif JP", 700);
  await expectRenderedFont(page, ".party-candidate-symptoms", "Noto Sans JP", 400);
  await page.getByRole("button", { name: "ロッシの詳細", exact: true }).click();
  await expectRenderedFont(page, ".character-details-stats dd", "Noto Sans JP", 400);
});

for (const width of [320, 1920]) {
  test(`ブラウザー文字200%で${width}pxの長名と大桁HPを縮めず詳細まで読める`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1080 });
    await collectCoverage(page);
    await page.goto("/tests/fixtures/party-selection.html?count=2&large-type=1");
    await readyFormation(page);
    await page.getByRole("button", { name: "枠 1", exact: true }).click();
    const originalSizes = await page
      .locator(".party-candidate-card")
      .first()
      .evaluate((card) =>
        [".party-candidate-name", ".party-candidate-hp"].map((selector) => {
          const node = card.querySelector(selector);
          if (!node) throw new Error(`文字要素がありません: ${selector}`);
          return Number.parseFloat(getComputedStyle(node).fontSize);
        }),
      );
    const session = await page.context().newCDPSession(page);
    await session.send("Page.setFontSizes", { fontSizes: { standard: 32, fixed: 26 } });
    await collectCoverage(page);
    await page.goto("/tests/fixtures/party-selection.html?count=2&large-type=1");
    await expect(page.locator("html")).toHaveCSS("font-size", "32px");
    await readyFormation(page);
    await page.screenshot({ path: info.outputPath(`font-${width}-departure-after.png`), fullPage: false });
    await expect(page.locator("html")).toHaveCSS("font-size", "32px");
    const departureGeometry = () =>
      page.evaluate(() => ({
        viewport: { width: innerWidth, height: innerHeight },
        scroll: { x: scrollX, y: scrollY },
        nodes: Array.from(
          document.querySelectorAll(
            ".formation-screen, .party-workspace, .party-slot-choice, .party-slot-name, .party-slot-hp, .party-slot-symptoms, .party-footer, .party-depart",
          ),
          (node) => ({
            className: node.className,
            text: node.textContent,
            rect: node.getBoundingClientRect().toJSON(),
          }),
        ),
      }));
    const beforeClick = await departureGeometry();
    try {
      await page.getByRole("button", { name: "枠 1", exact: true }).click();
    } catch (error) {
      await test.info().attach("departure-overlap-geometry", {
        body: JSON.stringify({ beforeClick, afterFailure: await departureGeometry() }, null, 2),
        contentType: "application/json",
      });
      throw error;
    }
    await readyFormation(page);
    const card = page.locator(".party-candidate-card").first();
    const name = card.locator(".party-candidate-name");
    const hp = card.locator(".party-candidate-hp");
    await expect(name).toHaveText("長い名前の仲間（精神疲労・戦闘不能・複雑な日本語を確認）");
    await expect(hp).toHaveText("HP 9007199254740991/9007199254740991");
    for (const [index, text] of [name, hp].entries()) {
      await text.scrollIntoViewIfNeeded();
      const extent = await text.evaluate((node) => ({
        scroll: node.scrollWidth,
        client: node.clientWidth,
        size: Number.parseFloat(getComputedStyle(node).fontSize),
      }));
      expect(extent.scroll).toBeLessThanOrEqual(extent.client + 1);
      const originalSize = originalSizes[index];
      if (originalSize === undefined) throw new Error("拡大前の文字サイズがありません");
      expect(extent.size, `文字拡大前 ${originalSize}px`).toBeGreaterThanOrEqual(originalSize * 2);
      const textBounds = await text.boundingBox();
      const cardBounds = await card.boundingBox();
      expect(textBounds).not.toBeNull();
      expect(cardBounds).not.toBeNull();
      if (!textBounds || !cardBounds) throw new Error("文字またはカードが表示されていません");
      expect(textBounds.x).toBeGreaterThanOrEqual(cardBounds.x);
      expect(textBounds.x + textBounds.width).toBeLessThanOrEqual(cardBounds.x + cardBounds.width + 1);
    }
    const detail = card.getByRole("button", { name: /の詳細$/ });
    for (let key = 0; key < 8 && !(await detail.evaluate((node) => node === document.activeElement)); key++)
      await page.keyboard.press("Tab");
    await expect(detail).toBeFocused();
    await expect(detail).toBeInViewport();
    await page.keyboard.press("Enter");
    const dialog = page.locator(".character-details");
    await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(
      "長い名前の仲間（精神疲労・戦闘不能・複雑な日本語を確認）",
    );
    await expect(dialog).toContainText("9007199254740991 / 9007199254740991");
    await page.keyboard.press("Escape");
    await expect(detail).toBeFocused();
    const confirm = page.getByRole("button", { name: "確定", exact: true });
    for (let key = 0; key < 8 && !(await confirm.evaluate((node) => node === document.activeElement)); key++)
      await page.keyboard.press("Tab");
    await expect(confirm).toBeFocused();
    await expect(confirm).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "出発準備", exact: true })).toBeVisible();
    await session.detach();
  });
}

test.describe(() => {
  test.use({ reducedMotion: "no-preference", hasTouch: true, viewport: { width: 320, height: 650 } });
  test("狭幅650px高でもタッチで選択しTabで末尾の詳細と確定へ到達する", async ({ page }) => {
    await collectCoverage(page);
    await page.goto("http://127.0.0.1:4174/tests/fixtures/party-selection.html?count=12&long=1");
    await page.getByRole("button", { name: "枠 1", exact: true }).tap();
    const first = page.locator(".party-candidate").first();
    await first.tap();
    await expect(first).toHaveAttribute("aria-pressed", "false");
    await first.tap();
    await expect(first).toHaveAttribute("aria-pressed", "true");
    const lastDetails = page.getByRole("button", { name: /^長い名前.*の詳細$/ });
    for (let key = 0; key < 30 && !(await lastDetails.evaluate((node) => node === document.activeElement)); key++)
      await page.keyboard.press("Tab");
    await expect(lastDetails).toBeFocused();
    await expect(lastDetails).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator(".character-details").getByRole("heading", { level: 2 })).toContainText("長い名前");
    await page.keyboard.press("Escape");
    await expect(lastDetails).toBeFocused();
    await page.keyboard.press("Tab");
    const confirm = page.getByRole("button", { name: "確定", exact: true });
    await expect(confirm).toBeFocused();
    await expect(confirm).toBeInViewport();
    const horizontalGeometry = await page.locator(".party-slot-name").evaluateAll((nodes) =>
      nodes.map((node) => ({
        box: node.getBoundingClientRect().toJSON(),
        after: {
          left: getComputedStyle(node, "::after").left,
          right: getComputedStyle(node, "::after").right,
          width: getComputedStyle(node, "::after").width,
        },
      })),
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      JSON.stringify(horizontalGeometry),
    ).toBeLessThanOrEqual(320);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "出発準備", exact: true })).toBeVisible();
  });
});

test("編成候補の名前とHPは範囲選択とコピーを維持して確定できる", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await collectCoverage(page);
  await page.goto("/tests/fixtures/party-selection.html?count=2");
  await page.getByRole("button", { name: "枠 1", exact: true }).click();
  for (const text of [page.locator(".party-candidate-name").first(), page.locator(".party-candidate-hp").first()]) {
    const box = await text.boundingBox();
    if (!box) throw new Error("candidate text missing");
    await page.mouse.move(box.x + 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    const selected = await page.evaluate(() => window.getSelection()?.toString() ?? "");
    expect(selected).not.toBe("");
    expect(await text.textContent()).toContain(selected.trim());
    await page.keyboard.press("ControlOrMeta+C");
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(selected);
  }
  await page.getByRole("button", { name: "確定", exact: true }).click();
  await expect(page.getByRole("heading", { name: "出発準備", exact: true })).toBeVisible();
});

test("詳細は長い名前と複数症状を狭幅で読め、画像未提供でも能力を表示する", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await collectCoverage(page);
  await page.goto("/tests/fixtures/party-details.html");
  await page.getByRole("button", { name: "枠 1", exact: true }).click();
  const opener = page.getByRole("button", { name: /^ロッシ.*の詳細$/ });
  await opener.click();
  const details = page.locator(".character-details");
  await expect(details.getByRole("heading", { name: /ロッシ（長い名前/ })).toBeInViewport();
  await expect(details.getByRole("button", { name: "編成へ戻る" })).toBeInViewport();
  await details.getByText(/肉体疲労・軽度/).scrollIntoViewIfNeeded();
  await expect(details.getByText(/肉体疲労・軽度/)).toBeInViewport();
  await expect(details.getByRole("button", { name: "編成へ戻る" })).toBeInViewport();
  await expect(details.getByText(/朦朧・軽度/)).toBeVisible();
  const bounds = await details.boundingBox();
  if (!bounds) throw new Error("詳細が表示されていません");
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: testInfo.outputPath("details-long-320.png") });
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await page.getByRole("button", { name: /^画像未提供.*の詳細$/ }).click();
  await expect(details.getByRole("heading", { name: /画像未提供の仲間/ })).toBeVisible();
  await expect(details.getByRole("img")).toHaveCount(0);
  await expect(details).toContainText("160 / 160");
  await expect(details).toContainText("92.31%");
  await page.keyboard.press("Escape");
});
