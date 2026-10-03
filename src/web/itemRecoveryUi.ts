import { itemCatalog, recoveryItemId } from "../content/itemSettings";
import type { BattleCombatantDefinition } from "../game/battle";
import { previewRecoveryItem } from "../game/itemUse";
import { effectiveMaxHp, healthyStatus } from "../game/status";
import "./items.css";

export function mountRecoveryItemUi(
  host: HTMLElement,
  options: {
    count: () => number;
    targets: () => readonly BattleCombatantDefinition[];
    names: Readonly<Record<string, string>>;
    canUse: () => boolean;
    use: (targetId: string) => boolean;
    afterUse?: () => void;
  },
) {
  const events = new AbortController();
  const button = document.createElement("button");
  button.type = "button";
  button.className = "command item-trigger";
  const dialog = document.createElement("dialog");
  dialog.className = "item-dialog";
  dialog.setAttribute("aria-label", "HP回復品の使用");
  dialog.innerHTML =
    '<h2>HP回復品</h2><p>生存中の味方1人のHPを回復します。精神疲労は増えません。</p><label>対象<select data-item-target></select></label><p data-item-preview role="status"></p><div class="item-actions"><button type="button" class="command" data-item-use>使用する</button><button type="button" class="command" data-item-cancel>戻る</button></div>';
  const target = dialog.querySelector<HTMLSelectElement>("select") as HTMLSelectElement;
  const preview = dialog.querySelector<HTMLElement>("[data-item-preview]") as HTMLElement;
  const use = dialog.querySelector<HTMLButtonElement>("[data-item-use]") as HTMLButtonElement;
  function updatePreview() {
    const candidate = options.targets().find((c) => c.id === target.value);
    const result = previewRecoveryItem(candidate, recoveryItemId, itemCatalog);
    preview.textContent = result.usable
      ? `回復見込み +${result.amount} HP · 残り${options.count()}個`
      : result.reason === "no-recovery"
        ? "HPは満タンです。使用できません。"
        : "この対象には使用できません。";
    use.disabled = !result.usable || options.count() === 0 || !options.canUse();
  }
  function render() {
    button.textContent = `物品（HP回復品 ×${options.count()}）`;
    button.disabled = options.count() === 0 || !options.canUse();
  }
  button.addEventListener(
    "click",
    () => {
      target.replaceChildren(
        ...options
          .targets()
          .filter((c) => c.team === "ally")
          .map((c) => {
            const option = document.createElement("option");
            option.value = c.id;
            option.textContent = `${options.names[c.id] ?? c.id} · HP ${c.hp}/${effectiveMaxHp(c.maxHp ?? c.hp, c.status ?? healthyStatus())}`;
            return option;
          }),
      );
      updatePreview();
      dialog.showModal();
      target.focus();
    },
    { signal: events.signal },
  );
  target.addEventListener("change", updatePreview, { signal: events.signal });
  dialog.addEventListener("keydown", (event) => event.stopPropagation(), { signal: events.signal });
  dialog
    .querySelector("[data-item-cancel]")
    ?.addEventListener("click", () => dialog.close(), { signal: events.signal });
  dialog.addEventListener("close", () => button.focus(), { signal: events.signal });
  use.addEventListener(
    "click",
    () => {
      if (use.disabled) return;
      use.disabled = true;
      if (options.use(target.value)) {
        if (dialog.isConnected) {
          dialog.close();
          render();
        }
        options.afterUse?.();
      } else {
        updatePreview();
        preview.textContent = "使用できませんでした。対象と所持数を確認してください。";
      }
    },
    { signal: events.signal },
  );
  host.append(button, dialog);
  render();
  return {
    render,
    dispose: () => {
      events.abort();
      dialog.remove();
      button.remove();
    },
  };
}
