import { characters } from "../../../src/content/characters";
import { initialGameOptions } from "../../../src/content/initialGameOptions";
import { saveDefinitions } from "../../../src/content/saveDefinitions";
import { createInitialGameState } from "../../../src/game/createInitialGameState";
import { applyPartyStatus, type ExpeditionGame } from "../../../src/game/expedition";
import { createParty } from "../../../src/game/party";
import { serializeGame } from "../../../src/game/save";
import { collectCoverage, expect, test } from "../coverage";

import { editSlot, finishGrowthChoices, winByAttacking } from "../debugSessionHelpers";

// Only drawing is redirected. The real entry, session wiring, UI, core and save remain loaded.
// HTTP redirects preserve the fixture module's actual URL and source map for coverage.
test.beforeEach(async ({ page }) => {
  await page.route(
    (url) => url.pathname === "/src/web/battleScene.ts",
    (route) =>
      route.fulfill({
        status: 302,
        headers: { location: new URL("/tests/fixtures/dungeon-renderer.ts", route.request().url()).href },
      }),
  );
});

test("全滅帰還でHP全回復し、街探索6回で戦闘不能から復帰する", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  let initial: ExpeditionGame = {
    adventure: createInitialGameState(initialGameOptions),
    party: createParty(characters, ["player"]),
    dungeon: null,
    randomState: 3,
  };
  initial = applyPartyStatus(initial, "player", { kind: "haze", amount: 150 }, characters);
  const seed = serializeGame(initial, saveDefinitions);
  if (!seed.accepted) throw new Error(seed.reason);
  await page.goto("/?debug=1");
  await page.evaluate((data) => localStorage.setItem("endfield-rpg-debug-save", data), seed.data);
  await page.getByRole("button", { name: "読込", exact: true }).click();
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await page.getByRole("button", { name: "出発する", exact: true }).click();
  await page.getByRole("button", { name: "戦闘、選択可能" }).click();

  const attack = page.getByRole("button", { name: "通常攻撃" });
  await expect(attack).toBeEnabled({ timeout: 60_000 });
  await page.getByRole("combobox", { name: "演出速度" }).selectOption("0");
  const defeat = page.getByRole("heading", { name: "戦闘に敗北しました" });
  for (let turn = 0; turn < 10 && !(await defeat.isVisible()); turn++) {
    await attack.click();
    await expect(page.getByRole("button", { name: "演出を省略", exact: true })).toBeHidden({ timeout: 60_000 });
  }
  await expect(defeat).toBeVisible();
  await page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await expect(page.locator("[data-town-recovery]")).toContainText("出撃者のHPが全回復しました。");
  await expect(page.locator("[data-town-recovery]")).toContainText("戦闘参加不可（あと街探索6回）");
  await page.screenshot({ path: testInfo.outputPath("defeat-town-1920.png") });
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(page.locator(".party-slot-hp").first()).toHaveText("HP 20/20");
  await expect(page.locator(".party-slot-symptoms").first()).toContainText("戦闘不能");
  await page.getByRole("button", { name: "枠 1", exact: true }).click();
  await page.getByRole("button", { name: "ロッシの詳細", exact: true }).click();
  const defeatedDetails = page.getByRole("dialog", { name: "ロッシ", exact: true });
  await expect(defeatedDetails).toContainText("戦闘参加不可（あと街探索6回）");
  await expect(defeatedDetails).toContainText("戦闘に参加できません");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "出発する" })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("defeat-party-1920.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("[data-party-calendar]")).toHaveText("1日目 · 夜");
  await page.getByRole("button", { name: "戻る", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "戻る", exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("defeat-party-390.png"), fullPage: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await collectCoverage(page);
  await page.reload();
  await page.getByRole("button", { name: "読込", exact: true }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await expect(page.locator("[data-town-recovery]")).toBeHidden();
  for (let step = 1; step <= 6; step++) {
    await page.getByRole("button", { name: "市場", exact: true }).click();
    await page.keyboard.press("Space");
    await expect(page.getByRole("heading", { name: "街の広場" })).toBeVisible();
    await expect(page.locator("[data-town-recovery]")).toContainText(
      step === 6 ? "戦闘不能から復帰" : `あと街探索${7 - step}回 → ${6 - step}回`,
    );
    if (step === 5) {
      await page.getByRole("button", { name: "保存", exact: true }).click();
      await collectCoverage(page);
      await page.reload();
      await page.getByRole("button", { name: "読込", exact: true }).click();
    }
    await page.getByRole("link", { name: "出撃編成を見る" }).click();
    await expect(page.locator(".party-slot-hp").first()).toHaveText("HP 20/20");
    if (step < 6) await expect(page.getByRole("button", { name: "出発する" })).toBeDisabled();
    else await expect(page.getByRole("button", { name: "出発する" })).toBeEnabled();
    await page.getByRole("button", { name: "戻る", exact: true }).click();
  }
  await expect(page.locator("[data-calendar]")).toHaveText("4日目 · 夜");
  await page.screenshot({ path: testInfo.outputPath("recovered-town-1920.png") });
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await page.getByRole("button", { name: "出発する" }).click();
  await expect(page.getByRole("region", { name: "遺跡の進路" })).toBeVisible();
  await expect(page.locator("[data-calendar]")).toHaveText("4日目 · 夜");
});

test("街の4枠を編集して単独出撃し、ボス帰還の回復HPを編成でも保持する", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/assets/") && !response.ok()) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?debug=1");
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  const party = page.getByRole("region", { name: "出撃編成", exact: true });
  await expect(party.locator(".party-slot-choice")).toHaveCount(4);
  await editSlot(page, 1, "");
  const depart = page.getByRole("button", { name: "出発する" });
  await expect(depart).toBeDisabled();
  await expect(party.getByRole("status")).toContainText("出撃する仲間を1人以上");
  await editSlot(page, 4, "player");
  await page.getByRole("button", { name: "枠 2", exact: true }).click();
  await page.getByRole("group", { name: "候補一覧" }).getByRole("button", { name: "ロッシ", exact: true }).click();
  const rossiCandidate = page
    .getByRole("group", { name: "候補一覧" })
    .getByRole("button", { name: "ロッシ", exact: true });
  await expect(rossiCandidate).toHaveAttribute("aria-pressed", "false");
  await rossiCandidate.click();
  await expect(rossiCandidate).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(party.getByLabel("枠 2", { exact: true })).toHaveAccessibleDescription("空き枠。仲間を選択");
  await expect(page.locator(".party-slot-hp").first()).toHaveText("HP 20/20");
  await depart.scrollIntoViewIfNeeded();
  await expect(depart).toBeInViewport();
  await depart.click();
  await page.getByRole("button", { name: "思わぬ遭遇、選択可能" }).click();
  await page.locator("[data-conversation-stage]").click();
  await page.getByRole("button", { name: "地図に足跡を記す" }).click();
  await finishGrowthChoices(page);
  await page.getByRole("button", { name: "ボス、選択可能" }).click();
  const attack = page.getByRole("button", { name: "通常攻撃" });
  await expect(attack).toBeEnabled({ timeout: 60_000 });
  await page.getByRole("combobox", { name: "演出速度" }).selectOption("0");
  await expect(page.getByRole("region", { name: "味方の状態" }).getByRole("article")).toHaveCount(1);
  await winByAttacking(page);
  await expect(page.getByRole("heading", { name: "戦闘に勝利しました" })).toBeVisible();
  await page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }).click();
  await expect(page.getByRole("heading", { name: "探索を完了しました" })).toBeVisible();
  await page.getByRole("button", { name: "街へ戻る", exact: true }).click();
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(page.locator(".party-slot-hp").first()).toHaveText("HP 20/20");
  await editSlot(page, 1, "");

  await editSlot(page, 1, "player");
  await expect(page.locator(".party-slot-hp").first()).toHaveText("HP 20/20");
  expect(errors).toEqual([]);
});

