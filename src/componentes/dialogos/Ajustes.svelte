<script>
  import { usuario, ajustar, COLORES_SKIN } from '../../lib/usuario.svelte.js';
  import { lista } from '../../lib/biblia.js';
  import { ui } from '../../lib/ui.svelte.js';
  import { t } from '../../lib/i18n.svelte.js';
  import VozAjustes from './VozAjustes.svelte';
  import { act, buscarActualizacion, instalarActualizacion } from '../../lib/actualizar.svelte.js';
  import { esTauri } from '../../lib/bd.js';
  import { puedeCandado, claveValida, crearCandado, abreCandado } from '../../lib/candado.js';
  const a = $derived(usuario.ajustes);
  const colores = $derived(COLORES_SKIN[a.skin] || []);
  const colorActual = $derived(a.colorSkin?.[a.skin] || colores[0]?.id);
  const elegirColor = (id) => ajustar('colorSkin', { ...(a.colorSkin || {}), [a.skin]: id });

  // Contraseña al abrir: ponerla pide una nueva; quitarla pide la actual
  let clave = $state('');
  let mensaje = $state({ texto: '', error: false });
  let ocupado = $state(false);
  async function candado(e) {
    e.preventDefault();
    if (ocupado) return;
    ocupado = true;
    if (a.candado) {
      if (await abreCandado(a.candado, clave)) {
        ajustar('candado', null);
        mensaje = { texto: t('aj.candadoQuitado'), error: false };
      } else mensaje = { texto: t('cd.mal'), error: true };
    } else if (!claveValida(clave)) {
      mensaje = { texto: t('bv.corta'), error: true };
    } else {
      ajustar('candado', await crearCandado(clave));
      mensaje = { texto: t('aj.candadoPuesto'), error: false };
    }
    clave = '';
    ocupado = false;
  }
</script>

<h3>{t('aj.tu')}</h3>
<div class="ajuste">
  <label for="aj-nombre">{t('aj.nombre')} <small>{t('aj.nombreAyuda')}</small></label>
  <input id="aj-nombre" type="text" maxlength="40" value={a.nombre || ''} autocomplete="off"
    onchange={(e) => ajustar('nombre', e.currentTarget.value.trim().slice(0, 40))} />
</div>
<div class="ajuste">
  <span class="lbl">{t('aj.repetir')} <small>{t('aj.repetirAyuda')}</small></span>
  <button class="boton secundario" type="button" onclick={() => { ui.dialogo = null; ui.puerta = 'seteo'; }}>{t('aj.repetirBoton')}</button>
