import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { checkAssets } from "./check-assets.mjs";

it("recursively checks every shipped format and rejects pointers, truncation and unknown formats", async () => {
  const root = await mkdtemp(join(tmpdir(), "asset-contract-"));
  try {
    const nested = join(root, "new-character/expressions");
    await mkdir(nested, { recursive: true });
    const samples = {
      "image.png": Buffer.from("89504e470d0a1a0a", "hex"),
      "model.glb": Buffer.from("676c5446", "hex"),
      "font.woff2": Buffer.from("774f4632", "hex"),
      "background.webp": Buffer.from("RIFF0000WEBP"),
      "icon.svg": Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    };
    for (const [name, bytes] of Object.entries(samples)) await writeFile(join(nested, name), bytes);
    await writeFile(join(root, "Font-OFL.txt"), "license text");
    await writeFile(join(root, "vendor-license.txt"), "license text");
    await expect(checkAssets(root)).resolves.toBeUndefined();
    for (const [name, bytes] of Object.entries(samples)) {
      for (const invalid of [Buffer.from("version https://git-lfs.github.com/spec/v1"), Buffer.alloc(0)]) {
        await writeFile(join(nested, name), invalid);
        await expect(checkAssets(root), name).rejects.toThrow(name);
      }
      await writeFile(join(nested, name), bytes);
    }
    await writeFile(join(nested, "background.webp"), "RIFF0000NOTP");
    await expect(checkAssets(root)).rejects.toThrow("background.webp");
    await writeFile(join(nested, "background.webp"), samples["background.webp"]);
    await writeFile(join(root, "new-format.bin"), "unchecked");
    await expect(checkAssets(root)).rejects.toThrow("new-format.bin");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
