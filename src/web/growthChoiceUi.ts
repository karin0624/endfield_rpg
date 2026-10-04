import type { ExplorationSkills } from "../game/skillAcquisition";
import type { SkillCatalog } from "../game/skills";
import { type GrowthEvent, type GrowthFocus, reduceGrowthPresentation } from "../presentation/growthModel";
import { projectGrowthChoice } from "../presentation/growthProjection";
import { createGrowthChoiceView } from "./growthChoiceView";

export function mountGrowthChoice(
  root: HTMLElement,
  state: ExplorationSkills,
  catalog: SkillCatalog,
  names: Readonly<Record<string, string>>,
  choose: (skillId: string) => void,
): () => void {
  let focus: GrowthFocus = { kind: "heading" };
  const view = createGrowthChoiceView(root, (event: GrowthEvent) => {
    if (event.type === "choose") {
      choose(event.skillId);
      return true;
    }
    const changed = reduceGrowthPresentation(focus, event, state.choice);
    focus = changed.focus;
    if (frame) view.render(frame, focus);
    return changed.handled;
  });
  const frame = projectGrowthChoice(state, catalog, names);
  if (frame) view.render(frame, focus);
  return view.dispose;
}
