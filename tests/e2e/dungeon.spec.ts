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

test("戦闘ノードの勝利後にボスへ進み、探索結果を表示する", async ({ page }) => {
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
  await expect(warden).toHaveAccessibleName(/HP 20\/28/);
  await attack.click();
  await expect(warden).toHaveAccessibleName(/HP 14\/28/);
  await attack.click();
  await expect(warden).toHaveAccessibleName(/HP 6\/28/);
  await attack.click();
  await expect(page.getByRole("heading", { name: "戦闘に勝利しました" })).toBeVisible();
  await page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }).click();
  await expect(page.getByRole("heading", { name: "探索を完了しました" })).toBeVisible();
});
