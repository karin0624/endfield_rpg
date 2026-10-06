import type { DungeonInput, DungeonModel } from "../presentation/dungeonModel";
import { projectDungeonChrome } from "../presentation/dungeonProjection";
export function deriveDungeonChrome(readModel: () => DungeonModel, readInput: () => DungeonInput, returnLabel: string) {
  let value = $derived(readModel().value);
  let outcome = $derived(readModel().context.outcome);
  let route = $derived(readModel().context.route),
    branch = $derived(readModel().context.branch),
    focus = $derived(readModel().context.focus),
    growthFocus = $derived(readModel().context.growthFocus);
  let message = $derived(readModel().context.message),
    branchResult = $derived(readModel().context.branchResult);
  let game = $derived(readInput().game),
    definition = $derived(readInput().route),
    adventure = $derived(readInput().adventure),
    rules = $derived(readInput().rules),
    basicAttack = $derived(readInput().basicAttack),
    items = $derived(readInput().items);
  let frame = $derived(
    projectDungeonChrome(
      {
        value,
        context: {
          outcome,
          route,
          branch,
          focus,
          growthFocus,
          message,
          branchResult,
        },
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
