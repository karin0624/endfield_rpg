import { expect, type Page, test } from "@playwright/test";
import { formationScreenshot } from "./formationEvidence";

async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "新規開始", exact: true }).click();
  await page.getByRole("button", { name: "実行する", exact: true }).click();
  await expect(page.locator(".campaign-copy")).toHaveText("（仮テキスト）");
  await page.getByRole("button", { name: "ホームへ", exact: true }).click();
}
async function cleanNormal(page: Page) {
  await expect(page.getByText(/戦闘デモ|デバッグ|検証用|構図設定|配置設定|未実装/)).toHaveCount(0);
}
async function save(page: Page, title = false) {
  await page.getByRole("button", { name: title ? "保存してタイトルへ戻る" : "保存", exact: true }).click();
  await page.getByRole("button", { name: "実行する", exact: true }).click();
}

test("通常版の候補を短間隔で選択・解除しても親画面がクリックを捨てない", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "出撃編成を見る", exact: true }).click();
  await page.getByRole("button", { name: "枠 1", exact: true }).click();
  const candidate = page.locator(".party-candidate").first();
  const box = await candidate.boundingBox();
  if (!box) throw new Error("候補カードが表示されていません");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (const clickCount of [1, 2, 3, 4]) {
    await page.mouse.down({ clickCount });
    await page.mouse.up({ clickCount });
    expect(
      await candidate.evaluate((button) => ({
        pressed: button.getAttribute("aria-pressed"),
        number: button.querySelector(".party-order")?.textContent,
      })),
    ).toEqual(clickCount % 2 === 0 ? { pressed: "true", number: "1" } : { pressed: "false", number: "" });
  }
  for (const delay of [0, 40, 120]) {
    // The second physical click carries detail=2. Both toggles must finish before dblclick returns.
    await candidate.dblclick({ delay });
    expect(await candidate.getAttribute("aria-pressed")).toBe("true");
  }
  await page.getByRole("button", { name: "確定", exact: true }).dblclick();
  await expect(page.getByRole("heading", { name: "編成", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "枠 1", exact: true })).toContainText("ロッシ");
});

test("通常版の街遷移と会話送りはdouble-clickで次の段階まで進まない", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await page.getByRole("button", { name: "街", exact: true }).click();
  await page.getByRole("button", { name: "冒険者ギルド", exact: true }).dblclick();
  const text = page.locator("[data-dialogue-text]");
  expect(await text.textContent()).toBe("ロッシは掲示板の前で足を止めた。");
  await page.locator("[data-dialogue-panel]").dblclick();
  expect(await text.textContent()).toBe("ギルベルタが掲示板の前で会釈した。");
  await page.locator("[data-dialogue-panel]").click();
  await expect(page.getByRole("button", { name: /掲示板の依頼について聞く/ })).toBeVisible();
});

