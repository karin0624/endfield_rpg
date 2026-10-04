import { readFileSync } from "node:fs";
import { expect, test } from "../browser/coverage";
import type { GroundView } from "../fixtures/ground-view";
import { createGroundPicture, expectGroundPicture, rendererPictureEntry } from "./groundPictures";

for (const [name, width, height] of [
  ["pc", 1440, 1080],
  ["mobile", 390, 844],
] as const) {
  test(`${name}の実地形の既知材質と未検証環境の元材質を直接比較する`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(rendererPictureEntry);
    await createGroundPicture(page);
    await expectGroundPicture(page, `ground-default-${name}`);
    await page.evaluate(async () => {
      const native = (window as typeof window & { groundView: GroundView }).groundView;
      native.start("unknown");
      await native.ready();
    });
    await expectGroundPicture(page, `ground-original-${name}`);
    await page.evaluate(async () => {
      const native = (window as typeof window & { groundView: GroundView }).groundView;
      native.start();
      await native.ready();
    });
    await expectGroundPicture(page, `ground-default-${name}`);
  });
}

// Preserve authored geometry and material chunks; only identity metadata changes in the response bytes.
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

test("同じ素材パスの別bytesは元材質で描き、実モデルを二重取得しない", async ({ page }) => {
  let requests = 0;
  await page.route("**/assets/ground/ground1.glb", (route) => {
    requests++;
    return route.fulfill({ body: unverifiedGround(), contentType: "model/gltf-binary" });
  });
  await page.goto(rendererPictureEntry);
  await createGroundPicture(page);
  await expectGroundPicture(page, "ground-original-pc");
  expect(requests).toBe(1);
});

for (const unavailable of ["absent", "failed"] as const) {
  test(`素材照合が${unavailable}でも元材質を直接描く`, async ({ page }) => {
    await page.addInitScript((unavailable) => {
      if (unavailable === "absent") Object.defineProperty(window.crypto, "subtle", { value: undefined });
      else
        Object.defineProperty(window.crypto.subtle, "digest", {
          value: () => Promise.reject(new Error("digest denied")),
        });
    }, unavailable);
    await page.goto(rendererPictureEntry);
    await createGroundPicture(page);
    await expectGroundPicture(page, "ground-original-pc");
  });
}
