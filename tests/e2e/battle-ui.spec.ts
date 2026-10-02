import { expect, test } from "@playwright/test";

test("敵を選んで攻撃すると対象のHPが更新される", async ({ page }) => {
  await page.goto("/tests/fixtures/battle-ui.html?demo=1");
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
  await page.goto("/tests/fixtures/battle-ui.html?demo=1");
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

test("スキルの予測・取消・使用から実コアの結果を表示する", async ({ page }) => {
  await page.goto("/tests/fixtures/battle-ui.html");
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
  await skills.click();
  await page.getByRole("button", { name: "検証用攻撃", exact: true }).click();
  await expect(page.locator("[data-skill-preview]")).toContainText("予測ダメージ 16");
  await expect(page.locator("[data-skill-preview]")).toContainText("対象：スライム A");
  await page.keyboard.press("Escape");
  await expect(skills).toBeFocused();
  await skills.click();
  await expect(page.locator("[data-skill-fatigue]")).toContainText("精神疲労 0");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await use("検証用攻撃");
  await expect(page.locator("[data-skill-result]")).toContainText("精神疲労 0 → 4");
  await use("検証用回復", "player");
  await expect(page.locator("[data-skill-result]")).toContainText("精神疲労 4 → 7");
});

test("スキルの予測・回復対象・取消を各画面サイズで操作できる", async ({ page }, testInfo) => {
  await page.goto("/tests/fixtures/battle-ui.html");
  await page.getByRole("button", { name: "戦闘、選択可能" }).click();
  const skills = page.getByRole("button", { name: "スキル", exact: true });
  await expect(skills).toBeEnabled({ timeout: 60_000 });
  await skills.click();
  await page.getByRole("button", { name: "検証用攻撃", exact: true }).click();
  await expect(page.locator("[data-skill-fatigue]")).toContainText("精神疲労 0");
  await expect(page.locator("[data-skill-preview]")).toContainText("予測ダメージ 16");
  for (const [width, height] of [
    [320, 900],
    [390, 900],
    [900, 900],
    [901, 900],
    [1440, 540],
    [1920, 1080],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.getByRole("button", { name: "使用する", exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "使用する", exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "戻る", exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "戻る", exact: true })).toBeInViewport();
    if (width === 390 || width === 1920 || (width === 1440 && height === 900))
      await page.screenshot({ path: testInfo.outputPath(`skill-preview-${width}.png`), fullPage: true });
  }

  await page.getByRole("button", { name: "検証用回復", exact: true }).click();
  await page.getByRole("combobox", { name: "回復対象" }).selectOption("player");
  await expect(page.getByRole("combobox", { name: "回復対象" })).toHaveValue("player");
  await page.getByRole("button", { name: "戻る", exact: true }).click();
  await expect(skills).toBeFocused();
  await skills.click();
  await expect(page.locator("[data-skill-fatigue]")).toContainText("精神疲労 0");
  await page.keyboard.press("Escape");
  await expect(skills).toBeFocused();
});
