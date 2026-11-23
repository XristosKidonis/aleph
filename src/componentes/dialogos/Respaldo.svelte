<script>
  import { exportar, importar, usuario } from '../../lib/usuario.svelte.js';
  import { avisar, copiarTexto } from '../../lib/ui.svelte.js';
  import { guardarArchivo } from '../../lib/archivos.js';
  import { esTauri } from '../../lib/bd.js';
  import { t, fecha } from '../../lib/i18n.svelte.js';
  import { desclave, nombreRef, nombreLibro, LIBROS } from '../../lib/libros.js';

  let mensaje = $state('');

  // Las notas como Markdown legible (Obsidian, Notion, imprimir): por libro en orden bíblico, y dentro de cada
  // libro por capítulo y versículo. Solo las notas: el JSON sigue siendo el respaldo completo.
  function notasMarkdown() {
    const orden = (n) => { const r = desclave(n.ref); return r.libro * 1e6 + r.cap * 1e3 + r.v; };
    const lineas = [`# ${t('res.mdTitulo')}`, '', `_${fecha(Date.now(), { dateStyle: 'long' })}_`];
    let libro = 0;
    for (const n of usuario.notas.toSorted((a, b) => orden(a) - orden(b) || a.creada - b.creada)) {
      const r = desclave(n.ref);
      if (r.libro !== libro) { libro = r.libro; lineas.push('', `## ${nombreLibro(LIBROS[libro - 1])}`); }
      const hasta = Number(n.hasta) || null; // número del último versículo, como en Notas.svelte
      const estado = n.respondida ? ` · ${t('notas.respondida')}` : '';
      lineas.push('', `### ${nombreRef(r.libro, r.cap, r.v, hasta)} · ${t(`notas.tipo.${n.tipo}`)}${estado}`, '', String(n.texto || '').trim(), '', `<small>${fecha(Number(n.creada), { dateStyle: 'medium' })}</small>`);
    }
    return `${lineas.join('\n')}\n`;
  }

  async function descargarNotas() {
    const hoy = new Date().toISOString().slice(0, 10);
    try {
      if (await guardarArchivo(`aleph-notas-${hoy}.md`, notasMarkdown(), { name: 'Markdown', extensions: ['md'] })) {
        avisar(t('res.mdGuardado', { n: usuario.notas.length }));
      }
    } catch (e) {
      avisar(t('res.noGuardado', { e: e.message || e }), true);
    }
  }

  async function descargar() {
    const hoy = new Date().toISOString().slice(0, 10);
    try {
      if (await guardarArchivo(`aleph-respaldo-${hoy}.json`, JSON.stringify(exportar(), null, 2), { name: 'Respaldo', extensions: ['json'] })) {
        avisar(t('res.guardado'));
      }
    } catch (e) {
      avisar(t('res.noGuardado', { e: e.message || e }), true);
    }
  }

  async function copiar() {
    avisar((await copiarTexto(JSON.stringify(exportar()))) ? t('res.copiado') : t('res.noCopiado'));
  }

  async function cargar(e) {
    const archivo = e.currentTarget.files?.[0];
    if (!archivo) return;
    try {
      const n = importar(JSON.parse(await archivo.text()));
      mensaje = n ? t('res.anadidos', { n }) : t('res.nadaNuevo');
    } catch (err) {
      mensaje = err.message || t('res.noLeido');
    }
    e.currentTarget.value = '';
  }
</script>

<h3>{t('res.datos')}</h3>
<p class="ayuda">
  {t('res.resumen', { notas: usuario.notas.length, sub: Object.keys(usuario.subrayados).length, cintas: usuario.cintas.length, mem: usuario.memoria.length, leidos: Object.keys(usuario.leidos).length })}
  {esTauri ? t('res.dondeApp') : t('res.dondeWeb')}
</p>
<h3>{t('res.exportar')}</h3>
<p class="ayuda">{t('res.exportarAyuda')}</p>
<div class="fila-botones">
  <button class="boton" onclick={descargar}>{t('res.guardar')}</button>
  <button class="boton secundario" onclick={copiar}>{t('res.copiar')}</button>
</div>
<h3>{t('res.mdNotas')}</h3>
<p class="ayuda">{t('res.mdAyuda')}</p>
<div class="fila-botones">
  <button class="boton secundario" onclick={descargarNotas} disabled={!usuario.notas.length}>{t('res.mdGuardar')}</button>
</div>
<h3>{t('res.importar')}</h3>
<p class="ayuda">{t('res.importarAyuda')}</p>
<input class="campo" type="file" accept=".json,application/json" onchange={cargar} aria-label={t('res.archivo')} />
{#if mensaje}<p class="nota-pie">{mensaje}</p>{/if}
<h3>{t('res.sync')}</h3>
<p class="ayuda">{t('res.syncAyuda')}</p>
