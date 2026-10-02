import { expect, test } from "@playwright/test";
import { characters } from "../../src/content/characters";
import { initialGameOptions } from "../../src/content/initialGameOptions";
import { saveDefinitions } from "../../src/content/saveDefinitions";
import { createInitialGameState } from "../../src/game/createInitialGameState";
import { applyPartyStatus, type ExpeditionGame } from "../../src/game/expedition";
import { createParty } from "../../src/game/party";
import { serializeGame } from "../../src/game/save";

test("ルートを横ドラッグでき、表示領域を変えても選択肢を操作できる", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?dungeon=1");
  await expect(page.getByRole("region", { name: "遺跡の進路" })).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

  const battleNode = page.getByRole("button", { name: "戦闘、選択可能" });
  await expect(battleNode).toBeEnabled();
  const futureBoss = page.getByRole("button", { name: "ボス、未到達" });
  await expect(futureBoss).toBeDisabled();
  await expect(futureBoss.locator("img")).not.toHaveCSS("filter", /blur/);
  await expect(page.getByText("遺跡の入口", { exact: true })).toHaveCount(0);
  await expect(page.getByText("ボス", { exact: true })).toBeVisible();
  for (const label of ["選択可能", "未到達", "踏破済み", "現在地"]) {
    await expect(page.getByText(label, { exact: true })).toHaveCount(0);
  }
  const battleToBossEdge = page.locator('[data-edge-from="battle-a"][data-edge-to="boss-c"]');
  const battleBeforeHover = await battleNode.boundingBox();
  const edgeBeforeHover = await battleToBossEdge.boundingBox();
  if (battleBeforeHover === null || edgeBeforeHover === null) {
    throw new Error("ルート上の戦闘ノードまたは接続線が表示されていません");
  }
  await battleNode.hover();
  await expect
    .poll(async () => {
      const bounds = await battleNode.boundingBox();
      return bounds?.y ?? Number.POSITIVE_INFINITY;
    })
    .toBeLessThan(battleBeforeHover.y - 4.99);
  await expect.poll(() => battleToBossEdge.boundingBox()).toEqual(edgeBeforeHover);
  await page.mouse.move(0, 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(battleNode).toBeEnabled();
  const conversationNode = page.getByRole("button", { name: "思わぬ遭遇、選択可能" });
  await expect(battleNode).toBeInViewport({ ratio: 1 });
  await expect(conversationNode).toBeInViewport({ ratio: 1 });
  const before = await battleNode.boundingBox();
  if (before === null) throw new Error("選択可能な戦闘ノードが表示されていません");
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 - 100, before.y + before.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(async () => {
      const after = await battleNode.boundingBox();
      return after?.x;
    })
    .toBeLessThan(before.x - 50);
  await expect(page.locator("[data-battle-screen]")).toBeHidden();

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(battleNode).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(battleNode).toBeEnabled();
  await expect(battleNode).toBeInViewport({ ratio: 1 });
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await battleNode.click();
  await expect(page.locator("[data-battle-screen]")).toBeVisible();
});

test("会話ノードの選択後に探索位置へ戻る", async ({ page }) => {
  await page.goto("/?dungeon=1");
  await page.getByRole("button", { name: "思わぬ遭遇、選択可能" }).click();
  await expect(page.getByText("道の脇に、遺跡へ続く新しい足跡が残っている。")).toBeVisible();
  await page.locator("[data-conversation-stage]").click();
  await expect(page.getByText("足跡を記録する？")).toBeVisible();
  await page.getByRole("button", { name: "地図に足跡を記す" }).click();

  await expect(page.getByRole("region", { name: "遺跡の進路" })).toBeVisible();
  await expect(page.getByRole("button", { name: "思わぬ遭遇、現在地" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "ボス、選択可能" })).toBeEnabled();
  const skippedBattle = page.getByRole("button", { name: "戦闘、未到達" });
  await expect(skippedBattle).toBeDisabled();
  await expect(skippedBattle.locator("img")).toHaveCSS("filter", /blur/);
  await expect(page.getByText("戦闘", { exact: true })).toHaveCount(0);
  await expect(page.getByText("ボス", { exact: true })).toBeVisible();
});

