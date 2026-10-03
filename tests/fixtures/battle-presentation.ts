import type { DungeonBattleRendererFactory } from "../../src/web/battlePresentation";

/** Only drawing is substituted. Input, battle state, events and fatigue use production code. */
export const createUiTestRenderer: DungeonBattleRendererFactory = (canvas) => ({
  beginBattle(combatants) {
    const hidden = new Set<string>();
    const enemies = combatants.filter(({ team }) => team === "enemy");
    const allies = combatants.filter(({ team }) => team === "ally");
    const rect = (id: string) => {
      const isAlly = allies.some((ally) => ally.id === id);
      const index = (isAlly ? allies : enemies).findIndex((member) => member.id === id);
      if (index < 0) return undefined;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const left = width * ((isAlly ? 0.65 : 0.2) + index * 0.14);
      const top = height * (0.55 + index * 0.1);
      return {
        left,
        top,
        width: width * 0.12,
        height: height * 0.16,
        markerX: left + width * 0.06,
        markerY: top,
        spriteTop: top,
      };
    };
    return {
      ready: Promise.resolve(),
      getCombatantScreenRect: (id) => (hidden.has(id) ? undefined : rect(id)),
      getFrontmostEnemyId: (candidateIds) =>
        [...candidateIds].sort((a, b) => (rect(b)?.top ?? 0) - (rect(a)?.top ?? 0))[0],
      refreshCombatantScreenPositions() {},
      playCombatantEffect(id, type, _animate, onComplete) {
        if (type === "defeat") hidden.add(id);
        onComplete?.();
      },
      resetCombatantPresentation() {
        hidden.clear();
      },
      dispose() {},
    };
  },
  dispose() {},
});
