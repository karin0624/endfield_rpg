import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { collectCoverage, expect, test } from "../e2e/coverage";

const fields = {
  cameraX: { group: "カメラの初期位置", label: "カメラ 左右" },
  cameraY: { group: "カメラの初期位置", label: "カメラ 高さ" },
  cameraZ: { group: "カメラの初期位置", label: "カメラ 前後" },
  targetX: { group: "視線の先", label: "注視点 左右" },
  targetY: { group: "視線の先", label: "注視点 高さ" },
  targetZ: { group: "視線の先", label: "注視点 前後" },
  fovDegrees: { group: "視線の先", label: "画角（度）" },
  groundScale: { group: "地面", label: "地面の倍率" },
  backdropScale: { group: "遠景", label: "遠景の倍率" },
  backdropX: { group: "遠景", label: "遠景 左右" },
  backdropY: { group: "遠景", label: "遠景 高さ" },
  backdropZ: { group: "遠景", label: "遠景 前後" },
  allyCenterX: { group: "味方の配置", label: "中心 左右" },
  allyCenterZ: { group: "味方の配置", label: "中心 前後" },
  allyStepX: { group: "味方の配置", label: "隣への左右差" },
  allyStepZ: { group: "味方の配置", label: "隣への前後差" },
  enemyCenterX: { group: "敵の配置", label: "中心 左右" },
  enemyCenterZ: { group: "敵の配置", label: "中心 前後" },
  enemyStepX: { group: "敵の配置", label: "隣への左右差" },
  enemyStepZ: { group: "敵の配置", label: "隣への前後差" },
} as const;

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

function fieldInput(page: Page, key: keyof typeof fields) {
  const field = fields[key];
  return page
    .getByRole("complementary", { name: "構図設定" })
    .getByRole("group", { name: field.group })
    .getByRole("spinbutton", { name: field.label, exact: true });
}

async function editSettings(page: Page) {
  // Batch real input while the render loop is paused, then await the final
  // grounding result. Input events, draft storage and the final WebGL view stay real.
  await page.clock.pauseAt(new Date("2026-10-03T12:01:00Z"));
  for (const [key, value] of Object.entries(changes)) {
    const input = fieldInput(page, key as keyof typeof fields);
    if (key === "groundScale") {
      await input.fill("");
      await input.pressSequentially(String(value));
    } else {
      await input.fill(String(value));
    }
  }
  await page.clock.resume();
  await expect(page.getByRole("button", { name: "標準として保存", exact: true })).toBeEnabled({ timeout: 60_000 });
}

