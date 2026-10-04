import type { Page } from "@playwright/test";
import { characters } from "../../../src/content/characters";
import { initialGameOptions } from "../../../src/content/initialGameOptions";
import { saveDefinitions } from "../../../src/content/saveDefinitions";
import { createInitialGameState } from "../../../src/game/createInitialGameState";
import { applyPartyStatus, type ExpeditionGame } from "../../../src/game/expedition";
import { rewardGrowth } from "../../../src/game/growthRuntime";
import { createInventory } from "../../../src/game/inventory";
import { createParty } from "../../../src/game/party";
import { serializeGame } from "../../../src/game/save";
import { cleanNormal, save, start } from "../campaignHelpers";
import { collectCoverage, expect, test } from "../coverage";

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
  await collectCoverage(page);
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
    await collectCoverage(page);
    await page.goto(`/?${query}`);
    await expect(page.getByRole("heading", { name: "ENDFIELD RPG" })).toBeVisible();
    await cleanNormal(page);
  }
  // App screens do not add history entries. Browser Back/Forward revisits URLs,
  // and must not turn a production build into a debug session.
  await collectCoverage(page);
  await page.goBack();
  await expect(page).toHaveURL(/debug=1&battle=1$/);
  await expect(page.getByRole("heading", { name: "ENDFIELD RPG" })).toBeVisible();
  await cleanNormal(page);
  await collectCoverage(page);
  await page.goForward();
  await expect(page).toHaveURL(/debug=1&dungeon=1$/);
  await expect(page.getByRole("heading", { name: "ENDFIELD RPG" })).toBeVisible();
  await cleanNormal(page);
  expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"))).toBe(saved);
  await page.getByRole("button", { name: "続きから" }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 昼");
  // Dedicated debug build; copy a pre-existing normal slot onto this origin to test key isolation.
  await collectCoverage(page);
  await page.goto("http://127.0.0.1:4175/?debug=1");
  await page.evaluate((data) => localStorage.setItem("endfield-rpg-game-save", data ?? ""), saved);
  await expect(page.getByText("デバッグモード", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "読込", exact: true }).click();
  await expect(page.locator("[data-save-status]")).toHaveText("保存データがありません。");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-debug-save"))).not.toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"))).toBe(saved);
  await collectCoverage(page);
  await page.getByRole("link", { name: "タイトルへ", exact: true }).click();
  await page.getByRole("button", { name: "続きから" }).click();
  await expect(page.getByRole("heading", { name: "ホーム", exact: true })).toBeVisible();
});

