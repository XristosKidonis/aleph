<script>
  // Seteo de la primera vez (después del nombre): cinco preguntas con botones, una por pantalla, para que
  // la app se acomode a quien la usa. Nada se aplica hasta el final; «Ahora no» deja todo como viene.
  // Siempre en Blanco, como la bienvenida. Se puede repetir desde Ajustes → Tú.
  import { fly } from 'svelte/transition';
  import { usuario, ajustar } from '../lib/usuario.svelte.js';
  import { ui } from '../lib/ui.svelte.js';
  import { t } from '../lib/i18n.svelte.js';
  import { info } from '../lib/biblia.js';
  import { sugerida } from '../lib/clave.js';

  const quieto = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // cada respuesta: id, texto, ayuda. La 3 marca como recomendada la NTV a quien recién empieza.
  const PREGUNTAS = [
    { id: 'motivo', opciones: ['leer', 'historia', 'compartir', 'todo'] },
    { id: 'relacion', opciones: ['empiezo', 'seguido', 'estudio'] },
    { id: 'version', opciones: ['NTV', 'RV1909', 'PDT', 'NLT'] },
    { id: 'lectura', opciones: ['libro', 'grande', 'calma'] },
    { id: 'momento', opciones: ['dia', 'noche', 'depende'] },
  ];

  let paso = $state(0);
  let respuestas = $state({});
  let conParalela = $state(true);
  const pregunta = $derived(PREGUNTAS[paso]);
  const estudia = $derived(respuestas.relacion === 'estudio');
  // solo se ofrecen las versiones que de verdad están en esta instalación
  const opciones = $derived(pregunta ? pregunta.opciones.filter((o) => pregunta.id !== 'version' || info(o)) : []);

  function elegir(o) {
    respuestas[pregunta.id] = o;
    paso++;
  }

  // «RV1909» no se entiende solo: en el resumen va el nombre
  const sigla = (v) => (v === 'RV1909' ? 'Reina-Valera 1909' : v);
  const paralelaDe = (v) => (v === 'NLT' ? 'BSB' : v === 'RV1909' ? 'NTV' : 'RV1909');

  // Lo que cambia cada respuesta (todo se puede cambiar después en Ajustes)
  const plan = $derived.by(() => {
    const r = respuestas;
    const a = {};
    if (r.motivo === 'historia') { a.ordenInicio = ['continuar', 'historia', 'biblioteca', 'archivo', 'laminas']; a.historia = true; }
    else if (r.motivo === 'compartir') a.ordenInicio = ['continuar', 'laminas', 'biblioteca', 'archivo', 'historia'];
    else if (r.motivo) a.ordenInicio = null;
    if (r.relacion === 'empiezo') { a.parrafo = true; a.portadas = true; a.estudioAlAbrir = false; }
    if (r.relacion === 'seguido') a.estudioAlAbrir = false;
    if (r.relacion === 'seguido' || r.relacion === 'estudio') {
      if (!Object.values(usuario.ajustes.claveColores || {}).some((x) => String(x).trim())) a.claveColores = { ...sugerida() };
    }
    if (r.relacion === 'estudio') a.estudioAlAbrir = true;
    if (r.version && info(r.version)) {
      a.version = r.version;
      const p = paralelaDe(r.version);
      a.paralela = estudia && conParalela && info(p) ? p : '';
    }
    if (r.lectura === 'libro') { a.fuente = 'literata'; a.calma = false; }
    if (r.lectura === 'grande') { a.fuente = 'atkinson'; a.tamano = 23; a.interlineado = 1.8; a.calma = false; }
    if (r.lectura === 'calma') { a.fuente = 'literata'; a.calma = true; }
    if (r.momento === 'dia') a.tema = 'papel';
    if (r.momento === 'noche') a.tema = 'cuero';
    if (r.momento === 'depende') a.tema = 'sistema';
    return a;
  });

  // el resumen del final: tres o cuatro líneas sobre lo que cambió
  const resumen = $derived.by(() => {
    const r = respuestas;
    const l = [];
    if (r.motivo === 'historia') l.push(t('st.rHistoria'));
    if (r.motivo === 'compartir') l.push(t('st.rLaminas'));
    if (r.version && plan.version) {
      l.push(plan.paralela ? t('st.rVersionPar', { v: sigla(r.version), p: sigla(plan.paralela) }) : t('st.rVersion', { v: sigla(r.version) }));
    }
    if (r.relacion === 'empiezo') l.push(t('st.rEmpieza'));
    if (r.relacion === 'seguido' || r.relacion === 'estudio') l.push(t('st.rClave'));
    if (r.relacion === 'estudio') l.push(t('st.rEstudio'));
    if (r.lectura) l.push(t(`st.r_${r.lectura}`));
    if (r.momento) l.push(t(`st.r_${r.momento}`));
    return l;
  });

  function terminar(aplicar) {
    if (aplicar) for (const [k, v] of Object.entries(plan)) ajustar(k, v);
    ui.llegada = true;
    ui.vista = 'inicio';
    ui.puerta = null;
  }

  const entrada = (n) => ({ y: 14, duration: quieto ? 0 : 500, delay: quieto ? 0 : n });
  const nombre = $derived(usuario.ajustes.nombre);
  // la recomendada en la pregunta de versión: la NTV para quien recién empieza
  const recomendada = (o) => pregunta?.id === 'version' && o === 'NTV' && respuestas.relacion === 'empiezo';
  // ejemplos de letra en la pregunta de lectura («Solo el texto» cambia la pantalla, no la letra: sin ejemplo)
  const MUESTRA = { libro: 'font-family: var(--f-literata); font-size: 17px', grande: 'font-family: var(--f-atkinson); font-size: 20px; line-height: 1.5' };
