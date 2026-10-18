<script lang="ts">
import type { BattleModelEvent } from "../../../presentation/battleModel";
import type { BattleHudFrame } from "../../../presentation/battleViewProjection";
import BattleItemBack from "../BattleItemBack/BattleItemBack.svelte";
import BattleItemTarget from "../BattleItemTarget/BattleItemTarget.svelte";
import BattleItemUse from "../BattleItemUse/BattleItemUse.svelte";
import "../../items.css";

let { items, dispatch }: { items: BattleHudFrame["items"]; dispatch: (event: BattleModelEvent) => boolean } = $props();
const controlId = $props.id();
</script>
<section class="item-dialog battle-item-dialog" aria-label="HP回復品の使用">
  <h2>HP回復品</h2>
  <p>生存中の味方1人のHPを回復します。精神疲労は増えません。</p>
  <label for={controlId}
    >対象<BattleItemTarget id={controlId} value={items.targetId} options={items.targets} {dispatch} /></label
  >
  <p data-item-preview role="status">{items.preview}</p>
  <div class="item-actions">
    <BattleItemUse enabled={items.useEnabled} {dispatch} /><BattleItemBack {dispatch} />
  </div>
</section>
