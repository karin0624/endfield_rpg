import { expect, test } from "../coverage";

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
  for (let i = 0; i < 10 && !(await mend.evaluate((node) => node === document.activeElement)); i++)
    await page.keyboard.press("Tab");
  await expect(mend).toBeFocused();
  await expect(mend).toBeInViewport();
  await expect(mend).not.toContainText("ランク");
  await page.keyboard.press("Enter");
  await expect(page.locator("#learned")).toHaveText("test-strike,test-heal,test-mend");
});

test("成長の新規・強化・保証表示と二人の権利をキーボードと連続入力で解決する", async ({ page }) => {
  await page.goto("/tests/fixtures/growth-contracts.html");
  const panel = page.getByRole("region", { name: "レベルアップのスキル選択" });
  await expect(panel.getByRole("heading")).toHaveText("ロッシ · Lv2 スキル選択");
  await expect(panel).toContainText("レベル保証で習得：保証技（探索中のみ）");
  await expect(panel.getByRole("button", { name: /^known/ })).toContainText("パッシブ 強化 1→2 / 上限3");
  await expect(panel.getByRole("button", { name: /^new/ })).toContainText("パッシブ 習得 0→1 / 上限3");
  const before = await page.locator("#state").textContent();
  const offers = await panel.getByRole("button").allTextContents();
  await page.setViewportSize({ width: 320, height: 650 });
  await page.keyboard.press("Escape");
  expect(await page.locator("#state").textContent()).toBe(before);
  expect(await panel.getByRole("button").allTextContents()).toEqual(offers);
  for (const choice of await panel.getByRole("button").all()) {
    await page.keyboard.press("Tab");
    await expect(choice).toBeFocused();
    await expect(choice).toBeInViewport();
  }
  await panel.getByRole("button", { name: /^known/ }).dblclick();
  await expect(page.locator("#commits")).toHaveText("1");
  await expect(panel.getByRole("heading")).toHaveText("同行者 · Lv2 スキル選択");
  await expect(panel).toContainText("レベル保証で習得：保証技（探索中のみ）");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.locator("#commits")).toHaveText("2");
  await expect(page.locator("#choice")).toHaveText("選択完了");
});

test("成長の候補不足は理由を示して権利を保持し、キー入力で迂回しない", async ({ page }) => {
  await page.goto("/tests/fixtures/growth-contracts.html?shortage=1");
  const panel = page.getByRole("region", { name: "レベルアップのスキル選択" });
  await expect(panel.getByRole("alert")).toHaveText(
    "有効な3候補が不足しています。選択権利を保持したまま進行を停止しています。",
  );
  await expect(panel.getByRole("button")).toHaveCount(0);
  const before = await page.locator("#state").textContent();
  for (const key of ["Escape", "Enter", "Space"]) await page.keyboard.press(key);
  await expect(panel.getByRole("alert")).toBeVisible();
  expect(await page.locator("#state").textContent()).toBe(before);
  await expect(page.locator("#commits")).toHaveText("0");
});

test("ショップの拒否結果は数量と残高を保持し、修正不要の再購入を受け付ける", async ({ page }) => {
  await page.goto("/tests/fixtures/shop-contracts.html");
  const trigger = page.getByRole("button", { name: "買物", exact: true });
  await trigger.click();
  const shop = page.getByRole("dialog", { name: "市場の買物" });
  await shop.getByLabel("購入個数").fill("2");
  await shop.getByRole("button", { name: "購入する", exact: true }).click();
  await expect(shop.getByRole("status")).toContainText("購入できませんでした");
  await expect(shop.getByLabel("購入個数")).toHaveValue("2");
  await expect(shop).toContainText("所持金 30 · 探索バッグ 0個");
  await expect(page.locator("#attempts")).toHaveText("1");
  await shop.getByRole("button", { name: "購入する", exact: true }).click();
  await expect(shop.getByRole("status")).toContainText("HP回復品を2個購入しました");
  await expect(shop).toContainText("所持金 10 · 探索バッグ 2個");
  await expect(page.locator("#attempts")).toHaveText("2");
  await shop.getByRole("button", { name: "買物を閉じる", exact: true }).click();
  await expect(trigger).toBeFocused();
});

async function tabTo(page: import("@playwright/test").Page, target: import("@playwright/test").Locator) {
  for (let attempt = 0; attempt < 30 && !(await target.evaluate((node) => node === document.activeElement)); attempt++)
    await page.keyboard.press("Tab");
  await expect(target).toBeFocused();
  try {
    await expect(target).toBeInViewport();
    // Native Tab scrolls in whole CSS pixels: the measured return-button bottom
    // is 650.3125 at a 650px viewport, while its label ends at 631.71875.
    // Allow that control-border rounding, but never clipped rendered text.
    await expect
      .poll(() =>
        target.evaluate((node) => {
          const box = node.getBoundingClientRect();
          if (box.left < -1 || box.top < -1 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1) return false;
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
          for (let text = walker.nextNode(); text; text = walker.nextNode()) {
            // Native select option popups do not expose rendered text DOM boxes.
            if (!text.textContent?.trim() || text.parentElement?.closest("option")) continue;
            const range = document.createRange();
            range.selectNodeContents(text);
            for (const line of range.getClientRects()) {
              if (line.width === 0 || line.height === 0) continue;
              if (line.left < 0 || line.top < 0 || line.right > innerWidth || line.bottom > innerHeight) return false;
            }
          }
          return true;
        }),
      )
      .toBe(true);
  } catch (error) {
    const geometry = await target.evaluate((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return {
        label: node.textContent,
        box: node.getBoundingClientRect().toJSON(),
        text: Array.from(range.getClientRects(), (rect) => rect.toJSON()),
        viewport: { width: innerWidth, height: innerHeight },
        scroll: { x: scrollX, y: scrollY },
      };
    });
    await test.info().attach("focused-control-geometry", {
      body: JSON.stringify(geometry, null, 2),
      contentType: "application/json",
    });
    throw error;
  }
}

