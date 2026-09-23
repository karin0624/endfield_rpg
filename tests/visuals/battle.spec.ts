import { test, expect } from "@playwright/test";

test("配布画面は保存済みの構図だけを表示し、リサイズできる", async ({ page }, testInfo) => {
  const errors: string[] = [];
  const assets = new Set<string>();
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("requestfailed", request => errors.push(request.url()));
  page.on("response", response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    if (/\.(glb|png)$/.test(response.url()) && response.ok()) assets.add(new URL(response.url()).pathname);
  });
  await page.goto("/?edit=1"); // 配布ビルドでは設定パラメーターも無視する。
  await expect(page.locator("canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await expect(page.locator("input, aside, header")).toHaveCount(0);
  await expect(page.locator(".turn-status, .enemy-status")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "通常攻撃", exact: true })).toBeEnabled();
  expect([...assets].sort()).toEqual([
    "/assets/backgrounds/landscape1.png", "/assets/characters/gilberta/face.png", "/assets/characters/gilberta/front-left.png",
    "/assets/characters/rossi/face.png", "/assets/characters/rossi/front-left.png",
    "/assets/enemies/slime-blue.png", "/assets/ground/ground1.glb",
  ]);
  const viewports = [
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
    { width: 1920, height: 700 },
    { width: 390, height: 844 },
    { width: 320, height: 844 },
  ];
  for (const { width, height } of viewports) {
    await page.setViewportSize({ width, height });
    await expect(page.locator("canvas")).toBeInViewport();
    await expect(page.locator("[data-enemy-label='slime']")).toBeVisible();
    await expect(page.locator("[data-enemy-label='slime-2']")).toBeVisible();
    await expect(page.locator("[data-target-indicator]")).toBeVisible();
    await expect(page.locator(".timeline h2, .timeline p")).toHaveCount(0);
    await expect(page.locator("[data-timeline]")).not.toContainText("行動中");
    for (const label of ["slime", "slime-2"]) {
      const gap = await page.locator(`[data-enemy-label='${label}']`).evaluate(node => {
        const spriteTop = Number((node as HTMLElement).dataset.spriteTop);
        const stageTop = document.querySelector<HTMLElement>(".stage")!.getBoundingClientRect().top;
        return spriteTop + stageTop - node.getBoundingClientRect().bottom;
      });
      expect(gap).toBeGreaterThanOrEqual(8);
    }
    const markerBounds = await page.evaluate(() => {
      const marker = document.querySelector<HTMLElement>("[data-target-indicator]")!.getBoundingClientRect();
      const selectedLabel = document.querySelector<HTMLElement>("[data-enemy-label='slime-2']")!.getBoundingClientRect();
      return { markerHeight: marker.height, markerBottom: marker.bottom, selectedLabelTop: selectedLabel.top };
    });
    expect(markerBounds.markerBottom).toBeLessThanOrEqual(markerBounds.selectedLabelTop + 1);
    if (width > 900) {
      const ratios = await page.evaluate(() => {
        const board = document.querySelector<HTMLElement>(".game-board")!.getBoundingClientRect();
        const rect = (selector: string) => document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
        const panels = [rect(".timeline"), rect(".commands"), rect(".ally-card")];
        return {
          timeline: rect(".timeline").width / board.width,
          commands: rect(".commands").width / board.width,
          allyCard: rect(".ally-card").width / board.width,
          contained: panels.every(panel => panel.left >= board.left - 1 && panel.top >= board.top - 1 && panel.right <= board.right + 1 && panel.bottom <= board.bottom + 1),
        };
      });
      expect(ratios.timeline).toBeGreaterThanOrEqual(0.11);
      expect(ratios.timeline).toBeLessThanOrEqual(0.13);
      expect(ratios.commands).toBeGreaterThanOrEqual(0.13);
      expect(ratios.commands).toBeLessThanOrEqual(0.16);
      expect(ratios.allyCard).toBeGreaterThanOrEqual(0.17);
      expect(ratios.allyCard).toBeLessThanOrEqual(0.20);
      expect(ratios.contained).toBe(true);
      if (width >= 1920 && height >= 1000) expect(markerBounds.markerHeight).toBeGreaterThanOrEqual(60);
    }
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.screenshot({ path: testInfo.outputPath(`battle-${width}x${height}.jpg`), type: "jpeg", quality: 85 });
    if (width <= 390) {
      const overlap = await page.evaluate(() => {
        const a = document.querySelector<HTMLElement>("[data-enemy-label='slime']")!.getBoundingClientRect();
        const b = document.querySelector<HTMLElement>("[data-enemy-label='slime-2']")!.getBoundingClientRect();
        const marker = document.querySelector<HTMLElement>("[data-target-indicator]")!.getBoundingClientRect();
        const intersects = (first: DOMRect, second: DOMRect) => first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
        return {
          labelCollision: intersects(a, b),
          markerOverOtherLabel: intersects(marker, a),
          markerAboveSelectedLabel: marker.bottom <= b.top + 1,
          labelsOnStage: a.top >= 0 && b.top >= 0,
        };
      });
      expect(overlap.labelCollision).toBe(false);
      expect(overlap.markerOverOtherLabel).toBe(false);
      expect(overlap.markerAboveSelectedLabel).toBe(true);
      expect(overlap.labelsOnStage).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("2対2の戦闘を通常攻撃で終え、再戦できる", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });

  const attack = page.locator("[data-attack]");
  const battleUi = page.locator("[data-battle-ui]");
  const targetIndicator = page.locator("[data-target-indicator]");
  const slimeAButton = page.locator(".enemy-hitbox[data-combatant-id='slime']");
  const slimeBButton = page.locator(".enemy-hitbox[data-combatant-id='slime-2']");
  const slimeALabel = page.locator("[data-enemy-label='slime']");
  const slimeBLabel = page.locator("[data-enemy-label='slime-2']");
  type ToastEpisode = { text: string; startedAt: number; endedAt: number };

  await page.evaluate(() => {
    const toast = document.querySelector<HTMLElement>("[data-event-toast]");
    if (toast === null) throw new Error("攻撃通知が見つかりません");
    const recorder = window as unknown as {
      __battleToastEpisodes: ToastEpisode[];
      __battleToastCurrent?: { text: string; startedAt: number };
    };
    recorder.__battleToastEpisodes = [];
    const recordTransition = () => {
      if (!toast.hidden) {
        const text = toast.textContent ?? "";
        if (recorder.__battleToastCurrent === undefined) {
          recorder.__battleToastCurrent = { text, startedAt: performance.now() };
        } else if (recorder.__battleToastCurrent.text !== text) {
          recorder.__battleToastEpisodes.push({
            ...recorder.__battleToastCurrent,
            endedAt: performance.now(),
          });
          recorder.__battleToastCurrent = { text, startedAt: performance.now() };
        }
      } else if (toast.hidden && recorder.__battleToastCurrent !== undefined) {
        recorder.__battleToastEpisodes.push({
          ...recorder.__battleToastCurrent,
          endedAt: performance.now(),
        });
        delete recorder.__battleToastCurrent;
      }
    };
    new MutationObserver(recordTransition).observe(toast, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    recordTransition();
  });

  async function waitForToastEpisode(text: string): Promise<ToastEpisode> {
    const findEpisode = () => page.evaluate((needle) => {
      const recorder = window as unknown as { __battleToastEpisodes: ToastEpisode[] };
      return recorder.__battleToastEpisodes.find(episode => episode.text.includes(needle)) ?? null;
    }, text);
    await expect.poll(findEpisode, { timeout: 10_000 }).not.toBeNull();
    const episode = await page.evaluate((needle) => {
      const recorder = window as unknown as { __battleToastEpisodes: ToastEpisode[] };
      const index = recorder.__battleToastEpisodes.findIndex(item => item.text.includes(needle));
      return index < 0 ? null : recorder.__battleToastEpisodes.splice(index, 1)[0]!;
    }, text);
    if (episode === null) throw new Error(`攻撃通知の記録が見つかりません: ${text}`);
    return episode;
  }

  async function expectMarkerAbove(label: typeof slimeALabel) {
    await expect(targetIndicator).toBeVisible();
    const marker = await targetIndicator.boundingBox();
    const labelBox = await label.boundingBox();
    expect(marker).not.toBeNull();
    expect(labelBox).not.toBeNull();
    expect(marker!.y + marker!.height).toBeLessThanOrEqual(labelBox!.y + 1);
  }

  async function expectSpriteGap(label: typeof slimeALabel) {
    const gap = await label.evaluate(node => {
      const stageTop = document.querySelector<HTMLElement>(".stage")!.getBoundingClientRect().top;
      return Number((node as HTMLElement).dataset.spriteTop) + stageTop - node.getBoundingClientRect().bottom;
    });
    expect(gap).toBeGreaterThanOrEqual(8);
  }

  async function measureReducedMotionReplay() {
    return page.evaluate(async () => {
      const attack = document.querySelector<HTMLButtonElement>("[data-attack]");
      const battleUi = document.querySelector<HTMLElement>("[data-battle-ui]");
      if (attack === null || battleUi === null) throw new Error("戦闘操作が見つかりません");
      const started = performance.now();
      attack.click();
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("演出再生が終了しません")), 1_000);
        const check = () => {
          if (battleUi.dataset.replaying === "false") {
            window.clearTimeout(timeout);
            resolve();
          } else {
            window.requestAnimationFrame(check);
          }
        };
        window.requestAnimationFrame(check);
      });
      return performance.now() - started;
    });
  }

  async function defeatEnemiesWithTargetSelection(checkReplayTiming = false, checkReducedMotionTiming = false) {
    // 現在の3D配置でカメラに最も近いスライム B が初期対象。
    await expect(battleUi).toHaveAttribute("data-selected-target", "slime-2");
    await expect(slimeALabel).toContainText("スライム A");
    await expect(slimeALabel).toContainText("14 / 14");
    await expect(slimeBLabel).toContainText("スライム B");
    await expect(slimeBLabel).toContainText("14 / 14");
    await expectSpriteGap(slimeALabel);
    await expectSpriteGap(slimeBLabel);
    await expectMarkerAbove(slimeBLabel);
    await expect(slimeBButton).toHaveAttribute("aria-pressed", "true");
    await expect(slimeAButton).toHaveAttribute("aria-pressed", "false");
    await expect(slimeAButton).toHaveAccessibleName("スライム A、HP 14/14、攻撃対象に選択");
    await expect(slimeAButton).toHaveAttribute("aria-describedby", "battle-screen-reader-status");

    // 敵をクリックすると対象だけが変わり、同じ敵をもう一度押しても解除されない。
    await slimeAButton.click();
    await expect(battleUi).toHaveAttribute("data-selected-target", "slime");
    await expectMarkerAbove(slimeALabel);
    await expect(slimeALabel).toContainText("14 / 14");
    await slimeAButton.click();
    await expect(slimeAButton).toHaveAttribute("aria-pressed", "true");
    const survivorBefore = await slimeBLabel.boundingBox();
    const survivorSpriteTopBefore = await slimeBLabel.getAttribute("data-sprite-top");

    // 通常攻撃は常に選択中の敵を攻撃する。
    if (checkReducedMotionTiming) {
      const elapsed = await measureReducedMotionReplay();
      expect(elapsed).toBeLessThan(250);
    } else {
      await attack.click();
    }
    if (checkReplayTiming) {
      const episode = await waitForToastEpisode("ロッシの通常攻撃");
      expect(episode.endedAt - episode.startedAt).toBeGreaterThanOrEqual(600);
    }
    await expect(slimeALabel).toContainText("6 / 14");
    await expect(page.locator(".ally-card.active")).toContainText("ギルベルタ");
    await expect(page.locator("[data-timeline] .queue-row").nth(0)).toHaveAttribute("aria-current", "step");
    await expect(page.locator("[data-timeline] .queue-row").nth(0)).toHaveAttribute("aria-label", "ギルベルタ");
    await expect(page.locator("[data-timeline] .queue-row").nth(0).locator(".queue-value")).toHaveCount(0);
    await expect(page.locator("[data-timeline]")).not.toContainText("行動中");
    await expect(page.locator("[data-party]")).not.toContainText("行動中");

    if (checkReducedMotionTiming) {
      const elapsed = await measureReducedMotionReplay();
      expect(elapsed).toBeLessThan(250);
    } else {
      await attack.click();
    }
    await expect(slimeALabel).toBeHidden();
    await expect(slimeAButton).toBeHidden();
    const survivorAfter = await slimeBLabel.boundingBox();
    expect(survivorBefore).not.toBeNull();
    expect(survivorAfter).not.toBeNull();
    expect(Math.abs(survivorAfter!.x - survivorBefore!.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(survivorAfter!.y - survivorBefore!.y)).toBeLessThanOrEqual(0.5);
    expect(await slimeBLabel.getAttribute("data-sprite-top")).toBe(survivorSpriteTopBefore);
    // 選択対象が倒れたら生存中でカメラに近い敵へ自動で移る。
    await expect(battleUi).toHaveAttribute("data-selected-target", "slime-2");
    await expectMarkerAbove(slimeBLabel);
    if (checkReplayTiming) {
      const defeatToast = await waitForToastEpisode("スライム Aは戦闘不能になった");
      const enemyAttackToast = await waitForToastEpisode("スライム Bの通常攻撃");
      expect(defeatToast.endedAt - defeatToast.startedAt).toBeGreaterThanOrEqual(600);
      expect(enemyAttackToast.startedAt - defeatToast.endedAt).toBeGreaterThanOrEqual(320);
    }

    await attack.click();
    await expect(slimeBLabel).toContainText("6 / 14");
    await attack.click();
    if (checkReplayTiming) {
      const episode = await waitForToastEpisode("戦闘に勝利しました");
      expect(episode.endedAt - episode.startedAt).toBeGreaterThanOrEqual(600);
    }
    await expect(page.getByRole("heading", { name: "戦闘に勝利しました" })).toBeVisible();
    await expect(slimeBLabel).toBeHidden();
    await expect(slimeBButton).toBeHidden();
  }

  await expect(page.locator(".turn-status, .enemy-status")).toHaveCount(0);
  await expect(page.locator(".ally-card.active")).toContainText("ロッシ");
  await expect(page.locator(".ally-card.active")).toHaveAttribute("aria-current", "true");
  await expect(page.locator("[data-timeline] .queue-row").nth(0)).toHaveAttribute("aria-label", "ロッシ");
  await expect(page.locator("[data-timeline] .queue-row").nth(0)).toHaveAttribute("aria-current", "step");
  await expect(page.locator("[data-timeline] .queue-row").nth(0).locator(".queue-value")).toHaveCount(0);
  await expect(page.locator("[data-timeline] .queue-row").nth(1)).toHaveAttribute("aria-label", "ギルベルタ、次の行動まで 11 tick");
  await expect(page.locator("[data-timeline] .queue-row").nth(2)).toHaveAttribute("aria-label", "スライム A、次の行動まで 25 tick");
  await expect(page.locator("[data-timeline] .queue-row").nth(3)).toHaveAttribute("aria-label", "スライム B、次の行動まで 43 tick");
  await expect(slimeALabel).toContainText("14 / 14");
  await expect(slimeBLabel).toContainText("14 / 14");
  await expect(slimeAButton).toBeEnabled();
  const tetraBeforeStop = await page.locator("[data-tetra-mesh]").innerHTML();
  await page.waitForTimeout(400);
  const tetraAfterTurn = await page.locator("[data-tetra-mesh]").innerHTML();
  expect(tetraAfterTurn).not.toBe(tetraBeforeStop);
  await expect(page.locator("[data-tetra-mesh] polygon")).toHaveCount(8);

  // 通常攻撃ボタンは、クリック対象を変える前なら前面の B を攻撃する。
  await attack.click();
  await expect(slimeBLabel).toContainText("6 / 14");
  await expect(slimeALabel).toContainText("14 / 14");
  await attack.click();
  await expect(slimeBLabel).toBeHidden();
  await expect(battleUi).toHaveAttribute("data-selected-target", "slime");
  await expect(slimeBButton).toBeHidden();
  await attack.click();
  await expect(slimeALabel).toContainText("6 / 14");
  await attack.click();
  await expect(slimeALabel).toBeHidden();
  await expect(page.getByRole("heading", { name: "戦闘に勝利しました" })).toBeVisible();
  await expect(attack).toBeDisabled();
  await expect(attack).toHaveCSS("cursor", "not-allowed");
  await page.getByRole("button", { name: "戦闘を再戦する" }).click();

  await defeatEnemiesWithTargetSelection(true);
  await page.getByRole("button", { name: "戦闘を再戦する" }).click();
  await expect(page.locator(".ally-card.active")).toContainText("ロッシ");
  await expect(slimeALabel).toContainText("14 / 14");
  await expect(slimeBLabel).toContainText("14 / 14");
  await expect(battleUi).toHaveAttribute("data-selected-target", "slime-2");

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedTetra = await page.locator("[data-tetra-mesh]").innerHTML();
  await page.waitForTimeout(250);
  await expect(page.locator("[data-tetra-mesh]")).toHaveJSProperty("innerHTML", reducedTetra);
  await defeatEnemiesWithTargetSelection(false, true);
  await expect(slimeALabel).toBeHidden();
  await expect(slimeBLabel).toBeHidden();
});

test("素材の取得に失敗したら読み込み中のままにせず伝える", async ({ page }) => {
  await page.route("**/assets/characters/rossi/front-left.png", route => route.fulfill({ status: 404, body: "missing" }));
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("戦闘画面を読み込めませんでした", { timeout: 30_000 });
});