test("初期症状の試験データから実操作で数値回復・全滅帰還・保存再開をつなぐ", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  // Setup only: use the public core to prepare a street save with numeric ailments.
  // Once loaded, all time, combat outcomes and recovery come from player controls.
  let fixture: ExpeditionGame = {
    adventure: createInitialGameState(initialGameOptions),
    party: createParty(characters, ["player"]),
    dungeon: null,
    randomState: 3,
  };
  fixture = applyPartyStatus(fixture, "player", { kind: "physicalFatigue", amount: 50 }, characters);
  fixture = applyPartyStatus(fixture, "player", { kind: "haze", amount: 75 }, characters);
  const encoded = serializeGame(fixture, saveDefinitions);
  if (!encoded.accepted) throw new Error(encoded.reason);
  await page.goto("/?debug=1");
  await page.evaluate((data) => localStorage.setItem("endfield-rpg-debug-save", data), encoded.data);
  await page.getByRole("button", { name: "読込", exact: true }).click();
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await page.getByRole("button", { name: "枠 1", exact: true }).click();
  await page.getByRole("button", { name: "ロッシの詳細" }).click();
  const details = page.getByRole("dialog", { name: "ロッシ", exact: true });
  await expect(details).toContainText("13 / 13");
  await expect(details).toContainText("基礎最大HP 20");
  await expect(details).toContainText("症状前最大HP 20");
  await expect(details).toContainText("肉体疲労による低下");
  await expect(details).toContainText("80%");
  await expect(details).toContainText("基礎 100% · 朦朧による低下");
  await expect(details).toContainText("肉体疲労・中度");
  await expect(details).toContainText("朦朧・重度");
  await page.screenshot({ path: testInfo.outputPath("details-ailments-1920.png") });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "市場", exact: true }).click();
  await page.keyboard.press("Space");
  await expect(page.locator("[data-town-recovery]")).toContainText("肉体疲労：50 → 40（軽度）");
  await expect(page.locator("[data-town-recovery]")).toContainText("朦朧：75 → 65（中度）");
  await page.screenshot({ path: testInfo.outputPath("continuous-recovery-1920.png") });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await collectCoverage(page);
  await page.reload();
  await page.getByRole("button", { name: "読込", exact: true }).click();
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(page.locator(".party-slot").first()).toContainText("HP 13/14");
  await expect(page.locator(".party-slot").first()).toContainText("肉体疲労・軽度");
  await expect(page.locator(".party-slot").first()).toContainText("朦朧・中度");
  await page.getByRole("button", { name: "枠 1", exact: true }).click();
  await page.getByRole("button", { name: "ロッシの詳細" }).click();
  await expect(details).toContainText("13 / 14");
  await expect(details.getByText("82.19%", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "出発する", exact: true }).click();
  await page.getByRole("button", { name: "戦闘、選択可能" }).click();
  const attack = page.getByRole("button", { name: "通常攻撃" });
  await expect(attack).toBeEnabled({ timeout: 60_000 });
  await page.getByRole("combobox", { name: "演出速度" }).selectOption("0");
  const defeat = page.getByRole("heading", { name: "戦闘に敗北しました" });
  for (let turn = 0; turn < 12 && !(await defeat.isVisible()); turn++) {
    await attack.click();
    await expect(page.getByRole("button", { name: "演出を省略", exact: true })).toBeHidden({ timeout: 60_000 });
  }
  await expect(defeat).toBeVisible();
  await page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }).click();
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(page.locator(".party-slot").first()).toContainText("HP 14/14");
  await expect(page.locator(".party-slot").first()).toContainText("肉体疲労・軽度");
  await expect(page.locator(".party-slot-symptoms").first()).toContainText("戦闘不能");
  await page.getByRole("button", { name: "枠 1", exact: true }).click();
  await page.getByRole("button", { name: "ロッシの詳細" }).click();
  await expect(details).toContainText("14 / 14");
  await expect(details).toContainText("戦闘に参加できません");
  await expect(details).toContainText("戦闘参加不可（あと街探索6回）");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.screenshot({ path: testInfo.outputPath("m2c-returned-ailments-1920.png") });
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "市場", exact: true }).click();
  await page.keyboard.press("Space");
  await expect(page.locator("[data-calendar]")).toHaveText("2日目 · 夜");
  await expect(page.locator("[data-town-recovery]")).toContainText("肉体疲労：40 → 30（軽度）");
  await expect(page.locator("[data-town-recovery]")).toContainText("あと街探索6回 → 5回");
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(page.locator(".party-slot").first()).toContainText("HP 14/15");
  await expect(page.locator(".party-slot").first()).toContainText("肉体疲労・軽度");
  await page.getByRole("button", { name: "枠 1", exact: true }).click();
  await page.getByRole("button", { name: "ロッシの詳細" }).click();
  await expect(details).toContainText("14 / 15");
  await expect(details.getByText("84.51%", { exact: true })).toBeVisible();
  await expect(details).toContainText("基礎最大HP 20");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "出発する", exact: true })).toBeDisabled();
});