test("物品の買物・持込み・帰還・保存を通常画面で通す", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await expect(page.getByLabel("持込み個数（HP回復品）")).toHaveValue("0");
  await expect(page.locator(".campaign-copy")).toContainText("所持金 30");
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await page.getByRole("button", { name: "街", exact: true }).click();
  await page.getByRole("button", { name: "市場", exact: true }).click();
  await page.getByRole("button", { name: "買物", exact: true }).click();
  const shop = page.getByRole("dialog", { name: "市場の買物" });
  await expect(shop).toContainText("所持金 30");
  const quantity = shop.getByLabel("購入個数");
  await quantity.fill("");
  await quantity.press("Digit1");
  await quantity.press("Space");
  await expect(quantity).toHaveValue("1");
  await expect(page.locator("[data-dialogue-text]")).toHaveText(
    "市場には旅支度をする人たちが集まっている。必要な物を見て回ろう。",
  );
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 昼");
  await expect(shop).toContainText("探索バッグ 0個");
  for (const invalid of ["0", "-1", "1.5", "", "9007199254740992"]) {
    await shop.getByLabel("購入個数").fill(invalid);
    await expect(shop.getByRole("button", { name: "購入する" })).toBeDisabled();
    await expect(shop).toContainText("所持金 30");
  }
  await shop.getByLabel("購入個数").fill("4");
  await expect(shop.getByRole("button", { name: "購入する" })).toBeDisabled();
  await expect(shop).toContainText("HP回復品 · HP8回復 · 価格10");
  await shop.getByLabel("購入個数").fill("1");
  await shop.getByRole("button", { name: "購入する" }).dblclick();
  await expect(shop).toContainText("所持金 20");
  await expect(shop).toContainText("探索バッグ 1個");
  await shop.getByRole("button", { name: "購入する" }).click();
  await expect(shop).toContainText("所持金 10");
  await expect(shop).toContainText("探索バッグ 2個");
  for (const width of [320, 390, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    await expect(shop.getByRole("button", { name: "買物を閉じる" })).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`campaign-items-shop-${width}.png`) });
  }
  await page.keyboard.press("Escape");
  await expect(shop).toBeHidden();
  await expect(page.getByRole("button", { name: "買物", exact: true })).toBeFocused();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 昼");
  await page.locator("[data-dialogue-text]").click();
  await page.getByRole("button", { name: "ホームへ戻る", exact: true }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await expect(page.locator(".campaign-copy")).toContainText("ホーム保管 HP回復品 2個");
  for (const invalid of ["-1", "0.5", "3", "9007199254740992"]) {
    await page.getByLabel("持込み個数（HP回復品）").fill(invalid);
    await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
    await expect(page.getByRole("heading", { name: "ホーム", exact: true })).toBeVisible();
    await expect(page.locator(".campaign-copy")).toContainText("ホーム保管 HP回復品 2個");
  }
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
  await expect(page.getByLabel("持込み個数（HP回復品）")).toHaveValue("0");
  // Seed 1 retains the one carried item; stock left at home never participates.
  await expect(page.locator(".campaign-copy")).toContainText("ホーム保管 HP回復品 2個");
  await expect(page.locator("[data-calendar]")).toHaveText("2日目 · 昼");
  await save(page, true);
  await collectCoverage(page);
  await page.reload();
  await page.getByRole("button", { name: "続きから", exact: true }).click();
  await expect(page.locator(".campaign-copy")).toContainText("所持金 10");
  await expect(page.locator(".campaign-copy")).toContainText("ホーム保管 HP回復品 2個");
  await cleanNormal(page);
  await expect(page.getByLabel("持込み個数（HP回復品）")).toHaveValue("0");
  await page.getByLabel("持込み個数（HP回復品）").fill("1");
  await save(page, true);
  await collectCoverage(page);
  await page.reload();
  await page.getByRole("button", { name: "続きから", exact: true }).click();
  await expect(page.getByLabel("持込み個数（HP回復品）")).toHaveValue("0");
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
  await expect(page.getByLabel("ギルベルタの防具").locator('option[value="armor-1"]')).toHaveJSProperty(
    "disabled",
    true,
  );
  await expect(page.getByLabel("ギルベルタの防具").locator('option[value="armor-1"]')).toContainText("ロッシ");
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
  await collectCoverage(page);
  await page.reload();
  await page.getByRole("button", { name: "続きから", exact: true }).click();
  await page.getByRole("button", { name: "装備を整える", exact: true }).click();
  await expect(page.getByLabel("ロッシの武器")).toHaveValue("weapon-1");
  await expect(page.getByLabel("ギルベルタの防具")).toHaveValue("armor-2");
  await expect(page.getByLabel("ロッシの防具")).toHaveValue("armor-1");
  await expect(page.getByLabel("ギルベルタの武器")).toHaveValue("weapon-2");
  await page.getByLabel("ロッシの武器").selectOption("");
  await page.getByLabel("ギルベルタの武器").selectOption("weapon-1");
  await expect(page.getByLabel("ロッシの武器")).toHaveValue("");
  await expect(page.getByLabel("ギルベルタの武器")).toHaveValue("weapon-1");
  await expect(page.locator(".campaign-copy")).toContainText("ロッシ · HP 20/24 · 攻撃力 8");
  await expect(page.locator(".campaign-copy")).toContainText("ギルベルタ · HP 18/22 · 攻撃力 7");
  for (const select of await page.getByRole("combobox").all()) await expect(select.locator("option")).toHaveCount(3);
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

test("通常画面の取消・focus・履歴と保存の不変条件を実入力で確認する", async ({ page }) => {
  await start(page);
  await save(page);
  const saved = await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"));
  const history = await page.evaluate(() => window.history.length);
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await page.getByRole("button", { name: "街", exact: true }).click();
  await page.getByRole("button", { name: "市場", exact: true }).click();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "ホームへ戻る", exact: true }).click();
  for (const name of ["保存", "保存してタイトルへ戻る"]) {
    for (const cancel of ["button", "Escape"]) {
      await page.getByRole("button", { name, exact: true }).click();
      await expect(page.getByRole("button", { name: "取り消す", exact: true })).toBeFocused();
      if (cancel === "button") await page.keyboard.press("Enter");
      else await page.keyboard.press("Escape");
      await expect(page.getByRole("heading", { name: "ホーム", exact: true })).toBeFocused();
      await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
      expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"))).toBe(saved);
    }
  }
  await page.getByRole("button", { name: "出撃編成を見る", exact: true }).click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  expect(await page.evaluate(() => window.history.length)).toBe(history);
  await page.getByRole("button", { name: "タイトルへ戻る", exact: true }).click();
  await page.getByRole("button", { name: "実行する", exact: true }).click();
  for (const cancel of ["button", "Escape"]) {
    await page.getByRole("button", { name: "新規開始", exact: true }).click();
    await expect(page.getByRole("button", { name: "取り消す", exact: true })).toBeFocused();
    if (cancel === "button") await page.keyboard.press("Enter");
    else await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "ENDFIELD RPG", exact: true })).toBeFocused();
    expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"))).toBe(saved);
  }
  await page.getByRole("button", { name: "続きから", exact: true }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 昼");
  expect(await page.evaluate(() => window.history.length)).toBe(history);
});

