<script module>
  // láminas ya dibujadas en esta sesión (versículo + rótulo + portada + pieza → imagen): entrar y salir no redibuja
  const dibujadas = new Map();
</script>

<script>
  // Láminas: un índice de tres colecciones con una VITRINA al lado (elegida por el dueño el 2026-11-23, «A · Vitrina»):
  // una sola lámina grande, de frente, la de hoy. Con el mouse (o el foco) sobre una colección, la vitrina pasa por
  // sus piezas una por una con un fundido; nunca hay dos juntas, así las estéticas no chocan. La vitrina se inclina
  // apenas hacia el mouse, como las puertas del Inicio (solo con Movimiento «inmersivo»).
  // Las piezas se dibujan con el motor original (Canvas 2D) y abren el editor de siempre.
  import { ui } from '../../lib/ui.svelte.js';
  import { usuario } from '../../lib/usuario.svelte.js';
  import { dibujarLamina } from '../../lib/laminas.js';
  import { COLECCIONES } from '../../lib/colecciones.js';
  import { dia, cargarVersoDelDia, laminaDelDia } from '../../lib/versoDelDia.svelte.js';
  import { t } from '../../lib/i18n.svelte.js';

  const nombrePieza = (p) => t(`lam.e.${p.estilo}`) + (p.tono ? ` ${t(`lam.t.${p.tono}`).toLowerCase()}` : '');
  const nombres = (c) => c.piezas.map(nombrePieza).join(' · ');
  const piezas = (n) => t('lamp.piezas', { n: String(n).padStart(2, '0') });
  const elegida = $derived(COLECCIONES.find((c) => c.id === ui.coleccion));

  const TODAS = COLECCIONES.flatMap((c) => c.piezas);
  const PASO = 1700; // ms que la vitrina se queda en cada pieza
  const ahora = new Date();
  const diaDelAnio = Math.floor((ahora - new Date(ahora.getFullYear(), 0, 0)) / 864e5);
  const deHoy = TODAS[diaDelAnio % TODAS.length]; // la pieza de hoy: rota entre todas, una por día

  // miniaturas: primero las que se ven (la de hoy o las de la colección abierta), después el resto, una por una
  let miniaturas = $state({});
  $effect(() => {
    cargarVersoDelDia();
    if (!dia.texto) return;
    const base = laminaDelDia();
    const rotulo = t('lam.rotulo');
    const imagen = usuario.portadas[base.libro] || undefined;
    const firma = [base.texto, base.referencia, rotulo, imagen ? `${imagen.length}:${imagen.slice(-40)}` : ''].join('|');
    const orden = [...new Map([...(elegida?.piezas ?? [deHoy]), ...TODAS].map((p) => [p.id, p])).values()];
    const ya = {};
    for (const p of orden) if (dibujadas.has(`${firma}|${p.id}`)) ya[p.id] = dibujadas.get(`${firma}|${p.id}`);
    miniaturas = ya;
    let vivo = true;
    (async () => {
      for (const p of orden) {
        const clave = `${firma}|${p.id}`;
        if (dibujadas.has(clave)) continue;
        const lienzo = document.createElement('canvas');
        await dibujarLamina(lienzo, { ...base, ...p, formato: 'post', rotulo, imagen, escala: 0.6 });
        dibujadas.set(clave, lienzo.toDataURL('image/jpeg', 0.88));
        if (!vivo) return;
        miniaturas = { ...miniaturas, [p.id]: dibujadas.get(clave) };
      }
    })();
    return () => { vivo = false; };
  });

  // vitrina: en reposo, la de hoy; con una colección señalada, pasa por sus piezas
  let foco = $state.raw(null); // raw: sin proxy, para que `foco === c` compare la misma colección
  let paso = $state(0);
  $effect(() => {
    if (!foco) return;
    paso = 0;
    const reloj = setInterval(() => paso++, PASO);
    return () => clearInterval(reloj);
  });
  const enVitrina = $derived(foco ? foco.piezas[paso % foco.piezas.length] : deHoy);

  // la vitrina se inclina hacia el mouse (con suavidad) y vuelve al centro cuando el mouse se va
  function inclinar(nodo) {
    const quieto = matchMedia('(prefers-reduced-motion: reduce)');
    const apto = matchMedia('(min-width: 901px) and (hover: hover) and (pointer: fine)');
    const marco = () => nodo.querySelector('.vitrina-marco');
    let meta = { x: 0, y: 0 };
    const pos = { x: 0, y: 0 };
    let cuadro = 0;
    function pintar() {
      cuadro = 0;
      pos.x += (meta.x - pos.x) * 0.08;
      pos.y += (meta.y - pos.y) * 0.08;
      const m = marco();
      if (m) m.style.transform = `rotateY(${(pos.x * 6).toFixed(3)}deg) rotateX(${(-pos.y * 5).toFixed(3)}deg)`;
      if (Math.abs(meta.x - pos.x) + Math.abs(meta.y - pos.y) > 0.001) cuadro = requestAnimationFrame(pintar);
    }
    const arrancar = () => { if (!cuadro) cuadro = requestAnimationFrame(pintar); };
    function mover(e) {
      const inmersivo = (document.documentElement.dataset.movimiento || 'inmersivo') === 'inmersivo';
      if (e.pointerType !== 'mouse' || quieto.matches || !apto.matches || !inmersivo) return;
      meta = { x: e.clientX / innerWidth - 0.5, y: e.clientY / innerHeight - 0.5 };
      arrancar();
    }
    const soltar = () => { meta = { x: 0, y: 0 }; arrancar(); };
    nodo.addEventListener('pointermove', mover);
    nodo.addEventListener('pointerleave', soltar);
    return { destroy() { cancelAnimationFrame(cuadro); nodo.removeEventListener('pointermove', mover); nodo.removeEventListener('pointerleave', soltar); } };
  }

  function abrir(p) {
    ui.lamina = { ...laminaDelDia(), estilo: p.estilo, formato: 'post', tono: p.tono };
    ui.dialogo = 'poster';
  }
