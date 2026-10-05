import { readFile } from "node:fs/promises";
import { afterEach, expect, it, vi } from "vitest";
import { assetFingerprint } from "./assetFingerprint";

afterEach(() => vi.unstubAllGlobals());

it("実GLBの同じbytesをNative WebCryptoで照合する", async () => {
  const bytes = Uint8Array.from(await readFile("public/assets/ground/ground1.glb")).buffer;
  expect(await assetFingerprint(bytes)).toBe("0bad77901554e56495e34844a5e63e66380b30d48c732c5c7fbc152c9b976ef9");
});

it("Native WebCryptoのsubtleを利用できないときは未照合として返す", async () => {
  vi.stubGlobal("crypto", { subtle: undefined });
  expect(await assetFingerprint(new ArrayBuffer(0))).toBeUndefined();
});

it("WebCrypto自体のない実行環境でも未照合として返す", async () => {
  vi.stubGlobal("crypto", undefined);
  expect(await assetFingerprint(new ArrayBuffer(0))).toBeUndefined();
});

it("Native digestの拒否は素材読込の失敗にしない", async () => {
  const unavailable = { digest: () => Promise.reject(new Error("digest denied")) };
  expect(await assetFingerprint(new ArrayBuffer(0), unavailable)).toBeUndefined();
});