</script>

<section class="puerta seteo" aria-label={t('st.aria')}>
  <div class="seteo-caja">
    <div class="seteo-puntos" aria-hidden="true">
      {#each PREGUNTAS as p, i (p.id)}<span class:hecho={i < paso} class:actual={i === paso}></span>{/each}
    </div>
    {#key paso}
      {#if pregunta}
        <div class="seteo-paso" in:fly={entrada(0)}>
          <h1 class="seteo-pregunta">{pregunta.id === 'motivo' && nombre ? t('st.motivoNombre', { n: nombre }) : t(`st.${pregunta.id}`)}</h1>
          {#if pregunta.id === 'version' && estudia}
            <label class="puerta-casilla seteo-casilla"><input type="checkbox" bind:checked={conParalela} /> {t('st.paralela')}</label>
          {/if}
          <div class="seteo-opciones" role="group" aria-label={t(`st.${pregunta.id}`)}>
            {#each opciones as o, i (o)}
              <button class="seteo-opcion" data-opcion={o} aria-pressed={respuestas[pregunta.id] === o} onclick={() => elegir(o)}>
                <span class="seteo-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <span class="seteo-texto">
                  {t(`st.${pregunta.id}_${o}`)}
                  {#if recomendada(o)}<em class="seteo-reco">{t('st.recomendada')}</em>{/if}
                  {#if pregunta.id === 'lectura' && MUESTRA[o]}
                    <small class="seteo-muestra" style={MUESTRA[o]}>{t('st.muestra')}</small>
                  {/if}
                  <small>{t(`st.${pregunta.id}_${o}Ayuda`)}</small>
                </span>
                <span class="seteo-flecha" aria-hidden="true">→</span>
              </button>
            {/each}
          </div>
        </div>
      {:else}
        <div class="seteo-paso" in:fly={entrada(0)}>
          <h1 class="seteo-pregunta">{t('st.listo')}</h1>
          <ul class="seteo-resumen">
            {#each resumen as linea, i (linea)}<li in:fly={entrada(120 + i * 90)}>{linea}</li>{/each}
          </ul>
          <p class="puerta-ayuda">{t('st.listoAyuda')}</p>
          <button class="puerta-entrar seteo-entrar" onclick={() => terminar(true)}>{t('bv.entrar')}</button>
        </div>
      {/if}
    {/key}
    <div class="seteo-pie">
      {#if paso > 0}<button class="puerta-olvido" onclick={() => paso--}>{t('st.atras')}</button>{:else}<span></span>{/if}
      {#if pregunta}<button class="puerta-olvido seteo-ahora-no" onclick={() => terminar(false)}>{t('st.ahoraNo')}</button>{/if}
    </div>
  </div>
</section>
