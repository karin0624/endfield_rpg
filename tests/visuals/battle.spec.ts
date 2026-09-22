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
  await expect(page.locator("input, button, aside, header")).toHaveCount(0);
  expect([...assets].sort()).toEqual([
    "/assets/backgrounds/landscape1.png", "/assets/characters/gilberta/front-left.png", "/assets/characters/rossi/front-left.png",
    "/assets/enemies/slime-blue.png", "/assets/ground/ground1.glb",
  ]);
  for (const width of [1440, 390, 320, 1920]) {
    await page.setViewportSize({ width, height: width >= 1440 ? 1080 : 844 });
    await expect(page.locator("canvas")).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`battle-${width}.jpg`), type: "jpeg", quality: 85 });
  }
  expect(errors).toEqual([]);
});

test("素材の取得に失敗したら読み込み中のままにせず伝える", async ({ page }) => {
  await page.route("**/assets/characters/rossi/front-left.png", route => route.fulfill({ status: 404, body: "missing" }));
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("戦闘画面を読み込めませんでした", { timeout: 30_000 });
});
