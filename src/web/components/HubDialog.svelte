<script lang="ts">
import HubAction from "./HubAction.svelte";
import "../hub.css";

let {
  panel,
  confirmation = null,
  scene = "home",
  waiting = false,
  command,
  focused,
}: {
  panel: "normal" | "menu" | "title-options" | "preparation" | null;
  confirmation?: string | null;
  scene?: "home" | "town" | "destinations";
  waiting?: boolean;
  command: (id: string) => void;
  focused?: (id: string) => void;
} = $props();
</script>

<div
  class="hub-dialog"
  class:command={panel === "menu"}
  role="dialog"
  aria-modal="true"
  aria-label={panel === "menu"
  ? "メニュー"
  : panel === "title-options"
    ? "タイトルへ戻りますか"
    : confirmation === "title"
      ? "未保存の変更を破棄しますか"
      : waiting
        ? "保存しています…"
        : "上書き保存しますか"}
>
  {#if panel === "menu"}
    <HubAction
      type="button"
      icon="close"
      data-command="close-panel"
      aria-label="メニューを閉じる"
      onclick={() => command("close-panel")}
      onfocus={() => focused?.("close-panel")}
    ></HubAction>
    <div class="stack">
      <HubAction
        type="button"
        data-command="save"
        disabled={scene === "town"}
        aria-describedby={scene === "town" ? "hub-save-reason" : undefined}
        onclick={() => command("save")}
        onfocus={() => focused?.("save")}
      >
        保存
      </HubAction>
      {#if scene === "town"}
        <p id="hub-save-reason">保存はホームで行えます。</p>
      {/if}
      <HubAction
        type="button"
        data-command="title-options"
        onclick={() => command("title-options")}
        onfocus={() => focused?.("title-options")}
      >
        タイトルへ
      </HubAction>
    </div>
  {:else if panel === "title-options"}
    <h2>タイトルへ戻りますか</h2>
    <p>未保存の変更は失われます。</p>
    <div class="stack">
      {#if scene === "town"}
        <p>保存はホームで行えます。</p>
      {/if}
      {#each [
   ["save-title", "保存してタイトルへ"],
   ["title", "保存せずタイトルへ"],
   ["close-panel", "取り消す"],
 ] as [id, label]}
        <HubAction
          type="button"
          data-command={id}
          disabled={scene === "town" && id === "save-title"}
          onclick={() => command(id)}
          onfocus={() => focused?.(id)}
          >{label}</HubAction
        >
      {/each}
    </div>
  {:else}
    <h2>
      {confirmation === "title" ? "未保存の変更を破棄しますか" : waiting ? "保存しています…" : "上書き保存しますか"}
    </h2>
    <div class="buttons">
      <HubAction
        type="button"
        data-command="cancel"
        disabled={waiting}
        onclick={() => command("cancel")}
        onfocus={() => focused?.("cancel")}
      >
        取り消す
      </HubAction>
      <HubAction
        type="button"
        primary
        data-command="accept"
        disabled={waiting}
        onclick={() => command("accept")}
        onfocus={() => focused?.("accept")}
      >
        {confirmation === "title" ? "タイトルへ戻る" : "保存"}
      </HubAction>
    </div>
  {/if}
</div>
