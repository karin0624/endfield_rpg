import { collectCoverage, expect, test } from "../coverage";

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
      await expect(page.locator(".enemy-hitbox")).toHaveCount(2);
      for (const target of await page.locator(".enemy-hitbox").all()) {
        await expect(target).toBeDisabled();
        await expect(target).toHaveAttribute("aria-pressed", "true");
      }
      await page.locator(".enemy-hitbox").first().click({ force: true });
      await expect(page.locator('.enemy-hitbox[aria-pressed="true"]')).toHaveCount(2);
      await expect(preview).toContainText("対象：生存中の敵全体（スライム A、スライム B）");
    } else {
      await expect(preview).toContainText("1体・1発あたり 4 × 3回（撃破時は打切り）");
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
  await expect(page.locator(".battle-sequence")).toHaveAttribute("data-phase", "result");
  await number.evaluate((element) => {
    for (const animation of element.getAnimations()) {
      animation.pause();
      animation.currentTime = 70;
    }
  });
  const resultFrame = await number.boundingBox();
  await speed.selectOption("1");
  expect(await number.boundingBox()).toEqual(resultFrame);
  await expect(page.locator(".battle-sequence")).toHaveAttribute("data-phase", "result");
  await expect(skills).toBeDisabled();
  await page.clock.runFor(160);
  await expect(page.locator(".battle-sequence")).toHaveAttribute("data-phase", "settle");
  await number.evaluate((element) => {
    for (const animation of element.getAnimations()) {
      animation.pause();
      animation.currentTime = 30;
    }
  });
  const settleFrame = await number.boundingBox();
  await speed.selectOption("2");
  expect(await number.boundingBox()).toEqual(settleFrame);
  await expect(page.locator(".battle-sequence")).toHaveAttribute("data-phase", "settle");
  await page.clock.runFor(100);
  await expect(number).toBeVisible();
  await expect(skills).toBeDisabled();
  await page.clock.runFor(21);
  await expect(number).toBeHidden();
  await expect(skills).toBeEnabled();
  await expect(page.locator("[data-count]")).toHaveText("確定 1回");
});

for (const presentation of ["normal", "double-speed", "instant", "skip", "exit"] as const) {
  test(`表示操作${presentation}は確定済みHP・時計・疲労・乱数と次入力を変えない`, async ({ page }) => {
    await page.goto("/tests/fixtures/battle-sequence.html");
    const skills = page.getByRole("button", { name: "スキル", exact: true });
    await expect(skills).toBeEnabled();
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    const inspect = () =>
      page.evaluate(() =>
        (
          window as unknown as {
            inspectBattleSequence: () => {
              confirmedState: import("../../../src/game/battle").BattleState;
              commandInput: import("../../../src/game/battle").BattleState;
            };
          }
        ).inspectBattleSequence(),
      );
    await skills.click();
    await page.getByRole("button", { name: "検証用攻撃", exact: true }).click();
    await page.getByRole("button", { name: "使用する", exact: true }).click();
    const { confirmedState } = await inspect();
    expect(confirmedState).toMatchObject({
      logicalTime: 200,
      currentActorId: "player",
      randomState: 1015568748,
      outcome: "ongoing",
    });
    expect(confirmedState.combatants.map(({ id, hp, mentalFatigue }) => ({ id, hp, mentalFatigue }))).toEqual([
      { id: "player", hp: 10, mentalFatigue: 4 },
      { id: "slime", hp: 24, mentalFatigue: 0 },
    ]);
    if (presentation === "double-speed") await page.getByRole("combobox", { name: "演出速度" }).selectOption("2");
    if (presentation === "instant") await page.getByRole("combobox", { name: "演出速度" }).selectOption("0");
    if (presentation === "skip") await page.getByRole("button", { name: "演出を省略" }).click();
    if (presentation === "exit") await page.getByRole("button", { name: "戦闘を離れる" }).click();
    await page.clock.runFor(5000);
    expect((await inspect()).confirmedState).toEqual(confirmedState);
    await expect(page.locator("[data-count]")).toHaveText("確定 1回");
    if (presentation === "exit") {
      await expect(page.locator(".battle-sequence")).toHaveCount(0);
    } else {
      await expect(page.locator("[data-enemy-hp]")).toHaveText("24 / 40");
      await skills.click();
      await page.getByRole("button", { name: "検証用回復", exact: true }).click();
      await page.getByRole("button", { name: "使用する", exact: true }).click();
      expect((await inspect()).commandInput).toEqual(confirmedState);
    }
  });
}