test("390pxのダンジョン戦闘でコマンドまでスクロールして攻撃できる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?dungeon=1");
  await page.getByRole("button", { name: "戦闘、選択可能" }).click();

  const attack = page.getByRole("button", { name: "通常攻撃" });
  const slimeB = page.getByRole("button", { name: /スライム B、HP .*攻撃対象に選択/ });
  await expect(attack).toBeEnabled({ timeout: 60_000 });
  await expect(page.getByText("DUNGEON BATTLE", { exact: true })).toHaveCount(0);
  await attack.scrollIntoViewIfNeeded();
  await expect(attack).toBeInViewport();
  await attack.click();
  await expect(slimeB).toHaveAccessibleName(/スライム B、HP 6\/14/);
});

test("全滅帰還でHP全回復し、街探索6回で戦闘不能から復帰する", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await page.getByRole("button", { name: "出撃", exact: true }).click();
  await page.getByRole("button", { name: "戦闘、選択可能" }).click();

  const attack = page.getByRole("button", { name: "通常攻撃" });
  const slimeA = page.getByRole("button", { name: /スライム A、HP .*攻撃対象に選択/ });
  const slimeB = page.getByRole("button", { name: /スライム B、HP .*攻撃対象に選択/ });
  await expect(attack).toBeEnabled({ timeout: 60_000 });
  await expect(slimeB).toHaveAttribute("aria-pressed", "true");
  await attack.click();
  await expect(slimeB).toHaveAccessibleName(/スライム B、HP 6\/14/);
  await attack.click();
  await expect(slimeB).toBeHidden();
  await expect(slimeA).toHaveAttribute("aria-pressed", "true");
  await attack.click();
  await expect(slimeA).toHaveAccessibleName(/スライム A、HP 6\/14/);
  await attack.click();
  await expect(page.getByRole("heading", { name: "戦闘に勝利しました" })).toBeVisible();
  await page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }).click();
  await expect(page.getByRole("button", { name: "ボス、選択可能" })).toBeEnabled();
  const skippedConversation = page.getByRole("button", { name: "思わぬ遭遇、未到達" });
  await expect(skippedConversation).toBeDisabled();
  await expect(skippedConversation.locator("img")).toHaveCSS("filter", /blur/);
  await expect(page.getByText("思わぬ遭遇", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ボス、選択可能" }).locator("img")).not.toHaveCSS("filter", /blur/);

  await page.getByRole("button", { name: "ボス、選択可能" }).click();
  const warden = page.getByRole("button", { name: /遺跡の守り手、HP .*攻撃対象に選択/ });
  await expect(attack).toBeEnabled({ timeout: 60_000 });
  await expect(warden).toHaveAccessibleName(/遺跡の守り手、HP 28\/28/);
  await attack.click();
  await expect(page.getByRole("heading", { name: "戦闘に敗北しました" })).toBeVisible();
  await page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }).click();
  await expect(page.getByRole("heading", { name: "探索に失敗しました" })).toBeVisible();
  await page.getByRole("button", { name: "街へ戻る", exact: true }).dblclick();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await expect(page.locator("[data-town-recovery]")).toContainText("出撃者のHPが全回復しました。");
  await expect(page.locator("[data-town-recovery]")).toContainText("戦闘不能（あと街探索6回）");
  await page.screenshot({ path: testInfo.outputPath("defeat-town-1920.png") });
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(page.locator(".party-slot-hp").first()).toHaveText("HP 20 / 20");
  await expect(page.locator(".party-slot-symptoms").first()).toHaveText("戦闘不能（あと街探索6回）");
  await expect(page.getByRole("button", { name: "出撃" })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("defeat-party-1920.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("[data-party-calendar]")).toBeInViewport();
  await expect(page.getByRole("button", { name: "戻る", exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("defeat-party-390.png"), fullPage: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
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
      await page.reload();
      await page.getByRole("button", { name: "読込", exact: true }).click();
    }
    await page.getByRole("link", { name: "出撃編成を見る" }).click();
    await expect(page.locator(".party-slot-hp").first()).toHaveText("HP 20 / 20");
    if (step < 6) await expect(page.getByRole("button", { name: "出撃" })).toBeDisabled();
    else await expect(page.getByRole("button", { name: "出撃" })).toBeEnabled();
    await page.getByRole("button", { name: "戻る", exact: true }).click();
  }
  await expect(page.locator("[data-calendar]")).toHaveText("4日目 · 夜");
  await page.screenshot({ path: testInfo.outputPath("recovered-town-1920.png") });
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await page.getByRole("button", { name: "出撃" }).click();
  await expect(page.getByRole("region", { name: "遺跡の進路" })).toBeVisible();
  await expect(page.locator("[data-calendar]")).toHaveText("4日目 · 夜");
});

test("編成だけを表示し、キーボードで戻っても編集内容を保持する", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const entry = page.getByRole("link", { name: "出撃編成を見る" });
  const party = page.getByRole("region", { name: "出撃編成", exact: true });
  const back = page.getByRole("button", { name: "戻る", exact: true });
  await expect(party).toBeHidden();
  await entry.focus();
  await page.keyboard.press("Enter");
  await expect(party).toBeVisible();
  await expect(page.getByRole("navigation", { name: "街の場所" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "街の広場" })).toBeHidden();
  await expect(back).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(party.getByLabel("枠 1", { exact: true })).toBeFocused();
  await party.getByLabel("枠 1", { exact: true }).selectOption("");
  await party.getByLabel("枠 4", { exact: true }).selectOption("player");
  for (let reopen = 0; reopen < 2; reopen++) {
    await back.focus();
    await page.keyboard.press("Enter");
    await expect(party).toBeHidden();
    await expect(page.getByRole("navigation", { name: "街の場所" })).toBeVisible();
    await expect(entry).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(party.getByLabel("枠 4", { exact: true })).toHaveValue("player");
    await expect(party.getByLabel("枠 1", { exact: true })).toHaveValue("");
    await expect(back).toBeFocused();
  }
});

