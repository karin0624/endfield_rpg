// 描画専用の配置。ゲーム状態・戦闘ルールには持ち込まない。
export const battleLayout = {
  ground: { scale: 26 },
  backdrop: { width: 50, height: (50 * 736) / 2138 },
  actors: [
    {
      id: "rossi", image: "characters/rossi/front-left.png",
      pixels: [1024, 1536], foot: [512, 1508], height: 3.3, flipX: false,
      position: [3.2, 2.49, 1.5], shadow: [0.65, 0.28],
    },
    {
      id: "slime", image: "enemies/slime-blue.png",
      pixels: [49, 34], foot: [24.5, 34], height: 1.3, flipX: true,
      position: [-3.2, 2.64, 0.5], shadow: [0.8, 0.35],
    },
  ],
} as const;
