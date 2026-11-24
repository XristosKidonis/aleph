<script>
  // Inicio: la pausa entre abrir la app y abrir un libro. La marca Aleph grande y las cinco entradas.
  // Sin fotos, sin cifras, sin rachas. Un único detalle cultural: una lámina mínima en el margen.
  import { onMount } from 'svelte';
  import Marca from './Marca.svelte';
  import { ui, irA, abrirVista } from '../lib/ui.svelte.js';
  import { usuario } from '../lib/usuario.svelte.js';
  import { nombreRef, desclave } from '../lib/libros.js';
  import { dibujarLamina } from '../lib/laminas.js';
  import { dia, cargarVersoDelDia, laminaDelDia } from '../lib/versoDelDia.svelte.js';
  import { t } from '../lib/i18n.svelte.js';
  import { parallax } from '../lib/parallax.js';

  const pos = $derived(usuario.ajustes.pos);
  // quien todavía no ha leído nada (ni se ha movido de Génesis 1) recibe una sugerencia: empezar por Juan
  const primeraVez = $derived(!Object.keys(usuario.leidos).length && pos.libro === 1 && pos.cap === 1);
  let miniatura = $state('');

  // «Un día como hoy»: una nota escrita en esta misma fecha (±1 día) hace uno o más años. Sin cifras ni
  // insistencia: si no hay ninguna, no aparece nada. Las notas ya vienen de la más nueva a la más vieja.
  const recuerdo = $derived.by(() => {
    const hoy = new Date();
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
    for (const n of usuario.notas) {
      const d = new Date(Number(n.creada));
      const anos = hoy.getFullYear() - d.getFullYear();
      if (anos < 1 || !String(n.texto || '').trim()) continue;
      if (Math.abs(new Date(hoy.getFullYear(), d.getMonth(), d.getDate()).getTime() - inicioHoy) > 864e5) continue;
      const r = desclave(n.ref);
      const texto = n.texto.trim().replace(/\s+/g, ' ');
      return { ...r, anos, ref: nombreRef(r.libro, r.cap, r.v), texto: texto.length > 90 ? `${texto.slice(0, 88).trimEnd()}…` : texto };
    }
    return null;
  });

  onMount(() => { cargarVersoDelDia(); });

  // la lámina del día, en Aura y en miniatura; en gris hasta que se pasa el cursor
  $effect(() => {
    if (!dia.texto) return;
    const base = laminaDelDia();
    let vivo = true;
    const c = document.createElement('canvas');
    dibujarLamina(c, { ...base, estilo: 'aura', formato: 'post', escala: 0.16 }).then(() => {
      if (vivo) miniatura = c.toDataURL('image/jpeg', 0.85);
    });
    return () => { vivo = false; };
  });

  // las cinco puertas de la app; por defecto en el mismo orden que la cabecera. El seteo de la primera vez
  // puede subir Historia o Láminas al segundo lugar (ajuste ordenInicio).
  const PUERTAS = {
    continuar: () => irA(pos.libro, pos.cap),
    biblioteca: () => abrirVista('biblioteca'),
    archivo: () => abrirVista('archivo'),
    laminas: () => abrirVista('laminas'),
    historia: () => abrirVista('historia'),
  };
  const ENTRADAS = $derived.by(() => {
    const orden = usuario.ajustes.ordenInicio;
    const ids = Array.isArray(orden) && orden.length === 5 && new Set(orden).size === 5 && orden.every((id) => PUERTAS[id]) ? orden : Object.keys(PUERTAS);
    return ids.map((id) => [`ini.${id}`, PUERTAS[id]]);
  });

  function verLaminas() {
    abrirVista('laminas');
    ui.coleccion = 'tipografia';
  }
</script>

{#snippet saludo()}
  {#if usuario.ajustes.nombre}<span class="inicio-saludo">{t('ini.hola', { n: usuario.ajustes.nombre })}</span>{/if}
{/snippet}

<section class="inicio" use:parallax class:llega={ui.llegada} aria-label={t('vista.inicio')} onanimationend={() => (ui.llegada = false)}>
  <div class="inicio-centro">
    <div class="inicio-edicion" aria-hidden="true">{t('ini.edicion')}</div>
    <Marca grande />
    <nav class="inicio-entradas" aria-label={t('ini.entrar')}>
      {#each ENTRADAS as [clave, ir], i (clave)}
        <button class="inicio-entrada" onclick={ir}>
          <span class="inicio-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><span>{t(clave)}</span><span class="inicio-flecha" aria-hidden="true">↗</span>
        </button>
      {/each}
    </nav>
    {#if primeraVez}
      <p class="inicio-ultima inicio-empezar">{@render saludo()}{t('ini.empezar')} <button onclick={() => irA(43, 1)}>{t('ini.juan')} ↗</button><small>{t('ini.juanPor')}</small></p>
    {:else}
      <p class="inicio-ultima">{@render saludo()}{t('ini.ultima')} <button onclick={() => irA(pos.libro, pos.cap)}>{nombreRef(pos.libro, pos.cap)}</button></p>
    {/if}
    {#if recuerdo}
      <p class="inicio-ultima inicio-recuerdo">
        {t(recuerdo.anos === 1 ? 'ini.recuerdo1' : 'ini.recuerdoN', { n: recuerdo.anos })}
        <button onclick={() => irA(recuerdo.libro, recuerdo.cap, recuerdo.v)}>{recuerdo.ref}</button>
        <q>{recuerdo.texto}</q>
      </p>
    {/if}
  </div>

  {#if miniatura}
    <div class="inicio-cultura">
      <button class="inicio-cultura-lamina" onclick={verLaminas} aria-label={t('ini.verLamina')}>
        <img src={miniatura} alt="" />
      </button>
      <div aria-hidden="true"><span>{t('ini.estudioVisual')}</span><small>{laminaDelDia().referencia}</small></div>
    </div>
  {/if}

  <div class="inicio-firma" aria-hidden="true"><span>{t('ini.firma')}</span><span>{t('ini.firmaLema')}</span></div>
</section>