for (const [width, height] of [
  [320, 480],
  [390, 650],
  [1920, 500],
]) {
  test(`ショップと装備は${width}×${height}で全入力・情報・戻るへ実キー操作で到達できる`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/tests/fixtures/items-layout.html");
    const activate = async (name: string) => {
      await tabTo(page, page.getByRole("button", { name, exact: true }));
      await page.keyboard.press("Enter");
    };
    await activate("続きから");
    await activate("装備を整える");
    await expect(page.locator(".campaign-copy")).toContainText("ロッシ · HP 24/24 · 攻撃力 9");
    await expect(page.locator(".campaign-copy")).toContainText("ギルベルタ · HP 22/22 · 攻撃力 7");
    for (const [name, value, owner] of [
      ["ロッシの武器", "weapon-1", "ロッシ"],
      ["ロッシの防具", "armor-1", "ロッシ"],
      ["ギルベルタの武器", "weapon-2", "ギルベルタ"],
      ["ギルベルタの防具", "armor-2", "ギルベルタ"],
    ]) {
      const select = page.getByLabel(name);
      await tabTo(page, select);
      await expect(select).toHaveValue(value);
      await expect(select.locator("option:checked")).toContainText(owner);
      if (name.endsWith("武器"))
        await expect(page.locator(".campaign-copy > p").filter({ hasText: `${owner} · HP` })).toBeInViewport({
          ratio: 1,
        });
      const box = await select.boundingBox();
      if (!box) throw new Error("装備入力が表示されていません");
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    // Inspect the real text line boxes, not just the select or return button.
    const lines = await page.locator(".campaign-copy").evaluate((root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const rectangles: { x: number; right: number }[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim() || node.parentElement?.closest("option")) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        rectangles.push(...Array.from(range.getClientRects(), ({ x, right }) => ({ x, right })));
      }
      return rectangles;
    });
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.x).toBeGreaterThanOrEqual(0);
      expect(line.right).toBeLessThanOrEqual(width);
    }
    await activate("ホームへ戻る");
    await activate("探索先を選ぶ");
    await activate("街");
    await activate("市場");
    await activate("買物");
    const shop = page.getByRole("dialog", { name: "市場の買物" });
    await expect(shop).toContainText("HP回復品 · HP8回復 · 価格10");
    await expect(shop).toContainText("所持金 30 · 探索バッグ 0個");
    const quantity = shop.getByLabel("購入個数");
    await tabTo(page, quantity);
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("2");
    await expect(quantity).toHaveValue("2");
    await activate("購入する");
    await expect(shop.getByRole("status")).toHaveText("HP回復品を2個購入しました。");
    await expect(shop.getByRole("status")).toBeInViewport({ ratio: 1 });
    await expect(shop).toContainText("所持金 10 · 探索バッグ 2個");
    const bounds = await shop.boundingBox();
    if (!bounds) throw new Error("買物画面が表示されていません");
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.wheel(0, -1000);
    await expect(shop.getByText("HP回復品 · HP8回復 · 価格10", { exact: true })).toBeInViewport({ ratio: 1 });
    await expect(shop.getByText("所持金 10 · 探索バッグ 2個", { exact: true })).toBeInViewport({ ratio: 1 });
    expect(await shop.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    await activate("買物を閉じる");
    await expect(shop).toBeHidden();
    await expect(page.getByRole("button", { name: "買物", exact: true })).toBeFocused();
    expect(await page.locator("body").evaluate((node) => node.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("満タンの防具を外すと現在HPを新上限へ抑え、再装備では回復せず保存する", async ({ page }) => {
  await page.goto("/tests/fixtures/items-layout.html");
  await page.getByRole("button", { name: "続きから", exact: true }).click();
  await page.getByRole("button", { name: "装備を整える", exact: true }).click();
  await expect(page.locator(".campaign-copy")).toContainText("ロッシ · HP 24/24");
  await expect(page.locator(".campaign-copy")).toContainText("ギルベルタ · HP 22/22");
  await page.getByLabel("ロッシの防具").selectOption("");
  await expect(page.locator(".campaign-copy")).toContainText("ロッシ · HP 20/20");
  await expect(page.locator(".campaign-copy")).toContainText("ギルベルタ · HP 22/22");
  await page.getByLabel("ロッシの防具").selectOption("armor-1");
  await expect(page.locator(".campaign-copy")).toContainText("ロッシ · HP 20/24");
  await page.getByLabel("ギルベルタの防具").selectOption("");
  await expect(page.locator(".campaign-copy")).toContainText("ギルベルタ · HP 18/18");
  await page.getByRole("button", { name: "ホームへ戻る", exact: true }).click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "実行する", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("保存しました");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("endfield-rpg-game-save") ?? "null"));
  expect(saved.party.members).toEqual([
    expect.objectContaining({ id: "player", hp: 20 }),
    expect.objectContaining({ id: "gilberta", hp: 18 }),
  ]);
  expect(saved.inventory.equipment.assignments).toEqual([
    { characterId: "player", weapon: "weapon-1", armor: "armor-1" },
    { characterId: "gilberta", weapon: "weapon-2", armor: null },
  ]);
});