test("通常版で導入・ホーム・街・編成・戦闘・帰還・保存再開を通す", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    // Cached assets may be revalidated with 304 after the save/resume navigation.
    if (response.url().includes("/assets/") && response.status() >= 400) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ENDFIELD RPG" })).toBeVisible();
  await expect(page).toHaveScreenshot("campaign-01-title-1920.png");
  await page.getByRole("button", { name: "新規開始", exact: true }).click();
  await expect(page).toHaveScreenshot("campaign-02-new-game-confirmation-1920.png");
  await page.getByRole("button", { name: "実行する", exact: true }).click();
  await expect(page.locator(".campaign-copy")).toHaveText("（仮テキスト）");
  await expect(page).toHaveScreenshot("campaign-03-introduction-1920.png");
  await page.getByRole("button", { name: "ホームへ", exact: true }).click();
  await cleanNormal(page);
  await expect(page).toHaveScreenshot("campaign-04-home-1920.png");
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 昼");
  await expect(page).toHaveScreenshot("campaign-05-destinations-1920.png");
  await page.getByRole("button", { name: "街", exact: true }).click();
  await cleanNormal(page);
  await expect(page.getByRole("button", { name: "保存", exact: true })).toHaveCount(0);
  await expect(page).toHaveScreenshot("campaign-06-town-1920.png");
  await page.getByRole("button", { name: "市場", exact: true }).click();
  await expect(page.getByRole("button", { name: "ホームへ戻る" })).toBeHidden();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "ホームへ戻る" }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await page.getByRole("button", { name: "出撃編成を見る" }).click();
  await expect(page.getByRole("button", { name: "出発する", exact: true })).toBeHidden();
  await formationScreenshot(page, info, "campaign-formation-home-1920.png");
  await page.getByRole("button", { name: "枠 1", exact: true }).click();
  await formationScreenshot(page, info, "campaign-formation-selection-1920.png");
  const candidate = page.getByRole("group", { name: "候補一覧" }).getByRole("button", { name: "ロッシ", exact: true });
  await expect(candidate).toHaveAccessibleDescription(/HP 20\/20.*隊列 1/);
  await expect(page.locator(".party-candidate-hp").first()).toHaveText("HP 20/20");
  await expect(page.locator(".party-current")).toHaveCount(0);
  await page.getByRole("button", { name: /ロッシの詳細/ }).click();
  await formationScreenshot(page, info, "campaign-formation-details-1920.png");
  await page.keyboard.press("Tab");
  const detailsInfo = page.getByRole("region", { name: "能力と状態" });
  await expect(detailsInfo).toBeFocused();
  await page.keyboard.press("End");
  await expect.poll(() => detailsInfo.evaluate((region) => region.scrollTop)).toBeGreaterThan(0);
  await expect(detailsInfo.locator(".character-details-skill").last()).toBeInViewport({ ratio: 1 });
  await formationScreenshot(page, info, "campaign-formation-details-bottom-1920.png");
  await cleanNormal(page);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await page.getByRole("button", { name: "ダンジョン", exact: true }).click();
  await expect(page.getByRole("heading", { name: "出発準備", exact: true })).toBeVisible();
  await formationScreenshot(page, info, "campaign-formation-departure-1920.png");
  await page.getByRole("button", { name: "出発する", exact: true }).click();
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
  const skills = page.getByRole("button", { name: "スキル", exact: true });
  await expect(skills).toBeEnabled({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: "通常攻撃", exact: true })).toBeHidden();
  await cleanNormal(page);
  const victory = page.getByRole("heading", { name: "戦闘に勝利しました" });
  for (let turn = 0; turn < 12 && !(await victory.isVisible()); turn++) {
    await skills.click();
    await page.getByRole("button", { name: "攻撃", exact: true }).click();
    await page.getByRole("button", { name: "使用する", exact: true }).click();
    await expect(page.locator("[data-battle-ui]")).toHaveAttribute("data-replaying", "false", { timeout: 60_000 });
  }
  await expect(victory).toBeVisible();
  await page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }).click();
  await page.getByRole("button", { name: "ホームへ帰還", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ホーム", exact: true })).toBeVisible();
  await expect(page.locator("[data-calendar]")).toHaveText("2日目 · 昼");
  await expect(page.locator("[data-town-recovery]")).toContainText("HPが全回復");
  await expect(page).toHaveScreenshot("campaign-07-returned-home-1920.png");
  await page.getByRole("button", { name: "保存してタイトルへ戻る", exact: true }).click();
  await expect(page).toHaveScreenshot("campaign-08-save-confirmation-1920.png");
  await page.getByRole("button", { name: "実行する", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ENDFIELD RPG" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("保存しました。");
  await expect(page).toHaveScreenshot("campaign-09-saved-title-1920.png");
  const saved = await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"));
  await page.reload();
  await page.getByRole("button", { name: "続きから" }).dblclick();
  await expect(page.locator("[data-calendar]")).toHaveText("2日目 · 昼");
  await cleanNormal(page);
  await expect(page).toHaveScreenshot("campaign-10-resumed-home-1920.png");
  await save(page);
  expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"))).toBe(saved);
  expect(errors).toEqual([]);
});

test("移動は時間を消費せず、取消・新規開始は既存保存を消さない", async ({ page }) => {
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
  // App screens do not add history entries. Browser Back/Forward revisits URLs,
  // and must not turn a production build into a debug session.
  await page.goBack();
  await expect(page).toHaveURL(/debug=1&battle=1$/);
  await expect(page.getByRole("heading", { name: "ENDFIELD RPG" })).toBeVisible();
  await cleanNormal(page);
  await page.goForward();
  await expect(page).toHaveURL(/debug=1&dungeon=1$/);
  await expect(page.getByRole("heading", { name: "ENDFIELD RPG" })).toBeVisible();
  await cleanNormal(page);
  expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"))).toBe(saved);
  await page.getByRole("button", { name: "続きから" }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 昼");
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

test("物品の買物・持込み・帰還・保存を通常画面で通す", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await expect(page.locator(".campaign-copy")).toContainText("所持金 30");
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await page.getByRole("button", { name: "街", exact: true }).click();
  await page.getByRole("button", { name: "市場", exact: true }).click();
  await page.getByRole("button", { name: "買物", exact: true }).click();
  const shop = page.getByRole("dialog", { name: "市場の買物" });
  await expect(shop).toContainText("所持金 30");
  await shop.getByLabel("購入個数").fill("4");
  await expect(shop.getByRole("button", { name: "購入する" })).toBeDisabled();
  await shop.getByLabel("購入個数").fill("2");
  await shop.getByRole("button", { name: "購入する" }).dblclick();
  await expect(shop).toContainText("所持金 10");
  await expect(shop).toContainText("探索バッグ 2個");
  for (const width of [320, 390, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    await expect(shop.getByRole("button", { name: "買物を閉じる" })).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`campaign-items-shop-${width}.png`) });
  }
  await page.keyboard.press("Escape");
  await expect(shop).toBeHidden();
  await page.locator("[data-dialogue-text]").click();
  await page.getByRole("button", { name: "ホームへ戻る", exact: true }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await expect(page.locator(".campaign-copy")).toContainText("ホーム保管 HP回復品 2個");
  await page.getByLabel("持込み個数（HP回復品）").fill("1");
  await page.screenshot({ path: info.outputPath("campaign-items-home.png") });
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await page.getByRole("button", { name: "ダンジョン", exact: true }).click();
  await page.getByRole("button", { name: "枠 1", exact: true }).click();
  await page.getByRole("button", { name: "ロッシの詳細", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "仲間を選択", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "出発準備", exact: true })).toBeVisible();
  await page.keyboard.down("Escape");
  await page.keyboard.down("Escape");
  await expect(page.getByRole("heading", { name: "探索先選択", exact: true })).toBeVisible();
  await page.keyboard.up("Escape");
  await page.getByRole("button", { name: "ダンジョン", exact: true }).click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(page.getByRole("heading", { name: "探索先選択", exact: true })).toBeVisible();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await page.getByRole("button", { name: "ホームへ戻る", exact: true }).click();
  await expect(page.getByLabel("持込み個数（HP回復品）")).toHaveValue("1");
  await expect(page.locator(".campaign-copy")).toContainText("ホーム保管 HP回復品 2個");
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await page.getByRole("button", { name: "ダンジョン", exact: true }).click();
  await page.getByRole("button", { name: "出発する", exact: true }).click();
  await page.getByRole("button", { name: "物品（HP回復品 ×1）", exact: true }).click();
  const item = page.getByRole("dialog", { name: "HP回復品の使用" });
  await expect(item).toContainText("HPは満タン");
  await expect(item.getByRole("button", { name: "使用する" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "ホームへ帰還", exact: true }).click();
  // Seed 1 retains the one carried item; stock left at home never participates.
  await expect(page.locator(".campaign-copy")).toContainText("ホーム保管 HP回復品 2個");
  await expect(page.locator("[data-calendar]")).toHaveText("2日目 · 昼");
  await save(page, true);
  await page.reload();
  await page.getByRole("button", { name: "続きから", exact: true }).click();
  await expect(page.locator(".campaign-copy")).toContainText("所持金 10");
  await expect(page.locator(".campaign-copy")).toContainText("ホーム保管 HP回復品 2個");
  await cleanNormal(page);
  expect(errors).toEqual([]);
});

test("共有装備2組を2人へ割り当て、重複・HP増加回復を防いで保存する", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await page.getByRole("button", { name: "街", exact: true }).click();
  await page.getByRole("button", { name: "同行者を探す（仮）", exact: true }).click();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "仲間に迎える" }).click();
  await page.getByRole("button", { name: "ホームへ戻る", exact: true }).click();
  await page.getByRole("button", { name: "装備を整える", exact: true }).click();
  await page.getByLabel("ロッシの武器").selectOption("weapon-1");
  await page.getByLabel("ロッシの防具").selectOption("armor-1");
  await expect(page.locator(".campaign-copy")).toContainText("ロッシ · HP 20/24 · 攻撃力 9");
  await expect(page.getByLabel("ギルベルタの武器").locator('option[value="weapon-1"]')).toHaveJSProperty(
    "disabled",
    true,
  );
  await page.getByLabel("ギルベルタの武器").selectOption("weapon-2");
  await page.getByLabel("ギルベルタの防具").selectOption("armor-2");
  await expect(page.locator(".campaign-copy")).toContainText("ギルベルタ · HP 18/22 · 攻撃力 7");
  for (const width of [320, 390, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    await expect(page.getByRole("button", { name: "ホームへ戻る", exact: true })).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`campaign-items-equipment-${width}.png`) });
  }
  await page.getByRole("button", { name: "ホームへ戻る", exact: true }).click();
  await save(page, true);
  await page.reload();
  await page.getByRole("button", { name: "続きから", exact: true }).click();
  await page.getByRole("button", { name: "装備を整える", exact: true }).click();
  await expect(page.getByLabel("ロッシの防具")).toHaveValue("armor-1");
  await expect(page.getByLabel("ギルベルタの武器")).toHaveValue("weapon-2");
  await page.getByLabel("ロッシの武器").selectOption("");
  await page.getByLabel("ギルベルタの武器").selectOption("weapon-1");
  await cleanNormal(page);
  expect(errors).toEqual([]);
});

