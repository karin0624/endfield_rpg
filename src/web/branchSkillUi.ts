import type { BattleSkillRules } from "../game/battle";
import type { DungeonActionResult, DungeonState } from "../game/dungeon";
import type { DungeonCommand } from "../game/expedition";
import { canParticipate, effectiveMaxHp, healthyStatus } from "../game/status";

/** Selection is local UI state; only confirmation dispatches a versioned core operation. */
export function mountBranchSkillUi(
  root: HTMLElement,
  state: DungeonState,
  rules: BattleSkillRules,
  names: Readonly<Record<string, string>>,
  dispatch: (command: DungeonCommand) => DungeonActionResult,
  committed: (result: DungeonActionResult) => void,
): () => void {
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.dataset.singleActivation = "";
  trigger.className = "branch-skill-trigger";
  trigger.textContent = "分岐で回復";
  const dialog = document.createElement("dialog");
  dialog.className = "branch-skill-dialog";
  dialog.setAttribute("aria-label", "分岐の回復スキル");
  root.append(trigger, dialog);
  let actorId = "";
  let skillId = "";
  const eligible = state.party.filter((member) => canParticipate(member.hp, member.status));
  const name = (id: string) => names[id] ?? id;
  function button(label: string, action: () => void): void {
    const element = document.createElement("button");
    element.type = "button";
    element.dataset.singleActivation = "";
    element.textContent = label;
    element.onclick = action;
    dialog.append(element);
  }
  function render(): void {
    dialog.replaceChildren();
    const heading = document.createElement("h2");
    heading.textContent = !actorId ? "使用者を選ぶ" : !skillId ? `${name(actorId)}の技を選ぶ` : "回復する味方を選ぶ";
    dialog.append(heading);
    if (!actorId) {
      for (const member of eligible)
        button(name(member.id), () => {
          actorId = member.id;
          render();
        });
    } else if (!skillId) {
      const actor = eligible.find((member) => member.id === actorId);
      for (const skill of rules.catalog.skills) {
        if (
          skill.type !== "active" ||
          !skill.scenes.includes("branch") ||
          skill.effect.type !== "hp-recovery" ||
          !actor?.learnedSkills?.some((known) => known.type === "active" && known.skillId === skill.id)
        )
          continue;
        button(`${skill.name} · 精神疲労 +${skill.mentalFatigueIncrease}`, () => {
          skillId = skill.id;
          render();
        });
        const description = document.createElement("p");
        description.textContent = `${skill.description} アクティブ／分岐対応。現在の精神疲労 ${actor.mentalFatigue ?? 0}。使用前の疲労で回復し、その後に負荷と追加発症を計算します。`;
        dialog.append(description);
      }
    } else {
      for (const member of eligible)
        button(
          `${name(member.id)} HP ${Number(member.hp.toFixed(2))}/${effectiveMaxHp(member.maxHp ?? member.hp, member.status ?? healthyStatus())}`,
          () => {
            const result = dispatch({
              type: "branch-skill",
              actorId,
              skillId,
              targetId: member.id,
              expectedVersion: state.branchSkillVersion,
              expectedNodeId: state.currentNodeId,
              expeditionActionId: state.expeditionActionId ?? -1,
            });
            dialog.close();
            committed(result);
          },
        );
    }
    if (!dialog.querySelector("button")) {
      const empty = document.createElement("p");
      empty.textContent = actorId ? "分岐で使える回復スキルを習得していません。" : "回復スキルを使える仲間がいません。";
      dialog.append(empty);
    }
    button("取消", () => dialog.close());
    dialog.querySelector("button")?.focus();
  }
  trigger.onclick = () => {
    actorId = "";
    skillId = "";
    dialog.showModal();
    render();
  };
  dialog.onclose = () => trigger.focus();
  return () => {
    dialog.close();
    dialog.remove();
    trigger.remove();
  };
}
