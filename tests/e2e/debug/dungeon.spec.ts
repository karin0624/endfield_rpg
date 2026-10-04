import { collectCoverage, expect, test } from "../coverage";
import { editSlot, finishGrowthChoices, winByAttacking } from "../debugSessionHelpers";

test("ルートを横ドラッグでき、表示領域を変えても選択肢を操作できる", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?debug=1&dungeon=1");
  await expect(page.getByRole("region", { name: "遺跡の進路" })).toBeVisible();

  const battleNode = page.getByRole("button", { name: "戦闘、選択可能" });
  await expect(battleNode).toBeEnabled();
  const futureBoss = page.getByRole("button", { name: "ボス、未到達" });
  await expect(futureBoss).toBeDisabled();
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
  await battleNode.click();
  await expect(page.locator("[data-battle-screen]")).toBeVisible();
});

test("会話ノードの選択後に探索位置へ戻る", async ({ page }) => {
  await page.goto("/?debug=1&dungeon=1");
  await page.getByRole("button", { name: "思わぬ遭遇、選択可能" }).click();
  await expect(page.getByText("道の脇に、遺跡へ続く新しい足跡が残っている。")).toBeVisible();
  await page.locator("[data-conversation-stage]").click();
  await expect(page.getByText("足跡を記録する？")).toBeVisible();
  await page.getByRole("button", { name: "地図に足跡を記す" }).click();
  await finishGrowthChoices(page);

  await expect(page.getByRole("region", { name: "遺跡の進路" })).toBeVisible();
  await expect(page.getByRole("button", { name: "思わぬ遭遇、現在地" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "ボス、選択可能" })).toBeEnabled();
  const skippedBattle = page.getByRole("button", { name: "戦闘、未到達" });
  await expect(skippedBattle).toBeDisabled();
  await expect(page.getByText("戦闘", { exact: true })).toHaveCount(0);
  await expect(page.getByText("ボス", { exact: true })).toBeVisible();
});

test("390pxのダンジョン戦闘でコマンドまでスクロールして攻撃できる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?debug=1&dungeon=1");
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

test("編成だけを表示し、キーボードで戻っても編集内容を保持する", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?debug=1");
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
  await expect(party.getByRole("button", { name: "出発する", exact: true })).toBeFocused();
  await editSlot(page, 1, "");
  await editSlot(page, 4, "player");
  for (let reopen = 0; reopen < 2; reopen++) {
    await back.focus();
    await page.keyboard.press("Enter");
    await expect(party).toBeHidden();
    await expect(page.getByRole("navigation", { name: "街の場所" })).toBeVisible();
    await expect(entry).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(party.getByLabel("枠 1", { exact: true })).toContainText("ロッシ");
    await expect(party.getByLabel("枠 4", { exact: true })).toHaveAccessibleDescription("空き枠。仲間を選択");
    await expect(back).toBeFocused();
  }
});

