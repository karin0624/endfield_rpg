import type { CampaignEvent, CampaignFocus } from "../presentation/campaignModel";
import type { CampaignFrame } from "../presentation/campaignProjection";
import type { TownEvent } from "../presentation/townModel";
import savedAdventureSettings from "./adventure-settings.json";
import { parseAdventureSettings } from "./adventureSettings";
import { createAdventureView } from "./adventureView";
import { createGrowthChoiceView } from "./growthChoiceView";
import { createItemShopView } from "./itemShopView";
import { createPartyView } from "./partyView";
import { requiredElement } from "./requiredElement";
import "./campaign.css";
import "./items.css";

/** Native painting/application records are separate from the application's current screen. */
export function createCampaignView(root: HTMLDivElement, send: (event: CampaignEvent) => boolean) {
  let events = new AbortController();
  let mode = "";
  let paint = "";
  let appliedFocus: string | undefined;
  let disposeChild: (() => void) | undefined;
  let party: ReturnType<typeof createPartyView> | undefined;
  let town: ReturnType<typeof createAdventureView> | undefined;
  let shop: ReturnType<typeof createItemShopView> | undefined;
  let growth: ReturnType<typeof createGrowthChoiceView> | undefined;
  const focusElements = new Map<string, HTMLElement>();
  const focusKey = (target: CampaignFocus) => JSON.stringify(target);
  function clear() {
    events.abort();
    events = new AbortController();
    const child = disposeChild;
    disposeChild = undefined;
    child?.();
    party = undefined;
    town = undefined;
    shop = undefined;
    growth = undefined;
    mode = "";
    paint = "";
    appliedFocus = undefined;
    focusElements.clear();
    document.body.classList.remove("dungeon-mode");
  }
  function bindFocus(element: HTMLElement, target: CampaignFocus) {
    focusElements.set(focusKey(target), element);
    element.addEventListener("focus", () => send({ type: "focused", target }), { signal: events.signal });
  }
  function paragraph(text: string) {
    const p = document.createElement("p");
    p.textContent = text;
    return p;
  }
  return {
    render(frame: CampaignFrame) {
      if (frame.kind === "disposed") {
        clear();
        return;
      }
      // Dungeon's native ownership/presentation is migrated next; its existing view currently occupies this root.
      if (frame.kind === "dungeon") {
        if (mode !== "dungeon") {
          clear();
          mode = "dungeon";
        }
        return;
      }
      if (frame.kind === "town") {
        if (mode !== "town") {
          clear();
          mode = "town";
          const townSend = (event: TownEvent) => send({ type: "town", event });
          town = createAdventureView(
            root,
            frame.town.adventure.utilities,
            townSend,
            parseAdventureSettings(savedAdventureSettings),
          );
          shop = createItemShopView(town.conversationHost, townSend);
          disposeChild = () => {
            town?.dispose();
            shop?.dispose();
          };
        }
        town?.render(frame.town.adventure);
        shop?.render(frame.town.shop);
        return;
      }
      if (frame.kind === "growth") {
        if (mode !== "growth") {
          clear();
          mode = "growth";
          root.replaceChildren();
          growth = createGrowthChoiceView(root, (event) => send({ type: "growth", event }));
          disposeChild = growth.dispose;
        }
        if (frame.growth)
          growth?.render(
            frame.growth,
            frame.focus?.kind === "growth-heading"
              ? { kind: "heading" }
              : frame.focus?.kind === "growth-candidate"
                ? { kind: "candidate", skillId: frame.focus.skillId }
                : null,
          );
        return;
      }
      const nextPaint = JSON.stringify({
        ...frame,
        focus: null,
        ...(frame.kind === "party" ? { party: null } : {}),
        ...(frame.kind === "home" ? { carry: { stock: frame.carry.stock } } : {}),
      });
      if (paint !== nextPaint) {
        clear();
        mode = frame.kind;
        paint = nextPaint;
        root.innerHTML = `<main class="campaign-screen" data-campaign-screen="${frame.kind}"><div class="campaign-art" aria-hidden="true"></div><header class="campaign-header"><h1 tabindex="-1"></h1><p data-calendar></p></header><section class="campaign-content"><div class="campaign-copy"></div><nav class="campaign-commands" aria-label="${frame.title}"></nav><p class="campaign-status" role="status"></p></section></main>`;
        const title = requiredElement<HTMLElement>(root, "h1");
        title.textContent = frame.title;
        bindFocus(title, { kind: "heading" });
        requiredElement<HTMLElement>(root, "[data-calendar]").textContent = frame.calendar;
        requiredElement<HTMLElement>(root, ".campaign-status").textContent = frame.status;
        const copy = requiredElement<HTMLElement>(root, ".campaign-copy");
        if (frame.kind === "home") {
          const portrait = document.createElement("img");
          portrait.src = `${import.meta.env.BASE_URL}assets/${frame.portrait.path}`;
          portrait.alt = "";
          requiredElement<HTMLElement>(root, ".campaign-art").append(portrait);
          const report = document.createElement("div");
          report.dataset.townRecovery = "";
          report.className = "campaign-report";
          report.setAttribute("role", "status");
          report.replaceChildren(...frame.feedback.map(paragraph));
          report.hidden = frame.feedback.length === 0;
          copy.append(report);
        }
        copy.append(...frame.copy.map(paragraph));
        if (frame.kind === "home") {
          const label = document.createElement("label");
          label.textContent = "持込み個数（HP回復品）";
          const carry = document.createElement("input");
          carry.type = "number";
          carry.min = "0";
          carry.max = String(frame.carry.stock);
          carry.step = "1";
          carry.className = "item-carry-input";
          carry.addEventListener(
            "input",
            () =>
              send({ type: "carry-changed", quantity: Number.isNaN(carry.valueAsNumber) ? null : carry.valueAsNumber }),
            { signal: events.signal },
          );
          bindFocus(carry, { kind: "carry" });
          label.append(carry);
          copy.append(label);
        }
        if (frame.kind === "equipment")
          for (const member of frame.members) {
            copy.append(paragraph(member.summary));
            for (const field of member.slots) {
              const label = document.createElement("label");
              label.textContent = field.label;
              const select = document.createElement("select");
              select.className = "item-equipment-select";
              for (const data of field.options) {
                const option = document.createElement("option");
                option.value = data.value;
                option.textContent = data.label;
                option.disabled = data.disabled;
                select.append(option);
              }
              select.value = field.selected;
              select.addEventListener(
                "change",
                () =>
                  send({ type: "equip", characterId: member.id, slot: field.slot, instanceId: select.value || null }),
                { signal: events.signal },
              );
              bindFocus(select, { kind: "equipment", characterId: member.id, slot: field.slot });
              label.append(select);
              copy.append(label);
            }
          }
        const nav = requiredElement<HTMLElement>(root, ".campaign-commands");
        for (const command of frame.commands) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = command.label;
          button.className = command.primary ? "campaign-command is-primary" : "campaign-command";
          button.disabled = "waiting" in frame && frame.waiting;
          button.addEventListener("click", () => send({ type: "command", command: command.command }), {
            signal: events.signal,
          });
          bindFocus(button, { kind: "command", command: command.command });
          nav.append(button);
        }
        if (frame.kind === "party") {
          const panel = document.createElement("section");
          panel.className = "party-editor";
          requiredElement<HTMLElement>(root, ".campaign-content").replaceChildren(panel);
          party = createPartyView(panel, (event) => send({ type: "party", event }));
          disposeChild = party.dispose;
        }
        window.addEventListener(
          "keydown",
          (event) => {
            if (event.key === "Escape" && send({ type: "escape" })) event.preventDefault();
          },
          { signal: events.signal },
        );
      }
      if (frame.kind === "home") {
        const carry = requiredElement<HTMLInputElement>(root, ".item-carry-input");
        const value = frame.carry.quantity === null ? "" : String(frame.carry.quantity);
        if (carry.value !== value) carry.value = value;
      }
      if (frame.kind === "party") party?.render(frame.party);
      const key = JSON.stringify(frame.focus);
      if (key !== appliedFocus) {
        appliedFocus = key;
        if (frame.focus) focusElements.get(focusKey(frame.focus))?.focus();
      }
    },
    reportCarryValidity() {
      root.querySelector<HTMLInputElement>(".item-carry-input")?.reportValidity();
    },
    dispose: clear,
  };
}