test("通常タイトルはStorage読取拒否を案内し操作を続けられる", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("denied", "SecurityError");
    };
  });
  await collectCoverage(page);
  await page.goto("/");
  await page.getByRole("button", { name: "続きから", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ENDFIELD RPG", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("読み込めませんでした。ブラウザの保存領域を確認してください。");
  await page.getByRole("button", { name: "新規開始", exact: true }).click();
  await page.getByRole("button", { name: "実行する", exact: true }).click();
  await page.getByRole("button", { name: "ホームへ", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ホーム", exact: true })).toBeVisible();
});

test("通常会話の長押し・背景クリック・数字キーは選択と半日を重複適用しない", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await page.getByRole("button", { name: "街", exact: true }).click();
  await page.getByRole("button", { name: "冒険者ギルド", exact: true }).click();
  for (const name of ["保存", "装備を整える", "出撃編成を見る", "ホームへ戻る"])
    await expect(page.getByRole("button", { name, exact: true })).toBeHidden();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 昼");
  await page.keyboard.down("Space");
  await expect(page.getByText("ギルベルタが掲示板の前で会釈した。")).toBeVisible();
  await page.keyboard.down("Space");
  await expect(page.getByText("ギルベルタが掲示板の前で会釈した。")).toBeVisible();
  await page.keyboard.up("Space");
  await page.keyboard.press("Space");
  const first = page.getByRole("button", { name: "掲示板の依頼について聞く" });
  await expect(first).toBeVisible();
  await page.locator("[data-conversation-stage]").click({ position: { x: 10, y: 10 } });
  await page.keyboard.press("Space");
  await page.keyboard.press("Digit9");
  await expect(first).toBeVisible();
  await expect(page.getByRole("button", { name: "極秘依頼について聞く" })).toHaveCount(0);
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 昼");
  await page.keyboard.press("Numpad2");
  await expect(page.getByRole("heading", { name: "街の広場", exact: true })).toBeVisible();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
});

test("通常の狭幅と低い画面をキーボードだけで開始・確認・ホーム操作できる", async ({ page }) => {
  async function activate(name: string) {
    const button = page.getByRole("button", { name, exact: true });
    for (let i = 0; i < 15 && !(await button.evaluate((node) => node === document.activeElement)); i++)
      await page.keyboard.press("Tab");
    await expect(button).toBeFocused();
    await expect(button).toBeInViewport();
    await page.keyboard.press("Enter");
  }
  for (const width of [320, 390, 800, 801, 1920]) {
    await page.setViewportSize({ width, height: 600 });
    await collectCoverage(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "ENDFIELD RPG", exact: true })).toBeFocused();
    await activate("新規開始");
    await expect(page.getByRole("button", { name: "取り消す", exact: true })).toBeFocused();
    await activate("実行する");
    await expect(page.getByRole("heading", { name: "導入", exact: true })).toBeFocused();
    await activate("ホームへ");
    await expect(page.getByRole("heading", { name: "ホーム", exact: true })).toBeFocused();
    for (const button of await page.locator(".campaign-commands button").all()) {
      for (let i = 0; i < 15 && !(await button.evaluate((node) => node === document.activeElement)); i++)
        await page.keyboard.press("Tab");
      await expect(button).toBeFocused();
      await expect(button).toBeInViewport();
    }
    expect(await page.locator("body").evaluate((node) => node.scrollWidth <= window.innerWidth)).toBe(true);
    await activate("探索先を選ぶ");
    await expect(page.getByRole("heading", { name: "探索先選択", exact: true })).toBeFocused();
    await activate("ホームへ戻る");
    await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 昼");
  }
});