test("多段攻撃は各着弾まで次のHPを先取りせず1発目から順に表示する", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/tests/fixtures/battle-ui.html?multi=1");
  await page.getByRole("button", { name: "戦闘、選択可能" }).click();
  const skills = page.getByRole("button", { name: "スキル", exact: true });
  await expect(skills).toBeEnabled();
  await page.getByRole("button", { name: /スライム A、HP .*攻撃対象に選択/ }).click();
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await skills.click();
  await page.getByRole("button", { name: "連続攻撃（試験入力）", exact: true }).click();
  await page.getByRole("button", { name: "使用する", exact: true }).click();
  const target = page.locator('[data-enemy-label="slime"]');
  const sequence = page.locator(".battle-sequence");
  for (const [index, before, after] of [
    [1, 14, 10],
    [2, 10, 6],
    [3, 6, 2],
  ]) {
    await expect(sequence).toHaveAttribute("data-phase", "actor");
    await expect(page.locator("[data-skill-result]")).toBeHidden();
    await expect(target).toContainText(`${before} / 14`);
    await page.clock.runFor(260);
    await expect(sequence).toHaveAttribute("data-phase", "impact");
    await expect(target).toContainText(`${after} / 14`);
    await expect(page.locator(".sequence-number")).toHaveText("−4");
    await expect(page.locator("[data-screen-reader-status]")).toContainText(`${index}発目`);
    await expect(page.locator('[data-enemy-label="slime-2"]')).toContainText("14 / 14");
    await page.clock.runFor(580);
  }
  await page.getByRole("button", { name: "演出を省略" }).click();
  await expect(page.locator("[data-skill-result]")).toBeVisible();
  await expect(page.locator("[data-skill-result]")).toContainText("3発目");
});

test("スキル参照・対象選択・取消はHP症状時計乱数を保持し次入力へ渡す", async ({ page }) => {
  await page.goto("/tests/fixtures/battle-sequence.html?party=1");
  const skills = page.getByRole("button", { name: "スキル", exact: true });
  await expect(skills).toBeEnabled();
  const inspect = () =>
    page.evaluate(() =>
      (
        window as unknown as { inspectBattleSequence: () => { confirmedState: unknown; commandInput: unknown } }
      ).inspectBattleSequence(),
    );
  const before = (await inspect()).confirmedState;
  expect(before).toMatchObject({
    logicalTime: 100,
    randomState: 1,
    currentActorId: "player",
    combatants: [
      { hp: 10, mentalFatigue: 0, status: { physicalFatigue: 0, haze: 0, incapacityRecoverySteps: null } },
      { hp: 4 },
      { hp: 40 },
    ],
  });
  for (const cancel of ["Escape", "戻る"]) {
    await skills.click();
    await page.getByRole("button", { name: "検証用回復", exact: true }).click();
    await page.getByRole("combobox", { name: "回復対象" }).selectOption("gilberta");
    if (cancel === "Escape") await page.keyboard.press("Escape");
    else await page.getByRole("button", { name: "戻る", exact: true }).click();
    expect((await inspect()).confirmedState).toEqual(before);
    await expect(page.locator("[data-count]")).toHaveText("確定 0回");
  }
  await skills.click();
  await page.getByRole("button", { name: "検証用攻撃", exact: true }).click();
  await page.getByRole("button", { name: "使用する", exact: true }).click();
  expect((await inspect()).commandInput).toEqual(before);
});

test("全体攻撃はA撃破の退場後にBへ移り各着弾の対象HPだけを更新する", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/tests/fixtures/battle-ui.html?multi=1");
  await page.getByRole("button", { name: "戦闘、選択可能" }).click();
  const skills = page.getByRole("button", { name: "スキル", exact: true });
  await expect(skills).toBeEnabled();
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await skills.click();
  await page.getByRole("button", { name: "全体攻撃（試験入力）", exact: true }).click();
  await page.getByRole("button", { name: "使用する", exact: true }).click();
  await page.clock.runFor(260);
  await expect(page.locator('[data-enemy-label="slime"]')).toContainText("0 / 14");
  await expect(page.locator('[data-enemy-label="slime-2"]')).toContainText("14 / 14");
  await expect(page.locator("[data-screen-reader-status]")).toContainText("スライム A −14 · 1発目");
  await page.clock.runFor(1120);
  await expect(page.locator(".battle-sequence")).toHaveAttribute("data-phase", "actor");
  await expect(page.locator('[data-enemy-label="slime"]')).toBeHidden();
  await expect(page.locator('[data-enemy-label="slime-2"]')).toContainText("14 / 14");
  await page.clock.runFor(260);
  await expect(page.locator('[data-enemy-label="slime-2"]')).toContainText("0 / 14");
  await expect(page.locator("[data-screen-reader-status]")).toContainText("スライム B −14 · 1発目");
  await page.clock.runFor(1500);
  await expect(page.getByRole("heading", { name: "戦闘に勝利しました" })).toBeVisible();
});