for (const carried of [1, 2]) {
  test(`分岐で正常回復後に残数${carried - 1}に応じてfocusを戻し再操作できる`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await start(page);
    await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
    await page.getByRole("button", { name: "街", exact: true }).click();
    await page.getByRole("button", { name: "市場", exact: true }).click();
    await page.getByRole("button", { name: "買物", exact: true }).click();
    const shop = page.getByRole("dialog", { name: "市場の買物" });
    await shop.getByLabel("購入個数").fill(String(carried));
    await shop.getByRole("button", { name: "購入する" }).click();
    await shop.getByRole("button", { name: "買物を閉じる" }).click();
    await page.locator("[data-dialogue-text]").click();
    await page.getByRole("button", { name: "ホームへ戻る", exact: true }).click();
    await page.getByRole("button", { name: "装備を整える", exact: true }).click();
    await page.getByLabel("ロッシの防具").selectOption("armor-1");
    await expect(page.locator(".campaign-copy")).toContainText("HP 20/24");
    await page.getByRole("button", { name: "ホームへ戻る", exact: true }).click();
    await page.getByLabel("持込み個数（HP回復品）").fill(String(carried));
    await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
    await page.getByRole("button", { name: "ダンジョン", exact: true }).click();
    await page.getByRole("button", { name: "出発する", exact: true }).click();
    await page.getByRole("button", { name: `物品（HP回復品 ×${carried}）`, exact: true }).click();
    const recovery = page.getByRole("dialog", { name: "HP回復品の使用" });
    await expect(recovery).toContainText("回復見込み +4 HP");
    await recovery.getByRole("button", { name: "使用する", exact: true }).click();
    await expect(recovery).toBeHidden();
    await expect(page.locator(".branch-skill-result")).toHaveText("HP回復品：HPを4回復。ロッシ HP 24 · 精神疲労 0。");
    const trigger = page.getByRole("button", { name: `物品（HP回復品 ×${carried - 1}）`, exact: true });
    await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
    await page.screenshot({ path: info.outputPath(`campaign-items-recovered-${carried}.png`) });
    if (carried === 2) {
      await expect(trigger).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(recovery).toBeVisible();
      await expect(recovery.getByLabel("対象")).toHaveValue("player");
      await expect(recovery).toContainText("HP 24/24");
      await expect(recovery.getByRole("button", { name: "使用する", exact: true })).toBeDisabled();
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
    } else {
      await expect(trigger).toBeDisabled();
      await expect(page.getByRole("button", { name: "戦闘、選択可能", exact: true })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("button", { name: "スキル", exact: true })).toBeEnabled({ timeout: 60_000 });
    }
    await cleanNormal(page);
    expect(errors).toEqual([]);
  });
}