async function loadInitialScenario(
  page: Page,
  randomState: number,
  options: { haze?: number; hp?: number; experience?: number } = {},
) {
  const { haze, hp, experience } = options;
  let game: ExpeditionGame = {
    adventure: createInitialGameState(initialGameOptions),
    party: createParty(characters, ["player"]),
    dungeon: null,
    randomState,
    inventory: createInventory(),
  };
  if (haze) game = applyPartyStatus(game, "player", { kind: "haze", amount: haze }, characters);
  if (hp !== undefined)
    game = { ...game, party: { ...game.party, members: game.party.members.map((member) => ({ ...member, hp })) } };
  if (experience) {
    if (!saveDefinitions.skills) throw new Error("skill definitions missing");
    const reward = rewardGrowth(
      game,
      { id: "initial-training", allocations: [{ characterId: "player", experience }] },
      saveDefinitions.skills,
    );
    if (!reward.accepted) throw new Error(reward.reason);
    game = reward.state;
  }
  const saved = serializeGame(game, saveDefinitions);
  if (!saved.accepted) throw new Error(saved.reason);
  // Only initial state uses the public save format. Everything after Continue uses real controls.
  await collectCoverage(page);
  await page.goto("/");
  await page.evaluate((data) => localStorage.setItem("endfield-rpg-game-save", data), saved.data);
  await page.getByRole("button", { name: "続きから", exact: true }).click();
}

test("通常本編の全滅からホーム保存再開・六回療養・再出撃へ接続する", async ({ page }) => {
  await loadInitialScenario(page, 3, { haze: 150, hp: 1 });
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await page.getByRole("button", { name: "ダンジョン", exact: true }).click();
  await page.getByRole("button", { name: "出発する", exact: true }).click();
  await page.getByRole("button", { name: "戦闘、選択可能" }).click();
  const defeat = page.getByRole("heading", { name: "戦闘に敗北しました" });
  for (let turn = 0; turn < 12 && !(await defeat.isVisible()); turn++) {
    await page.getByRole("button", { name: "スキル", exact: true }).click();
    await page.getByRole("button", { name: "攻撃", exact: true }).click();
    await page.getByRole("button", { name: "使用する", exact: true }).click();
    await expect(page.locator("[data-battle-ui]")).toHaveAttribute("data-replaying", "false", { timeout: 60_000 });
  }
  await expect(defeat).toBeVisible();
  await page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }).click();
  await expect(page.getByRole("heading", { name: "ホーム", exact: true })).toBeVisible();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await expect(page.locator("[data-town-recovery]")).toContainText("戦闘参加不可（あと街探索6回）");
  await save(page, true);
  await collectCoverage(page);
  await page.reload();
  await page.getByRole("button", { name: "続きから", exact: true }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await page.getByRole("button", { name: "ダンジョン", exact: true }).click();
  await expect(page.getByRole("button", { name: "出発する", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "出発する", exact: true })).toHaveAccessibleDescription(
    /出撃できる仲間がいません/,
  );
  await expect(page.locator(".party-slot-hp").first()).toHaveText("HP 20/20");
  await expect(page.locator(".party-slot-symptoms").first()).toContainText("戦闘不能");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "ホームへ戻る", exact: true }).click();
  for (let day = 0; day < 6; day++) {
    await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
    await page.getByRole("button", { name: "街", exact: true }).click();
    await page.getByRole("button", { name: "市場", exact: true }).click();
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: "ホームへ戻る", exact: true }).click();
  }
  await expect(page.locator("[data-town-recovery]")).toContainText("戦闘不能から復帰");
  await expect(page.locator("[data-calendar]")).toHaveText("4日目 · 夜");
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await page.getByRole("button", { name: "ダンジョン", exact: true }).click();
  await page.getByRole("button", { name: "出発する", exact: true }).click();
  await expect(page.getByRole("region", { name: "遺跡の進路" })).toBeVisible();
});

