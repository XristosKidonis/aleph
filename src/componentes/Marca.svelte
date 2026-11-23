<script>
  // Marca Aleph: la alef + ALEPH del tablero del dueño, en vector y en el color de la tinta. Sin filtros, sombras
  // ni texturas. La normal (cabecera) es horizontal. La «grande» (Inicio y arranque) trae los dos armados: apilada
  // en Blanco y horizontal en Imprenta y Editorial; cuál se ve lo decide skins.css.
  import { ALEF, PALABRA, HORIZONTAL, APILADA } from '../lib/marcaAleph.js';
  let { grande = false } = $props();
  const pieza = ([x, y, esc]) => `translate(${x} ${y}) scale(${esc})`;
</script>

{#snippet armado(a, clase)}
  <svg class="marca-logo {clase}" viewBox="0 0 {a.ancho} {a.alto}" aria-hidden="true">
    <path fill-rule="evenodd" transform={pieza(a.alef)} d={ALEF.d} />
    <path fill-rule="evenodd" transform={pieza(a.palabra)} d={PALABRA.d} />
  </svg>
{/snippet}

{#if grande}
  <div class="marca-grande" role="img" aria-label="Aleph">
    {@render armado(APILADA, 'marca-apilada')}
    {@render armado(HORIZONTAL, 'marca-horizontal')}
  </div>
{:else}
  <span class="marca" aria-hidden="true">{@render armado(HORIZONTAL, 'marca-horizontal')}</span>
{/if}
