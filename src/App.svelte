<script>
  import { onMount } from 'svelte';
  import Cabecera from './componentes/Cabecera.svelte';
  import NavMovil from './componentes/NavMovil.svelte';
  import Buscador from './componentes/Buscador.svelte';
  import Marca from './componentes/Marca.svelte';
  import Navegacion from './componentes/Navegacion.svelte';
  import Biblioteca from './componentes/vistas/Biblioteca.svelte';
  import Archivo from './componentes/vistas/Archivo.svelte';
  import Galeria from './componentes/vistas/Galeria.svelte';
  import Historia from './componentes/vistas/Historia.svelte';
  import Visor from './componentes/historia/Visor.svelte';
  import Lector from './componentes/Lector.svelte';
  import Estudio from './componentes/Estudio.svelte';
  import Acciones from './componentes/Acciones.svelte';
  import Dialogo from './componentes/Dialogo.svelte';
  import Inicio from './componentes/Inicio.svelte';
  import Actualizacion from './componentes/Actualizacion.svelte';
  import Portada from './componentes/Portada.svelte';
  import Bienvenida from './componentes/Bienvenida.svelte';
  import Candado from './componentes/Candado.svelte';
  import Seteo from './componentes/Seteo.svelte';
  import VentanaBotones, { hayVentana, ladoVentana } from './componentes/VentanaBotones.svelte';
  import { pidioQuitarCandado } from './lib/candado.js';
  import { buscarAlAbrir } from './lib/actualizar.svelte.js';
  import { ui, irA, recargarCapitulo, avisar } from './lib/ui.svelte.js';
  import { usuario, iniciarUsuario, ajustar, COLORES_SKIN } from './lib/usuario.svelte.js';
  import { cargarVersiones, info } from './lib/biblia.js';
  import { capituloSiguiente, fijarIdiomaLibros } from './lib/libros.js';
  import { t } from './lib/i18n.svelte.js';
  import { abrirEnNavegador } from './lib/archivos.js';
  import { esTauri } from './lib/bd.js';

  let listo = $state(false);
  // Sin cabecera (arranque, bienvenida, candado, Inicio, modo Calma) los botones de la ventana van en una
  // franja fina arriba, que también sirve para arrastrarla
  const sinCabecera = $derived(!listo || !!ui.puerta || ui.vista === 'inicio' || (ui.vista === 'lector' && usuario.ajustes.calma));
  if (hayVentana && typeof document !== 'undefined') document.documentElement.dataset.ventana = ladoVentana;
  let fallo = $state('');

  onMount(async () => {
    try {
      const versiones = cargarVersiones();
      versiones.catch(() => {}); // su error se atiende abajo; sin esto, si falla mientras se cargan tus datos, queda «sin atender»
      await iniciarUsuario();
      // ¿olvidaste la contraseña y dejaste el archivo para quitar el candado? (ver candado.js)
      if (usuario.ajustes.candado && await pidioQuitarCandado()) {
        ajustar('candado', null);
        avisar(t('cd.quitado'));
      }
      // En la web la base bíblica pesa unos 67 MB comprimida. Si se lee en la NTV o la NLT (que vienen de
      // internet) no hace falta esperarla: la app abre ya y la base sigue bajando por detrás. Lo que la
      // necesita (búsqueda, estudio, versiones incluidas) la espera solo cuando se usa.
      if (esTauri || !info(usuario.ajustes.version)?.enLinea) await versiones;
      else versiones.catch((e) => avisar(e.message || String(e), true)); // la NTV sigue funcionando
      if (!info(usuario.ajustes.version)) usuario.ajustes.version = 'NTV';
      ui.vista = usuario.ajustes.mostrarInicio ? 'inicio' : 'lector';
      // antes de todo: la bienvenida la primera vez; después, el candado si pusiste contraseña
      if (!usuario.ajustes.bienvenido) { ui.puerta = 'bienvenida'; ui.vista = 'inicio'; }
      else if (usuario.ajustes.candado) ui.puerta = 'candado';
      listo = true;
      buscarAlAbrir();
    } catch (e) {
      fallo = e.message || String(e);
    }
  });

  // Cargar el capítulo cuando cambia la posición, la versión o la paralela
  $effect(() => {
    if (!listo) return;
    usuario.ajustes.pos.libro; usuario.ajustes.pos.cap;
    usuario.ajustes.version; usuario.ajustes.paralela; usuario.ajustes.claveNLT;
    recargarCapitulo();
  });

  // Idioma: los nombres de libro se fijan antes de volver a pintar la interfaz
  const idiomaUI = $derived.by(() => {
    fijarIdiomaLibros(usuario.ajustes.idioma);
    return usuario.ajustes.idioma;
  });
  $effect(() => { document.documentElement.lang = idiomaUI === 'en' ? 'en' : 'es'; });

  // Tema y tipografía. Todo es claro; el modo oscuro es solo del lector (y sus paneles).
  $effect(() => {
    const r = document.documentElement;
    const { tema, tamano, interlineado, fuente } = usuario.ajustes;
    // la bienvenida y sus preguntas van siempre en Blanco: cada quien elige su aspecto después, en Ajustes
    const skin = ui.puerta === 'bienvenida' || ui.puerta === 'seteo' ? 'blanco' : usuario.ajustes.skin;
    const enLector = ui.vista === 'lector';
    // skin: una capa de colores, letras y diagramación encima del diseño base (skins.css)
    if (skin === 'imprenta' || skin === 'editorial') r.dataset.skin = skin;
    else delete r.dataset.skin;
    // color del skin: solo se marca si no es el primero (el de por defecto ya está en skins.css)
    const color = usuario.ajustes.colorSkin?.[skin];
    if (COLORES_SKIN[skin]?.slice(1).some((c) => c.id === color)) r.dataset.color = color;
    else delete r.dataset.color;
    if (tema === 'sistema' && enLector) r.removeAttribute('data-theme');
    else r.setAttribute('data-theme', tema === 'cuero' && enLector ? 'dark' : 'light');
    r.style.setProperty('--tam-texto', `${tamano}px`);
    r.style.setProperty('--interlineado', interlineado);
    r.style.setProperty('--f-texto', fuente === 'atkinson' ? 'var(--f-atkinson)' : 'var(--f-literata)');
  });

  function tecla(e) {
    if (ui.puerta) return; // ni buscador ni atajos antes de entrar
    const escribiendo = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ui.buscadorAbierto = true; return; }
    if (e.key === 'Escape') {
      if (ui.dialogo || ui.buscadorAbierto || ui.visor) return; // los diálogos se cierran solos
      if (usuario.ajustes.calma && ui.vista === 'lector') ajustar('calma', false);
      else if (ui.menuBarra) ui.menuBarra = null;
      else if (ui.seleccion.length) ui.seleccion = [];
      else if (ui.navAbierta) ui.navAbierta = false;
      else if (ui.estudioAbierto && ui.vista === 'lector') ui.estudioAbierto = false;
      else if (ui.vista === 'laminas' && ui.coleccion) ui.coleccion = null;
      return;
    }
    if (escribiendo || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); ui.buscadorAbierto = true; }
    if (ui.vista !== 'lector') return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const p = capituloSiguiente(usuario.ajustes.pos.libro, usuario.ajustes.pos.cap, e.key === 'ArrowLeft' ? -1 : 1);
      if (p) irA(p.libro, p.cap);
    }
  }

  // En la app de escritorio los enlaces externos se abren en tu navegador
  function clic(e) {
    const a = e.target.closest('a[target="_blank"]');
    if (a && esTauri) {
      e.preventDefault();
      abrirEnNavegador(a.href);
    }
  }
