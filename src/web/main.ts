import "./style.css";

// Normal distribution excludes the debug entry, even when its URL is supplied.
if (
  (import.meta.env.DEV || import.meta.env.MODE === "debug") &&
  new URLSearchParams(location.search).get("debug") === "1"
) {
  document.body.dataset.mode = "debug";
  if (
    !["battle", "dungeon", "edit", "adventureEdit"].some((key) => new URLSearchParams(location.search).get(key) === "1")
  ) {
    const { mount } = await import("svelte");
    const { default: DebugBadge } = await import("./components/DebugBadge.svelte");
    mount(DebugBadge, { target: document.body, anchor: document.body.firstChild ?? undefined });
  }
  document.title = "デバッグ · ENDFIELD RPG";
  await import("./debugMain");
} else {
  document.body.dataset.mode = "game";
  const events = new AbortController();
  let close: (() => void) | undefined;
  const dispose = () => {
    events.abort();
    close?.();
    close = undefined;
  };
  window.addEventListener(
    "pagehide",
    (event) => {
      if (!event.persisted) dispose();
    },
    { signal: events.signal },
  );
  if (import.meta.hot) import.meta.hot.dispose(dispose);
  const { mountCampaign } = await import("./campaignUi");
  if (!events.signal.aborted) {
    const app = document.querySelector<HTMLDivElement>("#app");
    if (!app) throw new Error("#app が見つかりません");
    close = mountCampaign(app);
  }
}