test("通常帰還の物品ロストを表示し、ホーム再描画と保存再開で抽選を繰り返さない", async ({ page }) => {
  await loadInitialScenario(page, 1500);
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await page.getByRole("button", { name: "街", exact: true }).click();
  await page.getByRole("button", { name: "市場", exact: true }).click();
  await page.getByRole("button", { name: "買物", exact: true }).click();
  const shop = page.getByRole("dialog", { name: "市場の買物" });
  await shop.getByRole("button", { name: "購入する", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.locator("[data-dialogue-text]").click();
  await page.getByRole("button", { name: "ホームへ戻る", exact: true }).click();
  await page.getByLabel("持込み個数（HP回復品）").fill("1");
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await page.getByRole("button", { name: "ダンジョン", exact: true }).click();
  await page.getByRole("button", { name: "出発する", exact: true }).click();
  await page.getByRole("button", { name: "ホームへ帰還", exact: true }).click();
  await expect(page.locator("[data-town-recovery]")).toContainText("物品ロスト：1個");
  await expect(page.locator(".campaign-copy")).toContainText("ホーム保管 HP回復品 0個");
  await save(page);
  const saved = await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"));
  await page.getByRole("button", { name: "装備を整える", exact: true }).click();
  await page.getByRole("button", { name: "ホームへ戻る", exact: true }).click();
  await save(page);
  expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"))).toBe(saved);
  await collectCoverage(page);
  await page.reload();
  await page.getByRole("button", { name: "続きから", exact: true }).click();
  await expect(page.locator(".campaign-copy")).toContainText("ホーム保管 HP回復品 0個");
  await expect(page.locator("[data-town-recovery]")).toBeHidden();
  await save(page);
  expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"))).toBe(saved);
});

test("市場の複数購入では療養を進めず、終了時にだけ非ゼロの療養時計と控え症状を更新する", async ({ page }) => {
  let game: ExpeditionGame = {
    adventure: createInitialGameState(initialGameOptions),
    party: createParty(characters, ["player", "gilberta"]),
    dungeon: null,
    randomState: 1,
    inventory: createInventory(),
    clock: { elapsedHalfDays: 2, recoverySteps: 1, nextActionId: 3, pendingAction: null },
    lastTownRecoverySignal: 0,
  };
  game = applyPartyStatus(game, "player", { kind: "physicalFatigue", amount: 30 }, characters);
  game = applyPartyStatus(game, "gilberta", { kind: "incapacity" }, characters);
  const initial = serializeGame(game, saveDefinitions);
  if (!initial.accepted) throw new Error(initial.reason);
  await collectCoverage(page);
  await page.goto("/");
  await page.evaluate((data) => localStorage.setItem("endfield-rpg-game-save", data), initial.data);
  await page.getByRole("button", { name: "続きから", exact: true }).click();
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await page.getByRole("button", { name: "街", exact: true }).click();
  await page.getByRole("button", { name: "市場", exact: true }).click();
  await page.getByRole("button", { name: "買物", exact: true }).click();
  const shop = page.getByRole("dialog", { name: "市場の買物" });
  for (const balance of [20, 10]) {
    await shop.getByRole("button", { name: "購入する", exact: true }).click();
    await expect(shop).toContainText(`所持金 ${balance}`);
    await expect(page.locator("[data-calendar]")).toHaveText("2日目 · 昼");
  }
  await page.keyboard.press("Escape");
  await page.locator("[data-dialogue-text]").click();
  await page.getByRole("button", { name: "ホームへ戻る", exact: true }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("2日目 · 夜");
  await save(page);
  const persisted = JSON.parse((await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"))) ?? "null");
  expect(persisted.clock).toEqual({ elapsedHalfDays: 3, recoverySteps: 2, nextActionId: 4 });
  expect(persisted.party.members).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "player", status: expect.objectContaining({ physicalFatigue: 20 }) }),
      expect.objectContaining({ id: "gilberta", status: expect.objectContaining({ incapacityRecoverySteps: 5 }) }),
    ]),
  );
  expect(persisted.inventory.balance).toBe(10);
  expect(persisted.inventory.items.home).toEqual([{ itemId: "hp-recovery", quantity: 2 }]);
});

