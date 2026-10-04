import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

test("代表シーケンス：通常1倍の操作動画（実素材）", async ({ browser }, testInfo) => {
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
