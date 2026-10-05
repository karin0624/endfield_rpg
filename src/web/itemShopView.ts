import type { projectTownShop, TownEvent } from "../presentation/townModel";
import "./items.css";

/** Dialog state and purchase decisions arrive in the projected frame. */
export function createItemShopView(host: HTMLElement, send: (event: TownEvent) => boolean) {
  const events = new AbortController();
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "command item-shop-trigger";
  trigger.textContent = "買物";
  const dialog = document.createElement("dialog");
  dialog.className = "item-dialog";
  dialog.setAttribute("aria-label", "市場の買物");
  dialog.innerHTML = `<h2>市場の買物</h2><p data-shop-offer></p><p data-shop-balance></p><label>購入個数<input type="number" min="1" step="1" value="1" data-shop-quantity /></label><p role="status" data-shop-result></p><div class="item-actions"><button class="command" type="button" data-shop-buy>購入する</button><button class="command" type="button" data-shop-close>買物を閉じる</button></div>`;
  const quantity = dialog.querySelector<HTMLInputElement>("input") as HTMLInputElement;
  const buy = dialog.querySelector<HTMLButtonElement>("[data-shop-buy]") as HTMLButtonElement;
  const close = dialog.querySelector<HTMLButtonElement>("[data-shop-close]") as HTMLButtonElement;
  trigger.addEventListener("click", () => send({ type: "shop-open" }), { signal: events.signal });
  quantity.addEventListener(
    "input",
    () =>
      send({ type: "shop-quantity", quantity: Number.isNaN(quantity.valueAsNumber) ? null : quantity.valueAsNumber }),
    { signal: events.signal },
  );
  buy.addEventListener("click", () => send({ type: "shop-buy" }), { signal: events.signal });
  close.addEventListener("click", () => send({ type: "shop-close" }), { signal: events.signal });
  for (const [target, element] of [
    ["quantity", quantity],
    ["buy", buy],
    ["close", close],
  ] as const)
    element.addEventListener("focus", () => send({ type: "shop-focused", target }), { signal: events.signal });
  dialog.addEventListener(
    "keydown",
    (event) => {
      if (send({ type: "shop-key", key: event.key, shift: event.shiftKey })) event.preventDefault();
      event.stopPropagation();
    },
    { signal: events.signal },
  );
  dialog.addEventListener(
    "cancel",
    (event) => {
      event.preventDefault();
      send({ type: "shop-close" });
    },
    { signal: events.signal },
  );
  host.append(trigger, dialog);
  let appliedFocus: ReturnType<typeof projectTownShop>["focus"] = null;
  return {
    render(frame: ReturnType<typeof projectTownShop>) {
      trigger.hidden = !frame.visible;
      (dialog.querySelector("[data-shop-offer]") as HTMLElement).textContent = frame.offer;
      (dialog.querySelector("[data-shop-balance]") as HTMLElement).textContent = frame.summary;
      (dialog.querySelector("[data-shop-result]") as HTMLElement).textContent = frame.message;
      const value = frame.quantity === null ? "" : String(frame.quantity);
      if (quantity.value !== value) quantity.value = value;
      buy.disabled = !frame.canBuy;
      if (frame.open && !dialog.open) dialog.showModal();
      else if (!frame.open && dialog.open) dialog.close();
      if (frame.focus !== appliedFocus) {
        appliedFocus = frame.focus;
        if (frame.focus === "quantity") quantity.focus();
        else if (frame.focus === "buy") buy.focus();
        else if (frame.focus === "close") close.focus();
        else if (frame.focus === "trigger") trigger.focus();
      }
    },
    dispose() {
      events.abort();
      dialog.close();
      trigger.remove();
      dialog.remove();
    },
  };
}
