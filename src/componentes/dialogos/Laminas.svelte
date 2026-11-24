<script module>
  // lo que la persona personalizó en cada acabado: se recuerda mientras la app está abierta
  const recuerdo = {};
</script>

<script>
  // Estudio de láminas: el versículo elegido como fondo de pantalla o diseño para compartir.
  // Viene de la selección del lector o de la galería del menú de inicio (ui.lamina).
  import { ui, etiquetaSeleccion, avisar } from '../../lib/ui.svelte.js';
  import { usuario } from '../../lib/usuario.svelte.js';
  import { ESTILOS, FORMATOS, VARIANTES, CABEN, FABRICA, POSICIONES, dibujarLamina, fraseCorta, palabraClave, trozos } from '../../lib/laminas.js';
  import { guardarArchivo } from '../../lib/archivos.js';
  import { t } from '../../lib/i18n.svelte.js';

  const origen = $derived.by(() => {
    if (ui.lamina) return ui.lamina;
    const s = new Set(ui.seleccion);
    const p = usuario.ajustes.pos;
    return {
      texto: ui.cap.versos.filter((x) => s.has(x.v) && x.texto).map((x) => x.texto).join(' '),
      referencia: etiquetaSeleccion(),
      clave: ui.palabra?.texto || '',
      version: usuario.ajustes.version,
      libro: p.libro,
    };
  });

  let estilo = $state(ui.lamina?.estilo || 'portadilla');
  let formato = $state(ui.lamina?.formato || 'post');
  let tono = $state(ui.lamina?.tono || 'amarillo');
  let frase = $state('');
  let lienzo = $state();
  let dibujando = $state(false);
  let pedido = 0;

  $effect(() => { frase = origen.texto; });

  // Los acabados de letra enorme lucen mejor con pocas palabras, pero por defecto va el versículo entero
  // (la letra se achica para que quepa). Aquí se ve y se elige: el texto completo, o un trozo para que se lea grande.
  const ENTERO_MAX = 60; // más que esto (varios versículos) ya no entra legible: se propone un trozo
  const cabe = $derived(CABEN[estilo]);
  const soloPalabra = $derived(cabe === 'palabra');
  const completo = $derived(frase.trim());
  const nPalabras = $derived(completo.split(/\s+/).filter(Boolean).length);
  const recorta = $derived(soloPalabra ? nPalabras > 3 : nPalabras > cabe);
  const trozoAuto = $derived(fraseCorta(frase, origen.clave, cabe));
  const automatico = $derived(soloPalabra ? palabraClave(frase, origen.clave) : nPalabras <= ENTERO_MAX ? completo : trozoAuto);
  const opciones = $derived.by(() => {
    if (!recorta) return [];
    if (!soloPalabra) return [...new Set([...(origen.clave ? [trozoAuto] : []), ...trozos(frase, cabe)])].filter((x) => x !== completo).slice(0, 9);
    // palabras con peso: sin repetir y sin las cortitas (de, que, el…)
    const ws = frase.split(/\s+/).map((w) => w.replace(/[^\p{L}]/gu, '')).filter((w) => w.length > 3);
    return [...new Set(ws)].slice(0, 12);
  });
  let grande = $state('');
  let elegido = $state(false); // la persona eligió o escribió su trozo: ya no se pisa solo
  $effect(() => { origen.texto; estilo; elegido = false; });
  $effect(() => { if (!elegido) grande = automatico; });
  const esEntero = $derived(!soloPalabra && grande.trim() === completo);
  const limpio = (x) => x.replace(/[.,;:!?¡¿«»"]+$/g, '').trim();

  // Personalizar (pedido por el dueño el 2026-11-23): cada acabado arranca de fábrica (FABRICA del motor) y la
  // persona cambia fondo, color de la letra, letra, tamaño, posición y textura; se ve al instante.
  let ajustes = $state(structuredClone(recuerdo));
  $effect(() => {
    const ahora = $state.snapshot(ajustes);
    for (const k of Object.keys(recuerdo)) delete recuerdo[k];
    Object.assign(recuerdo, ahora);
  });
  const CAMPOS = ['fondo', 'tinta', 'letra', 'tam', 'pos', 'grano'];
  const COMUNES = ['#f6f6f3', '#1a1a1a', '#fdd0e0', '#b9e8f0', '#e0261c'];
  const fab = $derived(FABRICA[estilo]);
  const valor = (campo) => ajustes[estilo]?.[campo] ?? fab[campo];
  const cambiado = (campo) => String(valor(campo)).toLowerCase() !== String(fab[campo]).toLowerCase();
  const algunCambio = $derived(CAMPOS.some(cambiado));
  const luz = (c) => { const n = parseInt(c.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
  // sin fondo de color (Grabado: la letra va sobre el grabado oscuro) solo se ofrecen colores claros para la letra
  const muestras = (campo) => [...new Set([fab.fondo, fab.tinta, ...COMUNES].filter(Boolean).map((c) => c.toLowerCase()))]
    .filter((c) => campo !== 'tinta' || fab.fondo || luz(c) > 0.6);
  function poner(campo, v) { ajustes[estilo] = { ...ajustes[estilo], [campo]: v }; }
  function restablecer() { delete ajustes[estilo]; }
  // mientras se arrastra un deslizador o se elige un color, la vista se dibuja a media resolución (va fluida);
  // al soltar, completa. Guardar siempre usa la completa.
  let rapido = false;
  const arrastrar = (campo, v) => { rapido = true; poner(campo, v); };
  const soltar = () => { rapido = false; clearTimeout(espera); espera = setTimeout(dibujar, 0); };

  async function dibujar() {
    if (!lienzo || !frase.trim()) return;
    const n = ++pedido;
    dibujando = true;
    const o = $state.snapshot(origen);
    await dibujarLamina(lienzo, {
      ...o, estilo, formato, tono: tonoDe(estilo), texto: frase, grande: recorta ? grande : '', rotulo: t('lam.rotulo'),
      imagen: usuario.portadas[o.libro] || undefined, ajuste: $state.snapshot(ajustes[estilo]), escala: rapido ? 0.5 : 1,
    });
    if (n === pedido) dibujando = false;
  }

  const tonoDe = (e) => (VARIANTES[e]?.includes(tono) ? tono : VARIANTES[e]?.[0]);

  let espera;
  $effect(() => {
    estilo; formato; tono; frase; grande; lienzo; JSON.stringify(ajustes[estilo] ?? null);
    clearTimeout(espera);
    espera = setTimeout(dibujar, rapido ? 30 : 160);
    return () => clearTimeout(espera);
  });

  async function guardar() {
    if (rapido || lienzo.width !== FORMATOS[formato].w) { rapido = false; clearTimeout(espera); await dibujar(); }
    const blob = await new Promise((r) => lienzo.toBlob(r, 'image/png'));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const nombre = `${origen.referencia.replace(/[^\p{L}\d]+/gu, '-')}-${estilo}-${formato}.png`;
    try {
      if (await guardarArchivo(nombre, bytes, { name: 'Imagen', extensions: ['png'] })) avisar(t('lam.guardada'));
    } catch (e) {
      avisar(t('app.noGuardar', { e: e.message || e }), true);
    }
  }
</script>

{#if !origen.texto}
  <p class="ayuda">{t('pos.elige')}</p>
{:else}
  <div class="estudio-lamina">
    <div class="lamina-vista" class:apaisada={formato === 'escritorio'} class:cargando={dibujando}>
      <canvas bind:this={lienzo} aria-label={t('pos.alt', { ref: origen.referencia })}></canvas>
    </div>
    <div class="lamina-controles">
      <span class="etiqueta-ui">{t('lam.acabado')}</span>
      <div class="chips">
        {#each ESTILOS as e}<button aria-pressed={estilo === e} onclick={() => (estilo = e)}>{t(`lam.e.${e}`)}</button>{/each}
      </div>
      {#if VARIANTES[estilo]}
        <div class="chips">
          {#each VARIANTES[estilo] as k}<button aria-pressed={tonoDe(estilo) === k} onclick={() => (tono = k)}>{t(`lam.t.${k}`)}</button>{/each}
        </div>
      {/if}
      <span class="etiqueta-ui">{t('lam.formato')}</span>
      <div class="chips">
        {#each Object.keys(FORMATOS) as f}<button aria-pressed={formato === f} onclick={() => (formato = f)}>{t(`lam.f.${f}`)}</button>{/each}
      </div>
      <div class="lam-personal">
        <div class="lam-personal-cabeza">
          <span class="lam-personal-titulo">{t('lam.personalizar')}</span>
          <button class="lam-restablecer" disabled={!algunCambio} onclick={restablecer}>{t('lam.restablecer')}</button>
        </div>
        {#each ['fondo', 'tinta'] as campo (campo)}
          {#if fab[campo]}
            <span class="etiqueta-ui lam-campo" class:cambiado={cambiado(campo)}>{t(`lam.p.${campo}`)}</span>
            <div class="lam-muestras" role="group" aria-label={t(`lam.p.${campo}`)}>
              {#each muestras(campo) as c (c)}
                <button style:background={c} aria-pressed={valor(campo).toLowerCase() === c} aria-label={c} onclick={() => poner(campo, c)}></button>
              {/each}
              <label class="lam-otro" title={t('lam.p.otro')}>+<input type="color" value={valor(campo)} aria-label={t('lam.p.otro')}
                oninput={(e) => arrastrar(campo, e.currentTarget.value)} onchange={soltar} /></label>
            </div>
          {/if}
        {/each}
        {#if fab.letras.length}
          <span class="etiqueta-ui lam-campo" class:cambiado={cambiado('letra')}>{t('lam.p.letra')}</span>
          <div class="chips">
            {#each fab.letras as l}<button aria-pressed={valor('letra') === l} onclick={() => poner('letra', l)}>{t(`lam.l.${l}`)}</button>{/each}
          </div>
        {/if}
        <label class="etiqueta-ui lam-campo" class:cambiado={cambiado('tam')} for="lam-tam">{t('lam.p.tam')} <em>{valor('tam')} %</em></label>
        <input id="lam-tam" type="range" min="60" max="140" step="1" value={valor('tam')}
          oninput={(e) => arrastrar('tam', +e.currentTarget.value)} onchange={soltar} />
        <span class="etiqueta-ui lam-campo" class:cambiado={cambiado('pos')}>{t('lam.p.pos')}</span>
        <div class="chips">
          {#each POSICIONES as p}<button aria-pressed={valor('pos') === p} onclick={() => poner('pos', p)}>{t(`lam.pos.${p}`)}</button>{/each}
        </div>
        <label class="etiqueta-ui lam-campo" class:cambiado={cambiado('grano')} for="lam-grano">{t('lam.p.grano')} <em>{valor('grano')} %</em></label>
        <input id="lam-grano" type="range" min="0" max="100" step="1" value={valor('grano')}
          oninput={(e) => arrastrar('grano', +e.currentTarget.value)} onchange={soltar} />
      </div>
      <label class="etiqueta-ui" for="lam-frase">{t('lam.frase')}</label>
      <textarea id="lam-frase" class="campo" rows="4" bind:value={frase}></textarea>
      <p class="nota-pie">{t('lam.fraseAyuda')}</p>
      {#if recorta}
        <div class="lam-grande">
          <span class="etiqueta-ui">{soloPalabra ? t('lam.palabraGrande') : t('lam.textoGrande')}</span>
          <p class="nota-pie">{soloPalabra
            ? t('lam.explicaPalabra', { e: t(`lam.e.${estilo}`) })
            : t('lam.explicaTrozo', { e: t(`lam.e.${estilo}`), n: cabe })}</p>
          <div class="chips lam-trozos" role="group" aria-label={t('lam.otroTrozo')}>
            {#if !soloPalabra}
              <button class="lam-entero" aria-pressed={esEntero} onclick={() => { grande = completo; elegido = true; }}>{t('lam.entero', { n: nPalabras })}</button>
            {/if}
            {#each opciones as o (o)}
              <button aria-pressed={limpio(grande).toLowerCase() === limpio(o).toLowerCase()} onclick={() => { grande = o; elegido = true; }}>{o}</button>
            {/each}
          </div>
          {#if !esEntero}
            <input id="lam-grande" class="campo" bind:value={grande} oninput={() => (elegido = true)} aria-label={t('lam.escribeTrozo')} />
          {/if}
        </div>
      {/if}
      <button class="boton" onclick={guardar}>{t('lam.guardar')}</button>
    </div>
  </div>
{/if}