</div>
{#if puedeCandado}
  <form class="ajuste" onsubmit={candado} autocomplete="off">
    <label for="aj-candado">{t('aj.candado')} <small>{mensaje.texto ? '' : t('aj.candadoAyuda')}{#if mensaje.texto}<span class:error={mensaje.error} role="status">{mensaje.texto}</span>{/if}</small></label>
    <span class="ajuste-candado">
      <input id="aj-candado" type="password" bind:value={clave} placeholder={t(a.candado ? 'aj.candadoActual' : 'aj.candadoNueva')}
        autocomplete={a.candado ? 'current-password' : 'new-password'} />
      <button class="boton secundario" type="submit" disabled={!clave || ocupado}>{t(a.candado ? 'aj.candadoQuitar' : 'aj.candadoPoner')}</button>
    </span>
  </form>
{/if}

<h3>{t('aj.lectura')}</h3>
<div class="ajuste">
  <label for="aj-idioma">{t('aj.idioma')} <small>Interface language</small></label>
  <select id="aj-idioma" value={a.idioma} onchange={(e) => ajustar('idioma', e.currentTarget.value)}>
    <option value="es">Español</option>
    <option value="en">English</option>
  </select>
</div>
<div class="ajuste">
  <label for="aj-skin">{t('aj.skin')} <small>{t('aj.skinAyuda')}</small></label>
  <select id="aj-skin" value={a.skin || 'blanco'} onchange={(e) => ajustar('skin', e.currentTarget.value)}>
    <option value="blanco">{t('aj.skinBlanco')}</option>
    <option value="imprenta">{t('aj.skinImprenta')}</option>
    <option value="editorial">{t('aj.skinEditorial')}</option>
  </select>
</div>
{#if colores.length}
  <div class="ajuste">
    <span class="lbl" id="aj-color">{t('aj.color')} <small>{t('aj.colorAyuda')}</small></span>
    <div class="muestras-color" role="group" aria-labelledby="aj-color">
      {#each colores as c (c.id)}
        <button type="button" aria-pressed={c.id === colorActual} data-color={c.id} style:--muestra={c.hex}
          title={t('col.' + c.id)} aria-label={t('col.' + c.id)} onclick={() => elegirColor(c.id)}></button>
      {/each}
      <span class="muestras-nombre">{t('col.' + colorActual)}</span>
    </div>
  </div>
{/if}
<div class="ajuste">
  <label for="aj-inicio">{t('aj.inicio')} <small>{t('aj.inicioAyuda')}</small></label>
  <input id="aj-inicio" type="checkbox" checked={a.mostrarInicio} onchange={(e) => ajustar('mostrarInicio', e.currentTarget.checked)} />
</div>
<div class="ajuste">
  <label for="aj-historia">{t('aj.historia')} <small>{t('aj.historiaAyuda')}</small></label>
  <input id="aj-historia" type="checkbox" checked={a.historia !== false} onchange={(e) => ajustar('historia', e.currentTarget.checked)} />
</div>
<div class="ajuste">
  <label for="aj-sonidos">{t('aj.sonidos')} <small>{t('aj.sonidosAyuda')}</small></label>
  <input id="aj-sonidos" type="checkbox" checked={a.sonidos !== false} onchange={(e) => ajustar('sonidos', e.currentTarget.checked)} />
</div>
<div class="ajuste">
  <label for="aj-movimiento">{t('aj.movimiento')} <small>{t('aj.movimientoAyuda')}</small></label>
  <select id="aj-movimiento" value={a.movimiento || 'inmersivo'} onchange={(e) => ajustar('movimiento', e.currentTarget.value)}>
    <option value="inmersivo">{t('aj.movInmersivo')}</option>
    <option value="sereno">{t('aj.movSereno')}</option>
    <option value="quieto">{t('aj.movQuieto')}</option>
  </select>
</div>
<div class="ajuste">
  <label for="aj-portadas">{t('aj.portadas')} <small>{t('aj.portadasAyuda')}</small></label>
  <input id="aj-portadas" type="checkbox" checked={a.portadas !== false} onchange={(e) => ajustar('portadas', e.currentTarget.checked)} />
</div>
<div class="ajuste">
  <label for="aj-grabados">{t('aj.grabados')} <small>{t('aj.grabadosAyuda')}</small></label>
  <input id="aj-grabados" type="checkbox" checked={a.grabados !== false} onchange={(e) => ajustar('grabados', e.currentTarget.checked)} />
</div>
<div class="ajuste">
  <label for="aj-tema">{t('aj.tema')}</label>
  <select id="aj-tema" value={a.tema} onchange={(e) => ajustar('tema', e.currentTarget.value)}>
    <option value="cuero">{t('aj.cuero')}</option>
    <option value="papel">{t('aj.papel')}</option>
    <option value="sistema">{t('aj.sistema')}</option>
  </select>
</div>
<div class="ajuste">
  <label for="aj-tam">{t('aj.tamano')} <small>{a.tamano} px</small></label>
  <input id="aj-tam" type="range" min="15" max="32" step="1" value={a.tamano} oninput={(e) => ajustar('tamano', Number(e.currentTarget.value))} />
</div>
<div class="ajuste">
  <label for="aj-int">{t('aj.interlineado')} <small>{a.interlineado}</small></label>
  <input id="aj-int" type="range" min="1.35" max="2.2" step="0.05" value={a.interlineado} oninput={(e) => ajustar('interlineado', Number(e.currentTarget.value))} />
</div>
<div class="ajuste">
  <label for="aj-fuente">{t('aj.fuente')} <small>{t('aj.fuenteAyuda')}</small></label>
  <select id="aj-fuente" value={a.fuente} onchange={(e) => ajustar('fuente', e.currentTarget.value)}>
    <option value="literata">{t('aj.literata')}</option>
    <option value="atkinson">{t('aj.atkinson')}</option>
  </select>
</div>
<div class="ajuste">
  <label for="aj-estudio">{t('aj.estudioAlAbrir')} <small>{t('aj.estudioAlAbrirAyuda')}</small></label>
  <input id="aj-estudio" type="checkbox" checked={a.estudioAlAbrir} onchange={(e) => ajustar('estudioAlAbrir', e.currentTarget.checked)} />
</div>
<div class="ajuste">
  <label for="aj-lector">{t('aj.modoLector')} <small>{t('aj.modoLectorAyuda')}</small></label>
  <input id="aj-lector" type="checkbox" checked={a.modoLector} onchange={(e) => ajustar('modoLector', e.currentTarget.checked)} />
</div>
<div class="ajuste">
  <label for="aj-parrafo">{t('aj.parrafo')} <small>{t('aj.parrafoAyuda')}</small></label>
  <input id="aj-parrafo" type="checkbox" checked={a.parrafo} onchange={(e) => ajustar('parrafo', e.currentTarget.checked)} />
</div>
<div class="ajuste">
  <label for="aj-par">{t('aj.paralela')}</label>
  <select id="aj-par" value={a.paralela} onchange={(e) => ajustar('paralela', e.currentTarget.value)}>
    <option value="">{t('aj.ninguna')}</option>
    {#each lista().filter((v) => v.id !== a.version) as v}<option value={v.id}>{v.id} · {v.nombre}</option>{/each}
  </select>
</div>
<h3>{t('aj.otros')}</h3>
<div class="fila-botones">
  <button class="boton secundario" onclick={() => (ui.dialogo = 'versiones')}>{t('aj.abrirVersiones')}</button>
  <button class="boton secundario" onclick={() => (ui.dialogo = 'respaldo')}>{t('aj.abrirRespaldo')}</button>
</div>
<VozAjustes />
{#if esTauri}
  <h3>{t('act.titulo')} <small class="cuenta">{act.actual ? t('act.tienes', { v: act.actual }) : ''}</small></h3>
  <div class="ajuste">
    <label for="aj-actualizar">{t('act.solo')} <small>{t('act.soloD')}</small></label>
    <input id="aj-actualizar" type="checkbox" checked={a.actualizarSolo !== false} onchange={(e) => ajustar('actualizarSolo', e.currentTarget.checked)} />
  </div>
  <div class="fila-botones">
    {#if act.estado === 'hay'}
      <button class="boton" onclick={instalarActualizacion}>{t('act.instalarV', { v: act.version })}</button>
    {:else}
      <button class="boton secundario" onclick={() => buscarActualizacion()} disabled={act.estado === 'buscando' || act.estado === 'bajando'}>{act.estado === 'buscando' ? t('act.buscando') : t('act.buscar')}</button>
    {/if}
    {#if act.estado === 'al-dia'}<span class="nota-pie">{t('act.alDia')}</span>{/if}
    {#if act.estado === 'error'}<span class="nota-pie">{t('act.error', { e: act.error })}</span>{/if}
    {#if act.estado === 'bajando'}<span class="nota-pie">{t('act.bajando', { p: Math.round(act.progreso * 100) })}</span>{/if}
  </div>
{/if}
<h3>{t('aj.atajos')}</h3>
<p class="ayuda">
  <span class="tecla">Ctrl K</span> · <span class="tecla">/</span>
  {@html t('aj.atajosTexto', {
    flechas: '<span class="tecla">←</span> <span class="tecla">→</span>',
    esc: '<span class="tecla">Esc</span>',
    mayus: `<span class="tecla">${usuario.ajustes.idioma === 'en' ? 'Shift' : 'Mayús'}</span>`,
  })}
</p>