test("街探索から加入・編成・ボス帰還・再訪まで同じセッションで進む", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/?debug=1");
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  const second = page.getByRole("button", { name: "枠 2" });
  await second.click();
  await expect(
    page.getByRole("group", { name: "候補一覧" }).getByRole("button", { name: "ギルベルタ", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "出発する", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "同行者を探す（仮）", exact: true }).click();
  await expect(page.getByText("ギルベルタに同行を相談する。（仮イベント）")).toBeVisible();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "仲間に迎える" }).click();
  await expect(page.locator("[data-town-prompt]")).toHaveText("ギルベルタが仲間に加わった。");
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(page.getByRole("button", { name: "枠 1" })).toContainText("ロッシ");
  await expect(second).toHaveAccessibleDescription("空き枠。仲間を選択");
  await editSlot(page, 2, "gilberta");
  await expect(page.locator(".party-slot").nth(1)).toContainText("HP 18/18");
  await expect
    .poll(() =>
      page
        .locator(".party-slot")
        .nth(1)
        .locator("img")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath("joined-party-1920.png") });
  await page.getByRole("button", { name: "出発する", exact: true }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await page.screenshot({ path: testInfo.outputPath("party-route-1920.png") });
  await page.getByRole("button", { name: "思わぬ遭遇、選択可能" }).click();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "地図に足跡を記す" }).click();
  await finishGrowthChoices(page);
  await page.getByRole("button", { name: "ボス、選択可能" }).click();
  const attack = page.getByRole("button", { name: "通常攻撃" });
  await expect(attack).toBeEnabled({ timeout: 60_000 });
  await page.screenshot({ path: testInfo.outputPath("party-battle-1920.png") });
  await winByAttacking(page);
  await expect(page.getByRole("heading", { name: "戦闘に勝利しました" })).toBeVisible();
  await page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }).click();
  await page.getByRole("button", { name: "街へ戻る", exact: true }).dblclick();
  await expect(page.locator("[data-calendar]")).toHaveText("2日目 · 昼");
  await expect(page.locator("[data-town-recovery]")).toHaveText("出撃者のHPが全回復しました。");
  await page.screenshot({ path: testInfo.outputPath("victory-town-1920.png") });
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(page.locator(".party-slot-hp").nth(0)).toHaveText("HP 20/20");
  await expect(page.locator(".party-slot-hp").nth(1)).toHaveText("HP 18/18");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "同行者を探す（仮）", exact: true }).click();
  await expect(page.getByText("ギルベルタは加入済みです。（仮イベント）")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.locator("[data-calendar]")).toHaveText("2日目 · 夜");
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(second).toContainText("ギルベルタ");
  await second.click();
  await expect(
    page.getByRole("group", { name: "候補一覧" }).getByRole("button", { name: "ギルベルタ", exact: true }),
  ).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await collectCoverage(page);
  await page.reload();
  await page.getByRole("button", { name: "読込", exact: true }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("2日目 · 夜");
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(second).toContainText("ギルベルタ");
  await page.getByRole("button", { name: "出発する", exact: true }).click();
  await expect(page.getByRole("region", { name: "遺跡の進路" })).toBeVisible();
  await expect(page.locator("[data-calendar]")).toHaveText("2日目 · 夜");
});

test("キャラ詳細の閲覧だけでは編成・保存内容を変えず、元の操作へ戻る", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/?debug=1");
  await page.getByRole("button", { name: "同行者を探す（仮）", exact: true }).click();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "仲間に迎える" }).click();
  const entry = page.getByRole("link", { name: "出撃編成を見る" });
  await entry.click();
  await editSlot(page, 2, "gilberta");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("endfield-rpg-debug-save") ?? "null"));
  await entry.click();
  await page.getByRole("button", { name: "枠 1", exact: true }).click();
  const rossi = page.getByRole("button", { name: "ロッシの詳細" });
  const gilberta = page.getByRole("button", { name: "ギルベルタの詳細" });
  await rossi.focus();
  await page.keyboard.press("Enter");
  let details = page.getByRole("dialog", { name: "ロッシ", exact: true });
  await expect(details).toBeVisible();
  await expect(details.getByRole("img", { name: "ロッシ", exact: true })).toBeVisible();
  await expect(details.getByRole("img", { name: "ロッシ", exact: true })).not.toHaveJSProperty("naturalWidth", 0);
  await expect(details).toContainText("20 / 20");
  await expect(
    details
      .locator(".character-details-stats > div")
      .filter({ has: page.getByText("攻撃力", { exact: true }) })
      .locator("dd"),
  ).toHaveText("8");
  await expect(
    details
      .locator(".character-details-stats > div")
      .filter({ has: page.getByText("速度", { exact: true }) })
      .locator("dd"),
  ).toHaveText("100");
  await expect(
    details
      .locator(".character-details-stats > div")
      .filter({ has: page.getByText("命中率", { exact: true }) })
      .locator("dd"),
  ).toHaveText("100%");
  await expect(
    details.locator(".character-details-stats > div").filter({ has: page.getByText("レベル", { exact: true }) }),
  ).toContainText("1");
  await expect(details.getByRole("region", { name: "習得スキル" })).toContainText("検証用攻撃");
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
  await expect(
    details
      .locator(".character-details-stats > div")
      .filter({ has: page.getByText("攻撃力", { exact: true }) })
      .locator("dd"),
  ).toHaveText("6");
  await expect(
    details
      .locator(".character-details-stats > div")
      .filter({ has: page.getByText("速度", { exact: true }) })
      .locator("dd"),
  ).toHaveText("90");
  await page.screenshot({ path: testInfo.outputPath("details-gilberta-1920.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(details.getByRole("heading", { name: "ギルベルタ", exact: true })).toBeInViewport();
  await expect(details.getByRole("button", { name: "編成へ戻る" })).toBeInViewport();
  await expect(details.getByText("命中率", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("details-gilberta-390.png") });
  await details.getByRole("button", { name: "編成へ戻る" }).click();
  await expect(gilberta).toBeFocused();
  const second = gilberta;
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
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "枠 1" })).toContainText("ロッシ");
  await expect(page.getByRole("button", { name: "枠 2" })).toContainText("ギルベルタ");
  await expect(page.locator("[data-party-calendar]")).toHaveText("1日目 · 夜");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("endfield-rpg-debug-save") ?? "null"))).toEqual(
    saved,
  );
  expect(errors).toEqual([]);
});

