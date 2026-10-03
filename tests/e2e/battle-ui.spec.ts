import { execFileSync } from "node:child_process";
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

test("成長確定のdouble-clickで同じ位置の次の選択権まで消費しない", async ({ page }) => {
  await page.goto("/tests/fixtures/battle-ui.html?growth=1");
  await page.getByRole("button", { name: "戦闘、選択可能" }).click();
  const attack = page.getByRole("button", { name: "通常攻撃" });
  for (let turn = 0; turn < 4; turn++) await attack.click();
  await page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }).click();
  const choice = page.getByRole("region", { name: "レベルアップのスキル選択" });
  await expect(choice.getByRole("heading")).toHaveText("ロッシ · Lv2 スキル選択");
  await choice.getByRole("button").first().dblclick();
  expect(await choice.isVisible()).toBe(true);
  expect(await choice.getByRole("heading").textContent()).toBe("ロッシ · Lv3 スキル選択");
  await choice.getByRole("button").first().click();
  await expect(choice).toBeHidden();
  await expect(page.getByRole("button", { name: "ボス、選択可能" })).toBeVisible();
});

test("通常入力の勝利XPから複数3択を完了し次戦へ成長を反映する", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto("/tests/fixtures/battle-ui.html?growth=1");
  await page.getByRole("button", { name: "戦闘、選択可能" }).click();
  const attack = page.getByRole("button", { name: "通常攻撃" });
  await expect(attack).toBeEnabled();
  for (let turn = 0; turn < 4; turn++) await attack.click();
  await page.getByRole("button", { name: "戦闘を終えてルートへ戻る" }).click();
  const choice = page.getByRole("region", { name: "レベルアップのスキル選択" });
  for (const level of [2, 3]) {
    await expect(choice.getByRole("heading")).toHaveText(`ロッシ · Lv${level} スキル選択`);
    await expect(choice).toContainText("現在Lv3 · 余剰XP 5");
    await expect(choice.getByRole("button")).toHaveCount(3);
    await expect(page.getByRole("button", { name: "ボス、選択可能" })).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(choice).toBeVisible();
    for (const button of await choice.getByRole("button").all()) {
      await button.scrollIntoViewIfNeeded();
      await button.focus();
      await expect(button).toBeFocused();
      await expect(button).toBeInViewport();
    }
    await page.screenshot({ path: testInfo.outputPath(`growth-level-${level}.png`) });
    const pick = choice.getByRole("button").first();
    await pick.scrollIntoViewIfNeeded();
    await expect(pick).toBeInViewport();
    await pick.click();
  }
  await expect(choice).toBeHidden();
  await page.getByRole("button", { name: "ボス、選択可能" }).click();
  await expect(attack).toBeEnabled();
  await expect(page.getByRole("region", { name: "味方の状態" })).toContainText("28");
});