test("構図設定の静止画を比較する", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-03T12:00:00Z") });
  await collectCoverage(page);
  await page.goto("/?debug=1&edit=1");
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
  await page.clock.install({ time: new Date("2026-10-03T12:00:00Z") });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await collectCoverage(page);
  // Draft, focus and export belong to the real editor's input/API boundary.
  // After saving, the normal app and grounding checks below use real WebGL.
  await page.goto("/tests/fixtures/battle-editor.html");
  const save = page.getByRole("button", { name: "標準として保存", exact: true });
  const editor = page.getByRole("complementary", { name: "構図設定" });
  const message = editor.getByRole("status");
  await expect(save).toBeEnabled({ timeout: 60_000 });
  await editSettings(page);
  await collectCoverage(page);
  await page.reload();
  await expect(save).toBeEnabled({ timeout: 60_000 });
  await expect(fieldInput(page, "groundScale")).toHaveValue("1.1");
  await expect(message).toContainText("復元");
  await page.getByRole("button", { name: "画面だけで確認", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByRole("button", { name: "設定に戻る", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "設定に戻る", exact: true }).click();
  await expect(page.getByRole("button", { name: "画面だけで確認", exact: true })).toBeFocused();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (downloadPath === null) throw new Error("書き出したJSONが見つかりません");
  const exported = JSON.parse(await readFile(downloadPath, "utf8"));
  expect(exported).toMatchObject({ version: 2, ...changes });
  await save.click();
  await expect(message).toContainText("標準として保存しました");
  await collectCoverage(page);
  await page.getByRole("link", { name: "保存済みの通常表示" }).click();
  await expect(page.getByRole("button", { name: "通常攻撃" })).toBeEnabled({ timeout: 60_000 });
  await collectCoverage(page);
  await page.getByRole("link", { name: "構図設定", exact: true }).click();
  await expect(save).toBeEnabled({ timeout: 60_000 });
  for (const [key, value] of Object.entries(changes))
    await expect(fieldInput(page, key as keyof typeof fields)).toHaveValue(String(value));
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
  // Disabled also covers pending work; wait for the real GLB grounding result, as for initial asset readiness.
  await expect(message).toContainText("地面の範囲外", { timeout: 60_000 });
  await page.getByRole("button", { name: "保存済みに戻す" }).click();
  await expect(save).toBeEnabled();
  expect(errors).toEqual([]);
});

test("会話画面の立ち絵と本文位置を調整・保存し、通常表示へ反映する", async ({ page }) => {
  await collectCoverage(page);
  await page.goto("/?debug=1&adventureEdit=1");
  const editor = page.getByRole("complementary", { name: "会話画面の配置設定" });
  const editorHeading = editor.getByRole("heading", { name: "会話画面の配置", exact: true });
  await expect(editorHeading).toBeVisible();
  const headingBounds = await editorHeading.boundingBox();
  if (headingBounds === null) throw new Error("設定の見出しが表示されていません");
  await page.mouse.move(headingBounds.x + 2, headingBounds.y + headingBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(headingBounds.x + headingBounds.width - 2, headingBounds.y + headingBounds.height / 2, {
    steps: 10,
  });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe("会話画面の配置");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.keyboard.press("ControlOrMeta+C");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("会話画面の配置");
  await page.mouse.click(headingBounds.x, headingBounds.y - 4);
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
  await expect
    .poll(() => rightPreview.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  const initialRightBounds = await rightPreview.boundingBox();
  if (initialRightBounds === null) throw new Error("右側の立ち絵プレビューが表示されていません");
  const initialRight = initialRightBounds.x;
  const initialRightValue = Number(await rightX.inputValue());
  const rightMovesFurtherRight = initialRightValue <= 96;
  await rightX.fill(String(initialRightValue + (rightMovesFurtherRight ? 4 : -4)));
  const rightPosition = expect.poll(async () => (await rightPreview.boundingBox())?.x ?? initialRight);
  if (rightMovesFurtherRight) await rightPosition.toBeGreaterThan(initialRight);
  else await rightPosition.toBeLessThan(initialRight);
  await leftX.fill("32");
  await leftX.press("ControlOrMeta+A");
  await leftX.press("ControlOrMeta+C");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("32");
  await panelHeight.fill("35");
  await expect(page.locator("[data-adventure-screen]")).toHaveScreenshot("adventure-edited-preview.png");
  await collectCoverage(page);
  await page.reload();
  await expect(leftX).toHaveValue("32");
  await expect(editor.getByRole("status")).toContainText("復元");
  await editor.getByRole("button", { name: "画面だけで確認" }).click();
  await expect(editor).toBeHidden();
  await page.getByRole("button", { name: "設定に戻る" }).click();
  await editor.getByRole("button", { name: "標準として保存" }).click();
  await expect(editor.getByRole("status")).toContainText("標準として保存しました");
  await collectCoverage(page);
  await editor.getByRole("link", { name: "保存済みの通常表示" }).click();
  await expect(page.getByRole("heading", { name: "街の広場" })).toBeVisible();
  await page.getByRole("button", { name: "冒険者ギルド", exact: true }).click();
  await expect(page.getByText("ロッシは掲示板の前で足を止めた。")).toBeVisible();
  await expect(page.locator("[data-adventure-screen]")).toHaveScreenshot("adventure-saved-dialogue.png");
});

// Independent public-input examples: do not derive the tested fields or expected values
// from settingsFields, otherwise deleting a product field also deletes its coverage.
const battleInputExamples = {
  cameraX: 0.2,
  cameraY: 7,
  cameraZ: 13,
  targetX: 0.1,
  targetY: 3,
  targetZ: -14,
  fovDegrees: 42,
  groundScale: 1.1,
  backdropScale: 0.8,
  backdropX: 1,
  backdropY: 9,
  backdropZ: -9,
  allyCenterX: 3.2,
  allyCenterZ: 1.4,
  allyStepX: -1.1,
  allyStepZ: -1.6,
  enemyCenterX: -3.4,
  enemyCenterZ: 0.9,
  enemyStepX: 2,
  enemyStepZ: 1.4,
};

test("構図の全20項目は数値とスライダーが双方向同期しJSONへ出力される", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 480 });
  await collectCoverage(page);
  await page.goto("/tests/fixtures/battle-editor.html");
  await expect(page.getByRole("button", { name: "標準として保存", exact: true })).toBeEnabled({ timeout: 60_000 });
  const adjusted: Record<string, number> = {};
  for (const [key, value] of Object.entries(battleInputExamples)) {
    const field = fields[key as keyof typeof fields];
    const number = fieldInput(page, key as keyof typeof fields);
    const slider = page
      .getByRole("group", { name: field.group })
      .getByRole("slider", { name: `${field.label} スライダー`, exact: true });
    await number.fill(String(value));
    await expect(slider).toHaveValue(String(value));
    await slider.press("ArrowRight");
    const step = key === "groundScale" || key === "backdropScale" ? 0.01 : 0.1;
    adjusted[key] = Number((value + step).toFixed(2));
    await expect(number).toHaveValue(String(adjusted[key]));
  }
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  const path = await (await downloaded).path();
  if (!path) throw new Error("JSON download missing");
  expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ version: 2, ...adjusted });
  await collectCoverage(page);
  await page.reload();
  await expect(page.getByRole("button", { name: "標準として保存", exact: true })).toBeEnabled({ timeout: 60_000 });
  for (const [key, value] of Object.entries(adjusted))
    await expect(fieldInput(page, key as keyof typeof fields)).toHaveValue(String(value));
});

