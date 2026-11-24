// Prueba funcional de Aleph en modo navegador.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
// Requiere Playwright (npm i -g playwright) y «npm run dev» en marcha. PLAYWRIGHT_DIR apunta a node_modules global.
// MOTOR=webkit la corre con el motor de la app en Mac (npx playwright install webkit); por defecto, chromium.
const pw = createRequire(process.env.PLAYWRIGHT_DIR || import.meta.url)('playwright');

const OUT = process.argv[2];
const DIRECCION = process.env.DIRECCION || 'http://127.0.0.1:1420/';

// Respuesta simulada de api.nlt.to con el formato documentado (verse_export, .vn, .subhead, .tn)
function falsaNLT(ref, version) {
  const [, libro, cap] = ref.match(/^(.*?) (\d+)(?::.*)?$/); // con la clave de prueba llegan tramos: «Numbers 1:1-50»
  const n = 20;
  // como en la NTV real: Números 1 une versículos («18-19», con una tabla) y Marcos 9 no trae algunos (4 y 6)
  const unidos = /^(Números|Numbers)$/.test(libro) && cap === '1';
  const omitidos = /^(Marcos|Mark)$/.test(libro) && cap === '9' ? [4, 6] : [];
  let html = `<div id="bibletext"><section><h2 class="bk_ch_vs_header">${ref}, ${version}</h2>`;
  html += `<p class="subhead">Título de sección simulado</p>`;
  for (let v = 1; v <= n; v++) {
    if (omitidos.includes(v)) continue;
    if (unidos && v === 19) { html += `<verse_export orig="x_${cap}_19" bk="x" ch="${cap}" vn="19"></verse_export>`; continue; }
    let extra = v === 16 ? ' Porque Dios amó tanto al mundo que dio a su único Hijo<a class="a-tn">*</a><span class="tn"><span class="tn-ref">3:16</span> Nota al pie.</span>' : ` texto de prueba ${version} ${libro} ${cap}:${v}.`;
    if (unidos && v === 18) extra += '<table><tr><td>Simeón</td><td class="table-col">59.300</td></tr></table>';
    // párrafos que cruzan versículos, como en la API real (Apocalipsis 22): el <p> abre en un versículo y sigue
    // en los siguientes, y al terminar el párrafo queda un <p> suelto sin cerrar antes del </verse_export>
    const abre = v % 5 === 1 ? '\n<p class="body">' : '';
    const cierra = v === n ? '</p>' : v % 5 === 0 ? '<p>\n' : '';
    html += `<verse_export orig="x_${cap}_${v}" bk="x" ch="${cap}" vn="${v}">${abre}<span class="vn">${unidos && v === 18 ? '18-19' : v}</span>${extra}${cierra}</verse_export>`;
  }
  return html + '</section></div>';
}

const errores = [];
const navegador = await pw[process.env.MOTOR || 'chromium'].launch();
const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
// La música del Ambiente tarda 0,4 s en arrancar, como con la máquina ocupada: así la prueba toca «Siguiente»
// justo mientras arranca, que antes dejaba el reproductor trabado en «Cargando…»
await ctx.addInitScript(() => {
  const play = HTMLMediaElement.prototype.play;
  window.__arrancando = 0;
  HTMLMediaElement.prototype.play = function () {
    if (!String(this.src).startsWith('blob:')) return play.call(this);
    window.__arrancando++;
    // como uno real: pasa a «sonando» al instante y la promesa tarda (el resultado se maneja ya, no a los 0,4 s)
    const demora = () => new Promise((listo) => setTimeout(() => { window.__arrancando--; listo(); }, 400));
    return play.call(this).then(async (v) => { await demora(); return v; }, async (e) => { await demora(); throw e; });
  };
});
const pag = await ctx.newPage();
pag.on('pageerror', (e) => errores.push('pageerror: ' + e.message));
pag.on('console', (m) => { if (m.type() === 'error') errores.push('console: ' + m.text()); });
let pedidosNLT = 0;
// sonidos Zen que pidió la app (lib/sonidos.js): señal → estado HTTP
const sonidos = new Map();
pag.on('response', (r) => { const m = r.url().match(/sonidos\/zen\/([a-z]+)\.mp3$/); if (m) sonidos.set(m[1], r.status()); });
await pag.route('https://api.nlt.to/**', (route) => {
  pedidosNLT++;
  const u = new URL(route.request().url());
  route.fulfill({ status: 200, contentType: 'text/html', body: falsaNLT(u.searchParams.get('ref'), u.searchParams.get('version')) });
});

const paso = async (nombre, fn) => {
  try { await fn(); console.log('OK  ', nombre); } catch (e) { console.log('FALLA', nombre, '-', e.message.split('\n')[0]); errores.push(nombre); }
};

