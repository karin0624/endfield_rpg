import { expect, test } from "@playwright/test";

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

test("単独で戦闘分岐のHPを持ち越し、ボスで全滅して街へ戻る", async ({ page }) => {
  await page.goto("/?dungeon=1");
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
  await page.getByRole("button", { name: "街へ戻る", exact: true }).click();
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(page.locator(".party-slot-hp").first()).toHaveText("戦闘不能 · HP 0");
  await expect(page.getByRole("button", { name: "出撃" })).toBeDisabled();
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

test("街の4枠を編集して単独出撃し、会話分岐のボス撃破後もHPを保持する", async ({ page }) => {
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
  await expect(page.locator(".party-slot-hp").nth(3)).toHaveText("HP 5 / 20");
  await party.getByLabel("枠 4", { exact: true }).selectOption("");
  await expect(
    party.getByLabel("枠 1", { exact: true }).getByRole("option", { name: "ロッシ — HP 5/20", exact: true }),
  ).toHaveCount(1);
  await party.getByLabel("枠 1", { exact: true }).selectOption("player");
  await expect(page.locator(".party-slot-hp").first()).toHaveText("HP 5 / 20");
  expect(errors).toEqual([]);
});

test("仮の街イベントでギルベルタが控えに加入し、編成と再訪でも重複しない", async ({ page }, testInfo) => {
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
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(page.getByRole("combobox", { name: "枠 1" })).toHaveValue("player");
  await expect(second).toHaveValue("");
  await expect(second.locator('option[value="gilberta"]')).toHaveText("ギルベルタ — HP 18/18");
  await second.selectOption("gilberta");
  await expect(page.locator(".party-slot").nth(1)).toContainText("HP 18 / 18");
  await expect(page.locator(".party-slot").nth(1).locator("img")).toHaveJSProperty("naturalWidth", 1024);
  await page.screenshot({ path: testInfo.outputPath("recruitment-party-1440.png"), fullPage: true });
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "同行者を探す（仮）", exact: true }).click();
  await expect(page.getByText("ギルベルタは加入済みです。（仮イベント）")).toBeVisible();
  await page.keyboard.press("Space");
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(second).toHaveValue("gilberta");
  await expect(second.locator('option[value="gilberta"]')).toHaveCount(1);
});
