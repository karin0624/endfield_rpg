import { mount, unmount } from "svelte";
import {
  type CharacterDetailsInteraction,
  type CharacterDetailsModel,
  createCharacterDetailsModel,
} from "../presentation/characterDetails";
import CharacterDetails from "./components/CharacterDetails.svelte";

export function createCharacterDetailsView(
  root: HTMLElement,
  send: (event: CharacterDetailsInteraction) => boolean,
  focusOpener: (characterId: string) => void,
) {
  let model = $state.raw<CharacterDetailsModel>(createCharacterDetailsModel());
  const component = mount(CharacterDetails, {
    target: root,
    props: {
      get model() {
        return model;
      },
      send,
      focusOpener,
    },
  });
  return {
    render(next: CharacterDetailsModel) {
      model = next;
    },
    dispose() {
      void unmount(component);
    },
  };
}
