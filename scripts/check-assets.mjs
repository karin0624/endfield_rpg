import { open } from "node:fs/promises";

// LFSポインタのまま配布用ビルドへコピーしてしまう事故を防ぐ。
const assets = [
  ["ground/ground1.glb", "676c5446"],
  ["backgrounds/landscape1.png", "89504e470d0a1a0a"],
  ["characters/rossi/front-left.png", "89504e470d0a1a0a"],
  ["enemies/slime-blue.png", "89504e470d0a1a0a"],
  ["backgrounds/dungeon-route.png", "89504e470d0a1a0a"],
  ["dungeon-nodes/focus/battle.png", "89504e470d0a1a0a"],
  ["dungeon-nodes/focus/encounter.png", "89504e470d0a1a0a"],
  ["dungeon-nodes/focus/boss.png", "89504e470d0a1a0a"],
  ["dungeon-nodes/unfocus/battle.png", "89504e470d0a1a0a"],
  ["dungeon-nodes/unfocus/encounter.png", "89504e470d0a1a0a"],
  ["dungeon-nodes/unfocus/boss.png", "89504e470d0a1a0a"],
];
for (const [path, magic] of assets) {
  const file = await open(new URL(`../public/assets/${path}`, import.meta.url));
  try {
    const header = Buffer.alloc(magic.length / 2);
    await file.read(header, 0, header.length, 0);
    if (header.toString("hex") !== magic) {
      throw new Error(`${path}: 素材の実体がありません。Git LFSを導入して git lfs pull を実行してください。`);
    }
  } finally {
    await file.close();
  }
}
