<script lang="ts">
let { ready, error, message }: { ready: boolean; error: boolean; message: string } = $props();
</script>
<div class="loading" class:sr-only={ready} role="status" data-status data-error={error ? "true" : undefined}>
  {message}
</div>
