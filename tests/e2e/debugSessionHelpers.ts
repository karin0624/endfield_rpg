import type { Page } from "@playwright/test";
import { expect } from "./coverage";

/** Resolve actual retained offers; prefer effects that do not alter attackPower. */
export async function finishGrowthChoices(page: Page) {
  const panel = page.getByRole("region", { name: "レベルアップのスキル選択" });
  while (await panel.isVisible()) {
    await expect(panel.getByRole("button")).toHaveCount(3);
    const pick = panel.getByRole("button").filter({ hasNotText: "検証用威力補正" }).first();
    await pick.click();
  }
}
export async function winByAttacking(page: Page) {
  const victory = page.getByRole("heading", { name: "戦闘に勝利しました" });
  for (let turn = 0; turn < 12 && !(await victory.isVisible()); turn++) {
    await page.getByRole("button", { name: "通常攻撃" }).click();
    await expect(page.locator("[data-battle-ui]")).toHaveAttribute("data-replaying", "false", { timeout: 60_000 });
  }
  await expect(victory).toBeVisible();
}

export async function editSlot(page: Page, slot: number, id: string) {
  const opener = page.getByRole("button", { name: `枠 ${slot}`, exact: true });
  const current = await opener.textContent();
  await opener.click();
  const name = id
    ? id === "player"
      ? "ロッシ"
      : "ギルベルタ"
    : current?.includes("ギルベルタ")
      ? "ギルベルタ"
      : "ロッシ";
  const candidate = page.getByRole("group", { name: "候補一覧" }).getByRole("button", { name, exact: true });
  if ((await candidate.getAttribute("aria-pressed")) !== String(!!id)) await candidate.click();
  await page.getByRole("button", { name: "確定", exact: true }).click();
}
