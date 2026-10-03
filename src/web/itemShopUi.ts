import { itemSettings } from "../content/itemSettings";
import "./items.css";
export interface ItemShopOptions {
  balance: () => number;
  count: () => number;
  buy: (quantity: number) => boolean;
}
export function mountItemShop(host: HTMLElement, options: ItemShopOptions) {
  const events = new AbortController();
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.dataset.singleActivation = "";
  trigger.className = "command item-shop-trigger";
  trigger.textContent = "買物";
  const dialog = document.createElement("dialog");
  dialog.className = "item-dialog";
  dialog.setAttribute("aria-label", "市場の買物");
  dialog.innerHTML = `<h2>市場の買物</h2><p>HP回復品 · HP${itemSettings.hpRecovery}回復 · 価格${itemSettings.recoveryPrice}</p><p data-shop-balance></p><label>購入個数<input type="number" min="1" step="1" value="1" data-shop-quantity /></label><p role="status" data-shop-result></p><div class="item-actions"><button class="command" type="button" data-shop-buy data-single-activation>購入する</button><button class="command" type="button" data-shop-close data-single-activation>買物を閉じる</button></div>`;
  const quantity = dialog.querySelector<HTMLInputElement>("input") as HTMLInputElement;
  const buy = dialog.querySelector<HTMLButtonElement>("[data-shop-buy]") as HTMLButtonElement;
  const status = dialog.querySelector<HTMLElement>("[data-shop-result]") as HTMLElement;
  function refresh() {
    (dialog.querySelector("[data-shop-balance]") as HTMLElement).textContent =
      `所持金 ${options.balance()} · 探索バッグ ${options.count()}個`;
    buy.disabled =
      !Number.isSafeInteger(quantity.valueAsNumber) ||
      quantity.valueAsNumber < 1 ||
      quantity.valueAsNumber * itemSettings.recoveryPrice > options.balance();
  }
  trigger.addEventListener(
    "click",
    () => {
      status.textContent = "";
      refresh();
      dialog.showModal();
    },
    { signal: events.signal },
  );
  quantity.addEventListener("input", refresh, { signal: events.signal });
  dialog.addEventListener("keydown", (event) => event.stopPropagation(), { signal: events.signal });
  dialog.querySelector("[data-shop-close]")?.addEventListener("click", () => dialog.close(), { signal: events.signal });
  dialog.addEventListener("close", () => trigger.focus(), { signal: events.signal });
  buy.addEventListener(
    "click",
    (event) => {
      if (buy.disabled || event.detail > 1) return;
      const count = quantity.valueAsNumber;
      status.textContent = options.buy(count)
        ? `HP回復品を${count}個購入しました。`
        : "購入できませんでした。所持金と個数を確認してください。";
      refresh();
    },
    { signal: events.signal },
  );
  host.append(trigger, dialog);
  return {
    render: (visible: boolean) => {
      trigger.hidden = !visible;
      if (!visible) dialog.close();
    },
    dispose: () => {
      events.abort();
      trigger.remove();
      dialog.remove();
    },
  };
}