for (const phase of ["prepare", "impact", "defeat"] as const) {
  test(`速度変更は${phase}の既存待機を短縮せず次段階に反映する`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/tests/fixtures/battle-sequence.html?lethal=1&no-completion=1");
    const skills = page.getByRole("button", { name: "スキル", exact: true });
    await expect(skills).toBeEnabled();
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await skills.click();
    await page.getByRole("button", { name: "検証用攻撃", exact: true }).click();
    await page.getByRole("button", { name: "使用する", exact: true }).click();
    const sequence = page.locator(".battle-sequence");
    const number = page.locator(".sequence-number");
    await expect(sequence).toHaveAttribute("data-phase", "actor");
    await expect(number).toBeHidden();
    await expect(page.locator("[data-enemy-hp]")).toHaveText("12 / 12");
    await page.clock.runFor(120);
    await expect(sequence).toHaveAttribute("data-phase", "prepare");
    await expect(number).toBeHidden();
    if (phase !== "prepare") await page.clock.runFor(140);
    if (phase === "defeat") await page.clock.runFor(580);
    await page.getByRole("combobox", { name: "演出速度" }).selectOption("2");
    const duration = phase === "prepare" ? 140 : phase === "impact" ? 80 : 240;
    await page.clock.runFor(duration - 1);
    if (phase === "defeat") {
      await expect(page.locator("#app")).toHaveAttribute("data-defeat", "playing");
      await expect(page.locator("[data-enemy-label]")).toBeVisible();
    } else {
      await expect(sequence).toHaveAttribute("data-phase", phase);
      await expect(number)[phase === "prepare" ? "toBeHidden" : "toBeVisible"]();
      await expect(page.locator("[data-enemy-hp]")).toHaveText(phase === "prepare" ? "12 / 12" : "0 / 12");
    }
    await page.clock.runFor(1);
    if (phase === "defeat") {
      await expect(page.locator("#app")).toHaveAttribute("data-defeat", "finished");
      await expect(page.locator("[data-enemy-label]")).toBeHidden();
    } else {
      await expect(sequence).toHaveAttribute("data-phase", phase === "prepare" ? "impact" : "result");
      await expect(number).toHaveText("−12");
      await expect(number).toBeVisible();
      await expect(page.locator("[data-enemy-hp]")).toHaveText("0 / 12");
      await page.clock.runFor(phase === "prepare" ? 39 : 189);
      await expect(sequence).toHaveAttribute("data-phase", phase === "prepare" ? "impact" : "result");
      await page.clock.runFor(1);
      await expect(sequence).toHaveAttribute("data-phase", phase === "prepare" ? "result" : "settle");
    }
    await page.clock.runFor(2000);
    await expect(page.getByRole("heading", { name: "戦闘に勝利しました" })).toBeVisible();
    await expect(page.locator("[data-count]")).toHaveText("確定 1回");
  });
}

for (const interruptAt of [260, 840, 1380]) {
  test(`致死攻撃の${interruptAt}msで離脱しても旧着弾・退場・勝敗を再入場へ流さない`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/tests/fixtures/battle-sequence.html?lethal=1&no-completion=1");
    const skills = page.getByRole("button", { name: "スキル", exact: true });
    await expect(skills).toBeEnabled();
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await skills.click();
    await page.getByRole("button", { name: "検証用攻撃", exact: true }).click();
    await page.getByRole("button", { name: "使用する", exact: true }).click();
    await page.clock.runFor(interruptAt);
    await expect(page.locator("[data-count]")).toHaveText("確定 1回");
    await page.getByRole("button", { name: "戦闘を離れる" }).click();
    await page.getByRole("button", { name: "戦闘を開始" }).click();
    await expect(skills).toBeEnabled();
    await page.clock.runFor(3000);
    await expect(page.locator(".battle-sequence")).toBeHidden();
    await expect(page.locator("[data-enemy-hp]")).toHaveText("12 / 12");
    await expect(page.getByRole("heading", { name: "戦闘に勝利しました" })).toBeHidden();
    await expect(page.locator("[data-count]")).toHaveText("確定 1回");
    await skills.click();
    await expect(page.locator("[data-skill-fatigue]")).toContainText("精神疲労 0");
  });
}