test("街の4枠を編集して単独出撃し、ボス帰還の回復HPを編成でも保持する", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/assets/") && !response.ok()) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  const party = page.getByRole("region", { name: "出撃編成", exact: true });
  await expect(party.getByRole("combobox")).toHaveCount(4);
  await party.getByLabel("枠 1", { exact: true }).selectOption("");
  const depart = page.getByRole("button", { name: "出撃" });
  await expect(depart).toBeDisabled();
  await expect(party.getByRole("status")).toContainText("出撃する仲間を1人以上");
  await party.getByLabel("枠 4", { exact: true }).selectOption("player");
  await party.getByLabel("枠 2", { exact: true }).selectOption("player");
  await expect(party.getByLabel("枠 2", { exact: true })).toHaveValue("");
  await expect(party.getByRole("status")).toContainText("同じ仲間は複数の枠に配置できません");
  await expect(page.locator(".party-slot-hp").nth(3)).toHaveText("HP 20 / 20");
  await depart.scrollIntoViewIfNeeded();
  await expect(depart).toBeInViewport();
  await depart.click();
  await page.getByRole("button", { name: "思わぬ遭遇、選択可能" }).click();
  await page.locator("[data-conversation-stage]").click();
  await page.getByRole("button", { name: "地図に足跡を記す" }).click();
  await page.getByRole("button", { name: "ボス、選択可能" }).click();
  const attack = page.getByRole("button", { name: "通常攻撃" });
  await expect(attack).toBeEnabled({ timeout: 60_000 });
  await expect(page.getByRole("region", { name: "味方の状態" }).getByRole("article")).toHaveCount(1);
  for (let turn = 0; turn < 4; turn++) await attack.click();
  await expect(page.getByRole("heading", { name: "戦闘に勝利しました" })).toBeVisible();
  await page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }).click();
  await expect(page.getByRole("heading", { name: "探索を完了しました" })).toBeVisible();
  await page.getByRole("button", { name: "街へ戻る", exact: true }).click();
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(page.locator(".party-slot-hp").nth(3)).toHaveText("HP 20 / 20");
  await party.getByLabel("枠 4", { exact: true }).selectOption("");
  await expect(
    party.getByLabel("枠 1", { exact: true }).getByRole("option", { name: "ロッシ — HP 20/20", exact: true }),
  ).toHaveCount(1);
  await party.getByLabel("枠 1", { exact: true }).selectOption("player");
  await expect(page.locator(".party-slot-hp").first()).toHaveText("HP 20 / 20");
  expect(errors).toEqual([]);
});

