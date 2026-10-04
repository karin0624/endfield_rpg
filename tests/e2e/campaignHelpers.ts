import type { Page } from "@playwright/test";
import { collectCoverage, expect } from "./coverage";

export async function start(page: Page) {
  await collectCoverage(page);
  await page.goto("/");
  await page.getByRole("button", { name: "新規開始", exact: true }).click();
  await page.getByRole("button", { name: "実行する", exact: true }).click();
  await expect(page.locator(".campaign-copy")).toHaveText("（仮テキスト）");
  await page.getByRole("button", { name: "ホームへ", exact: true }).click();
}
export async function cleanNormal(page: Page) {
  await expect(page.getByText(/戦闘デモ|デバッグ|検証用|構図設定|配置設定|未実装/)).toHaveCount(0);
  if ((await page.locator('[data-campaign-screen="home"]').count()) === 0) {
    for (const name of ["保存", "保存してタイトルへ戻る", "装備を整える"])
      await expect(page.getByRole("button", { name, exact: true })).toBeHidden();
  }
}
export async function save(page: Page, title = false) {
  await page.getByRole("button", { name: title ? "保存してタイトルへ戻る" : "保存", exact: true }).click();
  await page.getByRole("button", { name: "実行する", exact: true }).click();
}
