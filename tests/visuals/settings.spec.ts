import { test, expect } from "@playwright/test";
import { parseBattleSettings } from "../../src/web/battleSettings";
import { readFile } from "node:fs/promises";

test("構図を調整・一時保存・標準保存し、通常表示に反映する", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/?edit=1");
  const save = page.getByRole("button", { name: "標準として保存", exact: true });
  await expect(save).toBeEnabled({ timeout: 60_000 });
  let before = await page.locator("canvas").screenshot();
  const changes = { cameraY: 8, cameraZ: 13, targetY: 3.5, fovDegrees: 40, groundScale: 1.1, backdropScale: 1.15, backdropY: 7, backdropZ: -10 };
  for (const [key, value] of Object.entries(changes)) {
    const input = page.locator(`#${key}-number`);
    if (key === "groundScale") {
      await input.fill("");
      await input.pressSequentially(String(value));
    } else {
      await input.fill(String(value));
    }
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const changed = await page.locator("canvas").screenshot();
    expect(changed.equals(before), `${key}を変えると描画も変わる`).toBe(false);
    before = changed;
  }
  await page.reload();
  await expect(save).toBeEnabled({ timeout: 60_000 });
  await expect(page.locator("#groundScale-number")).toHaveValue("1.1");
  await expect(page.locator("[data-message]")).toContainText("復元");

  // 確認人数は設定値・下書きと独立した表示状態として、4通りを切り替える。
  await page.locator("[data-preview-ally-count]").selectOption("2");
  await page.locator("[data-preview-enemy-count]").selectOption("2");
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const countTwoByTwo = await page.locator("canvas").screenshot();
  for (const [ally, enemy] of [["1", "1"], ["1", "2"], ["2", "1"], ["2", "2"]]) {
    await page.locator("[data-preview-ally-count]").selectOption(ally);
    await page.locator("[data-preview-enemy-count]").selectOption(enemy);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.locator("[data-preview-ally-count]")).toHaveValue(ally);
    await expect(page.locator("[data-preview-enemy-count]")).toHaveValue(enemy);
    if (ally === "1" && enemy === "1") {
      expect((await page.locator("canvas").screenshot()).equals(countTwoByTwo)).toBe(false);
    }
  }

  await page.getByRole("button", { name: "画面だけで確認", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "構図設定" })).toBeHidden();
  await page.getByRole("button", { name: "設定に戻る", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  const download = await downloadPromise;
  const exported = parseBattleSettings(JSON.parse(await readFile((await download.path())!, "utf8")));
  expect(exported).toMatchObject(changes);
  await save.click();
  await expect(page.locator("[data-message]")).toContainText("標準として保存しました");
  await page.getByRole("link", { name: "保存済みの通常表示" }).click();
  await expect(page.locator("canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await expect(page.locator("aside, input")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("saved-normal.jpg"), type: "jpeg", quality: 85 });
  // 下書きを消した後も、再読み込みで保存したファイルの値が使われる。
  await page.getByRole("link", { name: "構図設定", exact: true }).click();
  await expect(save).toBeEnabled({ timeout: 60_000 });
  for (const [key, value] of Object.entries(changes)) await expect(page.locator(`#${key}-number`)).toHaveValue(String(value));
  await expect(page.locator("[data-message]")).not.toContainText("復元");
  await page.screenshot({ path: testInfo.outputPath("editor.jpg"), type: "jpeg", quality: 85 });

  await page.locator("#groundScale-number").fill("0");
  await expect(save).toBeDisabled();
  await expect(page.locator("[data-message]")).toContainText("地面の倍率");
  // 別フィールドの変更だけでは、不正な入力を保存可能に戻さない。
  await page.locator("#cameraY-number").fill("9");
  await expect(save).toBeDisabled();
  await page.getByRole("button", { name: "保存済みに戻す" }).click();
  await expect(page.locator("#groundScale-number")).toHaveValue("1.1");
  await expect(save).toBeEnabled();
  await page.locator("#allyCenterX-number").fill("15");
  await expect(save).toBeDisabled();
  await expect(page.locator("[data-message]")).toContainText("地面の範囲外");
  await page.getByRole("button", { name: "保存済みに戻す" }).click();
  await expect(save).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(save).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("editor-mobile.jpg"), type: "jpeg", quality: 85, fullPage: true });
  expect(errors).toEqual([]);
});

test("保存APIは不正な設定や別サイトからの書き込みを拒否する", async ({ request }) => {
  const invalid = await request.post("/__dev/battle-settings", {
    headers: { Origin: "http://127.0.0.1:4174", "Content-Type": "application/json" }, data: { version: 1 },
  });
  expect(invalid.status()).toBe(400);
  const foreign = await request.post("/__dev/battle-settings", {
    headers: { Origin: "https://example.com", "Content-Type": "application/json" }, data: { version: 1 },
  });
  expect(foreign.status()).toBe(403);
});
