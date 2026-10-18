<script lang="ts">
import type { projectTownShop, TownEvent } from "../../../presentation/townModel";
import ShopDialog from "../ShopDialog/ShopDialog.svelte";
import ShopTrigger from "../ShopTrigger/ShopTrigger.svelte";

let { frame, send }: { frame: ReturnType<typeof projectTownShop>; send: (event: TownEvent) => boolean } = $props();
let trigger = $state<HTMLButtonElement>();
$effect(() => {
  if (frame.focus === "trigger" && trigger && trigger !== document.activeElement) trigger.focus();
});
</script>
<ShopTrigger visible={frame.visible} bind:element={trigger} onclick={() => send({ type: "shop-open" })} />
<ShopDialog {frame} {send} />
