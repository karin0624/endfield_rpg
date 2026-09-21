import { describe, expect, it } from "vitest";

import { initialGameOptions } from "../content/initialGameOptions";
import { createInitialGameState } from "./createInitialGameState";

describe("createInitialGameState", () => {
  it("街から始まる未進行の状態を作る", () => {
    expect(createInitialGameState(initialGameOptions)).toEqual({
      mode: "town",
      flags: [],
    });
  });

  it("呼び出しごとに独立した状態を作る", () => {
    const first = createInitialGameState(initialGameOptions);
    const second = createInitialGameState(initialGameOptions);

    first.flags.push("visited-town");

    expect(second.flags).toEqual([]);
  });
});