// La primera vez: bienvenida (siempre en Blanco). Se salta la animación, se pone un nombre y se entra.
async function pasarBienvenida(p, nombre = 'Prueba', clave = '') {
  await p.waitForSelector('.bienvenida', { timeout: 20000 });
  await p.click('.puerta-saltar');
  await p.fill('#bv-nombre', nombre);
  if (clave) { await p.check('.puerta-casilla input'); await p.fill('#bv-clave', clave); }
  await p.press('#bv-nombre', 'Enter');
  await p.click('.seteo-ahora-no', { timeout: 20000 });
  await p.waitForSelector('.inicio .marca-grande', { timeout: 20000 });
}
// Inicio → «Continuar leyendo» → lector
async function entrar(p) {
  await p.waitForSelector('.inicio-entrada', { timeout: 20000 });
  await p.click('.inicio-entrada >> nth=0');
  await p.waitForSelector('.texto .v', { timeout: 20000 });
}
// Búsqueda global (Ctrl K): una referencia va directo al pasaje
async function ir(p, texto) {
  await p.keyboard.press('Control+k');
  await p.waitForSelector('.buscador[open] input');
  await p.fill('.buscador input', texto);
  await p.press('.buscador input', 'Enter');
  await p.waitForSelector('.buscador[open]', { state: 'detached' }).catch(() => {});
}
// abre un menú de la barra del lector: 'versiones' (versión y paralela) o 'aa' (tamaño, tema, letra, margen, Calma)
async function menu(p, cual) {
  if ((await p.getAttribute(`.lb-${cual}`, 'aria-expanded')) !== 'true') await p.click(`.lb-${cual}`);
  await p.waitForSelector('.lb-menu');
}
async function abrirEstudio(p) {
  if ((await p.getAttribute('.lb-estudio', 'aria-pressed')) !== 'true') await p.click('.lb-estudio');
  await p.waitForSelector('.estudio .pestanas-estudio');
}
const titulo = (p) => p.textContent('.cap-titulo');
await pag.goto(DIRECCION);
await paso('bienvenida: en Blanco, «hola» en varios idiomas, pide el nombre y el Inicio saluda', async () => {
  await pag.waitForSelector('.bienvenida', { timeout: 20000 });
  if (await pag.evaluate(() => document.documentElement.dataset.skin)) throw new Error('la bienvenida no está en Blanco');
  await pag.waitForFunction(() => document.querySelector('.puerta-palabra')?.textContent === 'Hola', null, { timeout: 5000 });
  await pag.waitForFunction(() => document.querySelector('.puerta-palabra')?.textContent === 'Hello', null, { timeout: 5000 });
  if (await pag.$('.buscador[open]')) throw new Error('el buscador se abre antes de entrar');
  await pag.keyboard.press('Control+k');
  if (await pag.$('.buscador[open]')) throw new Error('Ctrl K abre el buscador durante la bienvenida');
  await pag.click('.puerta-saltar');
  await pag.waitForSelector('.puerta-forma.ver');
  if (!(await pag.isDisabled('.puerta-entrar'))) throw new Error('se puede entrar sin nombre');
  await pag.fill('#bv-nombre', 'Xristos');
  await pag.press('#bv-nombre', 'Enter');
  await pag.waitForFunction(() => /Hola, Xristos\./.test(document.querySelector('.puerta-palabra')?.textContent || ''), null, { timeout: 5000 });
  await pag.waitForSelector('.seteo .seteo-opcion', { timeout: 10000 });
  if (await pag.evaluate(() => document.documentElement.dataset.skin)) throw new Error('el seteo no está en Blanco');
  await pag.click('.seteo-ahora-no');
  await pag.waitForSelector('.inicio .marca-grande', { timeout: 10000 });
  const saludo = await pag.textContent('.inicio-saludo');
  if (saludo !== 'Hola, Xristos') throw new Error('saludo: ' + saludo);
  await pag.reload();
  await pag.waitForSelector('.inicio .marca-grande', { timeout: 20000 });
  if (await pag.$('.puerta')) throw new Error('la bienvenida volvió a salir');
});
await paso('inicio con la marca nítida, cinco entradas y biblioteca de 66 libros', async () => {
  await pag.waitForSelector('.inicio .marca-grande');
  // la marca Aleph es el vector (alef + ALEPH), sin filtros y con tamaño real
  const estilo = await pag.evaluate(() => { const g = document.querySelector('.marca-grande'); const l = g.querySelector('.marca-horizontal'); return [getComputedStyle(l).filter, g.getAttribute('aria-label'), l.querySelectorAll('path').length, Math.round(l.getBoundingClientRect().width)]; });
  if (estilo[0] !== 'none' || estilo[1] !== 'Aleph' || estilo[2] !== 2 || estilo[3] < 150) throw new Error(estilo.join(' | '));
  if ((await pag.locator('.inicio-entrada').count()) !== 5) throw new Error('el inicio no tiene cinco entradas');
  if (await pag.locator('.inicio img:not(.inicio-cultura img)').count()) throw new Error('foto en el inicio');
  const sugerencia = await pag.locator('.inicio-empezar button').textContent();
  if (!/Juan/.test(sugerencia)) throw new Error('sin la sugerencia de empezar por Juan: ' + sugerencia);
  await pag.click('.inicio-entrada >> nth=1');
  await pag.waitForSelector('.cubierta');
  if ((await pag.locator('.cubierta').count()) !== 66) throw new Error('faltan libros');
  const filtroLogo = await pag.evaluate(() => getComputedStyle(document.querySelector('.cabecera .marca-logo')).filter);
  if (filtroLogo !== 'none') throw new Error('logo con filtro: ' + filtroLogo);
  await pag.click('.filtro >> nth=2');
  if ((await pag.locator('.cubierta').count()) !== 27) throw new Error('filtro NT');
  await pag.click('.filtro >> nth=0');
  await pag.click('.cubierta >> nth=0');
  // abrir un libro desde la Biblioteca muestra su portada; un toque la salta
  await pag.waitForSelector('.portada .pt-nota', { timeout: 5000 });
  await pag.click('.portada');
  await pag.waitForSelector('.portada', { state: 'detached', timeout: 3000 });
  await pag.waitForSelector('.texto .v', { timeout: 20000 });
});
await paso('arranca en Génesis 1 con NTV', async () => {
  const h1 = await titulo(pag);
  if (!/Génesis\s*1/.test(h1)) throw new Error(h1);
  const sub = await pag.textContent('.texto .subtitulo');
  if (!/Título/.test(sub)) throw new Error('sin subtítulo NTV');
  // cada versículo trae solo su texto aunque el párrafo siga en los siguientes, y no falta ninguno
  const textos = await pag.$$eval('.texto [data-v] .t', (els) => els.map((e) => [e.closest('[data-v]').dataset.v, e.textContent.trim()]));
  const propio = (v, x) => (v === '16' ? /^Porque Dios amó.*Hijo$/.test(x) && !/texto de prueba/.test(x) : x.endsWith(`:${v}.`) && x.match(/texto de prueba/g).length === 1);
  const mal = textos.filter(([v, x]) => !propio(v, x));
  if (textos.length !== 20 || mal.length) throw new Error(`${textos.length} versículos; con texto ajeno: ${mal.map(([v]) => v).join(',')}`);
});
await pag.screenshot({ path: `${OUT}/01-genesis-ntv.png` });

await paso('NTV: versículos unidos («18–19») y omitidos se ven y la búsqueda llega a ellos', async () => {
  // pedir el 19 lleva al bloque 18–19, que queda elegido; las celdas de la tabla no se pegan
  await ir(pag, 'nm 1:19');
  await pag.waitForSelector('.texto .v[data-v="18"].sel', { timeout: 20000 });
  const num = (await pag.textContent('.texto .v[data-v="18"] .num')).trim();
  if (num !== '18–19') throw new Error('número del bloque: ' + num);
  if (await pag.locator('.texto .v[data-v="19"]').count()) throw new Error('el 19 aparece suelto además del bloque');
  const t = await pag.textContent('.texto .v[data-v="18"] .t');
  if (!/Simeón 59\.300/.test(t)) throw new Error('tabla mal leída: ' + t);
  // los que la traducción no trae ocupan su lugar con un aviso, sin quedar elegidos
  await ir(pag, 'mr 9:4');
  await pag.waitForSelector('.texto .v.omitido[data-v="4"]', { timeout: 20000 });
  if (!/no incluye este versículo/.test(await pag.textContent('.texto .v.omitido[data-v="6"]'))) throw new Error('sin aviso en el 6');
  if (await pag.locator('.texto .v.sel').count()) throw new Error('quedó elegido un versículo omitido');
});

await paso('voz: «Escuchar» desde la selección, la pausa recuerda el versículo y no quedan dos lecturas', async () => {
  // voz del sistema simulada: cada versículo «suena» 300 ms; cancel() avisa con un error («interrupted») como
  // Chrome y WebView2, pero tarde (0,4 s): para entonces ya empezó otra lectura, que no puede duplicarse
  await pag.evaluate(() => {
    window.__dichos = [];
    let actual = null;
    // el WebKit de Playwright en Windows no trae voz del sistema (una Mac real sí): se crea la simulada
    if (!('speechSynthesis' in window)) {
      window.speechSynthesis = { getVoices: () => [], addEventListener() {} };
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    }
    speechSynthesis.speak = (u) => { actual = u; window.__dichos.push(u.text); setTimeout(() => { if (actual === u) { actual = null; u.onend?.(); } }, 300); };
    speechSynthesis.cancel = () => { const u = actual; actual = null; if (u) setTimeout(() => u.onerror?.({ error: 'interrupted' }), 400); };
  });
  await ir(pag, 'jn 1:2');
  await pag.waitForSelector('.texto .v[data-v="2"].sel', { timeout: 20000 });
  await pag.click('.acc-escuchar');
  await pag.waitForSelector('.texto .v[data-v="4"].leyendo', { timeout: 5000 });
  // pausa con el parlante de arriba: recuerda el versículo que sonaba
  await pag.click('.lb-voz');
  const titulo = await pag.getAttribute('.lb-voz', 'title');
  const enPausa = Number(titulo.match(/\d+/)?.[0]);
  if (!(enPausa >= 4)) throw new Error('sin memoria de la pausa: ' + titulo);
  // seguir: arranca en ese versículo (no en el 2) y hay una sola lectura
  await pag.evaluate(() => { window.__dichos = []; });
  await pag.click('.lb-voz');
  await pag.waitForTimeout(800);
  const dichos = await pag.evaluate(() => window.__dichos);
  if (!dichos[0]?.includes(`:${enPausa}.`)) throw new Error(`siguió en «${dichos[0]}», no en el ${enPausa}`);
  if (new Set(dichos).size !== dichos.length) throw new Error('dos lecturas a la vez: ' + dichos.join(' | '));
  // elegir otro versículo y «Escuchar» empieza ahí
  await pag.click('.lb-voz');
  await pag.click('.texto .v[data-v="12"] .t');
  await pag.evaluate(() => { window.__dichos = []; });
  await pag.click('.acc-escuchar');
  await pag.waitForTimeout(150);
  if (!(await pag.evaluate(() => window.__dichos[0]))?.includes(':12.')) throw new Error('«Escuchar» no empezó en el elegido');
  await pag.click('.acc-escuchar'); // pausar
  await pag.keyboard.press('Escape');
});