test("ゲージ下の症状アイコンから効果を読み、重度でも使用後に数値が悪化する", async ({ page }, testInfo) => {
  await page.goto("/tests/fixtures/battle-ui.html?symptoms=1");
  await page.getByRole("button", { name: "戦闘、選択可能" }).click();
  const ally = page.locator(".ally-card").first();
  const physical = ally.locator("summary").filter({ hasText: "肉体疲労・重度" });
  await expect(ally.locator(".symptom-icon")).toHaveCount(3);
  await physical.focus();
  await page.keyboard.press("Enter");
  await expect(ally.getByText("最大HP × 57.14%（あと街探索8回）", { exact: true })).toBeVisible();
  for (const [width, height] of [
    [320, 844],
    [390, 844],
    [900, 700],
    [901, 700],
    [1920, 500],
  ]) {
    await page.setViewportSize({ width, height });
    for (const summary of await ally.locator("summary").all()) {
      await summary.scrollIntoViewIfNeeded();
      await expect(summary).toBeInViewport();
    }
    await physical.scrollIntoViewIfNeeded();
    await expect(physical).toBeInViewport();
    const gauge = await ally.locator(".hp-track").boundingBox();
    const icons = await ally.locator(".symptom-icons").boundingBox();
    expect(icons?.y).toBeGreaterThanOrEqual((gauge?.y ?? 0) + (gauge?.height ?? 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 320 || width === 1920)
      await page.screenshot({ path: testInfo.outputPath(`symptoms-${width}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "スキル", exact: true }).click();
  await page.getByRole("button", { name: "検証用回復", exact: true }).click();
  await page.getByRole("combobox", { name: "回復対象" }).selectOption("player");
  await page.getByRole("button", { name: "使用する", exact: true }).click();
  await expect(page.locator("[data-skill-result]")).toContainText("精神疲労 100 → 103");
  await expect(page.locator("[data-skill-result]")).toContainText("肉体疲労：75 → 78（重度）");
  await expect(physical).toBeVisible();
  await physical.click();
  await expect(ally.getByText("最大HP × 56.18%（あと街探索8回）", { exact: true })).toBeVisible();
});

test("分岐回復の選択・取消・再使用とフォーカスを狭幅でも操作できる", async ({ page }, testInfo) => {
  await page.goto("/tests/fixtures/battle-ui.html?symptoms=1");
  const open = page.getByRole("button", { name: "分岐で回復", exact: true });
  const dialog = page.getByRole("dialog", { name: "分岐の回復スキル" });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 640 });
    await open.click();
    await dialog.getByRole("button", { name: "ロッシ", exact: true }).click();
    await expect(dialog.getByText(/現在の精神疲労 100/)).toBeVisible();
    await dialog.getByRole("button", { name: /検証用回復/ }).click();
    await expect(dialog.getByRole("button", { name: /ロッシ HP/ })).toBeInViewport();
    await expect(dialog.getByRole("button", { name: "取消" })).toBeInViewport();
    const box = await dialog.boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`branch-heal-${width}.png`) });
    await page.keyboard.press("Escape");
    await expect(open).toBeFocused();
    await open.click();
    await dialog.getByRole("button", { name: "取消" }).click();
    await expect(open).toBeFocused();
  }
  for (const fatigue of ["100 → 103", "103 → 106"]) {
    await open.click();
    await dialog.getByRole("button", { name: "ロッシ", exact: true }).click();
    await dialog.getByRole("button", { name: /検証用回復/ }).click();
    await dialog.getByRole("button", { name: /ロッシ HP/ }).click();
    await expect(page.locator(".branch-skill-result")).toContainText(`精神疲労 ${fatigue}`);
    // With seed 1, the first accepted use selects physical fatigue. Any cancellation draw would change this result.
    if (fatigue === "100 → 103") await expect(page.locator(".branch-skill-result")).toContainText("肉体疲労 75 → 78");
    await expect(open).toBeFocused();
  }
});

test("多段・全体攻撃の範囲、取消、各発の結果と一度の疲労を実UIで示す", async ({ page }) => {
  await page.goto("/tests/fixtures/battle-ui.html?multi=1");
  await page.getByRole("button", { name: "戦闘、選択可能" }).click();
  await page.getByRole("button", { name: /スライム A、HP .*攻撃対象に選択/ }).click();
  const skills = page.getByRole("button", { name: "スキル", exact: true });
  const preview = page.locator("[data-skill-preview]");
  const result = page.locator("[data-skill-result]");
  for (const name of ["連続攻撃（試験入力）", "全体攻撃（試験入力）"]) {
    await skills.click();
    await page.getByRole("button", { name, exact: true }).click();
    for (const [width, height] of [
      [320, 900],
      [390, 900],
      [900, 900],
      [901, 900],
      [1440, 540],
      [1920, 1080],
    ]) {
      await page.setViewportSize({ width, height });
      await page.getByRole("button", { name: "使用する", exact: true }).scrollIntoViewIfNeeded();
      await expect(page.getByRole("button", { name: "使用する", exact: true })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    if (name.startsWith("全体")) {
      await expect(preview).toContainText("対象：生存中の敵全体（スライム A、スライム B）");
      await expect(page.locator("[data-target-indicator]")).toBeHidden();
    } else {
      await expect(preview).toContainText("1体・1発あたり 4 × 3回");
      await expect(preview).toContainText("対象：スライム A");
    }
    await page.keyboard.press("Escape");
    await expect(skills).toBeFocused();
    await skills.click();
    await expect(page.locator("[data-skill-fatigue]")).toContainText("精神疲労 0");
    await page.getByRole("button", { name: "戻る", exact: true }).click();
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await skills.click();
  await page.getByRole("button", { name: "連続攻撃（試験入力）", exact: true }).click();
  await page.getByRole("button", { name: "使用する", exact: true }).dblclick();
  await expect(skills).toBeEnabled();
  await expect(result).toContainText(
    "スライム A 1発目 4ダメージ · スライム A 2発目 4ダメージ · スライム A 3発目 4ダメージ",
  );
  await expect(result).toContainText("精神疲労 0 → 4");
  await expect(page.locator('[data-enemy-label="slime"]')).toContainText("2 / 14");
  await expect(page.locator('[data-enemy-label="slime-2"]')).toContainText("14 / 14");
  await skills.click();
  await page.getByRole("button", { name: "全体攻撃（試験入力）", exact: true }).click();
  await expect(preview).toContainText("対象：生存中の敵全体（スライム A、スライム B）");
  await page.getByRole("button", { name: "使用する", exact: true }).click();
  await expect(result).toContainText("スライム A 1発目 2ダメージ · スライム B 1発目 14ダメージ");
  await expect(result).toContainText("精神疲労 4 → 8");
  await expect(page.getByRole("heading", { name: "戦闘に勝利しました" })).toBeVisible();
});

for (const real of [false, true]) {
  test(`代表シーケンス：行動者・着弾・数値・省略・離脱${real ? "（実素材）" : "（UI）"}`, async ({
    page,
  }, testInfo) => {
    test.skip(real && process.env.PLAYWRIGHT_UI === "1", "実素材は通常E2Eで検証");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(`/tests/fixtures/battle-sequence.html${real ? "?real=1" : ""}`);
    const skills = page.getByRole("button", { name: "スキル", exact: true });
    await expect(skills).toBeEnabled({ timeout: 60_000 });
    await page.clock.install({ time: new Date("2026-10-03T12:00:00Z") });
    await page.clock.pauseAt(new Date("2026-10-03T12:00:01Z"));
    await skills.click();
    await page.getByRole("button", { name: "検証用攻撃", exact: true }).click();
    const partyBefore = await page.locator(".party").boundingBox();
    await page.getByRole("button", { name: "使用する", exact: true }).click();
    const sequence = page.locator(".battle-sequence");
    await expect(sequence).toHaveAttribute("data-phase", "actor");
    await expect(page.locator(".sequence-actor")).toHaveText("検証用攻撃");
    await expect(page.locator("[data-enemy-hp]")).toHaveText("40 / 40");
    await page.screenshot({ path: testInfo.outputPath(`sequence-${real ? "real" : "ui"}-actor.png`) });
    await page.clock.runFor(260);
    await expect(sequence).toHaveAttribute("data-phase", "impact");
    await expect(page.locator("[data-enemy-hp]")).toHaveText("24 / 40");
    await expect(page.locator(".sequence-number")).toBeVisible();
    await expect(page.locator(".sequence-number")).toHaveText("−16");
    await page.screenshot({ path: testInfo.outputPath(`sequence-${real ? "real" : "ui"}-impact.png`) });
    await page.clock.runFor(80);
    await expect(page.locator(".sequence-number")).toBeVisible();
    await expect(page.locator(".sequence-number")).toHaveText("−16");
    expect(await page.locator(".party").boundingBox()).toEqual(partyBefore);
    await page.screenshot({ path: testInfo.outputPath(`sequence-${real ? "real" : "ui"}-result.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.runFor(64);
    await expect(page.locator(".sequence-number")).toBeVisible();
    const numberBox = await page.locator(".sequence-number").boundingBox();
    expect(numberBox?.x).toBeGreaterThanOrEqual(0);
    expect((numberBox?.x ?? 0) + (numberBox?.width ?? 0)).toBeLessThanOrEqual(390);
    await expect
      .poll(async () => {
        await page.clock.runFor(16);
        const targetBox = await page.locator("[data-enemy-label]").boundingBox();
        const currentNumber = await page.locator(".sequence-number").boundingBox();
        return Math.abs(
          (currentNumber?.x ?? 0) + (currentNumber?.width ?? 0) / 2 - (targetBox?.x ?? 0) - (targetBox?.width ?? 0) / 2,
        );
      })
      .toBeLessThan(30);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`sequence-${real ? "real" : "ui"}-mobile.png`), fullPage: true });
    await page.getByRole("button", { name: "演出を省略" }).click();
    await expect(skills).toBeEnabled();
    await expect(page.locator("[data-count]")).toHaveText("確定 1回");
    await expect(page.locator("[data-skill-result]")).toContainText("精神疲労 0 → 4");
    await skills.click();
    await page.getByRole("button", { name: "検証用回復", exact: true }).click();
    await page.getByRole("button", { name: "使用する", exact: true }).click();
    await page.getByRole("button", { name: "戦闘を離れる" }).click();
    await page.clock.resume();
    await page.getByRole("button", { name: "戦闘を開始" }).click();
    await expect(skills).toBeEnabled({ timeout: 60_000 });
    await page.clock.runFor(3000);
    await expect(page.locator(".battle-sequence")).toBeHidden();
    await expect(page.locator("[data-enemy-hp]")).toHaveText("40 / 40");
    await expect(page.locator("[data-count]")).toHaveText("確定 2回");
  });
}

test("外れと回復を静止状態で区別し、2倍・即時でも確定は一回", async ({ page }, testInfo) => {
  await page.goto("/tests/fixtures/battle-sequence.html?miss=1");
  const skills = page.getByRole("button", { name: "スキル", exact: true });
  await expect(skills).toBeEnabled();
  await page.clock.install({ time: new Date("2026-10-03T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-03T12:00:01Z"));
  await page.getByRole("combobox", { name: "演出速度" }).selectOption("2");
  await skills.click();
  await page.getByRole("button", { name: "検証用攻撃", exact: true }).click();
  await page.getByRole("button", { name: "使用する", exact: true }).click();
  await page.clock.runFor(100);
  await expect(page.locator(".sequence-number")).toHaveText("外れ");
  await expect(page.locator(".sequence-impact")).toBeHidden();
  await expect(page.locator("[data-enemy-hp]")).toHaveText("40 / 40");
  await page.clock.runFor(1000);
  await expect(skills).toBeEnabled();
  await page.getByRole("combobox", { name: "演出速度" }).selectOption("1");
  await skills.click();
  await page.getByRole("button", { name: "検証用回復", exact: true }).click();
  await page.getByRole("button", { name: "使用する", exact: true }).click();
  await page.clock.runFor(130);
  await expect(page.locator(".battle-sequence")).toHaveAttribute("data-kind", "heal");
  await expect(page.locator(".battle-sequence")).toHaveAttribute("data-motion", "false");
  await expect(page.locator(".sequence-number")).toContainText("20 回復");
  await expect(page.locator(".sequence-number")).toHaveCSS("animation-name", "none");
  const stillNumber = await page.locator(".sequence-number").boundingBox();
  await page.clock.runFor(80);
  expect(await page.locator(".sequence-number").boundingBox()).toEqual(stillNumber);
  await page.screenshot({ path: testInfo.outputPath("sequence-ui-reduced-heal.png") });
  await page.getByRole("combobox", { name: "演出速度" }).selectOption("0");
  await expect(skills).toBeEnabled();
  await expect(page.locator("[data-count]")).toHaveText("確定 2回");
  await expect(page.locator("[data-skill-result]")).toContainText("精神疲労 4 → 7");
});

for (const real of [false, true]) {
  test(`代表シーケンス：複数味方の回復と被弾は各自の位置に出る${real ? "（実素材）" : "（UI）"}`, async ({
    page,
  }, testInfo) => {
    test.skip(real && process.env.PLAYWRIGHT_UI === "1", "実素材は通常E2Eで検証");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(`/tests/fixtures/battle-sequence.html?party=1${real ? "&real=1" : ""}`);
    const skills = page.getByRole("button", { name: "スキル", exact: true });
    await expect(skills).toBeEnabled({ timeout: 60_000 });
    await page.clock.install({ time: new Date("2026-10-03T12:00:00Z") });
    await page.clock.pauseAt(new Date("2026-10-03T12:00:01Z"));
    async function heal(target: string) {
      await skills.click();
      await page.getByRole("button", { name: "検証用回復", exact: true }).click();
      await page.getByRole("combobox", { name: "回復対象" }).selectOption(target);
      await page.getByRole("button", { name: "使用する", exact: true }).click();
      await page.clock.runFor(340);
    }
    const number = page.locator(".sequence-number");
    const partyBefore = await page.locator(".party").boundingBox();
    await heal("gilberta");
    await expect(number).toHaveText("23 回復");
    const gilberta = await number.boundingBox();
    await page.screenshot({ path: testInfo.outputPath(`sequence-${real ? "real" : "ui"}-heal-gilberta.png`) });
    await page.getByRole("button", { name: "演出を省略" }).click();
    await expect(skills).toBeEnabled();
    await heal("player");
    await expect(number).toHaveText("20 回復");
    const player = await number.boundingBox();
    expect(Math.abs((player?.x ?? 0) - (gilberta?.x ?? 0))).toBeGreaterThan(20);
    await page.screenshot({ path: testInfo.outputPath(`sequence-${real ? "real" : "ui"}-heal-player.png`) });
    await page.clock.runFor(1200);
    await expect(number).toHaveText("−4");
    const damage = await number.boundingBox();
    expect(
      Math.abs((player?.x ?? 0) + (player?.width ?? 0) / 2 - (damage?.x ?? 0) - (damage?.width ?? 0) / 2),
    ).toBeLessThan(6);
    await page.screenshot({ path: testInfo.outputPath(`sequence-${real ? "real" : "ui"}-enemy-hit.png`) });
    await page.getByRole("button", { name: "演出を省略" }).click();
    await expect(skills).toBeEnabled();
    await expect(page.locator("[data-count]")).toHaveText("確定 2回");
    expect(await page.locator(".party").boundingBox()).toEqual(partyBefore);
    await expect(page.locator(".party")).toBeInViewport({ ratio: 1 });
  });
}

test("スキル専用の本編導線と、回復→発症のHP制限→敵の被弾を分離する", async ({ page }) => {
  await page.goto("/tests/fixtures/battle-sequence.html?symptom=1");
  const skills = page.getByRole("button", { name: "スキル", exact: true });
  await expect(skills).toBeEnabled();
  await expect(page.getByRole("button", { name: "通常攻撃", exact: true })).toBeHidden();
  await page.clock.install({ time: new Date("2026-10-03T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-03T12:00:01Z"));
  await skills.click();
  await page.getByRole("button", { name: "検証用回復", exact: true }).click();
  await page.getByRole("button", { name: "使用する", exact: true }).click();
  await page.clock.runFor(130);
  await expect(page.locator(".sequence-number")).toHaveText("7 回復");
  await expect(page.locator(".hp-line")).toHaveText("HP17/ 17");
  await page.clock.runFor(390);
  await expect(page.locator("[data-event-toast]")).toContainText("肉体疲労：75 → 78");
  await expect(page.locator(".hp-line")).toHaveText("HP16/ 16");
  await page.clock.runFor(1000);
  await expect(page.locator(".sequence-number")).toHaveText("−4");
  await expect(page.locator(".hp-line")).toHaveText("HP12/ 16");
  await page.getByRole("button", { name: "演出を省略" }).click();
  await expect(skills).toBeEnabled();
  await expect(page.locator(".hp-line")).toHaveText("HP12/ 16");
  await expect(page.locator("[data-count]")).toHaveText("確定 1回");
});

test("代表シーケンス：通常1倍の操作動画（実素材）", async ({ browser }, testInfo) => {
  test.skip(process.env.BATTLE_SEQUENCE_VIDEO !== "1", "動画採取のCIステップだけで実行");
  test.setTimeout(180_000);
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 1920, height: 1080 },
    reducedMotion: "no-preference",
    recordVideo: { dir: testInfo.outputPath("recording"), size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();
  const video = page.video();
  let started = 0;
  const cuts: number[] = [0];
  try {
    await page.goto("/tests/fixtures/battle-sequence.html?real=1&party=1");
    const skills = page.getByRole("button", { name: "スキル", exact: true });
    await expect(skills).toBeEnabled({ timeout: 60_000 });
    started = Date.now();
    // 視聴者が初期画面と操作を読める間。アサーションの同期には使わない。
    await page.waitForTimeout(1000);
    await skills.click();
    await page.getByRole("button", { name: "検証用攻撃", exact: true }).click();
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "使用する", exact: true }).click();
    await expect(skills).toBeEnabled({ timeout: 60_000 });
    await expect(page.locator("[data-enemy-hp]")).toHaveText("24 / 40");
    cuts.push((Date.now() - started) / 1000);
    for (const target of ["player", "gilberta"]) {
      await page.waitForTimeout(1000);
      await skills.click();
      await page.getByRole("button", { name: "検証用回復", exact: true }).click();
      await page.getByRole("combobox", { name: "回復対象" }).selectOption(target);
      await page.waitForTimeout(1000);
      await page.getByRole("button", { name: "使用する", exact: true }).click();
      await expect(skills).toBeEnabled({ timeout: 60_000 });
      cuts.push((Date.now() - started) / 1000);
    }
    await expect(page.locator("[data-count]")).toHaveText("確定 3回");
    await page.waitForTimeout(1500);
  } finally {
    await context.close();
  }
  if (!video || !started) throw new Error("操作動画を取得できませんでした");
  const source = await video.path();
  const duration = Number(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", source], {
      encoding: "utf8",
    }).trim(),
  );
  // 読込区間だけを除く。速度変更・静止画への置換・演出の途中カットはしない。
  const start = Math.max(0, duration - (Date.now() - started) / 1000 - 0.5);
  const output = testInfo.outputPath("sequence-real-motion.mp4");
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-ss",
      String(start),
      "-i",
      source,
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      output,
    ],
    { stdio: "pipe" },
  );
  await testInfo.attach("通常1倍・単体攻撃と味方別回復・被弾", { path: output, contentType: "video/mp4" });
  for (const [index, name] of ["attack", "heal-and-hit", "heal-ally"].entries()) {
    const from = Math.max(0, cuts[index] - 0.5);
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-ss",
        String(from),
        "-i",
        output,
        "-t",
        String(index === cuts.length - 2 ? duration : cuts[index + 1] - from + 0.5),
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        testInfo.outputPath(`sequence-real-${name}.mp4`),
      ],
      { stdio: "pipe" },
    );
  }
});

