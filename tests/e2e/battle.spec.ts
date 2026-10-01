import { expect, test } from "@playwright/test";

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
  await page.goto("/?battle=1");
  await expect(page.getByRole("button", { name: "通常攻撃" })).toBeEnabled({ timeout: 60_000 });
  await expect(page).toHaveScreenshot("battle-desktop.png", { animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "通常攻撃" })).toBeEnabled();
  await expect(page).toHaveScreenshot("battle-mobile.png", { animations: "disabled", fullPage: true });
  expect(errors).toEqual([]);
});

test("敵を選んで攻撃すると対象のHPが更新される", async ({ page }) => {
  await page.goto("/?battle=1");
  const attack = page.getByRole("button", { name: "通常攻撃" });
  const slimeA = page.getByRole("button", { name: /スライム A、HP .*攻撃対象に選択/ });
  const slimeB = page.getByRole("button", { name: /スライム B、HP .*攻撃対象に選択/ });
  await expect(attack).toBeEnabled({ timeout: 60_000 });
  await expect(slimeB).toHaveAttribute("aria-pressed", "true");
  await slimeA.click();
  await expect(slimeA).toHaveAttribute("aria-pressed", "true");
  await attack.click();
  await expect(slimeA).toHaveAccessibleName(/スライム A、HP 6\/14/);
  await expect(attack).toBeEnabled();
});

test("実ボタンから勝利し、再戦で初期状態へ戻る", async ({ page }) => {
  await page.goto("/?battle=1");
  const attack = page.getByRole("button", { name: "通常攻撃" });
  const slimeA = page.getByRole("button", { name: /スライム A、HP .*攻撃対象に選択/ });
  const slimeB = page.getByRole("button", { name: /スライム B、HP .*攻撃対象に選択/ });
  await expect(attack).toBeEnabled({ timeout: 60_000 });
  await attack.click();
  await expect(slimeB).toHaveAccessibleName(/スライム B、HP 6\/14/);
  await attack.click();
  await expect(slimeB).toBeHidden();
  await expect(slimeA).toHaveAttribute("aria-pressed", "true");
  await attack.click();
  await expect(slimeA).toHaveAccessibleName(/スライム A、HP 6\/14/);
  await attack.click();
  await expect(page.getByRole("heading", { name: "戦闘に勝利しました" })).toBeVisible();
  await expect(attack).toBeDisabled();
  await page.getByRole("button", { name: "戦闘を再戦する" }).click();
  await expect(slimeA).toHaveAccessibleName(/スライム A、HP 14\/14/);
  await expect(slimeB).toHaveAccessibleName(/スライム B、HP 14\/14/);
  await expect(slimeB).toHaveAttribute("aria-pressed", "true");
  await expect(attack).toBeEnabled();
});

test("素材の取得に失敗した理由を画面に表示する", async ({ page }) => {
  await page.route("**/assets/characters/rossi/front-left.png", (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await page.goto("/?battle=1");
  await expect(page.getByRole("status")).toContainText("戦闘画面を読み込めませんでした", { timeout: 30_000 });
});

test("街の場所から会話を送り、選択後の再訪でも進行を保つ", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "街の広場" })).toBeVisible();
  await expect(page.getByRole("button", { name: "冒険者ギルド" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/AUTO|MENU|Space/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "冒険者ギルド" }).click();
  await expect(page.locator("[data-adventure-screen]")).toHaveCSS("height", "844px");
  await expect(page.getByText("ロッシは掲示板の前で足を止めた。")).toBeVisible();
  await expect(page.locator('[data-portrait-id="rossi"]')).toBeVisible();
  await expect(page.locator('[data-portrait-id="rossi"] img')).toHaveJSProperty("naturalWidth", 1024);
  await page.keyboard.press("Space");
  await expect(page.getByText("ギルベルタが掲示板の前で会釈した。")).toBeVisible();
  await expect(page.locator('[data-portrait-id="rossi"]')).toHaveClass(/is-muted/);
  await expect(page.locator('[data-portrait-id="gilberta"]')).toHaveClass(/is-speaking/);
  await expect(page.locator('[data-portrait-id="gilberta"] img')).toHaveJSProperty("naturalWidth", 1024);

  await page.locator("[data-conversation-stage]").click();
  await expect(page.getByText("何を聞こう？")).toBeVisible();
  const questChoice = page.getByRole("button", { name: "掲示板の依頼について聞く" });
  await expect(questChoice).toBeVisible();
  await page.keyboard.press("Space");
  await expect(questChoice).toBeVisible();
  await expect(page.locator(".dialogue-next")).toBeHidden();
  await questChoice.click();
  await expect(page.getByText("街道の様子を調べる依頼が出ているそうだ。")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "街の広場" })).toBeVisible();

  await page.getByRole("button", { name: "冒険者ギルド" }).click();
  await expect(page.getByText(/前回の話を覚えていた/)).toBeVisible();
});

test("表示番号の数字キーで会話の選択肢を選べる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "冒険者ギルド" }).click();
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  const firstChoice = page.getByRole("button", { name: "掲示板の依頼について聞く" });
  await expect(firstChoice).toBeVisible();
  await page.keyboard.press("Digit1");
  await expect(page.getByText("街道の様子を調べる依頼が出ているそうだ。")).toBeVisible();
});