test("再生途中のreduced-motion切替は結果を静止させ読み取り時間を保持する", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/tests/fixtures/battle-sequence.html");
  const skills = page.getByRole("button", { name: "スキル", exact: true });
  await expect(skills).toBeEnabled();
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await skills.click();
  await page.getByRole("button", { name: "検証用攻撃", exact: true }).click();
  await page.getByRole("button", { name: "使用する", exact: true }).click();
  await page.clock.runFor(260);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".battle-sequence")).toHaveAttribute("data-motion", "false");
  const number = page.locator(".sequence-number");
  const still = await number.boundingBox();
  await page.clock.runFor(459);
  await expect(number).toBeVisible();
  expect(await number.boundingBox()).toEqual(still);
  await expect(skills).toBeDisabled();
  await expect(page.locator("[data-enemy-hp]")).toHaveText("24 / 40");
  await page.clock.runFor(1);
  await expect(page.locator(".battle-sequence")).toHaveAttribute("data-phase", "settle");
  // The reduced-motion settle phase schedules a zero-delay browser task.
  await page.clock.runFor(1);
  await expect(number).toBeHidden();
  await expect(skills).toBeEnabled();
  await expect(page.locator("[data-count]")).toHaveText("確定 1回");
});

for (const count of [3, 4]) {
  test(`${count}人編成と控えを公開partyから渡し行動順・現在actor・撃破後の選択を表示する`, async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 1000 });
    await page.goto(`/tests/fixtures/battle-contracts.html?count=${count}`);
    const cards = page.locator(".ally-card");
    await expect(cards).toHaveCount(count);
    await expect(cards).toHaveText(
      count === 3 ? [/Player/, /Ally2/, /Ally3/] : [/Player/, /Ally2/, /Ally3/, /Blocked/],
    );
    await expect(page.getByRole("region", { name: "味方の状態" })).not.toContainText("Reserve");
    const queue = page.locator(".queue-row");
    await expect(queue.first()).toHaveAttribute("aria-current", "step");
    await expect(queue.first()).toHaveAttribute("aria-label", "Player");
    await expect(queue.first().locator(".queue-value")).toHaveCount(0);
    await expect(queue.first()).not.toContainText(/行動中|0 tick/);
    await expect(queue.locator(".queue-value")).toHaveText(
      count === 3 ? ["11", "25", "100", "122", "150"] : ["11", "25", "43", "100", "122"],
    );
    const selected = page.getByRole("button", { name: /Enemy C、HP .*攻撃対象に選択/ });
    await expect(selected).toHaveAttribute("aria-pressed", "true");
    for (let n = 0; n < 3; n++) {
      await selected.click();
      await expect(selected).toHaveAttribute("aria-pressed", "true");
    }
    const survivor = page.locator('[data-enemy-label="slime-2"]');
    const relativeSurvivor = async () => {
      const [box, stage] = await Promise.all([survivor.boundingBox(), page.locator(".stage").boundingBox()]);
      if (!box || !stage) throw new Error("生存敵の札が見つかりません");
      return { x: box.x - stage.x, y: box.y - stage.y, width: box.width, height: box.height };
    };
    const survivorBefore = await relativeSurvivor();
    const skills = page.getByRole("button", { name: "スキル", exact: true });
    await skills.click();
    await expect(page.locator("[data-skill-list]").getByRole("button")).toHaveText(["検証用攻撃", "検証用回復"]);
    await page.getByRole("button", { name: "検証用攻撃", exact: true }).click();
    await page.getByRole("button", { name: "使用する", exact: true }).click();
    await page.getByRole("button", { name: "演出を省略" }).click();
    await expect(skills).toBeEnabled();
    await expect(selected).toBeHidden();
    await expect(page.locator('[data-enemy-label="third-enemy"]')).toBeHidden();
    await expect(page.getByRole("button", { name: /Enemy B、HP .*攻撃対象に選択/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await relativeSurvivor()).toEqual(survivorBefore);
    await expect(queue.first()).toHaveAttribute("aria-label", "Ally2");
    await expect(queue.locator(".queue-value")).toHaveText(
      count === 3 ? ["14", "89", "111", "139", "189"] : ["14", "32", "89", "111", "139"],
    );
    await expect(page.locator(".ally-card[aria-current=true]")).toContainText("Ally2");
    await skills.click();
    await expect(page.locator("[data-skill-list]").getByRole("button")).toHaveText(["検証用回復"]);
  });
}

