const portraits: Readonly<Record<string, string>> = {
  player: "characters/rossi/expressions/neutral.png",
  gilberta: "characters/gilberta/expressions/neutral.png",
};

export function characterPortraitPath(id: string): string | undefined {
  return portraits[id];
}
