import { type AdventureSettings, adventureSettingsFields } from "../presentation/adventureSettings";

export function adventureSettingsStyle(settings: AdventureSettings): string {
  return adventureSettingsFields
    .map((field) => `--adventure-${field.key}:${settings[field.key]}${field.unit}`)
    .join(";");
}

export function applyAdventureSettings(screen: HTMLElement, settings: AdventureSettings): void {
  for (const field of adventureSettingsFields) {
    screen.style.setProperty(`--adventure-${field.key}`, `${settings[field.key]}${field.unit}`);
  }
}