test("街探索から加入・編成・ボス帰還・再訪まで同じセッションで進む", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  const second = page.getByRole("combobox", { name: "枠 2" });
  await expect(second.locator('option[value="gilberta"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "出撃", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "同行者を探す（仮）", exact: true }).click();
  await expect(page.getByText("ギルベルタに同行を相談する。（仮イベント）")).toBeVisible();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "仲間に迎える" }).click();
  await expect(page.locator("[data-town-prompt]")).toHaveText("ギルベルタが仲間に加わった。");
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(page.getByRole("combobox", { name: "枠 1" })).toHaveValue("player");
  await expect(second).toHaveValue("");
  await expect(second.locator('option[value="gilberta"]')).toHaveText("ギルベルタ — HP 18/18");
  await second.selectOption("gilberta");
  await expect(page.locator(".party-slot").nth(1)).toContainText("HP 18 / 18");
  await expect(page.locator(".party-slot").nth(1).locator("img")).toHaveJSProperty("naturalWidth", 1024);
  await page.screenshot({ path: testInfo.outputPath("joined-party-1920.png") });
  await page.getByRole("button", { name: "出撃", exact: true }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await page.screenshot({ path: testInfo.outputPath("party-route-1920.png") });
  await page.getByRole("button", { name: "思わぬ遭遇、選択可能" }).click();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "地図に足跡を記す" }).click();
  await page.getByRole("button", { name: "ボス、選択可能" }).click();
  const attack = page.getByRole("button", { name: "通常攻撃" });
  await expect(attack).toBeEnabled({ timeout: 60_000 });
  await page.screenshot({ path: testInfo.outputPath("party-battle-1920.png") });
  for (let turn = 0; turn < 4; turn++) await attack.click();
  await expect(page.getByRole("heading", { name: "戦闘に勝利しました" })).toBeVisible();
  await page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }).click();
  await page.getByRole("button", { name: "街へ戻る", exact: true }).dblclick();
  await expect(page.locator("[data-calendar]")).toHaveText("2日目 · 昼");
  await expect(page.locator("[data-town-recovery]")).toHaveText("出撃者のHPが全回復しました。");
  await page.screenshot({ path: testInfo.outputPath("victory-town-1920.png") });
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(page.locator(".party-slot-hp").nth(0)).toHaveText("HP 20 / 20");
  await expect(page.locator(".party-slot-hp").nth(1)).toHaveText("HP 18 / 18");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "同行者を探す（仮）", exact: true }).click();
  await expect(page.getByText("ギルベルタは加入済みです。（仮イベント）")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.locator("[data-calendar]")).toHaveText("2日目 · 夜");
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(second).toHaveValue("gilberta");
  await expect(second.locator('option[value="gilberta"]')).toHaveCount(1);
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "読込", exact: true }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("2日目 · 夜");
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(second).toHaveValue("gilberta");
  await page.getByRole("button", { name: "出撃", exact: true }).click();
  await expect(page.getByRole("region", { name: "遺跡の進路" })).toBeVisible();
  await expect(page.locator("[data-calendar]")).toHaveText("2日目 · 夜");
});

