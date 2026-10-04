import type { Page } from "@playwright/test";
import { collectCoverage, expect, test } from "../coverage";

async function expectCurrentEnemyOverlays(page: Page, expectedViewport?: { width: number; height: number }) {
  await expect
    .poll(
      async () => {
        const [stage, label, marker] = await Promise.all([
          page.locator(".stage").boundingBox(),
          page.locator(".enemy-world-label.selected").boundingBox(),
          page.locator("[data-target-indicator]").boundingBox(),
        ]);
        if (!stage || !label || !marker) return false;
        return (
          [stage, label, marker].every((box) => Object.values(box).every(Number.isFinite)) &&
          (!expectedViewport ||
            (page.viewportSize()?.width === expectedViewport.width &&
              page.viewportSize()?.height === expectedViewport.height &&
              Math.abs(stage.width - expectedViewport.width) < 1 &&
              Math.abs(stage.height - (expectedViewport.width * 9) / 16) < 1)) &&
          marker.y + marker.height <= label.y - 3 &&
          label.y >= stage.y &&
          label.y + label.height <= stage.y + stage.height
        );
      },
      { timeout: 60_000, message: "指定画面寸法と敵札・選択マーカーの配置が整合する" },
    )
    .toBe(true);
}

test("配布画面の実描画を基準画像と比較する", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("requestfailed", (request) => errors.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("/?debug=1&battle=1");
  await expect(page.getByRole("button", { name: "通常攻撃" })).toBeEnabled({ timeout: 60_000 });
  await expectCurrentEnemyOverlays(page);
  await expect(page).toHaveScreenshot("battle-desktop.png", { animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "通常攻撃" })).toBeEnabled();
  await expectCurrentEnemyOverlays(page);
  await expect(page).toHaveScreenshot("battle-mobile.png", { animations: "disabled", fullPage: true });
  expect(errors).toEqual([]);
});