test("街で保存し、リロード後も加入・編成・時計を読み込み、再読込で進めない", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/?debug=1");
  await page.getByRole("button", { name: "同行者を探す（仮）", exact: true }).click();
  await expect(page.getByRole("button", { name: "保存", exact: true })).toBeHidden();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "読込", exact: true })).toBeHidden();
  await page.getByRole("button", { name: "仲間に迎える" }).click();
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await editSlot(page, 1, "");
  await editSlot(page, 4, "player");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await page.getByRole("button", { name: "保存", exact: true }).dblclick();
  await expect(page.locator("[data-save-status]")).toHaveText("保存しました。");
  await collectCoverage(page);
  await page.reload();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 昼");
  await page.getByRole("button", { name: "読込", exact: true }).click();
  await page.getByRole("button", { name: "読込", exact: true }).click();
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await expect(page.locator("[data-town-recovery]")).toBeHidden();
  await expect(page.locator("[data-save-status]")).toHaveText("読み込みました。");
  await page.screenshot({ path: testInfo.outputPath("save-loaded-town-1920.png") });
  await page.getByRole("link", { name: "出撃編成を見る" }).click();
  await expect(page.getByLabel("枠 4", { exact: true })).toHaveAccessibleDescription("空き枠。仲間を選択");
  await expect(page.getByLabel("枠 1", { exact: true })).toContainText("ロッシ");
  await page.getByLabel("枠 2", { exact: true }).click();
  await expect(
    page.getByRole("group", { name: "候補一覧" }).getByRole("button", { name: "ギルベルタ", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
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
  await page.goto("/?debug=1");
  await page.getByRole("button", { name: "市場", exact: true }).click();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  const saved = await page.evaluate(() => localStorage.getItem("endfield-rpg-debug-save"));
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "endfield-rpg-debug-save") throw new DOMException("quota", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.locator("[data-save-status]")).toContainText("保存できません");
  expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-debug-save"))).toBe(saved);
  await page.evaluate(() => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key === "endfield-rpg-debug-save") throw new DOMException("denied", "SecurityError");
      return original.call(this, key);
    };
  });
  await page.getByRole("button", { name: "読込", exact: true }).click();
  await expect(page.locator("[data-save-status]")).toContainText("読み込めません");
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  await collectCoverage(page);
  await page.reload();
  await page.evaluate(() => localStorage.setItem("endfield-rpg-debug-save", '{"version":5,"party":{}}'));
  await page.getByRole("button", { name: "市場", exact: true }).click();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "読込", exact: true }).click();
  await expect(page.locator("[data-save-status]")).toContainText("読み込めません");
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-debug-save"))).toBe('{"version":5,"party":{}}');
  await page.evaluate(() => localStorage.setItem("endfield-rpg-debug-save", '{"version":4,"party":{}}'));
  await page.getByRole("button", { name: "読込", exact: true }).click();
  await expect(page.locator("[data-save-status]")).toHaveText("対応していない保存データです。");
  await expect(page.locator("[data-calendar]")).toHaveText("1日目 · 夜");
  expect(await page.evaluate(() => localStorage.getItem("endfield-rpg-debug-save"))).toBe('{"version":4,"party":{}}');
});