test("回復と物品は生存条件・別対象予測・取消・失敗後の再選択を保つ", async ({ page }) => {
  await page.goto("/tests/fixtures/battle-contracts.html?unavailable=1&refuse-once=1");
  const skills = page.getByRole("button", { name: "スキル", exact: true });
  await skills.click();
  await page.getByRole("button", { name: "検証用回復", exact: true }).click();
  const healing = page.getByRole("combobox", { name: "回復対象" });
  await expect(healing.locator("option")).toHaveText(["Player · HP 28 / 30", "Ally2 · HP 10 / 30"]);
  await healing.selectOption("gilberta");
  await expect(healing).toHaveValue("gilberta");
  await page.keyboard.press("Escape");
  await expect(skills).toBeFocused();
  const inspect = () =>
    page.evaluate(() => (window as unknown as { inspectBattleContracts: () => unknown }).inspectBattleContracts());
  const before = await inspect();
  const item = page.getByRole("button", { name: "物品（HP回復品 ×2）", exact: true });
  for (const cancel of ["戻る", "Escape"]) {
    await item.click();
    const dialog = page.getByRole("dialog", { name: "HP回復品の使用" });
    await dialog.getByRole("combobox", { name: "対象" }).selectOption("gilberta");
    if (cancel === "戻る") await dialog.getByRole("button", { name: cancel, exact: true }).click();
    else await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(item).toBeFocused();
    expect(await inspect()).toEqual(before);
  }
  await item.click();
  const dialog = page.getByRole("dialog", { name: "HP回復品の使用" });
  const target = dialog.getByRole("combobox", { name: "対象" });
  await expect(target.locator("option")).toHaveText([
    "Player · HP 28/30",
    "Ally2 · HP 10/30",
    "Ally3 · HP 0/30",
    "Blocked · HP 10/30",
  ]);
  await expect(dialog).toContainText("回復見込み +2 HP");
  await target.selectOption("gilberta");
  await expect(dialog).toContainText("回復見込み +8 HP");
  for (const unavailable of ["third", "blocked"]) {
    await target.selectOption(unavailable);
    await expect(dialog).toContainText("この対象には使用できません。");
    await expect(dialog.getByRole("button", { name: "使用する", exact: true })).toBeDisabled();
  }
  await target.selectOption("gilberta");
  await dialog.getByRole("button", { name: "使用する", exact: true }).click();
  await expect(dialog).toContainText("使用できませんでした。対象と所持数を確認してください。");
  expect(await inspect()).toEqual(before);
  await target.selectOption("player");
  await expect(dialog).toContainText("回復見込み +2 HP");
  await target.selectOption("gilberta");
  await dialog.getByRole("button", { name: "使用する", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "演出を省略" }).click();
  await expect(page.getByRole("button", { name: "物品（HP回復品 ×1）", exact: true })).toBeEnabled();
  await expect(page.locator(".ally-card").filter({ hasText: "Ally2" })).toContainText("HP18/ 30");
});

test.describe(() => {
  test.use({ reducedMotion: "no-preference", hasTouch: true, viewport: { width: 390, height: 900 } });
  test("小正値を含む全症状アイコンを実タッチとキーボードで展開できる", async ({ page }) => {
    await page.goto("/tests/fixtures/battle-contracts.html?symptoms=1");
    const card = page.locator(".ally-card").filter({ hasText: "Player" });
    await expect(card.locator("summary")).toHaveCount(4);
    for (const [label, detail] of [
      ["肉体疲労・なし", "最大HP × 99.01%（あと街探索1回）"],
      ["朦朧・なし", "命中率 × 99.67%（あと街探索1回）"],
      ["戦闘不能", "戦闘参加不可（あと街探索6回）"],
      ["精神疲労・なし", "負荷付きスキル効果 × 99.01%（あと街探索1回）"],
    ]) {
      const summary = card.locator("summary").filter({ hasText: label });
      await summary.tap();
      await expect(card.getByText(detail, { exact: true })).toBeVisible();
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(card.getByText(detail, { exact: true })).toBeHidden();
    }
  });
});

