import type { BattleInput, BattleModel } from "../presentation/battleModel";
import { type BattleAppearance, projectBattleHud } from "../presentation/battleViewProjection";

/** Svelte compares semantic leaves before the relatively expensive HUD projection. */
export function deriveBattleHud(
  readModel: () => BattleModel,
  readInput: () => BattleInput,
  appearance: BattleAppearance = {},
) {
  let scene = $derived(readModel().scene);
  let panel = $derived(readModel().panel);
  let selectedEnemyId = $derived(readModel().selectedEnemyId);
  let focus = $derived(readModel().focus);
  let afterPlaybackFocus = $derived(readModel().afterPlaybackFocus);
  let disclosures = $derived(readModel().disclosures);
  let message = $derived(readModel().message);
  let targetAnnouncement = $derived(readModel().targetAnnouncement);
  let partyAnchor = $derived(readModel().partyAnchor);
  let actionPrompt = $derived(readModel().actionPrompt);
  let record = $derived(readModel().playback.record);
  let display = $derived(readModel().playback.display);
  let eventIndex = $derived(readModel().playback.eventIndex);
  let phase = $derived(readModel().playback.phase);
  let phaseDurationMs = $derived(readModel().playback.phaseDurationMs);
  let phaseSpeed = $derived(readModel().playback.phaseSpeed);
  let requestedSpeed = $derived(readModel().playback.requestedSpeed);
  let reducedMotion = $derived(readModel().playback.reducedMotion);
  let visibleCombatantIds = $derived(readModel().playback.visibleCombatantIds);
  let battle = $derived(readInput().battle);
  let rules = $derived(readInput().rules);
  let basicAttack = $derived(readInput().basicAttack);
  let itemCount = $derived(readInput().itemCount);
  let items = $derived(readInput().items);
  let frame = $derived(
    projectBattleHud(
      {
        scene,
        panel,
        selectedEnemyId,
        focus,
        afterPlaybackFocus,
        disclosures,
        message,
        targetAnnouncement,
        partyAnchor,
        actionPrompt,
        playback: {
          record,
          display,
          eventIndex,
          phase,
          phaseDurationMs,
          phaseSpeed,
          requestedSpeed,
          reducedMotion,
          visibleCombatantIds,
        },
      },
      { battle, rules, basicAttack, itemCount, items, enemyDepths: [] },
      appearance,
    ),
  );
  return {
    get frame() {
      return frame;
    },
  };
}
