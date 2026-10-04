import { expect, it } from "vitest";
import { DEBUG_SAVE_KEY, GAME_SAVE_KEY, readSlotData, writeSlotData } from "./saveSlot";

it("確定済みbytesを通常・debugの各スロットへ書き、他の保存を変更しない", () => {
  const values = new Map([["editor-draft", "keep"]]);
  const storage = () => ({
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  });
  expect(readSlotData(storage)).toEqual({ data: null });
  expect(writeSlotData("normal confirmed bytes", storage)).toBe(true);
  expect(writeSlotData("debug confirmed bytes", storage, DEBUG_SAVE_KEY)).toBe(true);
  expect(readSlotData(storage)).toEqual({ data: "normal confirmed bytes" });
  expect(readSlotData(storage, DEBUG_SAVE_KEY)).toEqual({ data: "debug confirmed bytes" });
  expect(values.get(GAME_SAVE_KEY)).toBe("normal confirmed bytes");
  expect(values.get("editor-draft")).toBe("keep");
});

it("Storage取得・書込みが拒否されたら失敗を返し、旧bytesを保持する", () => {
  let saved = "old saved bytes";
  const denied = () => {
    throw new Error("storage denied");
  };
  expect(writeSlotData("new bytes", denied)).toBe(false);
  expect(writeSlotData("new bytes", () => ({ getItem: () => saved, setItem: denied }))).toBe(false);
  expect(saved).toBe("old saved bytes");
  expect(
    writeSlotData("new bytes", () => ({
      getItem: () => saved,
      setItem: (_key, bytes) => {
        saved = bytes;
      },
    })),
  ).toBe(true);
  expect(saved).toBe("new bytes");
});

it("読込みが拒否されたらerrorを返し、破損bytesも読込みだけでは書換えない", () => {
  const denied = () => {
    throw new Error("storage denied");
  };
  expect(readSlotData(denied)).toEqual({ error: true });
  expect(readSlotData(() => ({ getItem: denied, setItem: denied }))).toEqual({ error: true });
  const values = new Map([[GAME_SAVE_KEY, "broken"]]);
  const storage = () => ({ getItem: (key: string) => values.get(key) ?? null, setItem: denied });
  expect(readSlotData(storage)).toEqual({ data: "broken" });
  expect(values.get(GAME_SAVE_KEY)).toBe("broken");
});
