import { type ComponentProps, mount, tick } from "svelte";
import {
  type CampaignContext,
  type CampaignModel,
  campaignMachine,
  createCampaignModel,
  reduceCampaign,
} from "../../src/presentation/campaignModel";
import { projectCampaign } from "../../src/presentation/campaignProjection";
import { createCampaignView } from "../../src/web/campaignView.svelte.ts";
import HubCalendar from "../../src/web/components/HubCalendar.svelte";
import HubScene from "../../src/web/components/HubScene.svelte";
import IllustratedAction from "../../src/web/components/IllustratedAction.svelte";
import { returnedCampaign } from "./returned-campaign";
import "../../src/web/hub.css";

function campaignState(name: string): CampaignModel {
  const initial = createCampaignModel();
  const context = initial.context;
  const commandFocus = (command: string) => ({ kind: "command" as const, command });
  const resolve = (value: CampaignModel["value"], patch: Partial<CampaignContext> = {}) =>
    campaignMachine.resolveState({ value, context: { ...context, ...patch } });
  switch (name) {
    case "title":
      return initial;
    case "title-loading":
      return resolve("loading");
    case "title-no-save":
      return resolve("title", { message: "保存データがありません。" });
    case "title-read-error":
      return resolve("title", { message: "読み込めませんでした。ブラウザの保存領域を確認してください。" });
    case "title-invalid-save":
      return resolve("title", { message: "保存データを読み込めませんでした。" });
    case "title-unsupported-save":
      return resolve("title", { message: "対応していない保存データです。" });
    case "title-saved":
      return resolve("title", { message: "保存しました。" });
    case "introduction":
      return resolve("intro");
    case "new-game-confirmation":
      return resolve("confirm", { confirmation: "new-game", focus: commandFocus("cancel") });
    case "home":
      return resolve("home");
    case "home-menu":
      return resolve("home", { hubPanel: "menu", focus: commandFocus("save") });
    case "home-title-options":
      return resolve("home", { hubPanel: "title-options", focus: commandFocus("close-panel") });
    case "home-save-confirmation":
    case "home-save-title-confirmation":
      return resolve("confirm", {
        confirmation: name === "home-save-confirmation" ? "save" : "save-title",
        focus: commandFocus("cancel"),
      });
    case "home-discard-confirmation":
      return resolve("confirm", { confirmation: "title", focus: commandFocus("cancel") });
    case "home-saving":
    case "home-saving-title":
      return resolve("saving", { confirmation: name === "home-saving" ? "save" : "save-title" });
    case "home-saved":
      return resolve("home", { message: "保存しました。", focus: commandFocus("menu") });
    case "home-save-failure":
      return resolve("home", {
        message: "保存できませんでした。ブラウザの保存領域を確認してください。",
        focus: commandFocus("menu"),
      });
    case "home-returned":
      return resolve("home", { game: returnedCampaign.game, completion: returnedCampaign.completion });
    case "home-resumed":
      return resolve("home", { game: returnedCampaign.game, message: "読み込みました。" });
    case "destinations":
      return resolve("destinations");
    case "town":
      return resolve("town", { focus: { kind: "town-place", placeId: context.game.adventure.currentPlaceId } });
    case "town-menu":
      return resolve("town", { hubPanel: "menu", focus: commandFocus("title-options") });
    case "town-title-options":
      return resolve("town", { hubPanel: "title-options", focus: commandFocus("close-panel") });
    case "town-discard-confirmation":
      return resolve("confirm", { confirmation: "title", confirmOrigin: "town", focus: commandFocus("cancel") });
    case "town-after-activity": {
      let state = initial;
      for (const command of ["new-game", "accept", "home", "destinations", "town"] as const)
        state = reduceCampaign(state, { type: "command", command }).state;
      state = reduceCampaign(state, { type: "town", event: { type: "select", placeId: "market" } }).state;
      return reduceCampaign(state, { type: "town", event: { type: "advance" } }).state;
    }
    default:
      throw new Error(`Unknown Campaign design screen: ${name}`);
  }
}

