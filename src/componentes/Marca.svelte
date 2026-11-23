<script>
  // Marca Aleph: la alef + ALEPH del tablero del dueño, en vector y en el color de la tinta. Sin filtros, sombras
  // ni texturas. «grande» es la versión del inicio; la normal va en la cabecera.
  import { LOGO, SIMBOLO_EN_LOGO, NOMBRE_EN_LOGO } from '../lib/marcaAleph.js';
  let { grande = false } = $props();
</script>

{#if grande}
  <div class="marca-grande" role="img" aria-label="Aleph">
    <svg class="marca-logo" viewBox="0 0 {LOGO.ancho} {LOGO.alto}" aria-hidden="true"><path fill-rule="evenodd" d={SIMBOLO_EN_LOGO} /><path fill-rule="evenodd" d={NOMBRE_EN_LOGO} /></svg>
  </div>
{:else}
  <span class="marca" aria-hidden="true">
    <svg class="marca-logo" viewBox="0 0 {LOGO.ancho} {LOGO.alto}"><path fill-rule="evenodd" d={SIMBOLO_EN_LOGO} /><path fill-rule="evenodd" d={NOMBRE_EN_LOGO} /></svg>
  </span>
{/if}
