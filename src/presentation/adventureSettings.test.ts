import { expect, it } from "vitest";
import savedSettings from "../web/adventure-settings.json";
import { parseAdventureSettings } from "./adventureSettings";

it("all adventure fields accept inclusive limits and reject missing, nonfinite and out-of-range input", () => {
  const bounds = {
    leftX: [0, 100],
    centerX: [0, 100],
    rightX: [0, 100],
    portraitBottom: [0, 70],
    portraitHeight: [20, 130],
    mobileLeftX: [0, 100],
    mobileCenterX: [0, 100],
    mobileRightX: [0, 100],
    mobilePortraitBottom: [0, 70],
    mobilePortraitHeight: [20, 130],
    panelHeight: [15, 75],
    mobilePanelHeight: [15, 75],
    panelPaddingX: [0, 25],
    mobilePanelPaddingX: [0, 25],
    panelPaddingTop: [0, 100],
    mobilePanelPaddingTop: [0, 100],
    speakerGap: [0, 80],
    textGap: [0, 80],
    arrowRight: [0, 25],
    arrowBottom: [0, 100],
    choicesTop: [10, 90],
    choicesWidth: [30, 100],
    mobileChoicesTop: [10, 90],
    mobileChoicesWidth: [30, 100],
  };
  for (const [key, [min, max]] of Object.entries(bounds)) {
    for (const value of [min, max])
      expect(parseAdventureSettings({ ...savedSettings, [key]: value }), key).toHaveProperty(key, value);
    for (const value of [min - 0.001, max + 0.001, NaN, Infinity, -Infinity, "1", null, undefined]) {
      expect(() => parseAdventureSettings({ ...savedSettings, [key]: value }), `${key}=${value}`).toThrow();
    }
  }
  for (const value of [
    null,
    [],
    1,
    "settings",
    undefined,
    {},
    { ...savedSettings, version: 2 },
    { ...savedSettings, version: "1" },
  ]) {
    expect(() => parseAdventureSettings(value)).toThrow();
  }
  expect(parseAdventureSettings({ ...savedSettings, unused: "ignored" })).toEqual(savedSettings);
});
