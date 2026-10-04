import { characterPortraitPath } from "../presentation/characterPortrait";

export function characterPortraitUrl(id: string): string | undefined {
  const path = characterPortraitPath(id);
  return path ? `${import.meta.env.BASE_URL}assets/${path}` : undefined;
}
