import { expect, test } from "@playwright/test";
import { observeWebGLResources, webGLResources } from "./webglResources";

test("同じ環境の次戦は旧表示・演出を引き継がず、資源を増やさず切替と解放を行う", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let groundRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("ground1.glb")) groundRequests += 1;
  });
  await observeWebGLResources(page);
  await page.goto("/tests/fixtures/battle-lifecycle.html");
  const status = page.getByRole("status", { name: "表示状態" });
  const left = page.getByLabel("敵画像の左端");
  const late = page.getByLabel("古い演出の完了回数");
  await page.getByRole("button", { name: "2対2を表示", exact: true }).click();
  await expect(status).toHaveText("4人の表示完了", { timeout: 60_000 });
  await expect(page.locator(".enemy-world-label")).toHaveCount(2);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "攻撃直後に切替" }).click();
  await expect(status).toHaveText("2人の表示完了", { timeout: 60_000 });
  await expect(page.getByRole("button", { name: /スライム B、HP 14\/14/ })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "撃破中に切替" }).click();
  await expect(status).toHaveText("2人の表示完了", { timeout: 60_000 });
  await expect(page.getByRole("button", { name: /スライム B、HP 14\/14/ })).toBeVisible();
  const initialLeft = await left.textContent();
  await page.getByRole("button", { name: "旧表示に操作" }).click();
  await expect(left).toHaveText(initialLeft ?? "");
  await expect(late).toHaveText("0");
  await page.getByRole("button", { name: "敵位置を変更" }).click();
  await expect(left).not.toHaveText(initialLeft ?? "");

  await page.getByRole("button", { name: "2対2を表示", exact: true }).click();
  await expect(status).toHaveText("4人の表示完了", { timeout: 60_000 });
  await page.screenshot();
  const warm = await webGLResources(page);
  expect(warm.Buffer).toBeGreaterThan(0);
  expect(warm.Texture).toBeGreaterThan(0);
  expect(warm.Program).toBeGreaterThan(0);
  for (let iteration = 0; iteration < 3; iteration++) {
    await page.getByRole("button", { name: "1対1を表示", exact: true }).click();
    await expect(status).toHaveText("2人の表示完了", { timeout: 60_000 });
    await page.getByRole("button", { name: "2対2を表示", exact: true }).click();
    await expect(status).toHaveText("4人の表示完了", { timeout: 60_000 });
    await expect(page.locator(".enemy-world-label")).toHaveCount(2);
    await page.screenshot();
    expect(await webGLResources(page)).toEqual(warm);
  }
  expect(groundRequests).toBe(1);
  await page.getByRole("button", { name: "描画を破棄" }).click();
  await expect(status).toHaveText("破棄済み");
  await expect.poll(() => webGLResources(page)).toEqual({ Buffer: 0, Texture: 0, Program: 0 });
  await expect(page.getByRole("button", { name: "通常攻撃" })).toHaveCount(0);
  await expect(page.locator(".enemy-world-label")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("旧立ち絵の読込を保留したまま次の表示と退出が完了する", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const held = new Map<string, () => void>();
  await page.route("**/assets/**", async (route) => {
    const url = route.request().url();
    const key = url.endsWith("ground1.glb")
      ? "ground"
      : url.endsWith("landscape1.png")
        ? "background"
        : url.includes("gilberta/front-left.png")
          ? "portrait"
          : undefined;
    if (key !== undefined) await new Promise<void>((resolve) => held.set(key, resolve));
    try {
      await route.continue();
    } catch {
      /* The owner may have aborted this request. */
    }
  });
  await observeWebGLResources(page);
  await page.goto("/tests/fixtures/battle-lifecycle.html");
  const status = page.getByRole("status", { name: "表示状態" });
  await page.getByRole("button", { name: "2対2を表示", exact: true }).click();
  await expect.poll(() => held.size).toBe(3);
  await page.getByRole("button", { name: "1対1を表示", exact: true }).click();
  held.get("ground")?.();
  held.get("background")?.();
  await expect(status).toHaveText("2人の表示完了", { timeout: 60_000 });
  // The discarded battle's unique portrait is still held here.
  await page.getByRole("button", { name: "2対2を表示", exact: true }).click();
  await expect(status).toHaveText("読込中");
  await page.getByRole("button", { name: "別の環境を表示" }).click();
  await expect(status).toHaveText("2人の表示完了", { timeout: 60_000 });
  await expect(page.getByRole("button", { name: /スライム B、HP 14\/14/ })).toBeVisible();
  await page.getByRole("button", { name: "描画を破棄" }).click();
  held.get("portrait")?.();
  await expect(status).toHaveText("破棄済み");
  await expect.poll(() => webGLResources(page), { timeout: 60_000 }).toEqual({ Buffer: 0, Texture: 0, Program: 0 });
  expect(errors).toEqual([]);
});

test("旧環境のモデル・背景を待たずに別環境を表示し、遅着した素材も解放する", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const held: Array<() => void> = [];
  await page.route("**/assets/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("ground1.glb") || url.endsWith("landscape1.png")) {
      await new Promise<void>((resolve) => held.push(resolve));
    }
    try {
      await route.continue();
    } catch {
      /* Disposing the renderer may abort the transport. */
    }
  });
  await observeWebGLResources(page);
  await page.goto("/tests/fixtures/battle-lifecycle.html");
  const status = page.getByRole("status", { name: "表示状態" });
  await page.getByRole("button", { name: "2対2を表示", exact: true }).click();
  await expect.poll(() => held.length).toBe(2);
  await page.getByRole("button", { name: "別の環境を表示" }).click();
  await expect(status).toHaveText("2人の表示完了", { timeout: 60_000 });
  await expect(page.getByLabel("環境読込の完了回数")).toHaveText("1");
  await page.screenshot();
  const warm = await webGLResources(page);
  const backgroundFinished = page
    .waitForResponse((response) => response.url().endsWith("landscape1.png"))
    .then((response) => response.finished());
  for (const release of held) release();
  await backgroundFinished;
  await expect(page.getByLabel("環境読込の完了回数")).toHaveText("2", { timeout: 60_000 });
  await page.getByRole("button", { name: "別の環境を表示" }).click();
  await expect(status).toHaveText("2人の表示完了", { timeout: 60_000 });
  await page.screenshot();
  expect(await webGLResources(page)).toEqual(warm);
  await expect(page.getByRole("button", { name: /スライム B、HP 14\/14/ })).toBeVisible();
  await page.getByRole("button", { name: "描画を破棄" }).click();
  await expect(status).toHaveText("破棄済み");
  await expect.poll(() => webGLResources(page), { timeout: 60_000 }).toEqual({ Buffer: 0, Texture: 0, Program: 0 });
  expect(errors).toEqual([]);
});