test("技名と結果は動いて出入りし、常設HUDと確定回数は変わらない", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/tests/fixtures/battle-sequence.html");
  const skills = page.getByRole("button", { name: "スキル", exact: true });
  await expect(skills).toBeEnabled();
  await page.clock.install({ time: new Date("2026-10-03T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-03T12:00:01Z"));
  const partyBefore = await page.locator(".party").boundingBox();
  await skills.click();
  await page.getByRole("button", { name: "検証用攻撃", exact: true }).click();
  await page.getByRole("button", { name: "使用する", exact: true }).click();
  await expect(page.locator("[data-event-toast]")).toBeHidden();
  await page.clock.runFor(340);
  const number = page.locator(".sequence-number");
  await expect(number).toBeVisible();
  const first = await number.boundingBox();
  if (!first) throw new Error("結果の表示位置がありません");
  await expect.poll(async () => first.y - ((await number.boundingBox())?.y ?? first.y)).toBeGreaterThan(3);
  await page.clock.runFor(1000);
  await expect(skills).toBeEnabled();
  await expect(number).toBeHidden();
  await expect(page.locator("[data-count]")).toHaveText("確定 1回");
  expect(await page.locator(".party").boundingBox()).toEqual(partyBefore);
});

test("物品は確定回復を表示してから敵行動を再生し、勝敗演出や二重消費を起こさない", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/tests/fixtures/battle-sequence.html?items=1");
  const item = page.getByRole("button", { name: "物品（HP回復品 ×2）", exact: true });
  await expect(item).toBeEnabled();
  await page.clock.install({ time: new Date("2026-10-03T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-03T12:00:01Z"));
  await item.click();
  const dialog = page.getByRole("dialog", { name: "HP回復品の使用" });
  await expect(dialog).toContainText("回復見込み +8 HP");
  await dialog.getByRole("button", { name: "使用する", exact: true }).dblclick();
  await expect(page.locator("[data-count]")).toHaveText("確定 1回");
  await expect(page.locator(".sequence-actor")).toHaveText("HP回復品");
  await expect(page.locator("[data-event-toast]")).toBeHidden();
  await expect(page.locator(".hp-line")).toHaveText("HP10/ 30");
  await expect(page.getByRole("button", { name: "物品（HP回復品 ×1）", exact: true })).toBeDisabled();
  await page.clock.runFor(340);
  await expect(page.locator(".sequence-number")).toHaveText("8 回復");
  await expect(page.locator(".battle-sequence")).toHaveAttribute("data-kind", "heal");
  await expect(page.locator(".hp-line")).toHaveText("HP18/ 30");
  await expect(page.locator("[data-event-toast]")).not.toHaveAttribute("data-event", "battle-ended");
  await page.clock.runFor(1300);
  await expect(page.locator(".hp-line")).toHaveText("HP14/ 30");
  await page.getByRole("button", { name: "演出を省略" }).click();
  const remaining = page.getByRole("button", { name: "物品（HP回復品 ×1）", exact: true });
  await expect(remaining).toBeEnabled();
  await expect(remaining).toBeFocused();
  await expect(page.locator("[data-skill-result]")).toContainText("HPを8回復 · 精神疲労は変化なし");
  await expect(page.getByRole("heading", { name: "戦闘に敗北しました" })).toBeHidden();
  await page.getByRole("button", { name: "スキル", exact: true }).click();
  await expect(page.locator("[data-skill-fatigue]")).toContainText("精神疲労 0");
  await expect(page.locator("[data-count]")).toHaveText("確定 1回");
});

