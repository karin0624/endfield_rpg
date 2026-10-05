import { approvedPicture } from "../browser/pictures";

const golden = (name: string) =>
  approvedPicture(["e2e", "ui", "party-ui.spec.ts-snapshots", name.replace(/\.png$/, `-ui-${process.platform}.png`)]);

import { collectCoverage, expect, test } from "../browser/coverage";
import { expectRenderedFont, readyFormation } from "../browser/formationEvidence";

// Game input, navigation, details, and draft rules are exercised by the presentation model's real-core
// headless tests. These cases paint supplied snapshots; native actions below only prepare modality.
test("承認画像に対応する4状態を1672×941のVRTで検証する", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  for (const [name, mode, selection] of [
    ["departure", "normal", false],
    ["selection", "normal", true],
    ["disabled", "disabled", false],
    ["symptoms", "symptoms", true],
  ] as const) {
    await collectCoverage(page);
    await page.goto(`/rpg/tests/fixtures/party-approved.html?mode=${mode}${selection ? "&selection=1" : ""}`);
    await readyFormation(page);
    if (selection) {
      // Establish the same pointer focus modality as the accepted picture, without changing state.
      const candidate = page
        .getByRole("group", { name: "候補一覧" })
        .getByRole("button", { name: "ロッシ", exact: true });
      await candidate.evaluate((button: HTMLButtonElement) => button.blur());
      await candidate.click();
    }
    await page.mouse.move(1660, 10);
    await expectRenderedFont(
      page,
      selection ? ".party-selection .ui-title" : ".party-heading .ui-title",
      "Noto Serif JP",
      700,
    );
    await expect(page).toHaveScreenshot(golden(`approved-${name}.png`));
    // The separate approved-art comparison consumes the actual runtime picture as review evidence.
    await page.screenshot({ path: testInfo.outputPath(`approved-${name}.png`) });
  }
});

test("候補の選択・未選択を直接描き、枠と番号のVRTが一致する", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const candidateState of ["selected", "unselected"] as const) {
    await collectCoverage(page);
    await page.goto(`/rpg/tests/fixtures/party-selection.html?count=2&selection=1&candidate=${candidateState}`);
    await readyFormation(page);
    const candidate = page
      .getByRole("group", { name: "候補一覧" })
      .getByRole("button", { name: "ロッシ", exact: true });
    await candidate.click();
    const box = await candidate.locator("..").boundingBox();
    if (!box) throw new Error("候補カードが表示されていません");
    await expect(page).toHaveScreenshot(golden(`party-candidate-${candidateState}.png`), {
      clip: {
        x: Math.floor(box.x) - 8,
        y: Math.floor(box.y) - 8,
        width: Math.ceil(box.width) + 16,
        height: Math.ceil(box.height) + 16,
      },
      animations: "disabled",
      maxDiffPixels: 0,
    });
  }
});

test("主操作のマウス保持とSpace押下中の文字・focusをVRTで検証する", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/rpg/tests/fixtures/party-selection.html?count=2");
  await readyFormation(page);
  const primary = page.getByRole("button", { name: "出発する", exact: true });
  await primary.hover();
  await expect(page).toHaveScreenshot(golden("formation-primary-hover-1920.png"));
  await page.mouse.down();
  await expect(page).toHaveScreenshot(golden("formation-primary-pressed-1920.png"));
  await page.mouse.up();
  await primary.focus();
  await page.keyboard.down("Space");
  await expect(page).toHaveScreenshot(golden("formation-primary-space-focus-1920.png"));
  await page.keyboard.up("Space");
});

test("編成のHPバーは全快・半分・空・症状後最大HPを直接描いてVRTで示す", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  for (const selection of [false, true]) {
    await collectCoverage(page);
    await page.goto(`/rpg/tests/fixtures/party-approved.html?mode=hp-levels${selection ? "&selection=1" : ""}`);
    await readyFormation(page);
    if (selection) {
      const candidate = page
        .getByRole("group", { name: "候補一覧" })
        .getByRole("button", { name: "ロッシ", exact: true });
      await candidate.evaluate((button: HTMLButtonElement) => button.blur());
      await candidate.click();
    }
    await page.mouse.move(1660, 10);
    await expect(page).toHaveScreenshot(golden(`party-hp-levels-${selection ? "selection" : "departure"}.png`), {
      maxDiffPixels: 0,
    });
  }
});
