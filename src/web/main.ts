import { initialGameOptions } from "../content/initialGameOptions";
import { createInitialGameState } from "../game/createInitialGameState";
import "./style.css";

const state = createInitialGameState(initialGameOptions);
const app = document.querySelector<HTMLDivElement>("#app");

if (app === null) {
  throw new Error("#app が見つかりません");
}

app.innerHTML = `
  <main class="game-shell">
    <p class="eyebrow">RPG PROTOTYPE</p>
    <h1>endfield_rpg</h1>
    <p>ゲーム本体とブラウザ表示の接続を確認する最小画面です。</p>
    <dl class="status-card">
      <div>
        <dt>開始地点</dt>
        <dd data-game-mode>${state.mode}</dd>
      </div>
      <div>
        <dt>フラグ数</dt>
        <dd>${state.flags.length}</dd>
      </div>
    </dl>
  </main>
`;
