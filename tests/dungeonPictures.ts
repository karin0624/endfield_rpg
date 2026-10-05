import { createDebugSessionModel, debugDungeonInput, reduceDebugSession } from "../src/presentation/debugSessionModel";

/** The core constructs these representative snapshots without any native input or elapsed browser time. */
export function dungeonPicture(name: "initial" | "progressed") {
  let app = createDebugSessionModel("dungeon");
  if (name === "progressed") {
    for (const event of [
      { type: "enter", nodeId: "conversation-b" },
      { type: "advance" },
      { type: "choose", optionId: "mark-on-map" },
      { type: "growth", event: { type: "choose", skillId: "test-vitality" } },
    ] as const) {
      const changed = reduceDebugSession(app, { type: "dungeon", event });
      if (!changed.handled) throw new Error(`Unavailable picture input: ${event.type}`);
      app = changed.state;
    }
  }
  if (!app.expedition) throw new Error("Missing expedition picture");
  return { state: app.expedition, input: debugDungeonInput(app) };
}