await paso('ir a Jn 3:16 con la búsqueda (Ctrl K)', async () => {
  // Ctrl K enseguida de elegir un resultado abre igual (antes, el aviso viejo de «cerrado» lo volvía a cerrar)
  for (let i = 0; i < 4; i++) {
    await pag.keyboard.press('Control+k');
    await pag.waitForSelector('.buscador[open] input');
    await pag.fill('.buscador input', `jn ${i + 1}`);
    await pag.press('.buscador input', 'Enter');
    await pag.keyboard.press('Control+k');
    await pag.waitForSelector('.buscador[open] input', { timeout: 2000 });
    await pag.keyboard.press('Escape');
    await pag.waitForSelector('.buscador[open]', { state: 'detached' });
  }
  await ir(pag, 'jn 3:16');
  await pag.waitForFunction(() => document.querySelector('.cap-titulo em')?.textContent === '3');
  const t = await pag.textContent('.texto [data-v="16"] .t');
  if (!/amó tanto/.test(t)) throw new Error(t);
  if (/Nota al pie/.test(t)) throw new Error('la nota al pie no se quitó');
});

await paso('tocar una palabra selecciona versículo y palabra', async () => {
  await pag.waitForTimeout(900);
  const caja = await pag.locator('.texto [data-v="16"] .t').boundingBox();
  // clic sobre «Dios» (cerca del inicio del texto)
  await pag.mouse.click(caja.x + 80, caja.y + 12);
  await pag.waitForSelector('.acciones');
  const p = await pag.textContent('.acc-palabra');
  console.log('     palabra capturada:', p.trim());
});

await paso('subrayar en rojo', async () => {
  await pag.click('.colores [data-color="rojo"]');
  const m = await pag.getAttribute('.texto [data-v="16"] .t', 'data-m');
  if (m !== 'rojo') throw new Error(m);
});

await paso('estudio de palabra con concordancia en RV1909', async () => {
  await pag.click('.acc-palabra');
  await pag.waitForSelector('.cifra b');
  const n = await pag.textContent('.cifra b');
  console.log('     versículos encontrados:', n);
  if (!(Number(n) > 0)) throw new Error('sin resultados');
  await pag.waitForSelector('.distribucion .barra-d');
});
await pag.screenshot({ path: `${OUT}/02-palabra.png` });

await paso('nota con referencia y retroenlace', async () => {
  await pag.click('.pestanas-estudio [role="tab"]:has-text("Notas")');
  await pag.click('.tipo:has-text("Observación")');
  await pag.fill('textarea.campo', 'El amor de Dios se demuestra en Ro 5:8. #amor');
  await pag.click('button:has-text("Guardar nota")');
  await pag.waitForSelector('.texto [data-v="16"] .marca-nota');
  await pag.click('.nota-texto .ref-link:has-text("Ro 5:8")');
  await pag.waitForFunction(() => /^Romanos/.test(document.querySelector('.cap-titulo')?.textContent || ''));
  await pag.waitForSelector('.texto [data-v="8"] .marca-retro');
});

await paso('el subrayado aparece también en la RV1909', async () => {
  await ir(pag, 'juan 3');
  await menu(pag, 'versiones');
  await pag.selectOption('.lb-menu .lb-version:not(.lb-paralela) select', 'RV1909');
  await pag.keyboard.press('Escape');
  await pag.waitForFunction(() => /de tal manera amó/.test(document.querySelector('.texto [data-v="16"] .t')?.textContent || ''));
  const m = await pag.getAttribute('.texto [data-v="16"] .t', 'data-m');
  if (m !== 'rojo') throw new Error(m);
});
await pag.screenshot({ path: `${OUT}/03-juan3-rv1909.png` });

await paso('vista paralela RV1909 + KJV', async () => {
  await menu(pag, 'versiones');
  await pag.selectOption('.lb-paralela select', 'KJV');
  await pag.keyboard.press('Escape');
  await pag.waitForSelector('.texto.paralelo .fila .p2');
  // la versión en su botón y, al lado, el botón Comparar dice con cuál se compara
  if (!/RV1909/.test(await pag.textContent('.lb-versiones'))) throw new Error('el botón no muestra la versión');
  if (!/∥\s*KJV/.test(await pag.textContent('.lb-comparar'))) throw new Error('el botón Comparar no muestra la paralela');
  // las dos listas del menú vienen separadas por idioma
  await pag.click('.lb-comparar');
  if (await pag.evaluate(() => document.activeElement?.closest('.lb-paralela') === null)) throw new Error('Comparar no enfoca la lista');
  const grupos = await pag.$$eval('.lb-paralela select optgroup', (g) => g.map((x) => x.label));
  if (grupos.length !== 2) throw new Error('la lista de comparar no se divide por idioma: ' + grupos.join(' | '));
  await pag.keyboard.press('Escape');
  const t = await pag.textContent('.texto .fila:nth-child(16) .p2 .t').catch(() => '');
  const kjv = await pag.locator('.texto .p2[data-v="16"] .t').textContent();
  if (!/For God so loved/.test(kjv)) throw new Error(kjv);
});
await pag.screenshot({ path: `${OUT}/04-paralelo.png` });
await menu(pag, 'versiones');
await pag.selectOption('.lb-paralela select', '');
await pag.keyboard.press('Escape');

await paso('búsqueda «luz del mundo» frase exacta', async () => {
  await pag.click('.pestanas-estudio [role="tab"]:has-text("Buscar")');
  await pag.fill('.estudio input[type="search"]', 'luz del mundo');
  await pag.selectOption('.estudio select[aria-label="Modo"]', 'frase');
  await pag.waitForSelector('.estudio .resultados li');
  const h = await pag.textContent('.estudio .seccion h3');
  console.log('     ', h.trim());
});

await paso('referencias cruzadas de Jn 3:16', async () => {
  await pag.locator('.texto [data-v="16"] .num').click();
  await pag.click('.pestanas-estudio [role="tab"]:has-text("Refs")');
  await pag.waitForSelector('.estudio .resultados li');
  const n = await pag.locator('.estudio .resultados li').count();
  console.log('      referencias:', n);
});

await paso('comparar: las del idioma, de literal a paráfrasis, y luego todas', async () => {
  await pag.click('.pestanas-estudio [role="tab"]:has-text("Comparar")');
  const listas = (n) => pag.waitForFunction((n) => [...document.querySelectorAll('.comparar-item .ref-texto')].every((p) => p.textContent !== 'Cargando…') && document.querySelectorAll('.comparar-item').length === n, n);
  await listas(6);
  const tipos = await pag.locator('.comparar-item .comp-tipo').allTextContents();
  if (tipos[0] !== 'Formal' || tipos.at(-1) !== 'Sencilla') throw new Error(`orden: ${tipos.join(', ')}`);
  await pag.click('.comp-todas');
  await listas(17);
  const vacios = await pag.locator('.comparar-item .ref-texto:text-is("—")').count();
  if (vacios) throw new Error(`${vacios} versiones sin texto`);
  await pag.click('.comp-todas');
  await listas(6);
});
await pag.screenshot({ path: `${OUT}/05-comparar.png` });

await paso('memorizar y practicar', async () => {
  await pag.click('.acc-mas');
  await pag.click('.acc-botones button:has-text("Memorizar")');
  await pag.waitForSelector('.mem-tarjeta');
  await pag.click('.niveles button:has-text("Solo iniciales")');
  await pag.click('button:has-text("Lo recordé")');
});

await paso('cinta y sello AMEN', async () => {
  await pag.keyboard.press('Escape');
  await pag.click('.lector-barra .marcador');
  await pag.waitForSelector('.marcador.puesto');
  await pag.click('.sello');
  await pag.waitForSelector('.amen.hecho');
});
await pag.locator('.amen').scrollIntoViewIfNeeded();
await pag.screenshot({ path: `${OUT}/06-amen.png` });

await paso('progreso refleja el capítulo leído', async () => {
  await pag.click('.pestanas-estudio [role="tab"]:has-text("Progreso")');
  await pag.waitForSelector('.cob-celdas button.leido');
});