test("仲間への誘いを見送り再訪で加入し、編成変更だけを保存へ反映する", async ({ page }) => {
  await loadInitialScenario(page, 12345, { haze: 50, hp: 12 });
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await page.getByRole("button", { name: "街", exact: true }).click();
  await page.getByRole("button", { name: "市場", exact: true }).click();
  await page.getByRole("button", { name: "買物", exact: true }).click();
  await page.getByRole("button", { name: "購入する", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "ホームへ戻る", exact: true }).click();
  for (const invite of [false, true]) {
    await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
    await page.getByRole("button", { name: "街", exact: true }).click();
    await page.getByRole("button", { name: "同行者を探す（仮）", exact: true }).click();
    await expect(page.getByRole("button", { name: "買物", exact: true })).toBeHidden();
    await page.keyboard.press("Space");
    await page.getByRole("button", { name: invite ? "仲間に迎える" : "今は見送る" }).click();
    await page.getByRole("button", { name: "ホームへ戻る", exact: true }).click();
    await page.getByRole("button", { name: "出撃編成を見る", exact: true }).click();
    await page.getByRole("button", { name: "枠 1", exact: true }).click();
    await expect(page.locator(".party-candidate")).toHaveCount(invite ? 2 : 1);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "戻る", exact: true }).click();
  }
  await page.getByRole("button", { name: "装備を整える", exact: true }).click();
  await page.getByLabel("ロッシの防具").selectOption("armor-1");
  await page.getByRole("button", { name: "ホームへ戻る", exact: true }).click();
  await page.getByLabel("持込み個数（HP回復品）").fill("1");
  await save(page);
  const readSave = () => page.evaluate(() => JSON.parse(localStorage.getItem("endfield-rpg-game-save") ?? "null"));
  const before = await readSave();
  await page.getByRole("button", { name: "出撃編成を見る", exact: true }).click();
  await page.getByRole("button", { name: "枠 1", exact: true }).click();
  await page.locator(".party-candidate").filter({ hasText: "ギルベルタ" }).click();
  await page.getByRole("button", { name: "確定", exact: true }).click();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await save(page);
  const after = await readSave();
  await expect(page.getByLabel("持込み個数（HP回復品）")).toHaveValue("1");
  expect(before.randomState).toBe(12345);
  expect(before.party.members[0]).toEqual(
    expect.objectContaining({ hp: 12, status: expect.objectContaining({ haze: 20 }) }),
  );
  expect(before.inventory.items.home).toEqual([{ itemId: "hp-recovery", quantity: 1 }]);
  expect(after.party.slots).toEqual(["player", "gilberta", null, null]);
  expect({ ...after, party: { ...after.party, slots: before.party.slots } }).toEqual(before);
  await collectCoverage(page);
  await page.reload();
  await page.getByRole("button", { name: "続きから", exact: true }).click();
  await page.getByRole("button", { name: "出撃編成を見る", exact: true }).click();
  await expect(page.getByRole("button", { name: "枠 2", exact: true })).toContainText("ギルベルタ");
});

test("街XPで生じた必須習得を終えると元の街へ戻り半日を二重計上しない", async ({ page }) => {
  await loadInitialScenario(page, 1, { experience: 5 });
  await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
  await page.getByRole("button", { name: "街", exact: true }).click();
  await page.getByRole("button", { name: "市場", exact: true }).click();
  await page.keyboard.press("Space");
  const growth = page.getByRole("region", { name: "レベルアップのスキル選択" });
  await expect(growth).toBeVisible();
  await expect(growth.getByRole("button")).toHaveCount(3);
  await page.keyboard.press("Tab");
  await expect(growth.getByRole("button").first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "街の広場" })).toBeVisible();
  await expect(growth).toBeHidden();
  await page.getByRole("button", { name: "ホームへ戻る", exact: true }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await save(page);
  const saved = JSON.parse((await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"))) ?? "null");
  expect(saved.clock).toEqual({ elapsedHalfDays: 1, recoverySteps: 1, nextActionId: 2 });
  expect(
    saved.growth.growth.characters.find((entry: { characterId: string }) => entry.characterId === "player")
      .pendingChoiceLevels,
  ).toEqual([]);
});
