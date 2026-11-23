<script>
  // Portada de libro a pantalla completa: azul impreso con letras blancas, como una hoja escaneada.
  // Entra entera, como una foto que se revela: la hoja aparece de una vez y las letras pasan de
  // borrosas a nítidas todas juntas; después asoman las notas. Se queda un momento y sale
  // desenfocándose mientras el azul se disuelve sobre el capítulo, que ya está cargado debajo.
  // Un toque o cualquier tecla la saltan. Con «menos movimiento» aparece quieta y se desvanece.
  //
  // Fluidez: nada anima un filtro. Cada palabra está dos veces, nítida (con la tinta) y
  // desenfocada, ya dibujadas; el revelado solo cruza sus opacidades, que la GPU mueve sin
  // volver a pintar letras de este tamaño (animar el blur las redibujaba en cada cuadro).
  import { onMount, tick } from 'svelte';
  import { ui } from '../lib/ui.svelte.js';
  import { portada } from '../lib/portadas.js';

  let { libro } = $props();
  const filas = $derived(portada(libro));

  const ESPERA = 1900;                 // desde que entra hasta que empieza a salir sola
  const SALE = 'cubic-bezier(.2,.7,.2,1)';

  let raiz;
  let cuerpo = $state(0);
  let anims = [];
  let saliendo = false;
  let reloj;

  const animar = (el, kf, o) => {
    const a = el.animate(kf, { fill: 'both', easing: SALE, ...o });
    anims.push(a);
    return a;
  };
  const piezas = (sel) => [...raiz.querySelectorAll(sel)];

  // Todos los renglones con el mismo cuerpo: lo más grande que quepa en alto, y si una palabra
  // no entra a lo ancho (Deuteronomio, 1 Tesalonicenses), todos bajan lo justo.
  async function encajar() {
    const fila = raiz.querySelector('.pt-fila');
    const alto = fila.clientHeight * 0.9;
    cuerpo = alto;
    await tick();
    const libre = fila.clientWidth - raiz.querySelector('.pt-nota').offsetWidth - parseFloat(getComputedStyle(fila).columnGap || 0);
    const ancho = Math.max(...piezas('.pt-palabra i').map((i) => i.getBoundingClientRect().width));
    if (ancho > libre) cuerpo = (alto * libre) / ancho;
    await tick();
  }

  function entrar() {
    const quieta = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (quieta) {
      piezas('.pt-nitida, .pt-nota').forEach((el) => animar(el, [{ opacity: 1 }, { opacity: 1 }], { duration: 1 }));
      reloj = setTimeout(salir, 1800);
      return;
    }
    animar(raiz, [{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
    piezas('.pt-desenfocada').forEach((i) => animar(i, [{ opacity: 1 }, { opacity: 0 }], { duration: 480, delay: 120, easing: 'ease-in' }));
    piezas('.pt-nitida').forEach((i) => animar(i, [{ opacity: 0 }, { opacity: 1 }], { duration: 520, delay: 40 }));
    piezas('.pt-nota').forEach((n) => animar(n, [{ opacity: 0 }, { opacity: 1 }], { duration: 360, delay: 320, easing: 'ease-out' }));
    reloj = setTimeout(salir, ESPERA);
  }

  function salir() {
    if (saliendo || !raiz) return;
    saliendo = true;
    clearTimeout(reloj);
    anims.forEach((a) => a.finish());
    const quieta = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!quieta) {
      piezas('.pt-nitida').forEach((i) => animar(i, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-in' }));
      piezas('.pt-desenfocada').forEach((i) => animar(i, [{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' }));
    }
    animar(raiz, [{ opacity: 1 }, { opacity: 0 }], { duration: quieta ? 300 : 380, easing: 'ease-in-out' })
      .finished.then(() => { if (ui.portada === libro) ui.portada = 0; }, () => {});
  }

  // La primera tecla solo salta la portada: no llega al lector (no cambia de capítulo de rebote).
  function tecla(e) {
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    salir();
  }

  onMount(() => {
    addEventListener('keydown', tecla, true);
    let vivo = true;
    // la letra de la portada (cambia según el skin) puede no estar cargada todavía; sin ella las medidas saldrían mal
    const letra = getComputedStyle(raiz.querySelector('.pt-palabra i'));
    Promise.race([document.fonts.load(`${letra.fontWeight} 100px ${letra.fontFamily}`), new Promise((r) => setTimeout(r, 1200))])
      .then(() => vivo && encajar())
      .then(() => vivo && entrar());
    return () => {
      vivo = false;
      removeEventListener('keydown', tecla, true);
      clearTimeout(reloj);
      anims.forEach((a) => a.cancel());
    };
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="portada" bind:this={raiz} style:--cuerpo={cuerpo ? `${cuerpo}px` : null} onclick={salir} aria-hidden="true">
  <svg class="pt-filtros" width="0" height="0" aria-hidden="true">
    <!-- borde impreso: la tinta azul se come apenas las esquinas de la letra y el escaneo las suaviza -->
    <filter id="pt-impreso" x="-3%" y="-10%" width="106%" height="120%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2" result="fibra" />
      <feDisplacementMap in="SourceGraphic" in2="fibra" scale="1.6" xChannelSelector="R" yChannelSelector="G" result="corrido" />
      <feGaussianBlur in="corrido" stdDeviation="1.1" result="difuso" />
      <feComponentTransfer in="difuso" result="comido"><feFuncA type="linear" slope="2.4" intercept="-0.7" /></feComponentTransfer>
      <feGaussianBlur in="comido" stdDeviation="0.95" />
    </filter>
  </svg>
  {#each filas as f, k (k)}
    <div class="pt-fila">
      <div class="pt-palabra"><i class="pt-nitida">{f.grande}</i><i class="pt-desenfocada">{f.grande}</i></div>
      <div class="pt-nota">{f.nota}</div>
    </div>
  {/each}
</div>
