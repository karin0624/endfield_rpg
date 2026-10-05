import { characters } from "../content/characters";
import type { BattleInput } from "./battleModel";
import type { CampaignFocus } from "./campaignModel";
import { campaignFeedback } from "./campaignProjection";
import { type DebugSessionModel, debugDungeonInput, debugSessionRules, debugTownInput } from "./debugSessionModel";
import { projectDungeon } from "./dungeonProjection";
import { projectGrowthChoice } from "./growthProjection";
import { calendarLabel } from "./statusText";
import { projectTown } from "./townProjection";

export function projectDebugSession(state: DebugSessionModel, enemyDepths: BattleInput["enemyDepths"] = []) {
  const focus: CampaignFocus | null =
    state.growthFocus?.kind === "heading"
      ? { kind: "growth-heading" }
      : state.growthFocus?.kind === "candidate"
        ? { kind: "growth-candidate", skillId: state.growthFocus.skillId }
        : null;
  const base = {
    title: "",
    copy: [],
    commands: [],
    calendar: calendarLabel(state.game.clock),
    status: state.saveStatus,
    focus,
  };
  if (state.screen === "town" || state.screen === "saving" || state.screen === "loading")
    return {
      ...base,
      kind: "town" as const,
      town: projectTown(state.town, debugTownInput(state), {
        calendar: base.calendar,
        feedback: campaignFeedback(state),
        home: false,
        debug: true,
        editorEntry: state.editorEntry,
        saveStatus: state.saveStatus,
      }),
    };
  if (state.screen === "growth")
    return {
      ...base,
      kind: "growth" as const,
      growth: state.game.growth
        ? projectGrowthChoice(
            state.game.growth,
            debugSessionRules.catalog,
            Object.fromEntries(characters.map(({ id, name }) => [id, name])),
          )
        : null,
    };
  if (state.screen === "dungeon")
    return {
      ...base,
      kind: "dungeon" as const,
      dungeon: state.expedition ? projectDungeon(state.expedition, debugDungeonInput(state, enemyDepths)) : null,
    };
  return { ...base, kind: "disposed" as const };
}