test("通常戦闘で持込み物品を一度だけ使い敵行動の後に入力へ戻る", async ({ page }, info) => {
  await start(page);
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await page.getByRole("button", { name: "街", exact: true }).click();
  await page.getByRole("button", { name: "市場", exact: true }).click();
  await page.getByRole("button", { name: "買物", exact: true }).click();
  const shop = page.getByRole("dialog", { name: "市場の買物" });
  await shop.getByLabel("購入個数").fill("1");
  await shop.getByRole("button", { name: "購入する" }).click();
  await shop.getByRole("button", { name: "買物を閉じる" }).click();
  await page.locator("[data-dialogue-text]").click();
  await page.getByRole("button", { name: "ホームへ戻る", exact: true }).click();
  await page.getByRole("button", { name: "装備を整える", exact: true }).click();
  await page.getByLabel("ロッシの防具").selectOption("armor-1");
  await expect(page.locator(".campaign-copy")).toContainText("HP 20/24");
  await page.getByRole("button", { name: "ホームへ戻る", exact: true }).click();
  await page.getByLabel("持込み個数（HP回復品）").fill("1");
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await page.getByRole("button", { name: "ダンジョン", exact: true }).click();
  await page.getByRole("button", { name: "出発する", exact: true }).click();
  await page.getByRole("button", { name: "戦闘、選択可能", exact: true }).click();
  const item = page.getByRole("button", { name: "物品（HP回復品 ×1）", exact: true });
  await expect(item).toBeEnabled({ timeout: 60_000 });
  await item.click();
  const dialog = page.getByRole("dialog", { name: "HP回復品の使用" });
  await expect(dialog).toContainText("回復見込み +4 HP");
  await dialog.getByRole("button", { name: "使用する", exact: true }).click();
  await expect(page.getByRole("button", { name: "スキル", exact: true })).toBeEnabled({ timeout: 60_000 });
  await expect(page.locator("[data-skill-result]")).toContainText("HPを4回復 · 精神疲労は変化なし");
  await expect(page.getByRole("button", { name: "物品（HP回復品 ×0）", exact: true })).toBeDisabled();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await page.screenshot({ path: info.outputPath("campaign-items-battle-recovery.png") });
  await cleanNormal(page);
});