test("初回の疲労と追加症状の表示でもHP行の位置を移動しない", async ({ page }) => {
  await page.goto("/tests/fixtures/battle-contracts.html?onset=1");
  const player = page.locator(".ally-card").filter({ hasText: "Player" });
  await expect(player.locator("summary")).toHaveCount(0);
  const hpPosition = () =>
    player.evaluate((card) => {
      const line = card.querySelector(".hp-line");
      if (!line) throw new Error("HP line missing");
      const hp = line.getBoundingClientRect();
      return {
        hp: { x: hp.x + window.scrollX, y: hp.y + window.scrollY },
        rows: [card, ...card.querySelectorAll(".symptom-icons, summary")].map((element) => ({
          tag: element.className || element.tagName,
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
          font: getComputedStyle(element).fontSize,
          lineHeight: getComputedStyle(element).lineHeight,
        })),
      };
    });
  const hpBefore = await hpPosition();
  await page.getByRole("button", { name: "スキル", exact: true }).click();
  await page.getByRole("button", { name: "検証用攻撃", exact: true }).click();
  await page.getByRole("button", { name: "使用する", exact: true }).click();
  await page.getByRole("button", { name: "演出を省略" }).click();
  await expect(page.getByRole("button", { name: "スキル", exact: true })).toBeEnabled();
  await expect(player.locator("summary")).toHaveCount(2);
  await expect(player).toContainText("HP15/ 15");
  const hpAfter = await hpPosition();
  expect(hpAfter.hp, JSON.stringify({ before: hpBefore.rows, after: hpAfter.rows })).toEqual(hpBefore.hp);
});

test("分岐回復は控えと不能者を除外し未習得技と非分岐技を選ばせない", async ({ page }) => {
  await collectCoverage(page);
  await page.goto("/tests/fixtures/battle-contracts.html?branch=1&unavailable=1");
  const open = page.getByRole("button", { name: "分岐で回復", exact: true });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "分岐の回復スキル" });
  await expect(dialog.getByRole("button")).toHaveText(["Player", "Ally2", "取消"]);
  await dialog.getByRole("button", { name: "Ally2", exact: true }).click();
  await expect(dialog.getByRole("button")).toHaveText(["検証用回復 · 精神疲労 +3", "取消"]);
  await dialog.getByRole("button", { name: "検証用回復 · 精神疲労 +3", exact: true }).click();
  await expect(dialog.getByRole("button")).toHaveText(["Player HP 28/30", "Ally2 HP 10/30", "取消"]);
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
  await collectCoverage(page);
  await page.goto("/tests/fixtures/battle-contracts.html?branch=1");
  await page.getByRole("button", { name: "分岐で回復", exact: true }).click();
  await dialog.getByRole("button", { name: "Ally3", exact: true }).click();
  await expect(dialog).toContainText("分岐で使える回復スキルを習得していません。");
  await expect(dialog.getByRole("button")).toHaveText(["取消"]);
  await collectCoverage(page);
  await page.goto("/tests/fixtures/battle-contracts.html?branch=1&allblocked=1");
  await page.getByRole("button", { name: "分岐で回復", exact: true }).click();
  await expect(dialog).toContainText("回復スキルを使える仲間がいません。");
  await expect(dialog.getByRole("button")).toHaveText(["取消"]);
});