await paso('lámina en los ocho acabados', async () => {
  await pag.locator('.texto [data-v="16"] .num').click();
  await pag.click('.acc-botones button:has-text("Lámina")');
  await pag.waitForSelector('.estudio-lamina canvas', { timeout: 10000 });
  for (const e of ['Ultramar', 'Aura', 'Aerosol', 'Pedrería', 'Primario', 'Riso', 'Calor', 'Grabado']) {
    await pag.click(`.chips button:has-text("${e}")`);
    await pag.waitForTimeout(600);
    await pag.waitForSelector('.lamina-vista:not(.cargando)', { timeout: 10000 });
  }
  // Aerosol deja elegir la letra: «A mano» de entrada, y «De molde»
  await pag.click('.chips button:has-text("Aerosol")');
  await pag.waitForSelector('.chips button[aria-pressed="true"]:has-text("A mano")');
  await pag.click('.chips button:has-text("De molde")');
  await pag.waitForSelector('.chips button[aria-pressed="true"]:has-text("De molde")');
  await pag.waitForTimeout(600);
  await pag.waitForSelector('.lamina-vista:not(.cargando)', { timeout: 10000 });
  // Personalizar: un fondo nuevo pinta la lámina, marca el control y «Restablecer» vuelve a fábrica
  await pag.click('.chips button:has-text("Ultramar")');
  if (!(await pag.isDisabled('.lam-restablecer'))) throw new Error('Restablecer activo sin cambios');
  await pag.click('.lam-muestras >> nth=0 >> button[aria-label="#fdd0e0"]');
  await pag.waitForSelector('.lam-campo.cambiado');
  await pag.waitForTimeout(600);
  await pag.waitForSelector('.lamina-vista:not(.cargando)', { timeout: 10000 });
  const [r, g] = await pag.evaluate(() => [...document.querySelector('.estudio-lamina canvas').getContext('2d').getImageData(8, 8, 1, 1).data]);
  if (r < 235 || g < 190 || g > 225) throw new Error(`el fondo no cambió a rosa (${r}, ${g})`);
  await pag.click('.lam-restablecer');
  await pag.waitForSelector('.lam-campo.cambiado', { state: 'detached' });
  await pag.click('.chips button:has-text("Grabado")');
  // versículo largo en Grabado: se ve qué trozo va en grande y se puede elegir otro
  const trozos = await pag.locator('.lam-trozos button').count();
  if (trozos < 2) throw new Error('sin trozos para elegir');
  const otro = await pag.textContent('.lam-trozos button >> nth=1');
  await pag.click('.lam-trozos button >> nth=1');
  if ((await pag.inputValue('#lam-grande')) !== otro) throw new Error('el trozo elegido no pasó al texto grande');
  await pag.click('.chips button:has-text("Fondo de celular")');
  await pag.waitForTimeout(800);
  const [w, h] = await pag.evaluate(() => { const c = document.querySelector('.estudio-lamina canvas'); return [c.width, c.height]; });
  if (w !== 1179 || h !== 2556) throw new Error(`tamaño ${w}x${h}`);
});
await pag.screenshot({ path: `${OUT}/07-lamina.png` });
await pag.click('.dlg .dlg-cabeza .ico');

await paso('guardar en Mi archivo, filtrar y volver al pasaje desde una nota', async () => {
  // el versículo 16 sigue seleccionado desde la lámina; si no, se selecciona
  if (!(await pag.locator('.texto [data-v="16"].sel').count())) await pag.locator('.texto [data-v="16"] .num').click();
  await pag.click('.acc-guardar');
  await pag.waitForSelector('.acc-guardar[aria-pressed="true"]');
  await pag.keyboard.press('Escape');
  await pag.click('.cab-link:has-text("Mi archivo")');
  await pag.waitForSelector('.archivo-entrada');
  await pag.click('.filtro:has-text("Guardados")');
  const g = await pag.locator('.archivo-entrada .arc-meta').allTextContents();
  if (!g.some((x) => /Juan 3:16 \/ Guardado/.test(x)) || !g.some((x) => /Juan 3 \/ Cinta/.test(x))) throw new Error('guardados: ' + g.join(' | '));
  await pag.waitForFunction(() => [...document.querySelectorAll('.archivo-entrada .arc-verso')].some((e) => /de tal manera/.test(e.textContent)));
  await pag.click('.filtro:has-text("Notas")');
  const n = await pag.locator('.archivo-entrada .arc-nota').first().textContent();
  if (!/Ro 5:8/.test(n)) throw new Error('nota: ' + n);
  await pag.click('.archivo-entrada .arc-volver >> nth=0');
  await pag.waitForFunction(() => /^Juan\s*3/.test(document.querySelector('.cap-titulo')?.textContent || ''));
  await pag.waitForSelector('.pestanas-estudio [role="tab"][aria-selected="true"]:has-text("Notas")');
});
await pag.screenshot({ path: `${OUT}/13-archivo.png` });

await paso('clave de colores: significado, imagen y filtro en Mi archivo', async () => {
  if (!(await pag.locator('.texto [data-v="16"].sel').count())) await pag.locator('.texto [data-v="16"] .num').click();
  await pag.click('.acc-clave');
  await pag.waitForSelector('.clave-fila');
  await pag.fill('#clave-rojo', 'Jesús');
  await pag.press('#clave-rojo', 'Tab');
  const [descarga] = await Promise.all([pag.waitForEvent('download'), pag.click('button:has-text("Guardar mi clave como imagen")')]);
  if (!/clave/.test(descarga.suggestedFilename())) throw new Error('imagen: ' + descarga.suggestedFilename());
  await pag.click('.dlg-cabeza .ico');
  await pag.waitForFunction(() => document.querySelector('.acc-sentido')?.textContent === 'Jesús');
  const titulo = await pag.getAttribute('.colores [data-color="rojo"]', 'title');
  if (titulo !== 'Jesús') throw new Error('título del color: ' + titulo);
  await pag.keyboard.press('Escape');
  await pag.click('.cab-link:has-text("Mi archivo")');
  await pag.click('.filtro:has-text("Subrayados")');
  await pag.click('.filtro-color:has-text("Jesús")');
  const metas = await pag.locator('.archivo-entrada .arc-meta').allTextContents();
  if (!metas.length || !metas.every((x) => /Jesús/.test(x))) throw new Error('filtro por color: ' + metas.join(' | '));
  await pag.click('.archivo-entrada .arc-volver >> nth=0');
  await pag.waitForFunction(() => /^Juan\s*3/.test(document.querySelector('.cap-titulo')?.textContent || ''));
});

await paso('modo margen: notas y clave a la altura de su versículo; en pantalla angosta, debajo', async () => {
  await menu(pag, 'aa');
  await pag.click('.lb-margen');
  await pag.keyboard.press('Escape');
  await pag.waitForSelector('.pagina.con-margen .margen .m-nota');
  await pag.waitForFunction(() => {
    const v = document.querySelector('.texto .v[data-v="16"]').getBoundingClientRect().top;
    const n = document.querySelector('.margen .m-item.item-nota');
    return n && n.style.visibility !== 'hidden' && Math.abs(n.getBoundingClientRect().top - v) < 60;
  });
  const clave = await pag.locator('.margen .m-clave').first().textContent();
  if (!/Jesús/.test(clave)) throw new Error('clave en el margen: ' + clave);
  await pag.setViewportSize({ width: 980, height: 900 });
  await pag.waitForSelector('.texto .nota-linea');
  if (await pag.locator('.margen').count()) throw new Error('margen lateral en pantalla angosta');
  await pag.setViewportSize({ width: 1440, height: 900 });
  await pag.waitForSelector('.margen .m-nota');
});
await pag.screenshot({ path: `${OUT}/13b-margen.png` });
await menu(pag, 'aa');
await pag.click('.lb-margen');
await pag.keyboard.press('Escape');

