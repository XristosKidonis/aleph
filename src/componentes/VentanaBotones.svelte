<script module>
  import { esTauri } from '../lib/bd.js';
  // La ventana no tiene el marco del sistema (tauri.conf: decorations false): cerrar, minimizar y maximizar
  // viven dentro de la app, como tres discos en la tinta del aspecto. El lado sigue al sistema: en Mac a la
  // izquierda (× – +), en Windows y Linux a la derecha con cerrar en la esquina (– + ×). En la web no hay botones.
  export const hayVentana = esTauri;
  export const ladoVentana = typeof navigator !== 'undefined' && /Macintosh|Mac OS X/.test(navigator.userAgent) ? 'izquierda' : 'derecha';
</script>

<script>
  import { onMount } from 'svelte';
  import { t } from '../lib/i18n.svelte.js';

  const ORDEN = ladoVentana === 'izquierda' ? ['cerrar', 'min', 'max'] : ['min', 'max', 'cerrar'];
  const SIGNO = { cerrar: 'M3.9 3.9l4.2 4.2M8.1 3.9l-4.2 4.2', min: 'M3.4 6h5.2', max: 'M6 3.4v5.2M3.4 6h5.2' };
  const ETIQUETA = { cerrar: 'vn.cerrar', min: 'vn.minimizar', max: 'vn.maximizar' };

  let ventana = null;
  let atras = $state(false); // la ventana en segundo plano: los discos se aclaran, como en el Mac

  onMount(() => {
    let soltar = () => {};
    let vivo = true;
    import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      if (!vivo) return;
      ventana = getCurrentWindow();
      const fuera = await ventana.onFocusChanged(({ payload }) => { atras = !payload; });
      if (vivo) soltar = fuera; else fuera();
    });
    return () => { vivo = false; soltar(); };
  });

  const ACCION = { cerrar: () => ventana?.close(), min: () => ventana?.minimize(), max: () => ventana?.toggleMaximize() };
</script>

{#if hayVentana}
  <div class="ventana-botones" class:atras role="group" aria-label={t('vn.aria')}>
    {#each ORDEN as k (k)}
      <button type="button" aria-label={t(ETIQUETA[k])} title={t(ETIQUETA[k])} onclick={ACCION[k]}>
        <svg viewBox="0 0 12 12" aria-hidden="true"><circle class="disco" cx="6" cy="6" r="6" /><path class="signo" d={SIGNO[k]} /></svg>
      </button>
    {/each}
  </div>
{/if}
