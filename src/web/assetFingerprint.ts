/** Identity metadata may be unavailable; callers retain the asset's original material in that case. */
export async function assetFingerprint(
  bytes: ArrayBuffer,
  subtle: Pick<SubtleCrypto, "digest"> | undefined = globalThis.crypto?.subtle,
): Promise<string | undefined> {
  if (!subtle) return undefined;
  try {
    const digest = await subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    return undefined;
  }
}