test("敵札の文字寸法と画面サイズの変更に追従し、離脱後に札を表示しない", async ({ page }) => {
  // DOMだけの寸法変更で地面を描き直さないことを、ブラウザの描画APIで確認する。
  await page.addInitScript(() => {
    for (const context of [WebGLRenderingContext, WebGL2RenderingContext]) {
      const drawElements = context.prototype.drawElements;
      context.prototype.drawElements = function (
        this: WebGLRenderingContext,
        ...args: Parameters<WebGLRenderingContext["drawElements"]>
      ) {
        performance.mark("e2e-webgl-draw");
        drawElements.apply(this, args);
      };
      const drawArrays = context.prototype.drawArrays;
      context.prototype.drawArrays = function (
        this: WebGLRenderingContext,
        ...args: Parameters<WebGLRenderingContext["drawArrays"]>
      ) {
        performance.mark("e2e-webgl-draw");
        drawArrays.apply(this, args);
      };
    }
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/?debug=1&dungeon=1");
  await page.getByRole("button", { name: "戦闘、選択可能" }).click();
  await expect(page.getByRole("button", { name: "通常攻撃" })).toBeEnabled({ timeout: 60_000 });
  await expectCurrentEnemyOverlays(page);
  const selected = page.locator(".enemy-world-label.selected");
  const before = await selected.boundingBox();
  if (!before) throw new Error("敵札が表示されていません");
  await page.screenshot();
  const drawsBeforeTextResize = await page.evaluate(() => performance.getEntriesByName("e2e-webgl-draw").length);
  expect(drawsBeforeTextResize).toBeGreaterThan(0);
  // Presentation input only: simulate increased text size, leaving game state intact.
  const textSize = await page.addStyleTag({
    content: ".enemy-world-heading strong, .enemy-world-hp { font-size: 24px !important; }",
  });
  await expect.poll(async () => (await selected.boundingBox())?.height ?? 0).toBeGreaterThan(before.height);
  await expectCurrentEnemyOverlays(page);
  await page.screenshot();
  expect(await page.evaluate(() => performance.getEntriesByName("e2e-webgl-draw").length)).toBe(drawsBeforeTextResize);
  await textSize.evaluate((element) => element.parentNode?.removeChild(element));
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await expectCurrentEnemyOverlays(page, viewport);
  }
  const attack = page.getByRole("button", { name: "通常攻撃" });
  for (let turn = 0; turn < 4; turn++) {
    await attack.click();
    await expect(page.getByRole("button", { name: "演出を省略", exact: true })).toBeHidden({ timeout: 60_000 });
  }
  await expect(page.getByRole("heading", { name: "戦闘に勝利しました" })).toBeVisible();
  await page.setViewportSize({ width: 900, height: 900 });
  await page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }).click();
  const growth = page.getByRole("region", { name: "レベルアップのスキル選択" });
  while (await growth.isVisible()) {
    await expect(growth.getByRole("button")).toHaveCount(3);
    await growth.getByRole("button").first().click();
  }
  await expect(page.getByRole("region", { name: "遺跡の進路" })).toBeVisible();
  for (const label of await page.locator(".enemy-world-label").all()) await expect(label).toBeHidden();
  await expect(page.locator("[data-target-indicator]")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("通常モーションで攻撃・撃破・再戦し、再読込後も敵札を配置する", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?debug=1&battle=1");
  const attack = page.getByRole("button", { name: "通常攻撃" });
  const slimeA = page.getByRole("button", { name: /スライム A、HP .*攻撃対象に選択/ });
  const slimeB = page.getByRole("button", { name: /スライム B、HP .*攻撃対象に選択/ });
  await expect(attack).toBeEnabled({ timeout: 60_000 });
  await expectCurrentEnemyOverlays(page);
  await attack.click();
  // 通常モーション経路の攻撃後に寸法を変えても、その後の入力・投影を保つ。
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(slimeB).toHaveAccessibleName(/スライム B、HP 6\/14/);
  await expect(attack).toBeEnabled({ timeout: 60_000 });
  await expectCurrentEnemyOverlays(page, { width: 390, height: 844 });
  await attack.click();
  await expect(slimeB).toBeHidden({ timeout: 60_000 });
  await expect(attack).toBeEnabled({ timeout: 60_000 });
  await attack.click();
  await expect(attack).toBeEnabled({ timeout: 60_000 });
  await attack.click();
  await expect(page.getByRole("heading", { name: "戦闘に勝利しました" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "戦闘を再戦する" }).click();
  await expect(slimeA).toHaveAccessibleName(/スライム A、HP 14\/14/);
  await expect(slimeB).toHaveAccessibleName(/スライム B、HP 14\/14/);
  await expect(attack).toBeEnabled({ timeout: 60_000 });
  await expectCurrentEnemyOverlays(page);
  await collectCoverage(page);
  await page.reload();
  await expect(attack).toBeEnabled({ timeout: 60_000 });
  await expectCurrentEnemyOverlays(page);
  expect(errors).toEqual([]);
});

test("素材の取得に失敗した理由を画面に表示する", async ({ page }) => {
  await page.route("**/assets/characters/rossi/front-left.png", (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await page.goto("/?debug=1&battle=1");
  await expect(page.getByRole("status")).toContainText("戦闘画面を読み込めませんでした", { timeout: 30_000 });
});

test("街の場所から会話を送り、選択後の再訪でも進行を保つ", async ({ page }) => {
  await page.goto("/?debug=1");
  await expect(page.getByRole("heading", { name: "街の広場" })).toBeVisible();
  await expect(page.getByRole("button", { name: "冒険者ギルド" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/AUTO|MENU|Space/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "冒険者ギルド" }).click();
  await expect(page.locator("[data-adventure-screen]")).toHaveCSS("height", "844px");
  await expect(page.getByText("ロッシは掲示板の前で足を止めた。")).toBeVisible();
  await expect(page.locator('[data-portrait-id="rossi"]')).toBeVisible();
  await expect
    .poll(() =>
      page.locator('[data-portrait-id="rossi"] img').evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.keyboard.press("Space");
  await expect(page.getByText("ギルベルタが掲示板の前で会釈した。")).toBeVisible();
  await expect(page.locator("[data-adventure-screen]")).toHaveScreenshot("conversation-gilberta-390.png");
  await expect
    .poll(() =>
      page.locator('[data-portrait-id="gilberta"] img').evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);

  await page.locator("[data-conversation-stage]").click();
  await expect(page.getByText("何を聞こう？")).toBeVisible();
  const questChoice = page.getByRole("button", { name: "掲示板の依頼について聞く" });
  await expect(questChoice).toBeVisible();
  await page.keyboard.press("Space");
  await expect(questChoice).toBeVisible();
  await expect(page.locator(".dialogue-next")).toBeHidden();
  await expect(page.locator("[data-adventure-screen]")).toHaveScreenshot("conversation-choice-390.png");
  await questChoice.click();
  await expect(page.getByText("街道の様子を調べる依頼が出ているそうだ。")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "街の広場" })).toBeVisible();

  await page.getByRole("button", { name: "冒険者ギルド" }).click();
  await expect(page.getByText(/前回の話を覚えていた/)).toBeVisible();
});

test("表示番号の数字キーで会話の選択肢を選べる", async ({ page }) => {
  await page.goto("/?debug=1");
  await page.getByRole("button", { name: "冒険者ギルド" }).click();
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  const firstChoice = page.getByRole("button", { name: "掲示板の依頼について聞く" });
  await expect(firstChoice).toBeVisible();
  await page.keyboard.press("Digit1");
  await expect(page.getByText("街道の様子を調べる依頼が出ているそうだ。")).toBeVisible();
});

test("街と会話の表示をドラッグしても範囲選択せず、移動とキー操作を続けられる", async ({ page }) => {
  await page.goto("/?debug=1");
  const title = page.getByRole("heading", { name: "街の広場" });
  await expect(title).toBeVisible();
  const townPlaces = page.getByRole("navigation", { name: "街の場所" });
  await expect(townPlaces).toHaveText("街の広場›冒険者ギルド›市場›同行者を探す（仮）›");
  for (const target of [title, page.locator("[data-town-prompt]"), page.locator(".town-place-arrow").first()]) {
    const bounds = await target.boundingBox();
    if (bounds === null) throw new Error("街の表示が見つかりません");
    await page.mouse.move(bounds.x + 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width - 2, bounds.y + bounds.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe("");
  }
  // Dragging the arrow can navigate to its place; finish that ordinary conversation before opening the guild.
  if (await page.locator("[data-conversation-view]").isVisible()) await page.keyboard.press("Space");
  await expect(title).toBeVisible();

  await page.getByRole("button", { name: "冒険者ギルド" }).click();
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  await expect(page.getByText("何を聞こう？")).toBeVisible();
  for (const target of [
    page.locator("[data-speaker]"),
    page.locator("[data-dialogue-text]"),
    page.locator("[data-conversation-portraits] img").first(),
  ]) {
    await page.evaluate(() => window.getSelection()?.removeAllRanges());
    const bounds = await target.boundingBox();
    if (bounds === null) throw new Error("会話の文字が表示されていません");
    await page.mouse.move(bounds.x + 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width - 2, bounds.y + bounds.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe("");
  }

  await page.keyboard.press("Digit1");
  await expect(page.getByText("街道の様子を調べる依頼が出ているそうだ。")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(title).toBeVisible();
});