test("結果の入場と退場の途中で速度を変えても現在の補間と待機は揃う", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/tests/fixtures/battle-sequence.html");
  const skills = page.getByRole("button", { name: "スキル", exact: true });
  await expect(skills).toBeEnabled();
  await page.clock.install({ time: new Date("2026-10-03T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-03T12:00:01Z"));
  const speed = page.getByRole("combobox", { name: "演出速度" });
  const number = page.locator(".sequence-number");
  await speed.selectOption("2");
  await skills.click();
  await page.getByRole("button", { name: "検証用攻撃", exact: true }).click();
  await page.getByRole("button", { name: "使用する", exact: true }).click();
  await page.clock.runFor(200);
  await expect(number).toHaveCSS("animation-duration", "0.19s");
  await speed.selectOption("1");
  await expect(number).toHaveCSS("animation-duration", "0.19s");
  await expect(skills).toBeDisabled();
  await page.clock.runFor(160);
  await expect(number).toHaveCSS("animation-duration", "0.12s");
  await speed.selectOption("2");
  await expect(number).toHaveCSS("animation-duration", "0.12s");
  await page.clock.runFor(100);
  await expect(number).toBeVisible();
  await expect(skills).toBeDisabled();
  await page.clock.runFor(21);
  await expect(number).toBeHidden();
  await expect(skills).toBeEnabled();
  await expect(page.locator("[data-count]")).toHaveText("確定 1回");
});