test("通常探索のスキル使用を次戦・帰還・保存読込・街回復へつなぐ", async ({ page }, testInfo) => {
  await page.goto("/?debug=1");
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await page.getByRole("button", { name: "出発する", exact: true }).click();
  await page.getByRole("button", { name: "戦闘、選択可能" }).click();
  const skills = page.getByRole("button", { name: "スキル", exact: true });
  await expect(skills).toBeEnabled({ timeout: 60_000 });
  await page.locator('[data-combatant-id="slime"]').click();
  const use = async (name: string, target?: string, endsBattle = false) => {
    await page.getByRole("combobox", { name: "演出速度" }).selectOption("0");
    await skills.click();
    await page.getByRole("button", { name, exact: true }).click();
    if (target) await page.getByRole("combobox", { name: "回復対象" }).selectOption(target);
    await page.getByRole("button", { name: "使用する", exact: true }).click();
    await expect(page.getByRole("button", { name: "演出を省略", exact: true })).toBeHidden({ timeout: 60_000 });
    await expect(endsBattle ? page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }) : skills).toBeEnabled();
  };
  await use("検証用攻撃");
  await use("検証用回復", "player");
  await use("検証用攻撃", undefined, true);
  await page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }).click();
  await finishGrowthChoices(page);
  await page.getByRole("button", { name: "分岐で回復", exact: true }).click();
  const branch = page.getByRole("dialog", { name: "分岐の回復スキル" });
  await branch.getByRole("button", { name: "ロッシ", exact: true }).click();
  await branch.getByRole("button", { name: /検証用回復/ }).click();
  await branch.getByRole("button", { name: /ロッシ HP/ }).click();
  await expect(page.locator(".branch-skill-result")).toContainText("精神疲労 11 → 14");
  await page.getByRole("button", { name: "ボス、選択可能" }).click();
  await expect(skills).toBeEnabled({ timeout: 60_000 });
  await page.getByRole("combobox", { name: "演出速度" }).selectOption("0");
  await skills.click();
  await page.getByRole("button", { name: "検証用攻撃", exact: true }).click();
  await expect(page.locator("[data-skill-fatigue]")).toContainText("精神疲労 14");
  await expect(page.locator("[data-skill-preview]")).toContainText("予測ダメージ 14.91");
  await page.screenshot({ path: testInfo.outputPath("skill-preview-1440.png") });
  await page.getByRole("button", { name: "使用する", exact: true }).click();
  await expect(skills).toBeEnabled();
  await expect(page.locator("[data-skill-result]")).toContainText("14.91ダメージ");
  await use("検証用攻撃", undefined, true);
  await page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }).click();
  await page.getByRole("button", { name: "街へ戻る", exact: true }).click();
  await expect(page.locator("[data-town-recovery]")).toContainText("精神疲労 22");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("endfield-rpg-debug-save") ?? "null"));
  expect(saved.party.members.find(({ id }: { id: string }) => id === "player").mentalFatigue).toBe(22);
  expect(
    saved.growth.growth.characters.find(({ characterId }: { characterId: string }) => characterId === "player"),
  ).toMatchObject({ level: 1, experience: 0 });
  expect(
    saved.growth.characters
      .find(({ characterId }: { characterId: string }) => characterId === "player")
      .learned.map((entry: { skillId: string }) => entry.skillId),
  ).toEqual(["test-strike", "test-heal"]);
  await collectCoverage(page);
  await page.reload();
  await page.getByRole("button", { name: "読込", exact: true }).dblclick();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("endfield-rpg-debug-save") ?? "null"))).toEqual(
    saved,
  );
  await page.getByRole("button", { name: "市場", exact: true }).click();
  await page.keyboard.press("Space");
  await expect(page.locator("[data-town-recovery]")).toContainText("精神疲労：22 → 12");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("endfield-rpg-debug-save") ?? "{}").party.members.find(
          ({ id }: { id: string }) => id === "player",
        ).mentalFatigue,
    ),
  ).toBe(12);
  await page.screenshot({ path: testInfo.outputPath("skill-town-recovery.png") });
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await page.getByRole("button", { name: "枠 1", exact: true }).click();
  await page.getByRole("button", { name: "ロッシの詳細", exact: true }).click();
  const details = page.getByRole("dialog", { name: "ロッシ", exact: true });
  await expect(
    details
      .locator(".character-details-stats > div")
      .filter({ has: page.getByText("精神疲労", { exact: true }) })
      .locator("dd"),
  ).toHaveText("12（なし）");
  await expect(
    details
      .locator(".character-details-stats > div")
      .filter({ has: page.getByText("レベル", { exact: true }) })
      .locator("dd"),
  ).toHaveText("1");
  await expect(details.locator(".character-details-skill h4")).toHaveText(["検証用攻撃", "検証用回復"]);
  await page.screenshot({ path: testInfo.outputPath("skill-fatigue-details.png") });
  await page.keyboard.press("Escape");
});