test("選択マーカーは1個の立体として6秒で一周しreduced-motionで静止する", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install({ time: new Date("2026-10-03T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-03T12:00:01Z"));
  await page.goto("/tests/fixtures/battle-contracts.html");
  const marker = page.locator("[data-target-indicator]");
  await expect(marker).toBeVisible();
  await expect(marker).toHaveCount(1);
  await expect(marker).toHaveText("");
  await page.clock.runFor(32);
  const geometry = () =>
    marker.locator("polygon").evaluateAll((polygons) =>
      polygons
        .map((polygon) => {
          const rect = polygon.getBoundingClientRect();
          return [rect.x, rect.y, rect.width, rect.height];
        })
        .sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    );
  const initial = await geometry();
  expect(initial.length).toBeGreaterThan(1);
  await page.clock.runFor(1500);
  expect(await geometry()).not.toEqual(initial);
  await page.clock.runFor(4500);
  const fullTurn = await geometry();
  expect(fullTurn.length).toBe(initial.length);
  for (let i = 0; i < initial.length; i++)
    for (let n = 0; n < 4; n++) expect(fullTurn[i][n]).toBeCloseTo(initial[i][n], 0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.runFor(32);
  const stopped = await geometry();
  await page.clock.runFor(2000);
  expect(await geometry()).toEqual(stopped);
  await expect(marker).toBeInViewport();
});

test("分岐回復はノードと時計を進めず会話・必須選択・戦闘・終了中には出ない", async ({ page }) => {
  await page.goto("/tests/fixtures/battle-ui.html?growth=1");
  const inspect = () =>
    page.evaluate(() =>
      (
        window as unknown as {
          inspectBattleUiGame: () => { clock: unknown; dungeon: { currentNodeId: string; resolvedNodeIds: string[] } };
        }
      ).inspectBattleUiGame(),
    );
  const before = await inspect();
  const open = page.getByRole("button", { name: "分岐で回復", exact: true });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "分岐の回復スキル" });
  await dialog.getByRole("button", { name: "ロッシ", exact: true }).click();
  await dialog.getByRole("button", { name: /検証用回復/ }).click();
  await dialog.getByRole("button", { name: /ロッシ HP/ }).click();
  const after = await inspect();
  expect(after.clock).toEqual(before.clock);
  expect(after.dungeon.currentNodeId).toBe(before.dungeon.currentNodeId);
  expect(after.dungeon.resolvedNodeIds).toEqual(before.dungeon.resolvedNodeIds);
  await page.getByRole("button", { name: "思わぬ遭遇、選択可能" }).click();
  await expect(open).toHaveCount(0);
  await page.locator("[data-conversation-stage]").click();
  await page.getByRole("button", { name: "地図に足跡を記す" }).click();
  const growth = page.getByRole("region", { name: "レベルアップのスキル選択" });
  await expect(growth).toBeVisible();
  await expect(open).toHaveCount(0);
  while (await growth.isVisible()) await growth.getByRole("button").first().click();
  await expect(open).toBeVisible();
  await page.getByRole("button", { name: "ボス、選択可能" }).click();
  await expect(page.getByRole("button", { name: "通常攻撃", exact: true })).toBeEnabled();
  await expect(open).toHaveCount(0);
  for (let n = 0; n < 10 && !(await page.getByRole("heading", { name: "戦闘に勝利しました" }).isVisible()); n++) {
    await page.getByRole("button", { name: "通常攻撃", exact: true }).click();
    await expect(page.locator("[data-battle-ui]")).toHaveAttribute("data-replaying", "false");
  }
  await expect(page.getByRole("heading", { name: "戦闘に勝利しました" })).toBeVisible();
  await expect(open).toHaveCount(0);
});

test("多段攻撃の命中と外れを各発の結果に残し命中分だけHPを減らす", async ({ page }) => {
  await page.goto("/tests/fixtures/battle-ui.html?multi=1&miss=1");
  await page.getByRole("button", { name: "戦闘、選択可能" }).click();
  await page.getByRole("button", { name: /スライム A、HP .*攻撃対象に選択/ }).click();
  await page.getByRole("button", { name: "スキル", exact: true }).click();
  await page.getByRole("button", { name: "連続攻撃（試験入力）", exact: true }).click();
  await page.getByRole("button", { name: "使用する", exact: true }).click();
  await page.getByRole("button", { name: "演出を省略" }).click();
  await expect(page.locator("[data-skill-result]")).toContainText(
    "スライム A 1発目 4ダメージ · スライム A 2発目 4ダメージ · スライム A 3発目 外れ",
  );
  await expect(page.locator("[data-skill-result]")).toContainText("精神疲労 0 → 4");
  await expect(page.locator('[data-enemy-label="slime"]')).toContainText("6 / 14");
  await expect(page.locator('[data-enemy-label="slime-2"]')).toContainText("14 / 14");
});

test("通常campaignの戦闘素材失敗は入力を開始せず理由を示し再読込後に再出発できる", async ({ page }) => {
  const enter = async () => {
    await page.getByRole("button", { name: "新規開始", exact: true }).click();
    await page.getByRole("button", { name: "実行する", exact: true }).click();
    await page.getByRole("button", { name: "ホームへ", exact: true }).click();
    await page.getByRole("button", { name: "探索先を選ぶ", exact: true }).click();
    await page.getByRole("button", { name: "ダンジョン", exact: true }).click();
    await page.getByRole("button", { name: "出発する", exact: true }).click();
    await page.getByRole("button", { name: "戦闘、選択可能" }).click();
  };
  await page.route("**/*.glb", (route) => route.abort("failed"));
  await page.goto("/");
  await enter();
  await expect(
    page.getByText("戦闘画面を読み込めませんでした。素材とWebGL対応を確認して、再読み込みしてください。", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: "スキル", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "使用する", exact: true })).toHaveCount(0);
  await page.unroute("**/*.glb");
  await collectCoverage(page);
  await page.reload();
  await enter();
  const skills = page.getByRole("button", { name: "スキル", exact: true });
  await expect(skills).toBeEnabled({ timeout: 60_000 });
  await skills.click();
  await page.getByRole("button", { name: "攻撃", exact: true }).click();
  await page.getByRole("button", { name: "使用する", exact: true }).click();
  await page.getByRole("button", { name: "演出を省略" }).click();
  await expect(skills).toBeEnabled();
  await expect(page.locator("[data-skill-result]")).toContainText("ダメージ");
  await expect(page.locator("body")).toHaveAttribute("data-mode", "game");
});