await paso('ambiente: música grabada dentro de la app, sonidos, apagado al Amén y Spotify afuera', async () => {
  const pistasPedidas = [];
  pag.on('response', (r) => { if (/\/musica\/.+\.mp3$/.test(r.url()) && r.ok()) pistasPedidas.push(r.url().split('/').pop()); });
  await pag.evaluate(() => { window.__abiertos = []; window.open = (u) => { window.__abiertos.push(u); return null; }; });
  await ir(pag, 'sal 23');
  await pag.waitForFunction(() => /Salmos/.test(document.querySelector('.cap-titulo')?.textContent || ''));
  await pag.click('.lb-ambiente');
  await pag.waitForSelector('.amb-musica');
  if ((await pag.locator('.amb-musica').count()) !== 4) throw new Error('faltan músicas');
  // música grabada: elige la lista, suena una pista con su crédito, se puede pasar a la siguiente o elegir una
  await pag.click('.amb-musica:has-text("Piano")');
  await pag.waitForFunction(() => { const a = document.querySelector('.amb-pista'); return a && a.textContent.length > 3; }, null, { timeout: 20000 });
  const primera = await pag.textContent('.amb-pista');
  await pag.waitForFunction(() => window.__arrancando > 0, null, { timeout: 20000 }); // «Siguiente» mientras arranca
  await pag.click('.amb-pasos button:has-text("Siguiente")');
  await pag.waitForFunction((p) => document.querySelector('.amb-pista')?.textContent !== p, primera, { timeout: 20000 });
  await pag.click('.amb-musica:has-text("Himnos")');
  await pag.click('.amb-lista button:has-text("Sublime gracia")');
  await pag.waitForFunction(() => /Sublime gracia/.test(document.querySelector('.amb-pista')?.textContent || '') && /Infantería de Marina/.test(document.querySelector('.amb-autor')?.textContent || ''), null, { timeout: 20000 });
  if (!/Sublime gracia/.test(await pag.textContent('.amb-lista .actual'))) throw new Error('la lista no marca la pista que suena');
  // el título aparece al instante; el MP3 llega un poco después
  for (let k = 0; k < 40 && !pistasPedidas.includes('sublime-gracia.mp3'); k++) await pag.waitForTimeout(250);
  if (pistasPedidas.length < 3 || !pistasPedidas.includes('sublime-gracia.mp3')) throw new Error('no se pidieron los MP3: ' + pistasPedidas.join(', '));
  await pag.locator('input[data-capa="lluvia"]').evaluate((el) => { el.value = '0.6'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await pag.click('.amb-tiempos .filtro:has-text("Al terminar el capítulo")');
  // Spotify: un enlace inválido avisa; uno válido aparece como «Abrir mi playlist»; las búsquedas se abren afuera
  await pag.fill('.dlg input[placeholder^="https://open.spotify.com"]', 'hola');
  await pag.click('.dlg button:has-text("Guardar")');
  await pag.waitForSelector('text=Ese enlace no parece de Spotify.');
  await pag.fill('.dlg input[placeholder^="https://open.spotify.com"]', 'https://open.spotify.com/intl-es/playlist/37i9dQZF1DX0Yxoavh5qJV?si=abc');
  await pag.click('.dlg button:has-text("Guardar")');
  await pag.click('.amb-mia');
  await pag.click('.amb-busquedas button >> nth=0');
  const abiertos = await pag.evaluate(() => window.__abiertos);
  if (abiertos[0] !== 'https://open.spotify.com/playlist/37i9dQZF1DX0Yxoavh5qJV' || !/open\.spotify\.com\/search\/.+\/playlists/.test(abiertos[1])) throw new Error('spotify: ' + abiertos.join(' | '));
  await pag.screenshot({ path: `${OUT}/13c-ambiente.png` });
  await pag.click('.dlg-cabeza .ico');
  await pag.waitForSelector('.cab-ambiente');
  // con «al terminar el capítulo», el Amén apaga el ambiente
  if (await pag.locator('.amen.hecho').count()) await pag.click('.sello');
  await pag.click('.sello');
  await pag.waitForSelector('.cab-ambiente', { state: 'detached' });
  await pag.click('.lb-ambiente');
  await pag.click('.amb-tiempos .filtro:has-text("Nunca")');
  await pag.click('.amb-play');
  await pag.waitForSelector('.cab-ambiente');
  await pag.click('.dlg-cabeza .ico');
  await pag.click('.cab-ambiente');
  await pag.waitForSelector('.cab-ambiente', { state: 'detached' });  await ir(pag, 'juan 3');
  await pag.waitForFunction(() => /^Juan\s*3/.test(document.querySelector('.cap-titulo')?.textContent || ''));
});

await paso('voz narrada (Bible.is simulado): clave, Biblias en audio y lectura que sigue el texto', async () => {
  const pedidos = [];
  await pag.route('https://4.dbt.io/**', (r) => {
    const u = new URL(r.request().url());
    pedidos.push(u.pathname);
    const j = (d) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (u.searchParams.get('key') !== 'CLAVE-PRUEBA') return r.fulfill({ status: 401 });
    if (u.pathname.endsWith('/bibles')) return j({ data: u.searchParams.get('language_code') === 'spa' ? [{ abbr: 'SPNRVR', name: 'Reina Valera 1960', filesets: { 'dbp-prod': [{ id: 'SPNRVRO2DA', type: 'audio', size: 'OT' }, { id: 'SPNRVRN2DA', type: 'audio', size: 'NT' }] } }] : [], meta: { pagination: { last_page: 1 } } });
    if (u.pathname.includes('/bibles/filesets/')) return j({ data: [{ path: `${DIRECCION}musica/castillo-fuerte.mp3` }] });
    if (u.pathname.includes('/timestamps/')) return j({ data: Array.from({ length: 40 }, (_, i) => ({ verse_start: String(i + 1), timestamp: i * 1.5 })) });
    return r.fulfill({ status: 404 });
  });
  await ir(pag, 'juan 3');
  await pag.waitForFunction(() => /^Juan\s*3/.test(document.querySelector('.cap-titulo')?.textContent || ''));
  await pag.click('.cab-accion[title="Ajustes"]');
  await pag.click('.voz-motores .amb-musica:has-text("Narrada")');
  await pag.fill('input[placeholder*="Bible Brain"]', 'CLAVE-PRUEBA');
  await pag.click('button:has-text("Buscar Biblias en audio")');
  await pag.waitForSelector('#aj-audio-es option:has-text("Reina Valera 1960")', { state: 'attached' });
  await pag.keyboard.press('Escape');
  await pag.locator('.texto [data-v="16"] .num').click();
  await pag.click('.lb-voz');
  await pag.waitForFunction(() => Number(document.querySelector('.v.leyendo')?.dataset.v) >= 16, null, { timeout: 15000 });
  if (!pedidos.some((x) => x.endsWith('/SPNRVRN2DA/JHN/3'))) throw new Error('no pidió Juan 3 del Nuevo Testamento: ' + pedidos.join(' '));
  await pag.click('.lb-voz'); // pausa
  // vuelve a la voz del equipo para el resto de las pruebas
  await pag.click('.cab-accion[title="Ajustes"]');
  await pag.click('.voz-motores .amb-musica:has-text("Voz del equipo")');
  await pag.keyboard.press('Escape');
});

await paso('Historia: expediente, ¿facto o fake?, línea del tiempo y lado a lado desde el lector', async () => {
  await pag.click('.cab-link:has-text("Historia")');
  await pag.waitForSelector('.his-prueba');
  if ((await pag.locator('.his-prueba').count()) !== 24) throw new Error('faltan pruebas de Jesús');
  await pag.click('#prueba-tacito .his-fila');
  const cita = await pag.textContent('#prueba-tacito .his-cita');
  if (!/Poncio Pilato/.test(cita) || !(await pag.locator('#prueba-tacito .contraste').count())) throw new Error('ficha de Tácito: ' + cita);
  // imágenes: miniaturas en el índice y visor a pantalla completa con crédito
  const minis = await pag.locator('.his-mini img').count();
  if (minis < 20) throw new Error(`solo ${minis} miniaturas`);
  await pag.click('#prueba-tacito .his-fig-img >> nth=0');
  await pag.waitForSelector('dialog.visor[open] img');
  const credito = await pag.textContent('dialog.visor .visor-pie');
  if (!/Dominio público/.test(credito)) throw new Error('crédito: ' + credito);
  await pag.keyboard.press('Escape');
  await pag.waitForSelector('dialog.visor[open]', { state: 'detached' });
  await pag.click('.filtro:has-text("Juan el Bautista")');
  if ((await pag.locator('.his-prueba').count()) !== 7) throw new Error('faltan pruebas de Juan');
  // Hallazgos: las fichas que llegan sin actualizar la app (aquí, la copia que trae la app)
  await pag.click('.filtro:has-text("Hallazgos")');
  await pag.waitForSelector('#prueba-tel-dan');
  const hallazgos = await pag.locator('.his-prueba').count();
  if (hallazgos < 3 || !(await pag.locator('.his-nuevo').count())) throw new Error(`hallazgos: ${hallazgos}`);
  await pag.click('#prueba-tel-dan .his-fila');
  if (!/casa de David/.test(await pag.textContent('#prueba-tel-dan .his-cita'))) throw new Error('ficha de Tel Dan');
  if (await pag.locator('#prueba-tel-dan .his-nuevo').count()) throw new Error('el hallazgo abierto sigue como nuevo');
  // ¿Facto o fake?: una ronda completa (14 fijas + las de los hallazgos)
  await pag.click('.filtro:has-text("¿Facto o fake?")');
  const total = Number((await pag.textContent('.quiz-cabeza')).match(/\/\s*(\d+)/)[1]);
  if (total < 14 + hallazgos) throw new Error(`el quiz no suma las preguntas de los hallazgos: ${total}`);
  for (let i = 0; i < total; i++) {
    await pag.click('.quiz-op >> nth=0');
    await pag.waitForSelector('.quiz-veredicto');
    await pag.click('.quiz-acciones .boton:not(.secundario)');
  }
  const marcador = await pag.textContent('.quiz-marcador');
  if (!marcador.includes(`/${total}`)) throw new Error('marcador: ' + marcador);
  await pag.click('.filtro:has-text("Línea del tiempo")');
  if ((await pag.locator('.tl-lista li').count()) < 12) throw new Error('línea del tiempo corta');
  // de una prueba al pasaje
  await pag.click('.filtro:has-text("Jesús")');
  await pag.click('#prueba-pilato .his-fila');
  await pag.click('#prueba-pilato .his-ref:has-text("Lucas 3:1")');
  await pag.waitForFunction(() => /^Lucas\s*3/.test(document.querySelector('.cap-titulo')?.textContent || ''));
  await pag.waitForSelector('.texto [data-v="1"] .marca-historia');
  // en el lector: la marca abre la Biblia y Josefo lado a lado
  await ir(pag, 'mc 6:17');
  await pag.waitForSelector('.texto [data-v="17"] .marca-historia');
  await pag.click('.texto [data-v="17"] .marca-historia');
  await pag.waitForSelector('.ev .contraste');
  await pag.waitForFunction(() => /Herodes/.test(document.querySelector('.ev-texto')?.textContent || ''));
  await pag.screenshot({ path: `${OUT}/13d-historia.png` });
  await pag.click('.dlg-cabeza .ico');
  // se pueden ocultar las marcas
  await pag.click('.cab-accion[aria-label="Ajustes"]');
  await pag.click('#aj-historia');
  await pag.click('.dlg-cabeza .ico');
  if (await pag.locator('.marca-historia').count()) throw new Error('las marcas no se ocultan');
  await pag.click('.cab-accion[aria-label="Ajustes"]');
  await pag.click('#aj-historia');
  await pag.click('.dlg-cabeza .ico');
  await pag.waitForSelector('.texto [data-v="17"] .marca-historia');
  await ir(pag, 'juan 3');
  await pag.waitForFunction(() => /^Juan\s*3/.test(document.querySelector('.cap-titulo')?.textContent || ''));
});

await paso('Láminas: índice con vitrina → Color → volver al índice', async () => {
  await pag.click('.cab-link:has-text("Láminas")');
  await pag.waitForSelector('.coleccion');
  if ((await pag.locator('.coleccion').count()) !== 3) throw new Error('no hay tres colecciones');
  if (await pag.locator('.obra').count()) throw new Error('hay piezas sueltas antes de entrar');
  // la vitrina: una sola lámina a la vista; con el mouse sobre Color pasa a una pieza de Color
  await pag.waitForSelector('.vitrina img.ver', { timeout: 30000 });
  if ((await pag.locator('.vitrina img.ver').count()) !== 1) throw new Error('la vitrina no muestra una sola lámina');
  await pag.hover('.coleccion:has-text("Color")');
  await pag.waitForFunction(() => ['ultramar', 'riso-amarillo', 'riso-verde', 'calor'].includes(document.querySelector('.vitrina img.ver')?.dataset.id), null, { timeout: 30000 });
  await pag.screenshot({ path: `${OUT}/13e-laminas-vitrina.png` });
  await pag.click('.coleccion:has-text("Color")');
  await pag.waitForFunction(() => document.querySelectorAll('.obra img').length === 4, null, { timeout: 30000 });
  await pag.screenshot({ path: `${OUT}/14-laminas-color.png` });
  await pag.click('.coleccion-barra button');
  await pag.waitForSelector('.coleccion');
  if (await pag.locator('.obra').count()) throw new Error('el índice no quedó neutro');
  // ningún acabado del motor queda fuera de las colecciones (se lee el código, sirve también para la web compilada)
  const { COLECCIONES } = await import('../src/lib/colecciones.js');
  const fuente = readFileSync(new URL('../src/lib/laminas.js', import.meta.url), 'utf8');
  const ESTILOS = JSON.parse(fuente.match(/export const ESTILOS = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  const en = new Set(COLECCIONES.flatMap((c) => c.piezas.map((p) => p.estilo)));
  const fuera = ESTILOS.filter((e) => !en.has(e));
  if (fuera.length || ESTILOS.length !== 8) throw new Error('acabados sin colección: ' + fuera.join(', '));
});

await paso('modo Calma: solo el texto, Esc para salir', async () => {
  await pag.click('.cab-link:has-text("Leer")');
  await menu(pag, 'aa');
  await pag.click('.lb-calma');
  await pag.waitForSelector('.cabecera', { state: 'detached' });
  if (await pag.locator('.lector-barra').count()) throw new Error('la barra sigue en Calma');
  await pag.keyboard.press('Escape');
  await pag.waitForSelector('.cabecera');
});

await paso('los datos sobreviven a recargar, y la base bíblica no se vuelve a bajar', async () => {
  const bajadas = [];
  const contar = (r) => { if (/\/biblias\.db(\?|$)/.test(r.url())) bajadas.push(r.url()); };
  pag.on('request', contar);
  await pag.reload();
  await entrar(pag);
  pag.off('request', contar);
  // WebKit de Playwright corre en modo efímero (como la navegación privada de Safari): la copia «se guarda»
  // en memoria y desaparece al recargar. La app recién lo nota en ese primer recargo (2 bajadas), lo recuerda
  // y desde el siguiente baja la base una sola vez. En una sesión persistente de WebKit (Safari normal, o la
  // web en la pantalla de inicio) la copia sí queda: se comprobó aparte (1 bajada; al recargar y al reabrir
  // el navegador, 0).
  const efimero = (process.env.MOTOR || 'chromium') === 'webkit';
  if (bajadas.length > (efimero ? 2 : 0)) throw new Error('la base se bajó de más al recargar: ' + bajadas.join(' '));
  if (efimero) {
    bajadas.length = 0;
    pag.on('request', contar);
    await pag.reload();
    await entrar(pag);
    pag.off('request', contar);
    if (bajadas.length !== 1) throw new Error(`en modo privado, al recargar otra vez se bajó ${bajadas.length} veces (debía ser 1)`);
  }
  if (!efimero) {
    const guardadas = await pag.evaluate(async () => (await (await caches.open('chiro-biblias')).keys()).map((k) => k.url));
    if (guardadas.length !== 1 || !/biblias\.db\?v=[0-9a-f]{16}$/.test(guardadas[0])) throw new Error('copia guardada: ' + guardadas.join(' '));
  }
  const m = await pag.getAttribute('.texto [data-v="16"] .t', 'data-m');
  const notas = await pag.locator('.texto [data-v="16"] .marca-nota').count();
  if (m !== 'rojo' || !notas) throw new Error(`m=${m} notas=${notas}`);
  const guardados = await pag.textContent('.cab-guardados span');
  if (guardados !== '01') throw new Error(`guardados=${guardados}`);
});

await paso('interlineal griego de Jn 3:16 con glosas en español', async () => {
  await ir(pag, 'jn 3:16');
  await pag.waitForTimeout(800);
  await abrirEstudio(pag);
  await pag.click('.pestanas-estudio [role="tab"]:has-text("Original")');
  await pag.waitForSelector('.interlineal .palabra-orig');
  const n = await pag.locator('.interlineal .palabra-orig').count();
  const g = await pag.locator('.interlineal .palabra-orig:nth-child(3) .glosa').textContent();
  console.log('      palabras:', n, '· 3.ª glosa:', g);
  if (n < 20 || !/amó/.test(g)) throw new Error('interlineal incorrecto');
  await pag.click('.interlineal .palabra-orig:nth-child(3)');
  await pag.waitForSelector('.definicion');
  await pag.waitForSelector('.estudio .resultados li');
  const h = await pag.locator('.estudio .seccion h3').filter({ hasText: /Aparece/ }).textContent();
  const m = await pag.locator('.estudio .tarjeta .strong-def').first().textContent();
  console.log('      ', h.trim(), '·', m.trim());
});
await pag.screenshot({ path: `${OUT}/10-interlineal-griego.png` });

await paso('tocar otro versículo reemplaza la selección y el estudio lo sigue', async () => {
  await pag.locator('.texto [data-v="17"] .t').click({ position: { x: 40, y: 12 } });
  await pag.waitForFunction(() => /3:17/.test(document.querySelector('.ori-cabeza h3')?.textContent || ''));
  const sel = await pag.evaluate(() => [...document.querySelectorAll('.texto .v.sel')].map((e) => e.dataset.v).join(','));
  if (sel !== '17') throw new Error('selección: ' + sel);
  await pag.keyboard.down('Control');
  await pag.locator('.texto [data-v="18"] .num').click();
  await pag.keyboard.up('Control');
  const dos = await pag.evaluate(() => [...document.querySelectorAll('.texto .v.sel')].map((e) => e.dataset.v).join(','));
  if (dos !== '17,18') throw new Error('Ctrl + clic: ' + dos);
});

await paso('interlineal hebreo de Gn 1:1 (derecha a izquierda)', async () => {
  await ir(pag, 'gn 1:1');
  await pag.waitForSelector('.interlineal.hebreo .palabra-orig');
  const dir = await pag.getAttribute('.interlineal', 'dir');
  const w = await pag.locator('.interlineal .palabra-orig:first-child .orig').textContent();
  console.log('      dir:', dir, '· primera palabra:', w);
  await pag.click('.interlineal .palabra-orig:nth-child(2)');
  await pag.waitForSelector('.definicion');
});
await pag.screenshot({ path: `${OUT}/11-interlineal-hebreo.png` });

await paso('interfaz en inglés', async () => {
  await pag.click('.cab-accion[aria-label="Ajustes"]');
  await pag.selectOption('#aj-idioma', 'en');
  await pag.waitForSelector('.dlg-cabeza h2:has-text("Settings")');
  await pag.click('.dlg-cabeza .ico');
  await ir(pag, 'john 3:16');
  await pag.waitForFunction(() => /^John\s*3/.test(document.querySelector('.cap-titulo')?.textContent || ''));
  await abrirEstudio(pag);
  const tab = await pag.locator('.pestanas-estudio [role="tab"]').first().textContent();
  const nav = await pag.locator('.cab-link').nth(1).textContent();
  const sobre = await pag.textContent('.cap-sobre');
  if (tab !== 'Word' || nav !== 'Library' || !/New Testament/.test(sobre)) throw new Error(`${tab} / ${nav} / ${sobre}`);
});
await pag.screenshot({ path: `${OUT}/12-ingles.png` });
await pag.click('.cab-accion[aria-label="Settings"]');
await pag.selectOption('#aj-idioma', 'es');
await pag.click('.dlg-cabeza .ico');

await paso('versiones: espectro, descripciones y licencias', async () => {
  await pag.click('.cab-accion[aria-label="Ajustes"]');
  await pag.click('button:has-text("Versiones y clave de Tyndale")');
  await pag.waitForSelector('.espectro li');
  const tipos = await pag.locator('.espectro li').count();
  const filas = await pag.locator('.version-fila').count();
  const sinDesc = await pag.locator('.version-fila:not(:has(.vn-desc))').count();
  const literales = await pag.locator('.espectro li:first-child .esp-ids').textContent();
  if (tipos !== 6 || filas !== 17 || sinDesc || !/YLT/.test(literales)) throw new Error(`${tipos} tipos, ${filas} versiones, ${sinDesc} sin descripción, literales: ${literales}`);
  await pag.click('.version-fila:has-text("PDT ·") button');
  await pag.waitForFunction(() => /PDT/.test(document.querySelector('.cap-sobre')?.textContent || '')
    && /CC BY-SA/.test(document.querySelector('.licencia')?.textContent || '') && document.querySelectorAll('.pagina .v').length > 5);
  await menu(pag, 'versiones');
  await pag.selectOption('.lb-menu .lb-version:not(.lb-paralela) select', 'RV1909');
  await pag.keyboard.press('Escape');
});
await pag.screenshot({ path: `${OUT}/12b-versiones.png` });

await paso('lector oscuro y vuelta a claro', async () => {
  await menu(pag, 'aa');
  await pag.click('.lb-tema:has-text("Oscuro")');
  await pag.keyboard.press('Escape');
  await pag.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await pag.screenshot({ path: `${OUT}/08-oscuro.png` });
  await pag.click('.cab-link:has-text("Biblioteca")');
  await pag.waitForFunction(() => document.documentElement.dataset.theme === 'light'); // el resto de la app sigue claro
  await pag.click('.cab-link:has-text("Leer")');
  await menu(pag, 'aa');
  await pag.click('.lb-tema:has-text("Claro")');
  await pag.keyboard.press('Escape');
  await pag.waitForFunction(() => document.documentElement.dataset.theme === 'light');
});

await paso('portada: abrir otro libro muestra su portada, un toque la salta y queda el capítulo', async () => {
  await pag.click('.cab-link:has-text("Biblioteca")');
  await pag.click('.cubierta:has-text("Deuteronomio")');
  await pag.waitForSelector('.portada .pt-nota', { timeout: 5000 });
  const notas = await pag.$$eval('.pt-nota', (ns) => ns.map((n) => n.textContent));
  if (notas[0] !== 'Libro 05 de 66' || !/34 capítulos · 959 versículos/.test(notas[3])) throw new Error(notas.join(' | '));
  // el nombre largo entra entero a lo ancho, sin pisar las notas
  const { palabra, nota } = await pag.evaluate(() => ({
    palabra: document.querySelector('.pt-palabra i').getBoundingClientRect().right,
    nota: document.querySelector('.pt-nota').getBoundingClientRect().left,
  }));
  if (palabra > nota) throw new Error(`la palabra (${palabra}) pisa la nota (${nota})`);
  await pag.waitForTimeout(1500);
  await pag.screenshot({ path: `${OUT}/08b-portada.png` });
  await pag.click('.portada');
  await pag.waitForSelector('.portada', { state: 'detached', timeout: 3000 });
  if (!/Deuteronomio\s*1/.test(await titulo(pag))) throw new Error(await titulo(pag));
  if (await pag.$('.frontis')) throw new Error('el grabado antiguo sigue saliendo con las portadas activas');
  // saltar a un versículo puntual (búsqueda) no la muestra
  await ir(pag, 'Jn 3:16');
  if (await pag.$('.portada')) throw new Error('apareció al saltar a un versículo');
});

// Móvil
const movil = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const pm = await movil.newPage();
pm.on('pageerror', (e) => errores.push('movil pageerror: ' + e.message));
await pm.route('https://api.nlt.to/**', (route) => {
  const u = new URL(route.request().url());
  route.fulfill({ status: 200, contentType: 'text/html', body: falsaNLT(u.searchParams.get('ref'), u.searchParams.get('version')) });
});
await pm.goto(DIRECCION);
await pasarBienvenida(pm);
await pm.waitForSelector('.inicio-entrada'); // que termine de bajar la base antes de recargar (WebKit lo cuenta como error)
await paso('móvil (390 y 320 px): todas las pantallas sin desbordes horizontales', async () => {
  for (const ancho of [390, 320]) {
    await pm.setViewportSize({ width: ancho, height: 844 });
    await pm.goto(DIRECCION);
    await pm.waitForSelector('.inicio-entrada');
    const anchos = { inicio: await pm.evaluate(() => document.documentElement.scrollWidth) };
    for (const [n, nombre] of [[1, 'biblioteca'], [2, 'lector'], [3, 'archivo'], [4, 'laminas'], [5, 'historia']]) {
      if (nombre === 'biblioteca') await pm.click('.inicio-entrada >> nth=1');
      else await pm.click(`.nav-movil button >> nth=${n}`);
      await pm.waitForTimeout(700);
      anchos[nombre] = await pm.evaluate(() => Math.max(...[...document.querySelectorAll('.vista, .lector, html')].map((e) => e.scrollWidth)));
    }
    console.log(`      ${ancho}px:`, JSON.stringify(anchos));
    if (Object.values(anchos).some((w) => w > ancho)) throw new Error('desborde horizontal');
  }
  await pm.setViewportSize({ width: 390, height: 844 });
  await pm.click('.nav-movil button >> nth=2');
  await pm.waitForSelector('.texto .v', { timeout: 20000 });
});
await pm.screenshot({ path: `${OUT}/09-movil.png` });

// Candado: contraseña al abrir (solo guarda sal + hash), contraseña mala, buena, y quitarla en Ajustes
const ctxCandado = await navegador.newContext({ viewport: { width: 1280, height: 800 } });
const pc = await ctxCandado.newPage();
pc.on('pageerror', (e) => errores.push('candado pageerror: ' + e.message));
await pc.route('https://api.nlt.to/**', (route) => {
  const u = new URL(route.request().url());
  route.fulfill({ status: 200, contentType: 'text/html', body: falsaNLT(u.searchParams.get('ref'), u.searchParams.get('version')) });
});
await paso('candado: pide la contraseña al abrir, rechaza la mala, abre con la buena y se puede quitar', async () => {
  await pc.goto(DIRECCION);
  await pc.waitForSelector('.bienvenida', { timeout: 20000 });
  await pc.click('.puerta-saltar');
  await pc.fill('#bv-nombre', 'Ana');
  await pc.check('.puerta-casilla input');
  await pc.fill('#bv-clave', 'ab');
  await pc.press('#bv-clave', 'Enter');
  await pc.waitForSelector('.puerta-ayuda.error');
  await pc.fill('#bv-clave', 'cordero7');
  await pc.press('#bv-clave', 'Enter');
  await pc.click('.seteo-ahora-no', { timeout: 15000 });
  await pc.waitForSelector('.inicio .marca-grande', { timeout: 15000 });
  const guardado = await pc.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  if (guardado.includes('cordero7')) throw new Error('la contraseña quedó guardada en claro');
  await pc.reload();
  await pc.waitForSelector('.candado #cd-clave', { timeout: 20000 });
  if (!/Hola de nuevo, Ana\./.test(await pc.textContent('.puerta-hola'))) throw new Error('sin saludo en el candado');
  await pc.keyboard.press('Control+k');
  if (await pc.$('.buscador[open]')) throw new Error('Ctrl K abre el buscador con el candado puesto');
  await pc.fill('#cd-clave', 'otra');
  await pc.press('#cd-clave', 'Enter');
  await pc.waitForSelector('#cd-mal');
  if (await pc.$('.inicio')) throw new Error('entró con la contraseña mala');
  await pc.fill('#cd-clave', 'cordero7');
  await pc.press('#cd-clave', 'Enter');
  await pc.waitForSelector('.inicio .marca-grande', { timeout: 10000 });
  await pc.click('.inicio-entrada >> nth=1');
  await pc.click('.cab-ajustes, [aria-label="Ajustes"]');
  await pc.waitForSelector('#aj-candado');
  await pc.fill('#aj-candado', 'cordero7');
  await pc.press('#aj-candado', 'Enter');
  await pc.waitForFunction(() => document.querySelector('#aj-candado')?.placeholder === 'Nueva contraseña');
  await pc.reload();
  await pc.waitForSelector('.inicio .marca-grande', { timeout: 20000 });
  if (await pc.$('.candado')) throw new Error('el candado sigue después de quitarlo');
});
await ctxCandado.close();

// Seteo de la primera vez: las cinco respuestas cambian el Inicio, la versión, la letra, el tema y el estudio
const ctxSeteo = await navegador.newContext({ viewport: { width: 1360, height: 860 } });
const ps = await ctxSeteo.newPage();
ps.on('pageerror', (e) => errores.push('seteo pageerror: ' + e.message));
await ps.route('https://api.nlt.to/**', (route) => {
  const u = new URL(route.request().url());
  route.fulfill({ status: 200, contentType: 'text/html', body: falsaNLT(u.searchParams.get('ref'), u.searchParams.get('version')) });
});
await paso('seteo: cinco preguntas personalizan Inicio, versión, letra, tema y estudio', async () => {
  await ps.goto(DIRECCION);
  await ps.waitForSelector('.bienvenida', { timeout: 20000 });
  await ps.click('.puerta-saltar');
  await ps.fill('#bv-nombre', 'Lucas');
  await ps.press('#bv-nombre', 'Enter');
  await ps.waitForSelector('.seteo-opcion', { timeout: 15000 });
  if (!/Lucas/.test(await ps.textContent('.seteo-pregunta'))) throw new Error('la primera pregunta no usa el nombre');
  const elegir = async (o) => { await ps.click(`.seteo-opcion[data-opcion="${o}"]`); await ps.waitForTimeout(120); };
  await elegir('historia');
  await elegir('estudio');
  if (!(await ps.isChecked('.seteo-casilla input'))) throw new Error('quien estudia no recibe la paralela marcada');
  await elegir('RV1909');
  await ps.click('.puerta-olvido'); // atrás: la respuesta anterior sigue marcada
  if ((await ps.getAttribute('.seteo-opcion[data-opcion="RV1909"]', 'aria-pressed')) !== 'true') throw new Error('al volver se perdió la respuesta');
  await elegir('RV1909');
  await elegir('grande');
  await elegir('noche');
  await ps.waitForSelector('.seteo-resumen li');
  const resumen = await ps.locator('.seteo-resumen li').allTextContents();
  if (resumen.length < 5 || !resumen.some((l) => /Reina-Valera 1909, con la NTV/.test(l))) throw new Error('resumen: ' + resumen.join(' | '));
  await ps.click('.seteo-entrar');
  await ps.waitForSelector('.inicio .marca-grande', { timeout: 10000 });
  const orden = await ps.locator('.inicio-entrada').allTextContents();
  if (!/Historia/.test(orden[1])) throw new Error('Historia no quedó segunda: ' + orden.join(' | '));
  await ps.click('.inicio-entrada >> nth=0');
  await ps.waitForSelector('.texto .v', { timeout: 20000 });
  const estado = await ps.evaluate(() => {
    const r = document.documentElement;
    return { tema: r.dataset.theme, letra: getComputedStyle(r).getPropertyValue('--f-texto'), tam: r.style.getPropertyValue('--tam-texto'), estudio: !!document.querySelector('.marco.con-estudio') };
  });
  if (estado.tema !== 'dark' || !/Atkinson/.test(estado.letra) || estado.tam !== '23px' || !estado.estudio) throw new Error(JSON.stringify(estado));
});
await ctxSeteo.close();

await paso('sonidos zen: se cargan al tocar, abrir, cerrar, subrayar y guardar', async () => {
  const faltan = ['press', 'open', 'close', 'select', 'check', 'success'].filter((x) => sonidos.get(x) !== 200);
  const malos = [...sonidos].filter(([, st]) => st !== 200);
  if (faltan.length || malos.length) throw new Error('faltan: ' + faltan.join(',') + ' · con error: ' + malos.join(';'));
  console.log('     señales oídas:', [...sonidos.keys()].join(', '));
});
console.log('pedidos a la API NTV/NLT simulada:', pedidosNLT);
console.log(errores.length ? 'ERRORES:\n' + errores.join('\n') : 'Sin errores de consola.');
await navegador.close();
