<script lang="ts">
import type { AdventureFrame } from "../../presentation/adventureProjection";

let {
  scene,
  advance,
  choose,
  focused,
}: {
  scene: AdventureFrame["scene"];
  advance: () => void;
  choose: (id: string) => void;
  focused: (id: string) => void;
} = $props();
const assetUrl = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;
</script>
<!-- The synchronous screen model handles the documented window keyboard commands. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<!-- biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: Screen-level keyboard commands are handled by its pure model. -->
<div class="conversation-stage" data-conversation-stage data-scene-type={scene?.type ?? "line"} onclick={advance}>
  <div class="conversation-portraits" data-conversation-portraits aria-hidden="true">
    {#each scene?.portraits ?? [] as portrait (portrait.id)}
      <figure
        class="conversation-portrait"
        class:is-speaking={portrait.speaking}
        class:is-muted={!portrait.speaking}
        data-portrait-id={portrait.id}
        data-position={portrait.position}
      >
        {#if portrait.path}
          <img src={assetUrl(portrait.path)} alt="" decoding="async">
        {/if}
      </figure>
    {/each}
  </div>
  <!-- biome-ignore lint/a11y/useSemanticElements: Dynamic conversation choices retain their approved layout and native buttons. -->
  <div
    role="group"
    class="conversation-choices"
    data-conversation-choices
    aria-label="選択肢"
    hidden={!scene?.choices.length}
  >
    {#each scene?.choices ?? [] as option (option.id)}
      <button
        type="button"
        class="conversation-choice"
        data-option-id={option.id}
        onclick={(event) => {
  event.stopPropagation();
  choose(option.id);
}}
        onfocus={() => focused(option.id)}
      >
        <svg class="choice-tetrahedron" viewBox="0 0 32 32" aria-hidden="true">
          <polygon points="30,16 4,3 4,29" fill="#394438" stroke="#f0b84a" stroke-width="1.5" />
          <path d="M30 16H4M4 3l12 13L4 29" fill="none" stroke="#f0b84a" stroke-width="1.2" />
        </svg><span class="choice-number">{option.number}</span><span class="choice-label">{option.label}</span>
      </button>
    {/each}
  </div>
  <div class="dialogue-panel" data-dialogue-panel aria-live="polite">
    <div class="dialogue-speaker" data-speaker>{scene?.speaker ?? ""}</div>
    <div class="dialogue-divider"></div>
    <p class="dialogue-text" data-dialogue-text>{scene?.text ?? ""}</p>
    <span class="dialogue-next" data-dialogue-next aria-hidden="true" hidden={scene?.type !== "line"}></span>
  </div>
</div>
