<script lang="ts" generics="Key extends string">
let {
  fields,
  prefix,
  numberSuffix = "-number",
  current,
  raw,
  invalid,
  enabled,
  emit,
  focused,
  blurred,
  finish = () => {},
}: {
  fields: readonly { key: Key; label: string; group: string; min: number; max: number; step: number }[];
  prefix: string;
  numberSuffix?: string;
  current: Readonly<Record<Key, number>>;
  raw: Readonly<Record<Key, string>>;
  invalid: readonly Key[];
  enabled: boolean;
  emit: (key: Key, raw: string) => void;
  focused: (key: Key, control: "number" | "range") => void;
  blurred: (key: Key, control: "number" | "range") => void;
  finish?: () => void;
} = $props();
</script>
{#each [...new Set(fields.map((field) => field.group))] as group (group)}
  <fieldset>
    <legend>{group}</legend>
    {#each fields.filter((field) => field.group === group) as field (field.key)}
      <div class="setting-field">
        <label for={`${prefix}${field.key}${numberSuffix}`}>{field.label}</label>
        <input
          id={`${prefix}${field.key}${numberSuffix}`}
          data-key={field.key}
          type="number"
          min={field.min}
          max={field.max}
          step={field.step}
          value={raw[field.key]}
          disabled={!enabled}
          aria-invalid={invalid.includes(field.key) ? "true" : undefined}
          oninput={(event) => emit(field.key, event.currentTarget.value)}
          onfocus={() => focused(field.key, "number")}
          onblur={() => blurred(field.key, "number")}
          onchange={finish}
        >
        <input
          aria-label={`${field.label} スライダー`}
          data-key={field.key}
          type="range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={invalid.includes(field.key) ? String(current[field.key]) : raw[field.key]}
          disabled={!enabled}
          aria-invalid={invalid.includes(field.key) ? "true" : undefined}
          oninput={(event) => emit(field.key, event.currentTarget.value)}
          onfocus={() => focused(field.key, "range")}
          onblur={() => blurred(field.key, "range")}
          onchange={finish}
        >
      </div>
    {/each}
    {#if group === "地面"}
      <p class="field-help">立ち位置は地面上の同じ地点に追従します。立ち絵の大きさは変わりません。</p>
    {:else if group === "遠景"}
      <p class="field-help">
        高さ・前後で地面との重なりを調整します。縦横比は固定です。前後は小さい値ほど奥へ動きます。
      </p>
    {:else if group === "味方の配置" || group === "敵の配置"}
      <p class="field-help">中心を固定し、人数に応じて隣への差分で均等に並べます。高さは地面から自動取得します。</p>
    {/if}
  </fieldset>
{/each}
