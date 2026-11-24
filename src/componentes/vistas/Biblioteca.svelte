<script>
  // Biblioteca: los 66 libros como cubiertas tipográficas en gris. La letra es la imagen.
  // Algunas cubiertas llevan un acabado aluminio mate muy leve; ninguna textura toca el texto.
  import { irA, entrarAlLibro } from '../../lib/ui.svelte.js';
  import { usuario } from '../../lib/usuario.svelte.js';
  import { LIBROS, nombreLibro, normalizar, parsearReferencia } from '../../lib/libros.js';
  import { t } from '../../lib/i18n.svelte.js';

  let filtro = $state('todos');
  let q = $state('');

  const FAMILIAS = [[1, 5, 'ley'], [6, 17, 'historia'], [18, 22, 'poesia'], [23, 39, 'profetas'], [40, 43, 'evangelios'], [44, 44, 'historia'], [45, 65, 'cartas'], [66, 66, 'revelacion']];
  const familia = (n) => FAMILIAS.find(([a, b]) => n >= a && n <= b)[2];
  // cubiertas «firma»: llevan monograma y familia; algunas de ellas, el aluminio
  const FIRMA = new Set([1, 2, 3, 19, 20, 23, 40, 43, 45, 66]);

  const visibles = $derived.by(() => {
    const n = normalizar(q.trim()).replace(/\s+/g, '');
    return LIBROS.filter((l) => {
      if (filtro === 'at' && l.testamento !== 'AT') return false;
      if (filtro === 'nt' && l.testamento !== 'NT') return false;
      if (!n) return true;
      const nombres = [l.clave, normalizar(l.nombre).replace(/\s+/g, ''), normalizar(l.ingles).replace(/\s+/g, ''), ...l.alias];
      return nombres.some((x) => x.includes(n));
    });
  });

  // Otro libro (o el mismo en su capítulo 1) abre por su portada: con «Inmersivo», la cubierta tocada crece hasta ser
  // esa portada (entrarAlLibro). El libro que se está leyendo, en otro capítulo, sigue donde iba.
  function abrir(l, cubierta = null) {
    const p = usuario.ajustes.pos;
    if (p.libro === l.n && p.cap !== 1) irA(p.libro, p.cap);
    else entrarAlLibro(cubierta, l.n);
  }

  // La cubierta bajo el mouse se inclina apenas hacia él (4–5°) y una luz suave lo sigue: «esta se puede tomar».
  // Solo en el skin Blanco (las demás son listas, no cubiertas), con mouse, en pantallas anchas y en «Inmersivo».
  function inclinar(nodo) {
    const quieto = matchMedia('(prefers-reduced-motion: reduce)');
    const apto = matchMedia('(min-width: 901px) and (hover: hover) and (pointer: fine)');
    const meta = { x: 0, y: 0 }, pos = { x: 0, y: 0 };
    let cuadro = 0;
    function pintar() {
      cuadro = 0;
      if (nodo.classList.contains('entrando')) { nodo.style.transform = ''; return; }
      pos.x += (meta.x - pos.x) * 0.12;
      pos.y += (meta.y - pos.y) * 0.12;
      const quieta = !meta.x && !meta.y && Math.abs(pos.x) + Math.abs(pos.y) < 0.004;
      nodo.style.transform = quieta ? '' : `perspective(900px) rotateX(${(-pos.y * 4).toFixed(3)}deg) rotateY(${(pos.x * 5).toFixed(3)}deg) translateY(-2px)`;
      if (!quieta) cuadro = requestAnimationFrame(pintar);
    }
    function mover(e) {
      const inmersivo = (document.documentElement.dataset.movimiento || 'inmersivo') === 'inmersivo';
      if (e.pointerType !== 'mouse' || quieto.matches || !apto.matches || !inmersivo || document.documentElement.dataset.skin) return;
      const r = nodo.getBoundingClientRect();
      meta.x = (e.clientX - r.left) / r.width - 0.5;
      meta.y = (e.clientY - r.top) / r.height - 0.5;
      nodo.style.setProperty('--mx', `${((meta.x + 0.5) * 100).toFixed(1)}%`);
      nodo.style.setProperty('--my', `${((meta.y + 0.5) * 100).toFixed(1)}%`);
      nodo.classList.add('inclinada');
      if (!cuadro) cuadro = requestAnimationFrame(pintar);
    }
    function soltar() {
      meta.x = meta.y = 0;
      nodo.classList.remove('inclinada');
      if (!cuadro) cuadro = requestAnimationFrame(pintar);
    }
    nodo.addEventListener('pointermove', mover);
    nodo.addEventListener('pointerleave', soltar);
    return { destroy() { cancelAnimationFrame(cuadro); nodo.removeEventListener('pointermove', mover); nodo.removeEventListener('pointerleave', soltar); } };
  }

  // Enter en el buscador: una referencia («jn 3:16») va directo; si no, el primer libro
  function enviar(e) {
    e.preventDefault();
    const ref = /\d/.test(q) ? parsearReferencia(q) : null;
    if (ref) irA(ref.libro, ref.cap, ref.v);
    else if (visibles.length) abrir(visibles[0]);
  }
