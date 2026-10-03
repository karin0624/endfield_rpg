import { access, open, readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const signatures = {
  ".glb": "676c5446",
  ".png": "89504e470d0a1a0a",
  ".woff2": "774f4632",
};

// Enumerate every shipped asset so additions cannot silently evade the build gate.
export async function checkAssets(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      await checkAssets(path);
      continue;
    }
    if (entry.name.endsWith("-OFL.txt") || entry.name.endsWith("-license.txt")) continue;
    const extension = extname(entry.name);
    const file = await open(path);
    try {
      const header = Buffer.alloc(512);
      const { bytesRead } = await file.read(header, 0, header.length, 0);
      const bytes = header.subarray(0, bytesRead);
      const magic = signatures[extension];
      const valid = magic
        ? bytes.subarray(0, magic.length / 2).toString("hex") === magic
        : extension === ".webp"
          ? bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP"
          : extension === ".svg" && /<svg(?:\s|>)/.test(bytes.toString());
      if (!valid) {
        throw new Error(`${path}: 素材形式を確認できません。LFS素材は git lfs pull で実体を取得してください。`);
      }
    } finally {
      await file.close();
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../public/assets", import.meta.url));
  // Preserve the original build's required-file guarantee as well as validating additions.
  for (const path of [
    "ground/ground1.glb",
    "backgrounds/landscape1.png",
    "characters/rossi/front-left.png",
    "enemies/slime-blue.png",
    "backgrounds/dungeon-route.png",
    ...["focus", "unfocus"].flatMap((state) =>
      ["battle", "encounter", "boss"].map((kind) => `dungeon-nodes/${state}/${kind}.png`),
    ),
  ])
    await access(join(root, path));
  await checkAssets(root);
}
