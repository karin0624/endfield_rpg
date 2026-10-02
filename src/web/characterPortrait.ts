const portraits: Readonly<Record<string, string>> = {
  player: "characters/rossi/expressions/neutral.png",
  gilberta: "characters/gilberta/expressions/neutral.png",
};

export function characterPortraitUrl(id: string, face = false): string | undefined {
  const portrait = portraits[id];
  const path = face ? portrait?.replace("expressions/neutral.png", "face.png") : portrait;
  return path ? `${import.meta.env.BASE_URL}assets/${path}` : undefined;
}
