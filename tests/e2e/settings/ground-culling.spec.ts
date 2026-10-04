import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { collectCoverage, expect, test } from "../coverage";

async function show(page: Page, view = "default") {
  // This helper also navigates between views within one test.
  await collectCoverage(page);
  await page.goto(`/tests/fixtures/battle-lifecycle.html?view=${view}`);
  await page.locator("#full").click();
  await expect(page.getByLabel("表示状態")).toHaveText("4人の表示完了", { timeout: 60_000 });
}

async function expectGround(page: Page, name: string) {
  await expect(page.locator("canvas")).toHaveScreenshot(name, {
    threshold: 0,
    maxDiffPixels: 0,
    stylePath: "tests/fixtures/ground-culling-screenshot.css",
  });
}

for (const [name, width, height] of [
  ["pc", 1440, 1080],
  ["mobile", 390, 844],
] as const) {
  test(`${name}の既知地形・未検証環境・再読込で描画方式を切り替える`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await show(page);
    await expectGround(page, `ground-default-${name}.png`);
    await page.locator("#unknown-environment").click();
    await expect(page.getByLabel("表示状態")).toHaveText("4人の表示完了", { timeout: 60_000 });
    await expectGround(page, `ground-original-${name}.png`);
    await page.locator("#known-environment").click();
    await expect(page.getByLabel("表示状態")).toHaveText("4人の表示完了", { timeout: 60_000 });
    await expectGround(page, `ground-default-${name}.png`);
    expect(errors).toEqual([]);
  });
}

for (const view of ["left-down", "left-up", "right-down", "right-up"]) {
  test(`検証範囲の${view}でも地形と人物を保持する`, async ({ page }) => {
    await show(page, view);
    await expectGround(page, `ground-${view}.png`);
  });
}

test("地形内部の適用と未検証構図のプレビューは元材質を保ち、既定構図へ戻せる", async ({ page }) => {
  await show(page);
  await page.getByLabel("検証構図").selectOption("internal");
  await page.locator("#apply-view").click();
  await expectGround(page, "ground-internal-original.png");
  await page.getByLabel("検証構図").selectOption("edited");
  await page.locator("#preview-view").click();
  await expectGround(page, "ground-edited-original.png");
  await page.getByLabel("検証構図").selectOption("default");
  await page.locator("#apply-view").click();
  await expectGround(page, "ground-default-pc.png");
});

// Alter only inert GLB metadata in the HTTP response. The checked-in asset and
// geometry/material chunks stay intact; the known path now contains other bytes.
function unverifiedGround(): Buffer {
  const original = readFileSync("public/assets/ground/ground1.glb");
  const jsonLength = original.readUInt32LE(12);
  const data = JSON.parse(original.subarray(20, 20 + jsonLength).toString());
  data.asset.extras = { testUnverifiedAsset: true };
  const json = Buffer.from(JSON.stringify(data));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(padded);
  const header = Buffer.from(original.subarray(0, 20));
  header.writeUInt32LE(20 + padded.length + original.length - 20 - jsonLength, 8);
  header.writeUInt32LE(padded.length, 12);
  return Buffer.concat([header, padded, original.subarray(20 + jsonLength)]);
}

test("同じ素材パスの別内容は元の材質で表示し、モデルを二重取得しない", async ({ page }) => {
  let requests = 0;
  await page.route("**/assets/ground/ground1.glb", async (route) => {
    requests += 1;
    await route.fulfill({ body: unverifiedGround(), contentType: "model/gltf-binary" });
  });
  await show(page);
  await expectGround(page, "ground-original-pc.png");
  expect(requests).toBe(1);
});

test("素材照合が利用できないブラウザでも元の材質で表示する", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window.crypto, "subtle", { value: undefined }));
  await show(page);
  await expectGround(page, "ground-original-pc.png");
});

test("素材のdigestが失敗した場合も元材質で表示して操作できる", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.crypto.subtle, "digest", { value: () => Promise.reject(new Error("digest denied")) });
  });
  await show(page);
  await expectGround(page, "ground-original-pc.png");
  await page.locator("#dispose").click();
  await expect(page.locator(".enemy-world-label")).toHaveCount(0);
});
