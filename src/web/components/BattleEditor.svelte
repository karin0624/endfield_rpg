<script lang="ts">
import { onMount } from "svelte";
import type { BattleEditorEvent, BattleEditorFocus, projectBattleEditor } from "../../presentation/battleEditorModel";
import { settingsFields } from "../../presentation/battleSettings";
import SettingsFields from "./SettingsFields.svelte";

let {
  app,
  part,
  frame,
  emit,
  finish,
}: {
  app: HTMLElement;
  part: "header" | "panel" | "back";
  frame: ReturnType<typeof projectBattleEditor> | null;
  emit: (event: BattleEditorEvent) => boolean;
  finish: () => void;
} = $props();
const focused = (target: BattleEditorFocus) => emit({ type: "focused", target }),
  blurred = (target: BattleEditorFocus) => emit({ type: "blurred", target });
let focus = $derived(frame?.focus);
$effect(() => {
  if (part === "header") document.body.classList.toggle("previewing", frame?.preview ?? false);
});
$effect(() => {
  if (part !== "header" || !focus) return;
  const selector =
    focus.kind === "field"
      ? `.editor-panel input[data-key="${focus.key}"][type="${focus.control}"]`
      : `[data-editor-focus="${focus.kind}"]`;
  const node = app.querySelector<HTMLElement>(selector);
  if (node && node !== document.activeElement) node.focus();
});
onMount(() => {
  if (part !== "header") return;
  const key = (event: KeyboardEvent) => {
    if (emit({ type: "key", key: event.key, shift: event.shiftKey })) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  app.addEventListener("keydown", key);
  return () => {
    app.removeEventListener("keydown", key);
    document.body.classList.remove("previewing");
  };
});
</script>
{#if frame}
  {#if part === "header"}
    <header class="editor-header">
      <div>
        <p class="eyebrow">DEVELOPMENT / COMPOSITION</p>
        <h1>戦闘画面の構図</h1>
      </div>
      <div class="header-actions">
        <a
          href={`${import.meta.env.BASE_URL}?debug=1&battle=1`}
          data-editor-focus="normal"
          onfocus={() => focused({ kind: "normal" })}
          onblur={() => blurred({ kind: "normal" })}
          >保存済みの通常表示</a
        ><button
          type="button"
          data-preview
          data-editor-focus="preview"
          onclick={() => emit({ type: "preview" })}
          onfocus={() => focused({ kind: "preview" })}
          onblur={() => blurred({ kind: "preview" })}
        >
          画面だけで確認
        </button>
      </div>
    </header>
  {:else if part === "back"}
    <button
      type="button"
      class="preview-back"
      data-editor-focus="preview-back"
      onclick={() => emit({ type: "preview-back" })}
      onfocus={() => focused({ kind: "preview-back" })}
      onblur={() => blurred({ kind: "preview-back" })}
    >
      設定に戻る
    </button>
  {:else}
    <aside class="editor-panel" aria-label="構図設定">
      <div class="save-panel">
        <button
          type="button"
          class="primary"
          data-save
          data-editor-focus="save"
          disabled={!frame.canSave}
          onclick={() => emit({ type: "save" })}
          onfocus={() => focused({ kind: "save" })}
          onblur={() => blurred({ kind: "save" })}
        >
          標準として保存
        </button>
        <!-- biome-ignore lint/a11y/useSemanticElements: This visual group retains the approved layout; its controls have labels. -->
        <div role="group" class="preview-counts" aria-label="確認人数">
          <span>確認人数：</span>
          {#each ["ally", "enemy"] as team, index}
            {#if index}
              <span>・</span>
            {/if}
            <label
              >{team === "ally" ? "味方" : "敵"}<select
                data-preview-ally-count={team === "ally" ? "" : undefined}
                data-preview-enemy-count={team === "enemy" ? "" : undefined}
                data-editor-focus={`${team}-count`}
                aria-label={`${team === "ally" ? "味方" : "敵"}の確認人数`}
                value={String(frame.counts[team as "ally" | "enemy"])}
                onchange={(event) => emit({ type: "count", team: team as "ally" | "enemy", count: Number(event.currentTarget.value) as 1 | 2 })}
                onfocus={() => focused({ kind: team === "ally" ? "ally-count" : "enemy-count" })}
                onblur={() => blurred({ kind: team === "ally" ? "ally-count" : "enemy-count" })}
              >
                <option value="1">1</option>
                <option value="2">2</option>
              </select></label
            >
          {/each}
        </div>
        <p class="field-help preview-count-help">
          確認人数を変えても、編集中の配置ルールはその陣営の全人数に適用されます。
        </p>
        <p class="editor-message" role="status" data-message class:error={frame.error}>{frame.message}</p>
        <div class="secondary-actions">
          <button
            type="button"
            data-revert
            data-editor-focus="revert"
            disabled={!frame.canRevert}
            onclick={() => emit({ type: "revert" })}
            onfocus={() => focused({ kind: "revert" })}
            onblur={() => blurred({ kind: "revert" })}
          >
            保存済みに戻す
          </button><button
            type="button"
            data-export
            data-editor-focus="export"
            disabled={!frame.canExport}
            onclick={() => emit({ type: "export" })}
            onfocus={() => focused({ kind: "export" })}
            onblur={() => blurred({ kind: "export" })}
          >
            JSONを書き出す
          </button>
        </div>
      </div>
      <div class="settings-fields">
        <SettingsFields
          fields={settingsFields}
          prefix=""
          current={frame.current}
          raw={frame.raw}
          invalid={frame.invalid}
          enabled={frame.inputsEnabled}
          emit={(key, raw) => emit({ type: "field", key, raw })}
          focused={(key, control) => focused({ kind: "field", key, control })}
          blurred={(key, control) => blurred({ kind: "field", key, control })}
          {finish}
        />
      </div>
    </aside>
  {/if}
{/if}