test("キャラ詳細の閲覧だけでは編成・保存内容を変えず、元の操作へ戻る", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await page.getByRole("button", { name: "同行者を探す（仮）", exact: true }).click();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "仲間に迎える" }).click();
  const entry = page.getByRole("link", { name: "出撃編成を見る" });
  await entry.click();
  await page.getByRole("combobox", { name: "枠 2" }).selectOption("gilberta");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  const saved = await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"));
  await entry.click();
  const rossi = page.getByRole("button", { name: "ロッシの詳細" });
  const gilberta = page.getByRole("button", { name: "ギルベルタの詳細" });
  await rossi.focus();
  await page.keyboard.press("Enter");
  let details = page.getByRole("dialog", { name: "ロッシ", exact: true });
  await expect(details).toBeVisible();
  await expect(details.getByRole("img", { name: "ロッシ", exact: true })).toBeVisible();
  await expect(details.getByRole("img", { name: "ロッシ", exact: true })).not.toHaveJSProperty("naturalWidth", 0);
  await expect(details).toContainText("20 / 20");
  await expect(details.locator("dd").nth(1)).toHaveText("8");
  await expect(details.locator("dd").nth(2)).toHaveText("100");
  await expect(details.locator("dd").nth(3)).toHaveText("100%");
  await expect(details).not.toContainText("レベル");
  await expect(details).not.toContainText("習得");
  await expect(details.getByRole("button", { name: "編成へ戻る" })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("details-rossi-1920.png") });
  await page.keyboard.press("Tab");
  await expect(details.getByRole("region", { name: "能力と状態" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(details.getByRole("button", { name: "編成へ戻る" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(rossi).toBeFocused();
  await gilberta.dblclick();
  details = page.getByRole("dialog", { name: "ギルベルタ", exact: true });
  await expect(details.getByRole("img", { name: "ギルベルタ", exact: true })).toBeVisible();
  await expect(details.getByRole("img", { name: "ギルベルタ", exact: true })).not.toHaveJSProperty("naturalWidth", 0);
  await expect(details).toContainText("18 / 18");
  await expect(details.locator("dd").nth(1)).toHaveText("6");
  await expect(details.locator("dd").nth(2)).toHaveText("90");
  await page.screenshot({ path: testInfo.outputPath("details-gilberta-1920.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(details.getByRole("heading", { name: "ギルベルタ", exact: true })).toBeInViewport();
  await expect(details.getByRole("button", { name: "編成へ戻る" })).toBeInViewport();
  await expect(details.getByText("命中率", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("details-gilberta-390.png") });
  await details.getByRole("button", { name: "編成へ戻る" }).click();
  await expect(gilberta).toBeFocused();
  const second = page.getByRole("combobox", { name: "枠 2" });
  const before = await second.boundingBox();
  if (!before) throw new Error("元の枠が表示されていません");
  for (let count = 0; count < 3; count++) {
    await page.keyboard.press("Enter");
    await expect(details).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(gilberta).toBeFocused();
  }
  await expect
    .poll(async () => Math.abs(((await second.boundingBox())?.y ?? Number.POSITIVE_INFINITY) - before.y))
    .toBeLessThan(1);
  await expect(page.getByRole("combobox", { name: "枠 1" })).toHaveValue("player");
  await expect(page.getByRole("combobox", { name: "枠 2" })).toHaveValue("gilberta");
  await expect(page.locator("[data-party-calendar]")).toHaveText("1日目 · 夜");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"))).toBe(saved);
  expect(errors).toEqual([]);
});

test("初期症状の試験データから実操作で段階回復・全滅帰還・保存再開をつなぐ", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  // Setup only: use the public core to prepare a street save with moderate ailments.
  // Once loaded, all time, combat outcomes and recovery come from player controls.
  let fixture: ExpeditionGame = {
    adventure: createInitialGameState(initialGameOptions),
    party: createParty(characters, ["player"]),
    dungeon: null,
  };
  for (let tier = 0; tier < 2; tier++) {
    fixture = applyPartyStatus(fixture, "player", "physicalFatigue", characters);
    fixture = applyPartyStatus(fixture, "player", "haze", characters);
  }
  const encoded = serializeGame(fixture, saveDefinitions);
  if (!encoded.accepted) throw new Error(encoded.reason);
  await page.goto("/");
  await page.evaluate((data) => localStorage.setItem("endfield-rpg-game-save", data), encoded.data);
  await page.getByRole("button", { name: "読込", exact: true }).click();
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await page.getByRole("button", { name: "ロッシの詳細" }).click();
  const details = page.getByRole("dialog", { name: "ロッシ", exact: true });
  await expect(details).toContainText("10 / 10");
  await expect(details).toContainText("基礎最大HP 20 · 肉体疲労による低下");
  await expect(details).toContainText("80%");
  await expect(details).toContainText("基礎 100% · 朦朧による低下");
  await expect(details).toContainText("肉体疲労・中度");
  await expect(details).toContainText("朦朧・中度");
  await page.screenshot({ path: testInfo.outputPath("details-ailments-1920.png") });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "市場", exact: true }).click();
  await page.keyboard.press("Space");
  await expect(page.locator("[data-town-recovery]")).toContainText("肉体疲労：中度 → 軽度");
  await expect(page.locator("[data-town-recovery]")).toContainText("朦朧：中度 → 軽度");
  await page.screenshot({ path: testInfo.outputPath("m2c-staged-recovery-1920.png") });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "読込", exact: true }).click();
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(page.locator(".party-slot").first()).toContainText("HP 10 / 15");
  await expect(page.locator(".party-slot").first()).toContainText("肉体疲労・軽度");
  await expect(page.locator(".party-slot").first()).toContainText("朦朧・軽度");
  await page.getByRole("button", { name: "ロッシの詳細" }).click();
  await expect(details).toContainText("10 / 15");
  await expect(details.getByText("90%", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "出撃", exact: true }).click();
  await page.getByRole("button", { name: "思わぬ遭遇、選択可能" }).click();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "地図に足跡を記す" }).click();
  await page.getByRole("button", { name: "ボス、選択可能" }).click();
  const attack = page.getByRole("button", { name: "通常攻撃" });
  await expect(attack).toBeEnabled({ timeout: 60_000 });
  await attack.click();
  await attack.click();
  await expect(page.getByRole("heading", { name: "戦闘に敗北しました" })).toBeVisible();
  await page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }).click();
  await page.getByRole("button", { name: "街へ戻る", exact: true }).click();
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(page.locator(".party-slot").first()).toContainText("HP 15 / 15");
  await expect(page.locator(".party-slot").first()).toContainText("肉体疲労・軽度");
  await expect(page.locator(".party-slot").first()).toContainText("あと街探索6回");
  await page.getByRole("button", { name: "ロッシの詳細" }).click();
  await expect(details).toContainText("15 / 15");
  await expect(details).toContainText("戦闘に参加できません");
  await expect(details).toContainText("戦闘不能（あと街探索6回）");
  await page.keyboard.press("Escape");
  await page.screenshot({ path: testInfo.outputPath("m2c-returned-ailments-1920.png") });
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "市場", exact: true }).click();
  await page.keyboard.press("Space");
  await expect(page.locator("[data-calendar]")).toHaveText("2日目 · 夜");
  await expect(page.locator("[data-town-recovery]")).toContainText("肉体疲労：軽度 → なし");
  await expect(page.locator("[data-town-recovery]")).toContainText("あと街探索6回 → 5回");
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(page.locator(".party-slot").first()).toContainText("HP 15 / 20");
  await expect(page.locator(".party-slot").first()).not.toContainText("肉体疲労");
  await page.getByRole("button", { name: "ロッシの詳細" }).click();
  await expect(details).toContainText("15 / 20");
  await expect(details.getByText("100%", { exact: true })).toBeVisible();
  await expect(details).not.toContainText("基礎最大HP");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "出撃", exact: true })).toBeDisabled();
});

