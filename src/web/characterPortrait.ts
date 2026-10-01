const portraits: Readonly<Record<string, string>> = {
  player: "characters/rossi/expressions/neutral.png",
  gilberta: "characters/gilberta/expressions/neutral.png",
};

export function characterPortraitUrl(id: string): string | undefined {
  const path = portraits[id];
  return path ? `${import.meta.env.BASE_URL}assets/${path}` : undefined;
}
