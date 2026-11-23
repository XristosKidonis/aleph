<script>
  // Candado al abrir: si pusiste contraseña, la app la pide antes de mostrar nada. Va en el aspecto que
  // elegiste. Si la olvidas, la pantalla explica cómo quitarlo sin perder tus notas.
  import { onMount } from 'svelte';
  import { usuario } from '../lib/usuario.svelte.js';
  import { ui } from '../lib/ui.svelte.js';
  import { t } from '../lib/i18n.svelte.js';
  import { esTauri } from '../lib/bd.js';
  import { abreCandado, carpetaDatos, ARCHIVO_OLVIDO } from '../lib/candado.js';

  let clave = $state('');
  let mal = $state(false);
  let probando = $state(false);
  let olvido = $state(false);
  let carpeta = $state('');
  let campo;

  const nombre = $derived(usuario.ajustes.nombre);

  async function probar(e) {
    e.preventDefault();
    if (!clave || probando) return;
    probando = true;
    mal = false;
    const abre = await abreCandado(usuario.ajustes.candado, clave);
    if (abre) {
      clave = '';
      ui.llegada = true;
      ui.puerta = null;
      return;
    }
    // una pausa corta ante cada intento fallido
    await new Promise((r) => setTimeout(r, 450));
    probando = false;
    mal = true;
    clave = '';
    campo?.focus();
  }

  async function verOlvido() {
    olvido = !olvido;
    if (olvido && esTauri && !carpeta) carpeta = await carpetaDatos().catch(() => '');
  }

  onMount(() => { campo?.focus({ preventScroll: true }); });
</script>

<section class="puerta candado" aria-label={t('cd.aria')}>
  <form class="puerta-pila" onsubmit={probar} autocomplete="off">
    <h1 class="puerta-hola">{nombre ? t('cd.hola', { n: nombre }) : t('cd.holaSin')}</h1>
    <label for="cd-clave">{t('cd.clave')}</label>
    <div class="puerta-campo">
      <input id="cd-clave" type="password" bind:this={campo} bind:value={clave} autocomplete="current-password"
        aria-invalid={mal ? 'true' : undefined} aria-describedby={mal ? 'cd-mal' : undefined} />
      <span class="puerta-raya llena"></span>
    </div>
    {#if mal}<p class="puerta-ayuda error" id="cd-mal" role="alert">{t('cd.mal')}</p>{/if}
    <div class="puerta-fila">
      <button type="button" class="puerta-olvido" aria-expanded={olvido} onclick={verOlvido}>{t('cd.olvido')}</button>
      <button class="puerta-entrar" type="submit" disabled={!clave || probando}>{t('bv.entrar')}</button>
    </div>
    {#if olvido}
      <p class="puerta-ayuda">
        {#if esTauri}
          {t('cd.olvidoTexto', { archivo: ARCHIVO_OLVIDO })}
          {#if carpeta}<code class="puerta-ruta">{carpeta}</code>{/if}
        {:else}
          {t('cd.olvidoWeb')}
        {/if}
      </p>
    {/if}
  </form>
</section>