function screen(root: HTMLElement, props: Record<string, unknown>) {
  const snapshot = campaignState(String(props.state ?? "home"));
  if (!(root instanceof HTMLDivElement)) throw new Error("Campaign design root must be a div");
  createCampaignView(root, () => false).render(projectCampaign(snapshot));
}

// Artwork masters are verified against the actual production component's part.
// Visibility preserves the source DOM geometry, inheritance and native rendering.
function isolate(root: HTMLElement, selectors: string) {
  const targets = [...root.querySelectorAll<HTMLElement | SVGElement>(selectors)];
  if (!targets.length) throw new Error(`Missing Campaign design part: ${selectors}`);
  for (const element of root.querySelectorAll<HTMLElement | SVGElement>("*"))
    if (!targets.some((target) => target === element || target.contains(element))) element.style.visibility = "hidden";
  for (const target of targets) target.style.visibility = "visible";
}

function illustratedAction(root: HTMLElement, props: Record<string, unknown>) {
  root.className = "hub-scene";
  root.style.cssText = "min-height:0;width:max-content;padding:32px";
  mount(IllustratedAction, {
    target: root,
    props: {
      id: String(props.id ?? "design-action"),
      label: String(props.label ?? "仲間"),
      picture: String(props.picture ?? "companions") as ComponentProps<typeof IllustratedAction>["picture"],
      round: props.round === true,
      movement: props.movement === true,
      onclick: () => {},
    },
  });
}

function hubScene(root: HTMLElement, props: Record<string, unknown>) {
  mount(HubScene, {
    target: root,
    props: {
      scene: String(props.scene ?? "home") as ComponentProps<typeof HubScene>["scene"],
      calendar: String(props.calendar ?? "1日目 · 昼"),
      feedback: Array.isArray(props.feedback) ? props.feedback.map(String) : [],
      places: ["guild", "town-square", "market", "find-companion"].map((id) => ({ id, label: id })),
      command: () => {},
    },
  });
}

export const cases: Record<string, (root: HTMLElement, props: Record<string, unknown>) => void | Promise<void>> = {
  screen,
  async "screen-part"(root, props) {
    screen(root, props);
    await tick();
    isolate(root, String(props.selector));
  },
  async "ui-action"(root, props) {
    screen(root, props);
    await tick();
    const selector = String(props.selector ?? '[data-command="cancel"]');
    const buttons = root.querySelectorAll<HTMLButtonElement>(selector);
    if (buttons.length !== 1) throw new Error(`Expected one real Hub action: ${selector}`);
    const button = buttons[0];
    const width = button.getBoundingClientRect().width;
    // A standalone fixture keeps the real node, handlers and source styling.
    // The host supplies the same available width as its production grid cell.
    root.className = "hub-scene";
    root.style.cssText = `display:grid;min-height:0;width:${width + 64}px;padding:32px`;
    root.replaceChildren(button);
  },
  "illustrated-action": illustratedAction,
  illustrated: illustratedAction,
  async "illustrated-action-part"(root, props) {
    illustratedAction(root, props);
    await tick();
    const part = String(props.part ?? "frame");
    if (part !== "frame" && part !== "picture") throw new Error(`Unknown IllustratedAction part: ${part}`);
    isolate(root, part === "frame" ? ".frame-art" : ".glyph");
  },
  "hub-scene": hubScene,
  async feedback(root, props) {
    const text = String(props.text ?? "出撃者のHPが全回復しました。\nロッシ · 精神疲労 8（なし）");
    hubScene(root, { scene: "home", feedback: [text] });
    await tick();
    isolate(root, ".result");
    if (props.scrollTop !== undefined) {
      await document.fonts.ready;
      const result = root.querySelector<HTMLElement>(".result");
      if (!result) throw new Error("Missing real Hub feedback region");
      result.scrollTop = Number(props.scrollTop);
    }
  },
  async "hub-scene-part"(root, props) {
    hubScene(root, props);
    await tick();
    isolate(root, String(props.selector));
  },
  calendar(root, props) {
    root.className = "hub-scene";
    root.style.cssText = "min-height:0;width:max-content;padding:32px";
    mount(HubCalendar, { target: root, props: { calendar: String(props.calendar ?? "1日目 · 昼") } });
  },
};