</script>

<section class="pagina-vista" aria-labelledby="lam-titulo">
  <div class="titular">
    <div><span class="sobretitulo">{t('lamp.over')}</span><h1 id="lam-titulo">{elegida ? t(`col.${elegida.id}`) : t('vista.laminas')}</h1></div>
    <p>{elegida ? t(`col.sub.${elegida.id}`) : t('lamp.sub')}</p>
  </div>

  {#if !elegida}
    <div class="lam-indice" use:inclinar>
      <div class="colecciones" class:con-foco={foco} aria-label={t('lamp.colecciones')} role="group" onpointerleave={() => (foco = null)}>
        {#each COLECCIONES as c, i}
          <button class="coleccion" class:foco={foco === c} onclick={() => (ui.coleccion = c.id)}
            onpointerenter={() => (foco = c)} onfocus={() => (foco = c)} onblur={() => (foco = null)}>
            <span class="col-num">{String(i + 1).padStart(2, '0')}</span>
            <span class="col-nombre">{t(`col.${c.id}`)}</span>
            <span class="col-sub">{nombres(c)}</span>
            <span class="col-cuenta">{piezas(c.piezas.length)}</span>
            <span class="col-flecha" aria-hidden="true">↗</span>
          </button>
        {/each}
      </div>
      <figure class="vitrina">
        <button class="vitrina-marco" onclick={() => abrir(enVitrina)} aria-label={t('lamp.abrir', { e: nombrePieza(enVitrina) })}>
          {#each TODAS as p (p.id)}
            {#if miniaturas[p.id]}<img src={miniaturas[p.id]} alt="" data-id={p.id} class:ver={p.id === enVitrina.id} />{/if}
          {/each}
        </button>
        <div class="vitrina-pasos" aria-hidden="true">
          {#if foco}{#each foco.piezas as p, k (p.id)}<i class:ya={k <= paso % foco.piezas.length}></i>{/each}{/if}
        </div>
        <figcaption class="vitrina-pie">
          <span>{nombrePieza(enVitrina)}</span><span>{dia.texto ? laminaDelDia().referencia : ''}</span>
        </figcaption>
      </figure>
    </div>
  {:else}
    <div class="coleccion-barra">
      <button onclick={() => (ui.coleccion = null)} aria-label={t('lamp.volver')}>← &nbsp; {t('lamp.colecciones')}</button>
      <span>{piezas(elegida.piezas.length)} · {nombres(elegida)}</span>
    </div>
    <p class="coleccion-ayuda">{dia.texto ? t('lamp.hoy', { ref: laminaDelDia().referencia }) : ''} · {t('lamp.ayuda')}</p>
    <div class="obras">
      {#each elegida.piezas as p (p.id)}
        <button class="obra" onclick={() => abrir(p)} aria-label={t('lamp.abrir', { e: nombrePieza(p) })}>
          <span class="obra-lamina">{#if miniaturas[p.id]}<img src={miniaturas[p.id]} alt="" />{/if}</span>
          <span class="obra-nombre"><span>{nombrePieza(p)}</span><span>{dia.texto ? laminaDelDia().referencia : ''}</span></span>
        </button>
      {/each}
    </div>
  {/if}
</section>