test("ルートの左右キーは範囲内で移動し、pointercancel後もノードを選べる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?debug=1&dungeon=1");
  const viewport = page.locator("[data-route-viewport]");
  const node = page.getByRole("button", { name: "戦闘、選択可能" });
  await viewport.focus();
  const initial = await node.boundingBox();
  if (!initial) throw new Error("戦闘ノードなし");
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await node.boundingBox())?.x).toBeLessThan(initial.x);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await node.boundingBox())?.x).toBeCloseTo(initial.x, 0);
  await node.focus();
  const focused = await node.boundingBox();
  await page.keyboard.press("ArrowRight");
  expect((await node.boundingBox())?.x).toBe(focused?.x);
  await viewport.focus();
  for (let i = 0; i < 30; i++) await page.keyboard.press("ArrowRight");
  const end = await node.boundingBox();
  const bossAtEnd = await page.getByRole("button", { name: "ボス、未到達" }).boundingBox();
  if (!bossAtEnd) throw new Error("ボス画像なし");
  expect(bossAtEnd.x + bossAtEnd.width / 2).toBeCloseTo(195, 0);
  await page.keyboard.press("ArrowRight");
  expect((await node.boundingBox())?.x).toBe(end?.x);
  for (let i = 0; i < 30; i++) await page.keyboard.press("ArrowLeft");
  const start = await node.boundingBox();
  if (!start) throw new Error("戦闘画像なし");
  expect(start.x + start.width / 2).toBeCloseTo(195, 0);
  await page.keyboard.press("ArrowLeft");
  expect((await node.boundingBox())?.x).toBe(start?.x);
  await viewport.dispatchEvent("pointerdown", {
    pointerId: 7,
    pointerType: "touch",
    button: 0,
    clientX: 200,
    clientY: 300,
  });
  await viewport.dispatchEvent("pointercancel", { pointerId: 7, pointerType: "touch" });
  await expect(page.locator("[data-battle-screen]")).toBeHidden();
  // Resizing resets the framing for a fresh route; interrupted pointer input must not keep a drag alive.
  await page.setViewportSize({ width: 1440, height: 900 });
  await node.click();
  await expect(page.locator("[data-battle-screen]")).toBeVisible();
});

test("ルート画像が題名の描画後に届いても初期表示を保つ", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let heldResponses = 0;
  await page.route("**/dungeon-nodes/**/*.png", async (route) => {
    const response = await route.fetch();
    heldResponses++;
    await pending;
    await route.fulfill({ response });
  });
  try {
    await page.goto("/?debug=1&dungeon=1", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "戦闘、選択可能" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "思わぬ遭遇、選択可能" })).toBeEnabled();
    await expect(page.getByText("戦闘", { exact: true })).toBeVisible();
    await expect(page.getByText("思わぬ遭遇", { exact: true })).toBeVisible();
    await expect.poll(() => heldResponses).toBe(3);
    await page.evaluate(async () => {
      await document.fonts.ready;
      // Deliberately allow the labels to paint before delivering the real node PNGs.
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    });
  } finally {
    release();
  }
  await page.locator("[data-route-nodes] img").evaluateAll(async (images) => {
    await Promise.all(images.map((image) => (image as HTMLImageElement).decode()));
  });
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot("route-initial-390.png");
});

