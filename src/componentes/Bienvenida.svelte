<script>
  // La primera vez que se abre la app: «hola» pasa por varios idiomas (empieza por el tuyo, para que se
  // entienda, y sigue por los de la Biblia) y llega a «Hola.». Después pregunta tu nombre y, si quieres,
  // una contraseña para abrir, y sigue con las preguntas del seteo (Seteo.svelte). Siempre en Blanco: el aspecto se elige después, en Ajustes.
  // Solo se anima opacity y transform; con «reducir movimiento» aparece directo el «Hola.».
  import { onMount } from 'svelte';
  import { usuario, ajustar } from '../lib/usuario.svelte.js';
  import { ui } from '../lib/ui.svelte.js';
  import { t, idioma } from '../lib/i18n.svelte.js';
  import { puedeCandado, claveValida, crearCandado } from '../lib/candado.js';

  const SALUDOS = {
    es: { t: 'Hola', idioma: 'bv.espanol' },
    en: { t: 'Hello', idioma: 'bv.ingles' },
  };
  const otro = idioma() === 'en' ? 'es' : 'en';
  const PALABRAS = [
    SALUDOS[idioma()],
    SALUDOS[otro],
    { t: 'Salve', idioma: 'bv.latin' },
    { t: 'Χαῖρε', idioma: 'bv.griego', clase: 'griego' },
    { t: 'שָׁלוֹם', idioma: 'bv.hebreo', clase: 'hebreo', rtl: true },
  ];

  let caja, rotulo, formulario, raya, campoNombre;
  let nombre = $state('');
  let conCandado = $state(false);
  let clave = $state('');
  let error = $state('');
  let guardando = $state(false);
  let formaVisible = $state(false);
  let turno = 0;

  const quieto = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const anim = (el, k, o) => (quieto ? Promise.resolve() : el.animate(k, { fill: 'forwards', ...o }).finished.catch(() => {}));
  const entra = (el) => anim(el, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.2,.7,.2,1)' });
  const sale = (el) => anim(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-12px)' }], { duration: 450, easing: 'ease-in' });

  function palabra(p) {
    const el = document.createElement('span');
    el.className = `puerta-palabra-texto ${p.clase || ''}`;
    el.textContent = p.t;
    if (p.rtl) el.dir = 'rtl';
    if (!quieto) el.style.opacity = '0';
    caja.replaceChildren(el);
    return el;
  }

  function ponerRotulo(texto) {
    rotulo.textContent = texto;
    anim(rotulo, [{ opacity: 0 }, { opacity: texto ? 1 : 0 }], { duration: 400 });
  }

  async function correr() {
    const mio = ++turno;
    const lista = quieto ? [] : PALABRAS;
    await esperar(quieto ? 0 : 500);
    for (const p of lista) {
      if (mio !== turno) return;
      const el = palabra(p);
      ponerRotulo(t(p.idioma));
      await entra(el);
      await esperar(900);
      if (mio !== turno) return;
      await sale(el);
    }
    if (mio !== turno) return;
    ponerRotulo('');
    await entra(palabra({ t: t('bv.hola') }));
    if (mio !== turno) return;
    await esperar(quieto ? 0 : 500);
    mostrarForma();
  }

  function mostrarForma() {
    formaVisible = true;
    anim(formulario, [{ opacity: 0, transform: 'translate(-50%, 10px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 600, easing: 'cubic-bezier(.2,.7,.2,1)' });
    anim(raya, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 800, delay: 200, easing: 'cubic-bezier(.65,0,.35,1)' });
    setTimeout(() => campoNombre?.focus({ preventScroll: true }), quieto ? 0 : 300);
  }

  function saltar() {
    ++turno;
    caja.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    const el = palabra({ t: t('bv.hola') });
    el.style.opacity = '';
    rotulo.textContent = '';
    mostrarForma();
  }

  async function entrar(e) {
    e.preventDefault();
    const n = nombre.trim().slice(0, 40);
    if (!n || guardando) return;
    if (conCandado && !claveValida(clave)) { error = t('bv.corta'); return; }
    guardando = true;
    error = '';
    const candado = conCandado ? await crearCandado(clave) : null;
    clave = '';
    ajustar('nombre', n);
    ajustar('candado', candado);
    ajustar('bienvenido', true);
    ++turno;
    await anim(formulario, [{ opacity: 1, transform: 'translate(-50%, 0)' }, { opacity: 0, transform: 'translate(-50%, 0)' }], { duration: 300 });
    formaVisible = false;
    const viejo = caja.firstElementChild;
    if (viejo) await sale(viejo);
    caja.classList.add('chica');
    await entra(palabra({ t: t('bv.holaNombre', { n }) }));
    await esperar(quieto ? 300 : 1300);
    await sale(caja.firstElementChild);
    ui.vista = 'inicio';
    ui.puerta = 'seteo'; // las cinco preguntas
  }

  onMount(() => {
    (document.fonts?.ready ?? Promise.resolve()).then(correr);
    return () => { ++turno; };
  });
</script>

<section class="puerta bienvenida" aria-label={t('bv.aria')} data-usuario={usuario.ajustes.nombre ? 'si' : 'no'}>
  <div class="puerta-centro"><div class="puerta-palabra" bind:this={caja} aria-live="polite"></div></div>
  <div class="puerta-rotulo" bind:this={rotulo} aria-hidden="true"></div>
  <form class="puerta-forma" class:ver={formaVisible} bind:this={formulario} onsubmit={entrar} autocomplete="off">
    <label for="bv-nombre">{t('bv.nombre')}</label>
    <div class="puerta-campo">
      <input id="bv-nombre" bind:this={campoNombre} bind:value={nombre} maxlength="40" autocomplete="off" spellcheck="false" />
      <span class="puerta-raya" bind:this={raya}></span>
    </div>
    {#if conCandado}
      <div class="puerta-campo">
        <input id="bv-clave" type="password" bind:value={clave} placeholder={t('bv.clave')} aria-label={t('bv.clave')} autocomplete="new-password" />
        <span class="puerta-raya llena"></span>
      </div>
      <small class="puerta-ayuda" class:error role={error ? 'alert' : undefined}>{error || t('bv.claveAyuda')}</small>
    {/if}
    <div class="puerta-fila">
      {#if puedeCandado}
        <label class="puerta-casilla"><input type="checkbox" bind:checked={conCandado} /> {t('bv.candado')}</label>
      {:else}<span></span>{/if}
      <button class="puerta-entrar" type="submit" disabled={!nombre.trim() || guardando}>{t('bv.entrar')}</button>
    </div>
  </form>
  {#if !formaVisible && !guardando}<button class="puerta-saltar" onclick={saltar}>{t('bv.saltar')}</button>{/if}
</section>