test("街で保存し、リロード後も加入・編成・時計を読み込み、再読込で進めない", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await page.getByRole("button", { name: "同行者を探す（仮）", exact: true }).click();
  await expect(page.getByRole("button", { name: "保存", exact: true })).toBeHidden();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "読込", exact: true })).toBeHidden();
  await page.getByRole("button", { name: "仲間に迎える" }).click();
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await page.getByLabel("枠 1", { exact: true }).selectOption("");
  await page.getByLabel("枠 4", { exact: true }).selectOption("player");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "保存", exact: true }).dblclick();
  await expect(page.locator("[data-save-status]")).toHaveText("保存しました。");
  await page.reload();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 昼");
  await page.getByRole("button", { name: "読込", exact: true }).click();
  await page.getByRole("button", { name: "読込", exact: true }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await expect(page.locator("[data-town-recovery]")).toBeHidden();
  await expect(page.locator("[data-save-status]")).toHaveText("読み込みました。");
  await page.screenshot({ path: testInfo.outputPath("save-loaded-town-1920.png") });
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(page.getByLabel("枠 1", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("枠 4", { exact: true })).toHaveValue("player");
  await expect(page.getByLabel("枠 2", { exact: true }).locator('option[value="gilberta"]')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("save-loaded-party-1920.png") });
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "保存", exact: true })).toBeInViewport();
  await expect(page.getByRole("button", { name: "読込", exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("save-loaded-town-390.png"), fullPage: true });
  await page.getByRole("button", { name: "同行者を探す（仮）", exact: true }).click();
  await expect(page.getByText("ギルベルタは加入済みです。（仮イベント）")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.locator("[data-calendar]")).toHaveText("2日目 · 昼");
});

