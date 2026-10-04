import { projectAdventure } from "./adventureProjection";
import { projectParty } from "./partyProjection";
import { projectTownShop, type TownInput, type TownState, townPartyModel } from "./townModel";

export function projectTown(
  state: TownState,
  input: TownInput,
  display: {
    readonly calendar: string;
    readonly feedback: readonly string[];
    readonly home: boolean;
    readonly debug: boolean;
    readonly editorEntry: boolean;
    readonly saveStatus: string;
  },
) {
  const party = townPartyModel(state, input);
  return {
    adventure: projectAdventure({
      state: input.game.adventure,
      definition: input.definition,
      ...display,
      prompt: state.prompt,
      partyEntry: input.partyEntry,
      party: party ? projectParty(party) : undefined,
      focus: party ? null : state.focus,
    }),
    shop: projectTownShop(state, input),
  };
}
export type TownFrame = ReturnType<typeof projectTown>;