test("ルートの線端点・視差・中央配置はドラッグと進行後のリサイズに追従する", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await collectCoverage(page);
  await page.goto("/?debug=1&dungeon=1");
  const viewport = page.locator("[data-route-viewport]");
  const battle = page.getByRole("button", { name: "戦闘、選択可能" });
  const conversation = page.getByRole("button", { name: "思わぬ遭遇、選択可能" });
  const boss = page.getByRole("button", { name: "ボス、未到達" });
  const background = page.locator("[data-route-background]");
  const edge = page.locator('[data-edge-from="battle-a"][data-edge-to="boss-c"]');
  async function endpoints() {
    return edge.evaluate((node: SVGPathElement) => {
      const matrix = node.getScreenCTM();
      if (!matrix) throw new Error("edge matrix missing");
      const start = node.getPointAtLength(0).matrixTransform(matrix);
      const end = node.getPointAtLength(node.getTotalLength()).matrixTransform(matrix);
      return { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } };
    });
  }
  async function checkConnection() {
    await page.mouse.move(0, 0);
    await expect
      .poll(async () => {
        const from = await battle.locator("img").boundingBox(),
          to = await boss.locator("img").boundingBox();
        if (!from || !to) return false;
        const path = await endpoints();
        return (
          Math.abs(path.start.y - (from.y + from.height / 2)) < 1 &&
          Math.abs(path.end.y - (to.y + to.height / 2)) < 1 &&
          path.start.x > from.x + from.width &&
          path.end.x < to.x
        );
      })
      .toBe(true);
  }
  await expect(battle).toBeInViewport({ ratio: 1 });
  await expect(conversation).toBeInViewport({ ratio: 1 });
  const initial = await battle.boundingBox();
  if (!initial) throw new Error("node missing");
  expect(initial.x + initial.width / 2).toBeCloseTo(195, 0);
  await expect(page.locator("[data-route-nodes] img")).toHaveCount(3);
  await checkConnection();
  await expect(page).toHaveScreenshot("route-initial-390.png");
  const bgBefore = await background.boundingBox(),
    pathBefore = await endpoints();
  if (!bgBefore) throw new Error("background missing");
  await viewport.focus();
  await page.keyboard.press("ArrowRight");
  const moved = await battle.boundingBox(),
    bgAfter = await background.boundingBox(),
    pathAfter = await endpoints();
  if (!moved || !bgAfter) throw new Error("dragged geometry missing");
  const dx = moved.x - initial.x;
  expect(dx).toBeLessThan(0);
  expect(pathAfter.start.x - pathBefore.start.x).toBeCloseTo(dx, 0);
  expect(bgAfter.x - bgBefore.x).toBeLessThan(0);
  expect(Math.abs(bgAfter.x - bgBefore.x)).toBeLessThan(Math.abs(dx));
  await page.mouse.move(200, 400);
  await page.mouse.wheel(0, 500);
  await expect(viewport).toHaveJSProperty("scrollTop", 0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await checkConnection();
  // Start the visual state at its capture viewport; the separate narrow regression
  // below verifies progression and resize at 390, 800 and 1440 pixels.
  await page.setViewportSize({ width: 1440, height: 844 });
  await collectCoverage(page);
  await page.goto("/?debug=1&dungeon=1");
  await conversation.click();
  await page.keyboard.press("Space");
  await page.keyboard.press("Digit1");
  await finishGrowthChoices(page);
  await page.setViewportSize({ width: 1440, height: 844 });
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot("route-progressed-1440.png");
});

test("狭幅ルートも進行後の現在地と次候補を同時に画面内へ収める", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?debug=1&dungeon=1");
  await page.getByRole("button", { name: "思わぬ遭遇、選択可能" }).click();
  await page.keyboard.press("Space");
  await page.keyboard.press("Digit1");
  await finishGrowthChoices(page);
  // specs/dungeon.md58 explicitly requires both current and available nodes to remain visible.
  for (const width of [390, 800, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole("button", { name: "思わぬ遭遇、現在地" })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("button", { name: "ボス、選択可能" })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: info.outputPath(`route-fixed-${width}.png`) });
  }
});

test.describe(() => {
  test.use({ reducedMotion: "no-preference", hasTouch: true, viewport: { width: 390, height: 844 } });
  test("実タッチのドラッグと中断は誤選択せず、次のタップを受け付ける", async ({ page, context }) => {
    await page.goto("http://127.0.0.1:4175/?debug=1&dungeon=1");
    const node = page.getByRole("button", { name: "思わぬ遭遇、選択可能" });
    const before = await node.boundingBox();
    if (!before) throw new Error("node missing");
    const x = before.x + before.width / 2,
      y = before.y + before.height / 2;
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - 70, y }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    await expect.poll(async () => (await node.boundingBox())?.x).toBeLessThan(before.x - 50);
    await expect(page.locator("[data-conversation-screen]")).toBeHidden();
    await node.tap();
    await expect(page.getByText("道の脇に、遺跡へ続く新しい足跡が残っている。")).toBeVisible();
    await session.detach();
  });
});

test("探索中の会話本文をドラッグしても範囲選択せず番号入力を続けられる", async ({ page }) => {
  await page.goto("/?debug=1&dungeon=1");
  await page.getByRole("button", { name: "思わぬ遭遇、選択可能" }).click();
  const text = page.locator("[data-dialogue-text]");
  const box = await text.boundingBox();
  if (!box) throw new Error("dialogue text missing");
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("");
  // The drag may finish the line, but it must leave the real choice operable.
  if (!(await page.locator("[data-conversation-choices] button").count())) await page.keyboard.press("Space");
  await page.keyboard.press("Digit1");
  await finishGrowthChoices(page);
  await expect(page.getByRole("button", { name: "ボス、選択可能" })).toBeVisible();
});
