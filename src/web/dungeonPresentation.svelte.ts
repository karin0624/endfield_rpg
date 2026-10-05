import type { DungeonInput, DungeonModel } from "../presentation/dungeonModel";
import { projectDungeonChrome } from "../presentation/dungeonProjection";
export function deriveDungeonChrome(readModel: () => DungeonModel, readInput: () => DungeonInput, returnLabel: string) {
  let kind = $derived(readModel().screen.kind);
  let outcome = $derived(
    readModel().screen.kind === "outcome"
      ? (readModel().screen as Extract<DungeonModel["screen"], { kind: "outcome" }>).outcome
      : undefined,
  );
  let route = $derived(readModel().route),
    branch = $derived(readModel().branch),
    focus = $derived(readModel().focus),
    growthFocus = $derived(readModel().growthFocus);
  let inputContext = $derived(readModel().inputContext),
    message = $derived(readModel().message),
    branchResult = $derived(readModel().branchResult),
    sceneOwner = $derived(readModel().sceneOwner),
    speed = $derived(readModel().speed),
    reducedMotion = $derived(readModel().reducedMotion);
  let game = $derived(readInput().game),
    definition = $derived(readInput().route),
    adventure = $derived(readInput().adventure),
    rules = $derived(readInput().rules),
    basicAttack = $derived(readInput().basicAttack),
    items = $derived(readInput().items);
  let frame = $derived(
    projectDungeonChrome(
      {
        screen: { kind, outcome },
        route,
        branch,
        focus,
        growthFocus,
        inputContext,
        message,
        branchResult,
        sceneOwner,
        speed,
        reducedMotion,
      },
      { game, route: definition, adventure, rules, basicAttack, items, enemyDepths: [] },
      returnLabel,
    ),
  );
  return {
    get frame() {
      return frame;
    },
  };
}