</script>

<svelte:window onkeydown={tecla} onclick={clic} />

{#if hayVentana && sinCabecera}
  <div class="franja-ventana" class:a-la-derecha={ladoVentana === 'derecha'} data-tauri-drag-region><VentanaBotones /></div>
{/if}

{#if !listo}
  <div class="arranque">
    {#if fallo}
      <p class="cartel">{t('app.noAbrir')} <em>{t('app.noAbrirEm')}</em></p>
      <p class="ayuda">{fallo}</p>
    {:else}
      <Marca grande />
    {/if}
  </div>
{:else}
  {#key idiomaUI}
  {#if ui.puerta}
    {#if ui.puerta === 'bienvenida'}<Bienvenida />{:else if ui.puerta === 'seteo'}<Seteo />{:else}<Candado />{/if}
  {:else if ui.vista === 'inicio'}
    <Inicio />
  {:else}
    {@const calma = ui.vista === 'lector' && usuario.ajustes.calma}
    <div class="app" class:calma data-vista={ui.vista}>
      {#if !calma}<Cabecera />{/if}
      {#if ui.vista === 'lector'}
        <div class="marco" class:con-estudio={ui.estudioAbierto}>
          <Lector />
          <Estudio />
        </div>
        <Navegacion />
        {#if ui.navAbierta || (ui.estudioAbierto && typeof innerWidth !== 'undefined' && innerWidth <= 900)}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="velo" onclick={() => { ui.navAbierta = false; if (innerWidth <= 900) ui.estudioAbierto = false; }}></div>
        {/if}
        <Acciones />
        {#if calma}<button class="salir-calma" onclick={() => ajustar('calma', false)}>{t('lec.calmaSalir')}</button>{/if}
      {:else}
        <main class="vista">
          {#if ui.vista === 'biblioteca'}<Biblioteca />
          {:else if ui.vista === 'archivo'}<Archivo />
          {:else if ui.vista === 'historia'}<Historia />
          {:else}<Galeria />{/if}
        </main>
      {/if}
      {#if !calma}<NavMovil />{/if}
    </div>
  {/if}
  {#if !ui.puerta}
  <Buscador />
  <Dialogo />
  <Actualizacion />
  <Visor />
  {/if}
  {#if ui.portada}{#key ui.portada}<Portada libro={ui.portada} />{/key}{/if}
  {#if ui.aviso}<div class="aviso" class:error={ui.aviso.error} class:arriba={ui.vista === 'lector' && ui.seleccion.length > 0} role="status">{ui.aviso.texto}</div>{/if}
  {#if usuario.error}<div class="aviso error" role="alert">{t('app.noGuardar', { e: usuario.error })}</div>{/if}
  {/key}
{/if}