for (const kind of ["battle", "adventure"] as const) {
  const editorPath = kind === "battle" ? "/tests/fixtures/battle-editor.html" : "/?debug=1&adventureEdit=1";
  const panelName = kind === "battle" ? "構図設定" : "会話画面の配置設定";
  const group = kind === "battle" ? "カメラの初期位置" : "立ち絵・横画面";
  const label = kind === "battle" ? "カメラ 高さ" : "左の水平位置 (%)";
  const editedValue = kind === "battle" ? "8" : "31";
  const draftKey = `endfield.${kind}-settings.draft.v1`;

  test(`${kind}設定は保存の応答待ち・失敗・再試行を通じて編集値と最後の標準を保つ`, async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 480 });
    await collectCoverage(page);
    await page.goto(editorPath);
    const panel = page.getByRole("complementary", { name: panelName });
    const save = panel.getByRole("button", { name: "標準として保存", exact: true });
    const input = panel.getByRole("group", { name: group }).getByRole("spinbutton", { name: label, exact: true });
    await expect(save).toBeEnabled({ timeout: 60_000 });
    const initial = await input.inputValue();
    await input.fill(editedValue);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**/__dev/${kind}-settings`, async (route) => {
      await pending;
      await route.fulfill({ status: 500, json: { message: "保存先に書き込めません" } });
    });
    await save.click();
    await expect(panel.getByRole("status")).toContainText("保存しています");
    await expect(save).toBeDisabled();
    if (kind === "battle") {
      for (const field of await panel.locator("input").all()) await expect(field).toBeDisabled();
      await expect(panel.getByRole("button", { name: "保存済みに戻す" })).toBeDisabled();
    }
    release();
    await expect(panel.getByRole("status")).toContainText("保存先に書き込めません");
    await expect(input).toHaveValue(editedValue);
    await expect(input).toBeEnabled();
    await expect(save).toBeEnabled();
    await collectCoverage(page);
    await page.reload();
    await expect(input).toHaveValue(editedValue, { timeout: 60_000 });
    await expect(panel.getByRole("status")).toContainText("復元");
    await panel.getByRole("button", { name: "保存済みに戻す" }).click();
    await expect(input).toHaveValue(initial);
    await input.fill(editedValue);
    await page.route(`**/__dev/${kind}-settings`, (route) => route.abort("failed"));
    const editingMessage = await panel.getByRole("status").textContent();
    const failedRequest = page.waitForEvent(
      "requestfailed",
      (request) => request.method() === "POST" && request.url().endsWith(`/__dev/${kind}-settings`),
    );
    await save.click();
    await failedRequest;
    await expect(save).toBeEnabled();
    const failureMessage = panel.getByRole("status");
    await expect(failureMessage).toContainText(/\S/);
    await expect(failureMessage).not.toHaveText(editingMessage ?? "");
    await expect(failureMessage).not.toContainText("保存しています");
    await expect(failureMessage).not.toContainText("標準として保存しました");
    await expect(input).toHaveValue(editedValue);
    await page.unroute(`**/__dev/${kind}-settings`);
    await save.click();
    await expect(panel.getByRole("status")).toContainText("標準として保存しました");
    expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), draftKey)).toBeNull();
    await input.fill(kind === "battle" ? "9" : "33");
    await panel.getByRole("button", { name: "保存済みに戻す" }).click();
    await expect(input).toHaveValue(editedValue);
  });

  test(`${kind}設定は一時保存不可を案内して標準保存を続けられる`, async ({ page }) => {
    await page.addInitScript((settingsKey) => {
      const read = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        if (key === settingsKey) throw new DOMException("Storage denied", "SecurityError");
        return read.call(this, key);
      };
      Storage.prototype.setItem = () => {
        throw new DOMException("Storage denied", "SecurityError");
      };
    }, draftKey);
    await collectCoverage(page);
    await page.goto(editorPath);
    const panel = page.getByRole("complementary", { name: panelName });
    const save = panel.getByRole("button", { name: "標準として保存", exact: true });
    await expect(save).toBeEnabled({ timeout: 60_000 });
    await panel
      .getByRole("group", { name: group })
      .getByRole("spinbutton", { name: label, exact: true })
      .fill(editedValue);
    await expect(panel.getByRole("status")).toContainText(/一時保存.*(?:使えない|できません)/);
    await save.click();
    await expect(panel.getByRole("status")).toContainText("標準として保存しました");
  });
}

test("構図の壊れたdraftは理由を示し標準へ戻り、会話の無効値は保存を止めて復帰する", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("endfield.battle-settings.draft.v1", "{broken");
    localStorage.setItem("endfield.adventure-settings.draft.v1", "{broken");
  });
  await collectCoverage(page);
  await page.goto("/tests/fixtures/battle-editor.html");
  const battle = page.getByRole("complementary", { name: "構図設定" });
  await expect(battle.getByRole("status")).toContainText("読み取れなかった", { timeout: 60_000 });
  await expect(battle.getByRole("button", { name: "標準として保存", exact: true })).toBeEnabled({ timeout: 60_000 });
  await collectCoverage(page);
  await page.goto("/?debug=1&adventureEdit=1");
  const editor = page.getByRole("complementary", { name: "会話画面の配置設定" });
  await expect(editor.getByRole("status")).toContainText("読み取れなかった");
  const input = editor
    .getByRole("group", { name: "立ち絵・横画面" })
    .getByRole("spinbutton", { name: "左の水平位置 (%)", exact: true });
  const original = await input.inputValue();
  await input.fill("101");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(editor.getByRole("button", { name: "標準として保存", exact: true })).toBeDisabled();
  await expect(editor.getByRole("status")).toContainText("左の水平位置");
  await editor.getByRole("button", { name: "保存済みに戻す" }).click();
  await expect(input).toHaveValue(original);
  await expect(input).not.toHaveAttribute("aria-invalid", "true");
  await expect(editor.getByRole("button", { name: "標準として保存", exact: true })).toBeEnabled();
  await editor.getByRole("button", { name: "画面だけで確認" }).click();
  await expect(editor).toBeHidden();
  await page.getByRole("button", { name: "設定に戻る", exact: true }).click();
  await input.fill("30");
  await expect(input).toHaveValue("30");
  await expect(editor.getByRole("status")).toContainText("未保存");
});

test("構図の通常表示は未保存draftを使わず、編集へ戻るとdraftだけを復元する", async ({ page }) => {
  await collectCoverage(page);
  await page.goto("/?debug=1&battle=1");
  await expect(page.getByRole("button", { name: "通常攻撃", exact: true })).toBeEnabled({ timeout: 60_000 });
  const savedView = await page.locator("canvas").screenshot();
  await collectCoverage(page);
  // Draft input uses the real editor fixture. The final app -> editor link below
  // still checks draft restoration through the real entry's editor boot.
  await page.goto("/tests/fixtures/battle-editor.html");
  await expect(page.getByRole("button", { name: "標準として保存", exact: true })).toBeEnabled({ timeout: 60_000 });
  await fieldInput(page, "cameraY").fill("12");
  await collectCoverage(page);
  await page.getByRole("link", { name: "保存済みの通常表示" }).click();
  await expect(page.getByRole("button", { name: "通常攻撃", exact: true })).toBeEnabled({ timeout: 60_000 });
  // A metamorphic visual assertion: adding an editor-only draft must leave the
  // normal rendering identical to the saved view, including actual WebGL pixels.
  expect(await page.locator("canvas").screenshot()).toEqual(savedView);
  await collectCoverage(page);
  await page.getByRole("link", { name: "構図設定", exact: true }).click();
  await expect(fieldInput(page, "cameraY")).toHaveValue("12", { timeout: 60_000 });
  await expect(page.getByRole("complementary", { name: "構図設定" }).getByRole("status")).toContainText("復元");
});

for (const mobile of [false, true]) {
  test(`会話の${mobile ? "縦" : "横"}画面設定は立ち絵・本文・送り矢印・選択肢の実配置を動かす`, async ({ page }) => {
    await page.setViewportSize({ width: mobile ? 390 : 1440, height: mobile ? 844 : 1080 });
    await collectCoverage(page);
    await page.goto("/?debug=1&adventureEdit=1");
    const editor = page.getByRole("complementary", { name: "会話画面の配置設定" });
    const number = (group: string, label: string) =>
      editor.getByRole("group", { name: group, exact: true }).getByRole("spinbutton", { name: label, exact: true });
    const portraitGroup = mobile ? "立ち絵・縦画面" : "立ち絵・横画面";
    const panelHeightLabel = mobile ? "縦画面の最小高さ (%)" : "本文エリアの最小高さ (%)";
    const stage = page.locator("[data-conversation-stage]");
    const measure = async (selector: string, dimension: "x" | "y" | "width" | "height") => {
      const bounds = await page.locator(selector).boundingBox();
      const origin = await stage.boundingBox();
      if (!bounds || !origin) throw new Error(`Visible geometry missing: ${selector}`);
      return dimension === "x" || dimension === "y" ? bounds[dimension] - origin[dimension] : bounds[dimension];
    };
    await expect
      .poll(() =>
        page
          .locator('[data-portrait-id="rossi-preview"] img')
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    const examples = [
      [portraitGroup, "左の水平位置 (%)", '[data-position="left"]', "x", 25, 30, 1, 0.5],
      [portraitGroup, "中央の水平位置 (%)", '[data-position="center"]', "x", 45, 50, 1, 0.5],
      [portraitGroup, "右の水平位置 (%)", '[data-position="right"]', "x", 70, 75, 1, 0.5],
      [portraitGroup, "足元の高さ (%)", '[data-position="right"]', "y", 5, 10, -1, 0.5],
      [portraitGroup, "全員共通の高さ (%)", '[data-position="right"]', "height", 65, 75, 1, 0.5],
      ["本文エリア", panelHeightLabel, "[data-dialogue-panel]", "height", 45, 55, 1, 0.5],
      ["本文エリア", mobile ? "縦画面の左右余白 (%)" : "左右の余白 (%)", "[data-speaker]", "x", 5, 10, 1, 0.5],
      ["本文エリア", mobile ? "縦画面の上余白 (px)" : "上の余白 (px)", "[data-speaker]", "y", 20, 30, 1, 1],
    ] as const;
    // Keep the panel taller than its content so padding is measured independently
    // of a content-driven panel-height change.
    await number("本文エリア", panelHeightLabel).fill("55");
    for (const [group, label, selector, dimension, before, after, direction, step] of examples) {
      const input = number(group, label);
      await input.fill(String(before));
      const initial = await measure(selector, dimension);
      await input.fill(String(after));
      const slider = editor.getByRole("group", { name: group, exact: true }).getByRole("slider", {
        name: `${label} スライダー`,
        exact: true,
      });
      await expect(slider).toHaveValue(String(after));
      await expect.poll(async () => direction * ((await measure(selector, dimension)) - initial)).toBeGreaterThan(1);
      await slider.focus();
      await slider.press("ArrowLeft");
      await expect(input).toHaveValue(String(after - step));
      await input.fill(String(before));
    }
    for (const [label, selector, dimension, before, after, direction] of [
      ["話者名の下余白 (px)", ".dialogue-divider", "y", 5, 15, 1],
      ["罫線と本文の間隔 (px)", "[data-dialogue-text]", "y", 10, 20, 1],
      ["送り矢印の右位置 (%)", "[data-dialogue-next]", "x", 5, 10, -1],
      ["送り矢印の下位置 (px)", "[data-dialogue-next]", "y", 10, 20, -1],
    ] as const) {
      const input = number("本文エリア", label);
      await input.fill(String(before));
      const initial = await measure(selector, dimension);
      await input.fill(String(after));
      await expect.poll(async () => direction * ((await measure(selector, dimension)) - initial)).toBeGreaterThan(1);
      await input.fill(String(before));
    }
    await page.locator("[data-dialogue-text]").click();
    await expect(page.getByText("ギルベルタが掲示板の前で会釈した。")).toBeVisible();
    await page.locator("[data-dialogue-text]").click();
    await expect(page.getByRole("button", { name: "掲示板の依頼について聞く" })).toBeVisible();
    for (const [label, dimension, before, after] of [
      [mobile ? "縦画面の中心高さ (%)" : "選択肢の中心高さ (%)", "y", 35, 40],
      [mobile ? "縦画面の幅 (%)" : "選択肢の幅 (%)", "width", 40, 50],
    ] as const) {
      const input = number("選択肢", label);
      await input.fill(String(before));
      const initial = await measure("[data-conversation-choices]", dimension);
      await input.fill(String(after));
      await expect
        .poll(async () => (await measure("[data-conversation-choices]", dimension)) - initial)
        .toBeGreaterThan(1);
    }
  });
}
