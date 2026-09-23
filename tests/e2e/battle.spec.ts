import { expect, test } from "@playwright/test";

test("配布画面の実描画を基準画像と比較する", async ({ page }) => {
  const errors: string[] = [];
  const assets = new Set<string>();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("requestfailed", (request) => errors.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    if (/\.(glb|png)$/.test(response.url()) && response.ok()) assets.add(new URL(response.url()).pathname);
  });
  await page.goto("/?edit=1");
  await expect(page.locator("canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await expect(page).toHaveScreenshot("battle-desktop.png", { animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page).toHaveScreenshot("battle-mobile.png", { animations: "disabled", fullPage: true });
  expect([...assets].sort()).toEqual([
    "/assets/backgrounds/landscape1.png",
    "/assets/characters/gilberta/face.png",
    "/assets/characters/gilberta/front-left.png",
    "/assets/characters/rossi/face.png",
    "/assets/characters/rossi/front-left.png",
    "/assets/enemies/slime-blue.png",
    "/assets/ground/ground1.glb",
  ]);
  expect(errors).toEqual([]);
});

test("敵を選んで攻撃すると対象のHPが更新される", async ({ page }) => {
  await page.goto("/");
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
  await page.goto("/");
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
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("戦闘画面を読み込めませんでした", { timeout: 30_000 });
});
