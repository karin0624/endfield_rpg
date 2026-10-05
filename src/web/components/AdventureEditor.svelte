<script lang="ts">
import { onMount } from "svelte";
import type {
  AdventureEditorEvent,
  AdventureEditorFocus,
  projectAdventureEditor,
} from "../../presentation/adventureEditorModel";
import { adventureSettingsFields } from "../../presentation/adventureSettings";
import SettingsFields from "./SettingsFields.svelte";

let {
  app,
  frame,
  emit,
}: {
  app: HTMLElement;
  frame: ReturnType<typeof projectAdventureEditor> | null;
  emit: (event: AdventureEditorEvent) => boolean;
} = $props();
let focus = $derived(frame?.focus);
const focused = (target: AdventureEditorFocus) => emit({ type: "focused", target }),
  blurred = (target: AdventureEditorFocus) => emit({ type: "blurred", target });
$effect(() => {
  document.body.classList.toggle("adventure-previewing", frame?.preview ?? false);
});
$effect(() => {
  if (!focus) return;
  const selector =
    focus.kind === "field"
      ? `.adventure-editor-panel input[data-key="${focus.key}"][type="${focus.control}"]`
      : `[data-editor-focus="${focus.kind}"]`;
  const node = app.querySelector<HTMLElement>(selector);
  if (node && node !== document.activeElement) node.focus();
});
onMount(() => {
  const key = (event: KeyboardEvent) => {
    if (emit({ type: "key", key: event.key, shift: event.shiftKey })) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  app.addEventListener("keydown", key);
  return () => {
    app.removeEventListener("keydown", key);
    document.body.classList.remove("adventure-previewing");
  };
});
</script>
{#if frame}
  <aside class="adventure-editor-panel" aria-label="会話画面の配置設定">
    <header>
      <p class="adventure-eyebrow">DEVELOPMENT / CONVERSATION</p>
      <h1>会話画面の配置</h1>
      <a
        href={`${import.meta.env.BASE_URL}?debug=1`}
        data-editor-focus="normal"
        onfocus={() => focused({ kind: "normal" })}
        onblur={() => blurred({ kind: "normal" })}
        >保存済みの通常表示</a
      >
    </header>
    <div class="adventure-editor-actions">
      {#each [
   { kind: "preview", label: "画面だけで確認" },
   { kind: "save", label: "標準として保存" },
   { kind: "revert", label: "保存済みに戻す" },
 ] as button (button.kind)}
        <button
          type="button"
          data-editor-focus={button.kind}
          data-preview-only={button.kind === "preview" ? "" : undefined}
          data-save={button.kind === "save" ? "" : undefined}
          data-revert={button.kind === "revert" ? "" : undefined}
          disabled={button.kind === "save" && !frame.canSave}
          onclick={() => emit({ type: button.kind as "preview" | "save" | "revert" })}
          onfocus={() => focused({ kind: button.kind as "preview" | "save" | "revert" })}
          onblur={() => blurred({ kind: button.kind as "preview" | "save" | "revert" })}
        >
          {button.label}
        </button>
      {/each}
      <p data-message role="status" class:error={frame.error}>{frame.message}</p>
      <p>画面をクリックして会話を送ると、別の話者や選択肢の配置も確認できます。</p>
    </div>
    <div class="adventure-editor-fields">
      <SettingsFields
        fields={adventureSettingsFields}
        prefix="adventure-"
        numberSuffix=""
        current={frame.current}
        raw={frame.raw}
        invalid={frame.invalid}
        enabled={frame.inputsEnabled}
        emit={(key, raw) => emit({ type: "field", key, raw })}
        focused={(key, control) => focused({ kind: "field", key, control })}
        blurred={(key, control) => blurred({ kind: "field", key, control })}
      />
    </div>
  </aside>
  <button
    class="adventure-preview-back"
    type="button"
    data-editor-focus="preview-back"
    onclick={() => emit({ type: "preview-back" })}
    onfocus={() => focused({ kind: "preview-back" })}
    onblur={() => blurred({ kind: "preview-back" })}
  >
    設定に戻る
  </button>
{/if}
