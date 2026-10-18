<script lang="ts">
import type { AdventureFrame } from "../../../presentation/adventureProjection";
import ConversationChoice from "../ConversationChoice/ConversationChoice.svelte";
import DialoguePanel from "../DialoguePanel/DialoguePanel.svelte";

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
      <ConversationChoice {option} {choose} {focused} />
    {/each}
  </div>
  <DialoguePanel type={scene?.type ?? "choice"} speaker={scene?.speaker ?? ""} text={scene?.text ?? ""} />
</div>
