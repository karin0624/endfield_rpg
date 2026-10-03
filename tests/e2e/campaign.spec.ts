import { expect, type Page, test } from "@playwright/test";

async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "新規開始", exact: true }).click();
  await page.getByRole("button", { name: "実行する", exact: true }).click();
  await expect(page.locator(".campaign-copy")).toHaveText("（仮テキスト）");
  await page.getByRole("button", { name: "ホームへ", exact: true }).click();
}
async function cleanNormal(page: Page) {
  await expect(page.getByText(/戦闘デモ|デバッグ|検証用|構図設定|配置設定/)).toHaveCount(0);
}
async function save(page: Page, title = false) {
  await page.getByRole("button", { name: title ? "保存してタイトルへ戻る" : "保存", exact: true }).click();
  await page.getByRole("button", { name: "実行する", exact: true }).click();
}

test("通常版で導入・ホーム・街・編成・戦闘・帰還・保存再開を通す", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await start(page);
  await cleanNormal(page);
  await page.screenshot({ path: info.outputPath("campaign-home-1920.png") });
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 昼");
  await page.getByRole("button", { name: "街", exact: true }).click();
  await cleanNormal(page);
  await expect(page.getByRole("button", { name: "保存", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "市場", exact: true }).click();
  await expect(page.getByRole("button", { name: "ホームへ戻る" })).toBeHidden();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "ホームへ戻る" }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await page.getByRole("button", { name: "出撃編成を見る" }).click();
  await page.getByRole("button", { name: /ロッシの詳細/ }).click();
  await cleanNormal(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await page.getByRole("button", { name: "ダンジョン", exact: true }).click();
  await cleanNormal(page);
  await page.getByRole("button", { name: "思わぬ遭遇、選択可能" }).click();
  await page.locator("[data-conversation-stage]").click();
  await page.getByRole("button", { name: "地図に足跡を記す" }).click();
  const growth = page.getByRole("region", { name: "レベルアップのスキル選択" });
  while (await growth.isVisible()) {
    await cleanNormal(page);
    await growth.getByRole("button").first().click();
  }
  await page.getByRole("button", { name: "ボス、選択可能" }).click();
  await expect(page.getByRole("button", { name: "通常攻撃" })).toBeEnabled({ timeout: 60_000 });
  await cleanNormal(page);
  const victory = page.getByRole("heading", { name: "戦闘に勝利しました" });
  for (let turn = 0; turn < 12 && !(await victory.isVisible()); turn++)
    await page.getByRole("button", { name: "通常攻撃" }).click();
  await expect(victory).toBeVisible();
  await page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }).click();
  await page.getByRole("button", { name: "ホームへ帰還", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ホーム", exact: true })).toBeVisible();
  await expect(page.locator("[data-calendar]")).toHaveText("2日目 · 昼");
  await expect(page.locator("[data-town-recovery]")).toContainText("HPが全回復");
  await save(page, true);
  await expect(page.getByRole("heading", { name: "ENDFIELD RPG" })).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"));
  await page.reload();
  await page.getByRole("button", { name: "続きから" }).dblclick();
  await expect(page.locator("[data-calendar]")).toHaveText("2日目 · 昼");
  await cleanNormal(page);
  await save(page);
  expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"))).toBe(saved);
  expect(errors).toEqual([]);
});

test("移動は時間を消費せず、取消・新規開始は既存保存を消さない", async ({ page }, info) => {
  await start(page);
  await save(page);
  const saved = await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"));
  for (const width of [320, 390, 800, 801, 1920]) {
    await page.setViewportSize({ width, height: width === 801 ? 600 : 1080 });
    await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
    await expect(page.getByRole("button", { name: "ホームへ戻る" })).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 昼");
    expect(await page.locator("body").evaluate((el) => el.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`campaign-home-${width}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await page.getByRole("button", { name: "街", exact: true }).click();
  await page.getByRole("button", { name: "市場", exact: true }).click();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "ホームへ戻る" }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await page.getByRole("button", { name: "タイトルへ戻る", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await expect(page.getByRole("heading", { name: "ホーム", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "タイトルへ戻る", exact: true }).click();
  await page.getByRole("button", { name: "実行する" }).click();
  await page.getByRole("button", { name: "新規開始" }).dblclick();
  await expect(page.getByRole("heading", { name: "新しく始めますか" })).toBeVisible();
  await page.getByRole("button", { name: "実行する" }).click();
  await page.getByRole("button", { name: "タイトルへ戻る" }).click();
  expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"))).toBe(saved);
  await page.getByRole("button", { name: "続きから" }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 昼");
});

test("保存失敗ではホームに留まり、破損・旧版・保存なしではタイトルを保持する", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "続きから" }).click();
  await expect(page.getByRole("status")).toHaveText("保存データがありません。");
  for (const [data, message] of [
    ["broken", "保存データを読み込めませんでした。"],
    ['{"version":1}', "対応していない保存データです。"],
  ]) {
    await page.evaluate((data) => localStorage.setItem("endfield-rpg-game-save", data), data);
    await page.getByRole("button", { name: "続きから" }).click();
    await expect(page.getByRole("status")).toHaveText(message);
    expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"))).toBe(data);
  }
  await start(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
  });
  await save(page, true);
  await expect(page.getByRole("heading", { name: "ホーム", exact: true })).toBeVisible();
  await expect(page.locator(".campaign-status")).toContainText("保存できません");
  expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"))).toBe('{"version":1}');
});

test("明示デバッグ入口と保存を通常版から隔離する", async ({ page }) => {
  await start(page);
  await save(page);
  const saved = await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"));
  for (const query of [
    "battle=1",
    "dungeon=1",
    "edit=1",
    "adventureEdit=1",
    "debug=1",
    "debug=1&battle=1",
    "debug=1&dungeon=1",
  ]) {
    await page.goto(`/?${query}`);
    await expect(page.getByRole("heading", { name: "ENDFIELD RPG" })).toBeVisible();
    await cleanNormal(page);
  }
  // Dedicated debug build; copy a pre-existing normal slot onto this origin to test key isolation.
  await page.goto("http://127.0.0.1:4175/?debug=1");
  await page.evaluate((data) => localStorage.setItem("endfield-rpg-game-save", data ?? ""), saved);
  await expect(page.getByText("デバッグモード", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "読込", exact: true }).click();
  await expect(page.locator("[data-save-status]")).toHaveText("保存データがありません。");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-debug-save"))).not.toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"))).toBe(saved);
  await page.getByRole("link", { name: "タイトルへ", exact: true }).click();
  await page.getByRole("button", { name: "続きから" }).click();
  await expect(page.getByRole("heading", { name: "ホーム", exact: true })).toBeVisible();
});
