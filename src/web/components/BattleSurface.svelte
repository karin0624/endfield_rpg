<script lang="ts">
let {
  ready,
  error,
  message,
  label = "3Dの地面に立つロッシ、ギルベルタ、青いスライム2体",
}: { ready: boolean; error: boolean; message: string; label?: string } = $props();
</script>
<main class="battle-screen">
  <div class="game-board" data-board>
    <section class="stage" aria-label="荒野の戦闘画面">
      <canvas aria-label={label} data-ready={ready ? "true" : undefined}></canvas>
      <div class="loading" class:sr-only={ready} role="status" data-status data-error={error ? "true" : undefined}>
        {message}
      </div>
    </section>
  </div>
</main>