</script>

<section class="pagina-vista" aria-labelledby="bib-titulo">
  <div class="titular">
    <div><span class="sobretitulo">{t('bib.over')}</span><h1 id="bib-titulo">{t('vista.biblioteca')}</h1></div>
    <p>{t('bib.n', { n: 66 })}</p>
  </div>
  <div class="herramientas">
    <div class="filtros-vista" role="group" aria-label={t('vista.biblioteca')}>
      {#each [['todos', 'bib.todos'], ['at', 'bib.at'], ['nt', 'bib.nt']] as [id, etiqueta]}
        <button class="filtro" aria-pressed={filtro === id} onclick={() => (filtro = id)}>{t(etiqueta)}</button>
      {/each}
    </div>
    <form class="buscar-vista" onsubmit={enviar} role="search">
      <span aria-hidden="true">⌕</span>
      <input bind:value={q} placeholder={t('bib.buscar')} aria-label={t('bib.buscar')} autocomplete="off" spellcheck="false" />
    </form>
  </div>
  <div class="indice-cabeza"><span>{t('bib.contador', { n: String(visibles.length).padStart(2, '0') })}</span><span class="firma-indice" aria-hidden="true">{t('bib.firma')}</span></div>

  {#if visibles.length}
    <div class="cubiertas">
      {#each visibles as l, i (l.n)}
        <!-- data-sec: el rótulo de sección que los skins Imprenta y Editorial muestran al empezar cada familia -->
        <button class="cubierta fam-{familia(l.n)}" class:firma={FIRMA.has(l.n)} class:aluminio={l.n === 1 || l.n === 19 || l.n === 43 || l.n === 66}
          class:actual={l.n === usuario.ajustes.pos.libro} data-libro={l.n} use:inclinar
          data-sec={i === 0 || familia(visibles[i - 1].n) !== familia(l.n) ? t(`fam.${familia(l.n)}`) : null}
          onclick={(e) => abrir(l, e.currentTarget)} aria-label={t('bib.abrir', { libro: nombreLibro(l) })}>
          <span class="cub-num">{String(l.n).padStart(2, '0')}</span>
          <span class="cub-titulo">{nombreLibro(l)}</span>
          <span class="cub-caps" aria-hidden="true">{l.capitulos}</span>
          <span class="cub-tipo">{l.testamento === 'AT' ? t('nav.at') : t('nav.nt')} · {t('bib.capitulos', { n: l.capitulos })}</span>
          {#if FIRMA.has(l.n)}
            <span class="cub-monograma" aria-hidden="true">ALEPH / {String(l.n).padStart(2, '0')}</span>
            <span class="cub-familia" aria-hidden="true">{t(`fam.${familia(l.n)}`)}</span>
          {/if}
        </button>
      {/each}
    </div>
  {:else}
    <p class="vacio-vista">{t('bib.vacio')}</p>
  {/if}
</section>
