import "./style.css";

// Normal distribution excludes the debug entry, even when its URL is supplied.
if (
  (import.meta.env.DEV || import.meta.env.MODE === "debug") &&
  new URLSearchParams(location.search).get("debug") === "1"
) {
  document.body.dataset.mode = "debug";
  const badge = document.createElement("aside");
  badge.className = "debug-mode-badge";
  badge.innerHTML = 'デバッグモード · 通常版とは別の保存スロット <a href="?">タイトルへ</a>';
  if (
    !["battle", "dungeon", "edit", "adventureEdit"].some((key) => new URLSearchParams(location.search).get(key) === "1")
  )
    document.body.prepend(badge);
  document.title = "デバッグ · ENDFIELD RPG";
  await import("./debugMain");
} else {
  document.body.dataset.mode = "game";
  const { mountCampaign } = await import("./campaignUi");
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) throw new Error("#app が見つかりません");
  const dispose = mountCampaign(app);
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) dispose();
  });
  if (import.meta.hot) import.meta.hot.dispose(dispose);
}