test("壊れた保存とブラウザI/O失敗でもゲームと既存保存を保持する", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "市場", exact: true }).click();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  const saved = await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"));
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "endfield-rpg-game-save") throw new DOMException("quota", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.locator("[data-save-status]")).toContainText("保存できません");
  expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"))).toBe(saved);
  await page.evaluate(() => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key === "endfield-rpg-game-save") throw new DOMException("denied", "SecurityError");
      return original.call(this, key);
    };
  });
  await page.getByRole("button", { name: "読込", exact: true }).click();
  await expect(page.locator("[data-save-status]")).toContainText("読み込めません");
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await page.reload();
  await page.evaluate(() => localStorage.setItem("endfield-rpg-game-save", '{"version":1,"party":{}}'));
  await page.getByRole("button", { name: "市場", exact: true }).click();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "読込", exact: true }).click();
  await expect(page.locator("[data-save-status]")).toContainText("読み込めません");
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"))).toBe('{"version":1,"party":{}}');
});

test("通常探索のスキル使用を次戦・帰還・保存読込・街回復へつなぐ", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await page.getByRole("button", { name: "出撃", exact: true }).click();
  await page.getByRole("button", { name: "戦闘、選択可能" }).click();
  const skills = page.getByRole("button", { name: "スキル", exact: true });
  await expect(skills).toBeEnabled({ timeout: 60_000 });
  await page.locator('[data-combatant-id="slime"]').click();
  const use = async (name: string, target?: string, endsBattle = false) => {
    await skills.click();
    await page.getByRole("button", { name, exact: true }).click();
    if (target) await page.getByRole("combobox", { name: "回復対象" }).selectOption(target);
    await page.getByRole("button", { name: "使用する", exact: true }).click();
    await expect(endsBattle ? page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }) : skills).toBeEnabled();
  };
  await use("検証用攻撃");
  await use("検証用回復", "player");
  await use("検証用攻撃", undefined, true);
  await page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }).click();
  await page.getByRole("button", { name: "ボス、選択可能" }).click();
  await expect(skills).toBeEnabled({ timeout: 60_000 });
  await skills.click();
  await page.getByRole("button", { name: "検証用攻撃", exact: true }).click();
  await expect(page.locator("[data-skill-fatigue]")).toContainText("精神疲労 11");
  await expect(page.locator("[data-skill-preview]")).toContainText("予測ダメージ 14.41");
  await page.screenshot({ path: testInfo.outputPath("skill-preview-1440.png") });
  await page.getByRole("button", { name: "使用する", exact: true }).click();
  await expect(skills).toBeEnabled();
  await expect(page.locator("[data-skill-result]")).toContainText("14.41ダメージ");
  await use("検証用攻撃", undefined, true);
  await page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }).click();
  await page.getByRole("button", { name: "街へ戻る", exact: true }).click();
  await expect(page.locator("[data-town-recovery]")).toContainText("精神疲労 19");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  const saved = await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"));
  expect(JSON.parse(saved ?? "{}").party.members[0].mentalFatigue).toBe(19);
  await page.reload();
  await page.getByRole("button", { name: "読込", exact: true }).dblclick();
  expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-game-save"))).toBe(saved);
  await page.getByRole("button", { name: "市場", exact: true }).click();
  await page.keyboard.press("Space");
  await expect(page.locator("[data-town-recovery]")).toContainText("精神疲労：19 → 9");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("endfield-rpg-game-save") ?? "{}").party.members[0].mentalFatigue,
    ),
  ).toBe(9);
  await page.screenshot({ path: testInfo.outputPath("skill-town-recovery.png") });
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await page.getByRole("button", { name: "ロッシの詳細", exact: true }).click();
  const details = page.getByRole("dialog", { name: "ロッシ", exact: true });
  await expect(details.locator("dd").nth(4)).toHaveText("9（なし）");
  await page.screenshot({ path: testInfo.outputPath("skill-fatigue-details.png") });
  await page.keyboard.press("Escape");
});
