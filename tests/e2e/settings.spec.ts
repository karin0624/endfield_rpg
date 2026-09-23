import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { parseBattleSettings, type SettingKey, settingsFields } from "../../src/web/battleSettings";

const changes = {
  cameraY: 8,
  cameraZ: 13,
  targetY: 3.5,
  fovDegrees: 40,
  groundScale: 1.1,
  backdropScale: 1.15,
  backdropY: 7,
  backdropZ: -10,
};

function fieldInput(page: Page, key: SettingKey) {
  const field = settingsFields.find((item) => item.key === key);
  if (!field) throw new Error(`設定項目が見つかりません: ${key}`);
  return page
    .getByRole("complementary", { name: "構図設定" })
    .getByRole("group", { name: field.group })
    .getByRole("spinbutton", { name: field.label, exact: true });
}

async function editSettings(page: Page) {
  for (const [key, value] of Object.entries(changes)) {
    const input = fieldInput(page, key as SettingKey);
    if (key === "groundScale") {
      await input.fill("");
      await input.pressSequentially(String(value));
    } else {
      await input.fill(String(value));
    }
  }
}

test("構図設定の静止画を比較する", async ({ page }) => {
  await page.goto("/?edit=1");
  await expect(page.getByRole("button", { name: "標準として保存", exact: true })).toBeEnabled({ timeout: 60_000 });
  await editSettings(page);
  await expect(page.locator("canvas")).toHaveScreenshot("edited-battle-scene.png");
  await page.getByRole("combobox", { name: "味方の確認人数" }).selectOption("1");
  await page.getByRole("combobox", { name: "敵の確認人数" }).selectOption("1");
  await expect(page.locator("canvas")).toHaveScreenshot("one-on-one-scene.png");
  await page.getByRole("combobox", { name: "味方の確認人数" }).selectOption("2");
  await page.getByRole("combobox", { name: "敵の確認人数" }).selectOption("2");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page).toHaveScreenshot("editor-mobile.png", { fullPage: true });
});

test("構図を一時保存・標準保存し、通常表示に反映する", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?edit=1");
  const save = page.getByRole("button", { name: "標準として保存", exact: true });
  const editor = page.getByRole("complementary", { name: "構図設定" });
  const message = editor.getByRole("status");
  await expect(save).toBeEnabled({ timeout: 60_000 });
  await editSettings(page);
  await page.reload();
  await expect(save).toBeEnabled({ timeout: 60_000 });
  await expect(fieldInput(page, "groundScale")).toHaveValue("1.1");
  await expect(message).toContainText("復元");
  await page.getByRole("button", { name: "画面だけで確認", exact: true }).click();
  await expect(editor).toBeHidden();
  await page.getByRole("button", { name: "設定に戻る", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (downloadPath === null) throw new Error("書き出したJSONが見つかりません");
  const exported = parseBattleSettings(JSON.parse(await readFile(downloadPath, "utf8")));
  expect(exported).toMatchObject(changes);
  await save.click();
  await expect(message).toContainText("標準として保存しました");
  await page.getByRole("link", { name: "保存済みの通常表示" }).click();
  await expect(page.locator("canvas")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.getByRole("link", { name: "構図設定", exact: true }).click();
  await expect(save).toBeEnabled({ timeout: 60_000 });
  for (const [key, value] of Object.entries(changes))
    await expect(fieldInput(page, key as SettingKey)).toHaveValue(String(value));
  await expect(message).not.toContainText("復元");
  await fieldInput(page, "groundScale").fill("0");
  await expect(save).toBeDisabled();
  await expect(message).toContainText("地面の倍率");
  await fieldInput(page, "cameraY").fill("9");
  await expect(save).toBeDisabled();
  await page.getByRole("button", { name: "保存済みに戻す" }).click();
  await expect(fieldInput(page, "groundScale")).toHaveValue("1.1");
  await expect(save).toBeEnabled();
  await fieldInput(page, "allyCenterX").fill("15");
  await expect(save).toBeDisabled();
  await expect(message).toContainText("地面の範囲外");
  await page.getByRole("button", { name: "保存済みに戻す" }).click();
  await expect(save).toBeEnabled();
  expect(errors).toEqual([]);
});

test("保存APIは不正な設定や別サイトからの書き込みを拒否する", async ({ request }) => {
  const invalid = await request.post("/__dev/battle-settings", {
    headers: { Origin: "http://127.0.0.1:4174", "Content-Type": "application/json" },
    data: { version: 1 },
  });
  expect(invalid.status()).toBe(400);
  const foreign = await request.post("/__dev/battle-settings", {
    headers: { Origin: "https://example.com", "Content-Type": "application/json" },
    data: { version: 1 },
  });
  expect(foreign.status()).toBe(403);
});

test("会話画面の立ち絵と本文位置を調整・保存し、通常表示へ反映する", async ({ page }) => {
  await page.goto("/?adventureEdit=1");
  const editor = page.getByRole("complementary", { name: "会話画面の配置設定" });
  const rightPreview = page.locator('[data-portrait-id="rossi-preview"]');
  const leftX = editor.getByRole("group", { name: "立ち絵・横画面" }).getByRole("spinbutton", {
    name: "左の水平位置 (%)",
  });
  const rightX = editor.getByRole("group", { name: "立ち絵・横画面" }).getByRole("spinbutton", {
    name: "右の水平位置 (%)",
  });
  const panelHeight = editor.getByRole("group", { name: "本文エリア" }).getByRole("spinbutton", {
    name: "本文エリアの最小高さ (%)",
  });
  await expect(page.getByText("ロッシは掲示板の前で足を止めた。")).toBeVisible();
  await expect(rightPreview).toHaveAttribute("data-position", "right");
  await expect(rightPreview.locator("img")).toHaveJSProperty("naturalWidth", 1024);
  const initialRight = await rightPreview.evaluate((element) => element.getBoundingClientRect().left);
  const initialRightValue = Number(await rightX.inputValue());
  const rightMovesFurtherRight = initialRightValue <= 96;
  await rightX.fill(String(initialRightValue + (rightMovesFurtherRight ? 4 : -4)));
  const rightPosition = expect.poll(() => rightPreview.evaluate((element) => element.getBoundingClientRect().left));
  if (rightMovesFurtherRight) await rightPosition.toBeGreaterThan(initialRight);
  else await rightPosition.toBeLessThan(initialRight);
  await leftX.fill("32");
  await panelHeight.fill("35");
  await expect(page.locator("[data-adventure-screen]")).toHaveCSS("--adventure-leftX", "32%");
  await expect(page.locator("[data-adventure-screen]")).toHaveCSS("--adventure-panelHeight", "35%");
  await page.reload();
  await expect(leftX).toHaveValue("32");
  await expect(editor.getByRole("status")).toContainText("復元");
  await editor.getByRole("button", { name: "画面だけで確認" }).click();
  await expect(editor).toBeHidden();
  await page.getByRole("button", { name: "設定に戻る" }).click();
  await editor.getByRole("button", { name: "標準として保存" }).click();
  await expect(editor.getByRole("status")).toContainText("標準として保存しました");
  await editor.getByRole("link", { name: "保存済みの通常表示" }).click();
  await expect(page.getByRole("heading", { name: "街の広場" })).toBeVisible();
  await expect(page.locator("[data-adventure-screen]")).toHaveCSS("--adventure-leftX", "32%");
  await expect(page.locator("[data-adventure-screen]")).toHaveCSS("--adventure-panelHeight", "35%");
});