for (const effect of ["攻撃", "回復"] as const) {
  test(`実素材の${effect}演出を固定段階のVRTで比較する`, async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 1000 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    // Install before Babylon registers its render loop so native and fake rAF never mix.
    await page.clock.install({ time: new Date("2026-10-03T12:00:00Z") });
    await page.goto(`/tests/fixtures/battle-sequence.html?real=1${effect === "攻撃" ? "&lethal=1" : ""}`);
    const skills = page.getByRole("button", { name: "スキル", exact: true });
    await expect(skills).toBeEnabled({ timeout: 60_000 });
    await page.clock.pauseAt(new Date("2026-10-03T12:01:00Z"));
    // CSS uses a native clock: pause authored effects before creation and keep
    // unrelated HP-width transitions out of these deliberately frozen FX frames.
    await page.addStyleTag({
      content: `
      .battle-sequence * { animation-play-state: paused !important; }
      .hp-track > span, .enemy-world-track > span { transition: none !important; }
    `,
    });
    await skills.click();
    await page.getByRole("button", { name: `検証用${effect}`, exact: true }).click();
    await page.getByRole("button", { name: "使用する", exact: true }).click();
    const stage = page.locator(".stage");
    const frames =
      effect === "攻撃"
        ? ([
            [60, "actor"],
            [240, "impact"],
            [140, "result"],
            [460, "defeat"],
          ] as const)
        : ([
            [300, "heal-impact"],
            [340, "heal-result"],
          ] as const);
    for (const [advance, state] of frames) {
      await page.clock.runFor(advance);
      // Playwright Clock controls the confirmed-event timeline; Web Animations
      // has a separate clock. Seek its visible CSS effects to the same authored frame.
      await stage.evaluate(
        async (element, elapsed) => {
          const animations = element.getAnimations({ subtree: true });
          for (const animation of animations) {
            animation.pause();
            animation.currentTime = elapsed;
          }
          await Promise.all(animations.map((animation) => animation.ready));
        },
        state === "actor"
          ? 60
          : state.includes("impact")
            ? 40
            : state === "heal-result"
              ? 380
              : state === "result"
                ? 180
                : 0,
      );
      await expect(stage).toHaveScreenshot(`battle-fx-${state}.png`, { animations: "allow", maxDiffPixels: 0 });
    }
    await page.getByRole("button", { name: "演出を省略" }).click();
    if (effect === "攻撃") await expect(page.getByRole("heading", { name: "戦闘に勝利しました" })).toBeVisible();
    else await expect(skills).toBeEnabled();
  });
}

test("reduced-motionでは行動名と着弾形状も移動拡縮せず表示する", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/tests/fixtures/battle-sequence.html");
  await page.clock.install({ time: new Date("2026-10-03T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-03T12:00:01Z"));
  await page.getByRole("button", { name: "スキル", exact: true }).click();
  await page.getByRole("button", { name: "検証用攻撃", exact: true }).click();
  await page.getByRole("button", { name: "使用する", exact: true }).click();
  const actor = page.locator(".sequence-actor");
  await page.clock.runFor(30);
  await expect(actor).toBeVisible();
  const actorFrame = await actor.boundingBox();
  await page.clock.runFor(60);
  expect(await actor.boundingBox()).toEqual(actorFrame);
  await page.clock.runFor(190);
  const impact = page.locator(".sequence-impact svg");
  await expect(impact).toBeVisible();
  const impactFrame = await impact.boundingBox();
  await page.clock.runFor(40);
  expect(await impact.boundingBox()).toEqual(impactFrame);
  await page.getByRole("button", { name: "演出を省略" }).click();
  await expect(page.locator("[data-count]")).toHaveText("確定 1回");
});
