import { createBattleScene } from "./battleScene";
import savedSettings from "./battle-settings.json";
import { parseBattleSettings } from "./battleSettings";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");
if (app === null) throw new Error("#app が見つかりません");
const editing = import.meta.env.DEV && new URLSearchParams(location.search).get("edit") === "1";
document.body.classList.toggle("editing", editing);
app.innerHTML = `
  <main class="battle-screen">
    <section class="stage" aria-label="荒野の戦闘画面">
      <canvas aria-label="3Dの地面に立つロッシ、ギルベルタ、青いスライム2体"></canvas>
      <div class="loading" role="status" data-status>戦闘画面を読み込んでいます…</div>
    </section>
  </main>
`;
if (import.meta.env.DEV && !editing) {
  const link = document.createElement("a");
  link.className = "dev-link";
  link.href = "?edit=1";
  link.textContent = "構図設定";
  app.append(link);
}
const canvas = app.querySelector("canvas")!;
const status = app.querySelector<HTMLDivElement>("[data-status]")!;
const events = new AbortController();
let battle: ReturnType<typeof createBattleScene> | undefined;
let disposed = false;
let disposeEditor: (() => void) | undefined;

function dispose() {
  disposed = true;
  events.abort();
  disposeEditor?.();
  battle?.dispose();
}
window.addEventListener("pagehide", event => {
  if (!event.persisted) dispose();
}, { signal: events.signal });
if (import.meta.hot) import.meta.hot.dispose(dispose);

try {
  const settings = parseBattleSettings(savedSettings);
  battle = createBattleScene(canvas, settings);
  await battle.ready;
  if (!disposed) {
    status.textContent = "表示準備完了";
    status.classList.add("sr-only");
    canvas.dataset.ready = "true";
    if (editing) {
      // Viteの配布ビルドでは、この分岐と設定UIのコードを含めない。
      const { mountBattleEditor } = await import("./battleEditor");
      if (!disposed) disposeEditor = mountBattleEditor(app, battle, settings);
    }
  }
} catch (error) {
  if (!disposed) {
    console.error(error);
    battle?.dispose();
    status.textContent = "戦闘画面を読み込めませんでした。素材の取得とWebGL対応を確認して、再読み込みしてください。";
    status.dataset.error = "true";
  }
}
